import crypto from "node:crypto";
import * as XLSX from "xlsx";

export const VEHICLE_LIBRARY_BATCH_SIZE = 200;
export const DEFAULT_VEHICLE_LIBRARY_CDN_BASE_URL =
  "https://cdn.shopify.com/s/files/1/0012/8063/9049/files/";
export const VEHICLE_LIBRARY_CDN_BASE_URL = getVehicleLibraryCdnBaseUrl();

export const VEHICLE_LIBRARY_READ_CONVENTIONS = [
  "vehicle-selector-index-{version}.json",
  "vehicle-selector-year-{version}-{year}.json",
  "search-result-fitment-{version}-{year}-{group}.json",
  "pdp-fitment-year-index-{version}.json",
  "pdp-fitment-year-groups-{version}-{year}.json",
];

export const VEHICLE_LIBRARY_STATUSES = [
  "uploaded",
  "validating",
  "generated",
  "publishing",
  "verifying",
  "published",
  "failed",
];

export const REQUIRED_HEADERS = [
  "year",
  "group",
  "category",
  "make",
  "model",
  "trim",
  "body_style",
  "position",
  "note",
  "product_urls",
];

const GROUPS = [
  { slug: "led-bulbs", categories: ["LED Bulbs"] },
  { slug: "lighting-assemblies", categories: ["Lighting Assemblies"] },
  { slug: "accessories-kits", categories: ["Exterior Accessories", "Interior Accessories"] },
];

const CATEGORY_TO_GROUP = GROUPS.reduce((acc, group) => {
  group.categories.forEach((category) => {
    acc[normalizeToken(category)] = group.slug;
  });
  return acc;
}, {});

function normalizeToken(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeBaseUrl(value) {
  const baseUrl = String(value || "").trim();
  return baseUrl ? `${baseUrl.replace(/\/+$/, "")}/` : DEFAULT_VEHICLE_LIBRARY_CDN_BASE_URL;
}

function parseCdnBaseUrlMap() {
  const raw = process.env.VEHICLE_LIBRARY_CDN_BASE_URLS;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function getVehicleLibraryCdnBaseUrl(shop) {
  const shopKey = String(shop || "").trim().toLowerCase();
  const shopShortKey = shopKey.replace(/\.myshopify\.com$/, "");
  const baseUrlMap = parseCdnBaseUrlMap();
  return normalizeBaseUrl(
    baseUrlMap[shopKey] ||
      baseUrlMap[shopShortKey] ||
      process.env.VEHICLE_LIBRARY_CDN_BASE_URL ||
      DEFAULT_VEHICLE_LIBRARY_CDN_BASE_URL,
  );
}

export function buildVehicleLibraryReadConventions(version) {
  const artifactVersion = String(version || "{version}").trim() || "{version}";
  return VEHICLE_LIBRARY_READ_CONVENTIONS.map((pattern) =>
    pattern.replaceAll("{version}", artifactVersion),
  );
}

function normalizeBlank(value, fallback = "/") {
  const next = String(value ?? "").trim();
  return next || fallback;
}

function normalizeYearToken(year) {
  const normalized = String(year || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/\+/g, "_");
  if (normalized === "/" || normalized === "universal") {
    return "unlimited";
  }
  return normalized;
}

function normalizeLocationKey(value) {
  return String(value || "")
    .replace(/&/g, " and ")
    .replace(/back[-\s]*up reverse light/gi, "back up")
    .replace(/-\s*off[-\s]*road use/gi, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

function sortYears(years) {
  return years.slice().sort((left, right) => {
    if (left === "Universal") return 1;
    if (right === "Universal") return -1;
    return Number(right) - Number(left);
  });
}

function sortLabels(items) {
  return items.slice().sort((left, right) => left.localeCompare(right));
}

function toBuffer(input) {
  if (Buffer.isBuffer(input)) {
    return input;
  }
  return Buffer.from(input);
}

function stringifyJson(payload) {
  return JSON.stringify(payload);
}

function hashContent(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function createArtifact(type, fileName, payload) {
  const content = stringifyJson(payload);
  return {
    type,
    fileName,
    content,
    byteSize: Buffer.byteLength(content),
    checksum: hashContent(content),
  };
}

function normalizeHeader(header) {
  return String(header || "")
    .trim()
    .replace(/^\uFEFF/, "")
    .toLowerCase();
}

function readWorkbookRows(buffer, fileName) {
  const workbook = XLSX.read(toBuffer(buffer), { type: "buffer", cellDates: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("Excel 文件没有可读取的工作表");
  }
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    header: 1,
    defval: "",
    blankrows: false,
  });
  if (rows.length < 2) {
    throw new Error("Excel 至少需要表头和一行数据");
  }
  const headers = rows[0].map(normalizeHeader);
  return {
    fileName,
    sheetName,
    headers,
    rows: rows.slice(1),
  };
}

function buildHeaderIndex(headers) {
  return headers.reduce((acc, header, index) => {
    if (header && acc[header] == null) {
      acc[header] = index;
    }
    return acc;
  }, {});
}

function splitProductUrls(value) {
  return String(value || "")
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((url) => {
      if (/^https?:\/\//i.test(url)) {
        try {
          const parsed = new URL(url);
          return parsed.pathname + parsed.search;
        } catch {
          return url;
        }
      }
      return url;
    });
}

function normalizeGroupSlug(groupValue, categoryValue) {
  const rawGroup = String(groupValue || "").trim();
  const slug = rawGroup
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (GROUPS.some((group) => group.slug === slug)) {
    return slug;
  }
  return CATEGORY_TO_GROUP[normalizeToken(categoryValue)] || slug || "";
}

function normalizeRecord(row, headerIndex, rowNumber, sourceFileName, sourceSheet) {
  const value = (key) => row[headerIndex[key]] ?? "";
  const year = String(value("year")).trim();
  const category = String(value("category")).trim();
  const group = normalizeGroupSlug(value("group"), category);
  const make = String(value("make")).trim();
  const model = String(value("model")).trim();
  const trim = normalizeBlank(value("trim"));
  const bodyStyle = normalizeBlank(value("body_style"));
  const position = normalizeBlank(value("position"));
  const note = normalizeBlank(value("note"));
  const productUrls = splitProductUrls(value("product_urls"));
  const errors = [];

  if (!/^\d{4}$/.test(year) && year !== "Universal") {
    errors.push("year 必须是 4 位年份或 Universal");
  }
  if (!group || !GROUPS.some((item) => item.slug === group)) {
    errors.push("group 必须能映射到 led-bulbs / lighting-assemblies / accessories-kits");
  }
  if (!category) errors.push("category 不能为空");
  if (!make) errors.push("make 不能为空");
  if (!model) errors.push("model 不能为空");
  productUrls.forEach((url) => {
    if (!/^\/(collections|products)\//.test(url)) {
      errors.push(`product_urls 只支持 /collections/... 或 /products/...：${url}`);
    }
  });

  return {
    rowNumber,
    sourceFileName,
    sourceSheet,
    year,
    group,
    category,
    make,
    model,
    trim,
    bodyStyle,
    position,
    note,
    productUrls,
    key: [
      year,
      group,
      category,
      make,
      model,
      trim,
      bodyStyle,
      position,
      note,
    ]
      .map((part) => normalizeToken(part))
      .join("||"),
    errors,
  };
}

export function parseVehicleLibraryWorkbook(buffer, fileName = "vehicle-library.xlsx") {
  const workbookRows = readWorkbookRows(buffer, fileName);
  const headerIndex = buildHeaderIndex(workbookRows.headers);
  const missingHeaders = REQUIRED_HEADERS.filter((header) => headerIndex[header] == null);

  if (missingHeaders.length) {
    return {
      records: [],
      errors: missingHeaders.map((header) => ({
        rowNumber: 1,
        message: `缺少必填表头：${header}`,
      })),
      meta: workbookRows,
    };
  }

  const records = workbookRows.rows.map((row, index) =>
    normalizeRecord(row, headerIndex, index + 2, fileName, workbookRows.sheetName),
  );
  const errors = records.flatMap((record) =>
    record.errors.map((message) => ({
      rowNumber: record.rowNumber,
      message,
    })),
  );

  return {
    records,
    errors,
    meta: workbookRows,
  };
}

function setNestedUrlLeaf(root, record) {
  const trim = normalizeBlank(record.trim);
  const bodyStyle = normalizeBlank(record.bodyStyle);
  const position = normalizeBlank(record.position);
  const note = normalizeBlank(record.note);
  root[record.category] ||= {};
  root[record.category][record.make] ||= {};
  root[record.category][record.make][record.model] ||= {};
  root[record.category][record.make][record.model][trim] ||= {};
  root[record.category][record.make][record.model][trim][bodyStyle] ||= {};
  root[record.category][record.make][record.model][trim][bodyStyle][position] ||= {};
  root[record.category][record.make][record.model][trim][bodyStyle][position][note] = record.productUrls;
}

function buildSearchResultArtifacts(records, version) {
  const byYearGroup = new Map();
  const years = sortYears(Array.from(new Set(records.map((record) => record.year))));
  years.forEach((year) => {
    GROUPS.forEach((group) => {
      byYearGroup.set(`${year}::${group.slug}`, {
        version: 1,
        fitment_version: version,
        year,
        group: group.slug,
        categories: {},
      });
    });
  });
  records.forEach((record) => {
    const key = `${record.year}::${record.group}`;
    if (!byYearGroup.has(key)) {
      byYearGroup.set(key, {
        version: 1,
        fitment_version: version,
        year: record.year,
        group: record.group,
        categories: {},
      });
    }
    setNestedUrlLeaf(byYearGroup.get(key).categories, record);
  });

  return Array.from(byYearGroup.values())
    .sort((left, right) => {
      const yearCompare = Number(left.year) - Number(right.year);
      return yearCompare || left.group.localeCompare(right.group);
    })
    .map((payload) =>
      createArtifact(
        "search-result-shard",
        `search-result-fitment-${version}-${normalizeYearToken(payload.year)}-${payload.group}.json`,
        payload,
      ),
    );
}

function buildSelectorArtifacts(records, version) {
  const years = sortYears(Array.from(new Set(records.map((record) => record.year))));
  const makesByYearMap = new Map();
  const modelsByYearMake = new Map();

  records.forEach((record) => {
    makesByYearMap.set(record.year, makesByYearMap.get(record.year) || new Map());
    makesByYearMap.get(record.year).set(normalizeToken(record.make), record.make);

    const makeKey = `${record.year}||${normalizeToken(record.make)}`;
    modelsByYearMake.set(makeKey, modelsByYearMake.get(makeKey) || new Map());
    modelsByYearMake.get(makeKey).set(normalizeToken(record.model), record.model);
  });

  const makesByYear = {};
  const yearArtifacts = [];
  years.forEach((year) => {
    const makes = sortLabels(Array.from((makesByYearMap.get(year) || new Map()).values()));
    const models = {};
    makes.forEach((make) => {
      models[make] = sortLabels(
        Array.from((modelsByYearMake.get(`${year}||${normalizeToken(make)}`) || new Map()).values()),
      );
    });
    makesByYear[year] = makes;
    yearArtifacts.push(
      createArtifact("vehicle-selector-year", `vehicle-selector-year-${version}-${normalizeYearToken(year)}.json`, {
        version: 1,
        selector_version: version,
        generated_at: new Date().toISOString(),
        year,
        makes: models,
      }),
    );
  });

  const indexArtifact = createArtifact("vehicle-selector-index", `vehicle-selector-index-${version}.json`, {
    version: 1,
    selector_version: version,
    generated_at: new Date().toISOString(),
    years,
    makes_by_year: makesByYear,
  });

  return [indexArtifact, ...yearArtifacts];
}

function getSourceType(sourceUrl) {
  return sourceUrl.startsWith("/products/") ? "product" : "collection";
}

function extractProductHandle(sourceUrl) {
  const match = String(sourceUrl || "").match(/^\/products\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

function normalizeSourceHandleMap(sourceHandleMap, sourceUrls) {
  const normalized = new Map();
  sourceUrls.forEach((sourceUrl) => {
    const provided = sourceHandleMap instanceof Map ? sourceHandleMap.get(sourceUrl) : sourceHandleMap?.[sourceUrl];
    const handles = Array.isArray(provided?.handles) ? provided.handles.filter(Boolean) : [];
    const directHandle = extractProductHandle(sourceUrl);
    normalized.set(sourceUrl, {
      type: provided?.type || getSourceType(sourceUrl),
      handles: directHandle ? Array.from(new Set([directHandle, ...handles])) : Array.from(new Set(handles)),
      pages: Number(provided?.pages || 0),
      scanComplete: provided?.scanComplete !== false,
      error: provided?.error || null,
    });
  });
  return normalized;
}

function addCompactLocation(categoryPayload, record) {
  const locationLabel = normalizeBlank(record.position, "Universal");
  const locationKey = `dynamic::${normalizeToken(record.category)}::${normalizeLocationKey(locationLabel) || normalizeToken(locationLabel)}`;
  let group = categoryPayload.locationGroups.find((item) => item.locationKey === locationKey);
  if (!group) {
    group = {
      locationKey,
      locationLabel,
      sourceUrls: [],
    };
    categoryPayload.locationGroups.push(group);
  }
  record.productUrls.forEach((url) => {
    if (!group.sourceUrls.includes(url)) {
      group.sourceUrls.push(url);
    }
  });
}

function buildPdpCompactArtifacts(records, version, sourceHandleMap = new Map()) {
  const generatedAt = new Date().toISOString();
  const years = sortYears(Array.from(new Set(records.map((record) => record.year))));
  const sourceUrls = Array.from(new Set(records.flatMap((record) => record.productUrls))).sort();
  const normalizedSourceMap = normalizeSourceHandleMap(sourceHandleMap, sourceUrls);
  const handleSources = {};
  const sourceHandles = {};

  normalizedSourceMap.forEach((entry, sourceUrl) => {
    sourceHandles[sourceUrl] = {
      type: entry.type,
      handle_count: entry.handles.length,
      pages: entry.pages || (entry.handles.length ? 1 : 0),
      handles: entry.handles,
    };
    entry.handles.forEach((handle) => {
      handleSources[handle] ||= {
        source_count: 0,
        sourceUrls: [],
      };
      if (!handleSources[handle].sourceUrls.includes(sourceUrl)) {
        handleSources[handle].sourceUrls.push(sourceUrl);
        handleSources[handle].source_count = handleSources[handle].sourceUrls.length;
      }
    });
  });

  const yearGroupFiles = {};
  const yearArtifacts = years.map((year) => {
    const vehicles = {};
    records
      .filter((record) => record.year === year)
      .forEach((record) => {
        const vehicleKey = `${record.year}||${normalizeToken(record.make)}||${normalizeToken(record.model)}`;
        vehicles[vehicleKey] ||= {
          year: record.year,
          make: record.make,
          model: record.model,
          categories: {},
        };
        const categoryKey = `${record.group}::${normalizeToken(record.category)}`;
        vehicles[vehicleKey].categories[categoryKey] ||= {
          categorySlug: record.group,
          queryCategory: record.category,
          locationGroups: [],
        };
        addCompactLocation(vehicles[vehicleKey].categories[categoryKey], record);
      });

    const fileName = `pdp-fitment-year-groups-${version}-${normalizeYearToken(year)}.json`;
    yearGroupFiles[year] = fileName;
    return createArtifact("pdp-fitment-year-group", fileName, {
      version: 1,
      generated_at: generatedAt,
      artifact_version: version,
      year,
      vehicles,
    });
  });

  return [
    createArtifact("pdp-fitment-year-index", `pdp-fitment-year-index-${version}.json`, {
      version: 1,
      generated_at: generatedAt,
      artifact_version: version,
      output_mode: "compact",
      store_origin: "",
      source_handles_file: `pdp-fitment-source-handles-${version}.json`,
      handle_sources_file: `pdp-fitment-handle-sources-${version}.json`,
      year_group_files: yearGroupFiles,
      years,
    }),
    createArtifact("pdp-fitment-handle-sources", `pdp-fitment-handle-sources-${version}.json`, {
      version: 1,
      generated_at: generatedAt,
      artifact_version: version,
      store_origin: "",
      handles: handleSources,
    }),
    createArtifact("pdp-fitment-source-handles", `pdp-fitment-source-handles-${version}.json`, {
      version: 1,
      generated_at: generatedAt,
      artifact_version: version,
      store_origin: "",
      sources: sourceHandles,
    }),
    ...yearArtifacts,
  ];
}

export function mergeIncrementalRecords(baseRecords, replacementRecords) {
  const byKey = new Map();
  baseRecords.forEach((record) => byKey.set(record.key, { ...record, changeStatus: "base" }));
  replacementRecords.forEach((record) => {
    byKey.set(record.key, { ...record, changeStatus: byKey.has(record.key) ? "changed" : "new" });
  });
  return Array.from(byKey.values());
}

export function getAllSourceUrls(records) {
  return Array.from(new Set(records.flatMap((record) => record.productUrls))).sort();
}

export function generateVehicleLibraryArtifacts(records, { version, sourceHandleMap } = {}) {
  const artifactVersion = String(version || "").trim();
  if (!/^\d{6,}$/.test(artifactVersion)) {
    throw new Error("版本号必须是 6 位以上数字，例如 260509");
  }
  const usableRecords = records.filter((record) => !record.errors?.length);
  if (!usableRecords.length) {
    throw new Error("没有可生成的有效车型数据");
  }

  const artifacts = [
    ...buildPdpCompactArtifacts(usableRecords, artifactVersion, sourceHandleMap),
    ...buildSearchResultArtifacts(usableRecords, artifactVersion),
    ...buildSelectorArtifacts(usableRecords, artifactVersion),
  ].sort((left, right) => left.fileName.localeCompare(right.fileName, undefined, { numeric: true }));

  const byType = artifacts.reduce((acc, artifact) => {
    acc[artifact.type] = (acc[artifact.type] || 0) + 1;
    return acc;
  }, {});
  const totalBytes = artifacts.reduce((sum, artifact) => sum + artifact.byteSize, 0);
  const years = sortYears(Array.from(new Set(usableRecords.map((record) => record.year))));

  return {
    artifacts,
    summary: {
      version: artifactVersion,
      recordCount: usableRecords.length,
      yearCount: years.length,
      years,
      sourceUrlCount: getAllSourceUrls(usableRecords).length,
      artifactCount: artifacts.length,
      totalBytes,
      batchCount: Math.ceil(artifacts.length / VEHICLE_LIBRARY_BATCH_SIZE),
      artifactsByType: byType,
    },
  };
}

export function flattenSearchResultShard(payload) {
  const records = [];
  const year = String(payload?.year || "").trim();
  const group = String(payload?.group || "").trim();
  const categories = payload?.categories && typeof payload.categories === "object" ? payload.categories : {};

  Object.entries(categories).forEach(([category, makes]) => {
    Object.entries(makes || {}).forEach(([make, models]) => {
      Object.entries(models || {}).forEach(([model, trims]) => {
        Object.entries(trims || {}).forEach(([trim, bodies]) => {
          Object.entries(bodies || {}).forEach(([bodyStyle, positions]) => {
            Object.entries(positions || {}).forEach(([position, notes]) => {
              Object.entries(notes || {}).forEach(([note, urls]) => {
                const record = {
                  rowNumber: 0,
                  sourceFileName: "cdn",
                  sourceSheet: "cdn",
                  year,
                  group,
                  category,
                  make,
                  model,
                  trim,
                  bodyStyle,
                  position,
                  note,
                  productUrls: Array.isArray(urls) ? urls : [],
                  errors: [],
                };
                record.key = [
                  year,
                  group,
                  category,
                  make,
                  model,
                  trim,
                  bodyStyle,
                  position,
                  note,
                ]
                  .map((part) => normalizeToken(part))
                  .join("||");
                records.push(record);
              });
            });
          });
        });
      });
    });
  });
  return records;
}

export async function fetchCurrentSearchResultRecords({ version, shop, baseUrl, fetchImpl = fetch }) {
  if (!version) {
    throw new Error("增量模式需要当前车型库版本号");
  }
  const cdnBaseUrl = baseUrl || getVehicleLibraryCdnBaseUrl(shop);
  const indexUrl = new URL(`vehicle-selector-index-${version}.json`, cdnBaseUrl).toString();
  const indexResponse = await fetchImpl(indexUrl);
  if (!indexResponse.ok) {
    throw new Error(`无法读取当前车型库索引：${indexResponse.status} ${indexUrl}`);
  }
  const indexPayload = await indexResponse.json();
  const years = Array.isArray(indexPayload.years) ? indexPayload.years : [];
  const records = [];

  for (const year of years) {
    for (const group of GROUPS) {
      const url = new URL(
        `search-result-fitment-${version}-${normalizeYearToken(year)}-${group.slug}.json`,
        cdnBaseUrl,
      ).toString();
      const response = await fetchImpl(url);
      if (!response.ok) {
        throw new Error(`无法读取当前车型库分片：${response.status} ${url}`);
      }
      records.push(...flattenSearchResultShard(await response.json()));
    }
  }

  return records;
}

export function buildDefaultVehicleLibraryVersion(date = new Date()) {
  const year = String(date.getFullYear()).slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

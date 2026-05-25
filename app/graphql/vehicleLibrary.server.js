import { VEHICLE_LIBRARY_BATCH_SIZE, getVehicleLibraryCdnBaseUrl } from "../vehicle-library/artifacts.server";

const STAGED_UPLOADS_CREATE = `#graphql
mutation StagedUploadsCreate($input: [StagedUploadInput!]!) {
  stagedUploadsCreate(input: $input) {
    stagedTargets {
      url
      resourceUrl
      parameters {
        name
        value
      }
    }
    userErrors {
      field
      message
    }
  }
}
`;

const FILE_CREATE = `#graphql
mutation FileCreate($files: [FileCreateInput!]!) {
  fileCreate(files: $files) {
    files {
      id
      alt
      fileStatus
      ... on GenericFile {
        url
      }
    }
    userErrors {
      field
      message
    }
  }
}
`;

const POLL_FILE = `#graphql
query PollVehicleLibraryFile($query: String!) {
  files(first: 1, query: $query) {
    nodes {
      id
      fileStatus
      ... on GenericFile {
        url
      }
    }
  }
}
`;

const VEHICLE_DATE_METAOBJECT = `#graphql
query VehicleDateMetaobject {
  metaobjectByHandle(handle: { type: "vehicle_date", handle: "vehicle-date" }) {
    id
    handle
    vd: field(key: "vd") {
      value
    }
  }
}
`;

const UPDATE_VEHICLE_DATE = `#graphql
mutation UpdateVehicleDate($id: ID!, $version: String!) {
  metaobjectUpdate(id: $id, metaobject: { fields: [{ key: "vd", value: $version }] }) {
    metaobject {
      id
      handle
    }
    userErrors {
      field
      message
    }
  }
}
`;

const UPSERT_VEHICLE_DATE = `#graphql
mutation UpsertVehicleDate($version: String!) {
  metaobjectUpsert(handle: { type: "vehicle_date", handle: "vehicle-date" }, metaobject: { fields: [{ key: "vd", value: $version }] }) {
    metaobject {
      id
      handle
    }
    userErrors {
      field
      message
    }
  }
}
`;

const PRODUCT_BY_HANDLE = `#graphql
query ProductByHandleForVehicleLibrary($handle: String!) {
  productByIdentifier(identifier: { handle: $handle }) {
    id
    handle
  }
}
`;

const COLLECTION_PRODUCTS_BY_HANDLE = `#graphql
query CollectionProductsForVehicleLibrary($handle: String!, $cursor: String) {
  collectionByIdentifier(identifier: { handle: $handle }) {
    id
    handle
    products(first: 250, after: $cursor) {
      nodes {
        handle
        tags
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
}
`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function graphql(admin, query, variables = {}) {
  const response = await admin.graphql(query, { variables });
  const json = await response.json();
  if (json.errors?.length) {
    throw new Error(`GraphQL 错误: ${JSON.stringify(json.errors)}`);
  }
  return json.data;
}

function assertNoUserErrors(payload, label) {
  const errors = payload?.userErrors || [];
  if (errors.length) {
    throw new Error(`${label} userErrors: ${JSON.stringify(errors)}`);
  }
}

function parseSourceUrl(sourceUrl) {
  const cleanUrl = String(sourceUrl || "").trim();
  const productMatch = cleanUrl.match(/^\/products\/([^/?#]+)/);
  const collectionMatch = cleanUrl.match(/^\/collections\/([^/?#]+)(?:\/([^?#]+))?/);
  if (productMatch) {
    return {
      type: "product",
      handle: decodeURIComponent(productMatch[1]),
      tag: "",
    };
  }
  if (collectionMatch) {
    return {
      type: "collection",
      handle: decodeURIComponent(collectionMatch[1]),
      tag: collectionMatch[2] ? decodeURIComponent(collectionMatch[2]).toLowerCase() : "",
    };
  }
  return {
    type: "unknown",
    handle: "",
    tag: "",
  };
}

async function uploadStagedFile(target, artifact) {
  const form = new FormData();
  (target.parameters || []).forEach((parameter) => {
    form.append(parameter.name, parameter.value);
  });
  form.append("file", new Blob([artifact.content], { type: "application/json" }), artifact.fileName);
  const response = await fetch(target.url, {
    method: "POST",
    body: form,
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`staged upload failed for ${artifact.fileName}: ${response.status} ${text}`);
  }
}

async function createStagedTargets(admin, artifacts) {
  const data = await graphql(admin, STAGED_UPLOADS_CREATE, {
    input: artifacts.map((artifact) => ({
      resource: "FILE",
      filename: artifact.fileName,
      mimeType: "application/json",
      httpMethod: "POST",
    })),
  });
  const payload = data.stagedUploadsCreate;
  assertNoUserErrors(payload, "stagedUploadsCreate");
  return payload.stagedTargets || [];
}

async function createShopifyFiles(admin, artifacts, stagedTargets) {
  const data = await graphql(admin, FILE_CREATE, {
    files: artifacts.map((artifact, index) => ({
      originalSource: stagedTargets[index].resourceUrl,
      contentType: "FILE",
      filename: artifact.fileName,
      duplicateResolution: "REPLACE",
      alt: `AUXITO vehicle library ${artifact.fileName}`,
    })),
  });
  const payload = data.fileCreate;
  assertNoUserErrors(payload, "fileCreate");
  return payload.files || [];
}

async function pollFileReady(admin, file, fallbackFileName, { retries = 18, delayMs = 2000 } = {}) {
  let lastFile = file;
  for (let attempt = 0; attempt < retries; attempt += 1) {
    const query = file?.id ? `id:${file.id}` : `filename:${fallbackFileName}`;
    const data = await graphql(admin, POLL_FILE, { query });
    lastFile = data.files?.nodes?.[0] || lastFile;
    if (lastFile?.fileStatus === "READY" && lastFile?.url) {
      return lastFile;
    }
    if (lastFile?.fileStatus === "FAILED") {
      throw new Error(`Shopify file processing failed: ${fallbackFileName}`);
    }
    await sleep(delayMs);
  }
  throw new Error(`Shopify file did not become READY in time: ${fallbackFileName}`);
}

export async function getCurrentVehicleLibraryVersion(admin) {
  const data = await graphql(admin, VEHICLE_DATE_METAOBJECT);
  const node = data.metaobjectByHandle || null;
  return {
    id: node?.id || null,
    handle: node?.handle || null,
    version: String(node?.vd?.value || "").trim(),
  };
}

export async function updateVehicleLibraryVersion(admin, version) {
  const current = await getCurrentVehicleLibraryVersion(admin);
  const variables = { version: String(version) };
  if (current.id) {
    const data = await graphql(admin, UPDATE_VEHICLE_DATE, { id: current.id, ...variables });
    assertNoUserErrors(data.metaobjectUpdate, "metaobjectUpdate");
    return data.metaobjectUpdate.metaobject;
  }
  const data = await graphql(admin, UPSERT_VEHICLE_DATE, variables);
  assertNoUserErrors(data.metaobjectUpsert, "metaobjectUpsert");
  return data.metaobjectUpsert.metaobject;
}

export async function publishVehicleLibraryArtifacts(
  admin,
  artifacts,
  { batchSize = VEHICLE_LIBRARY_BATCH_SIZE, onBatch, fallbackCdnBaseUrl } = {},
) {
  const batches = chunk(artifacts, batchSize);
  const results = [];
  const cdnBaseUrl = fallbackCdnBaseUrl || getVehicleLibraryCdnBaseUrl();

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
    const batch = batches[batchIndex];
    const stagedTargets = await createStagedTargets(admin, batch);
    if (stagedTargets.length !== batch.length) {
      throw new Error(`stagedUploadsCreate returned ${stagedTargets.length} targets for ${batch.length} files`);
    }
    for (let index = 0; index < batch.length; index += 1) {
      await uploadStagedFile(stagedTargets[index], batch[index]);
    }
    const files = await createShopifyFiles(admin, batch, stagedTargets);
    for (let index = 0; index < batch.length; index += 1) {
      const readyFile = await pollFileReady(admin, files[index], batch[index].fileName);
      results.push({
        ...batch[index],
        shopifyFileId: readyFile.id,
        cdnUrl: readyFile.url || new URL(batch[index].fileName, cdnBaseUrl).toString(),
        status: "published",
      });
    }
    if (onBatch) {
      await onBatch({
        batchIndex,
        batchCount: batches.length,
        publishedCount: results.length,
      });
    }
  }

  return results;
}

export async function verifyPublishedArtifacts(
  artifacts,
  { sampleSize = 12, fetchImpl = fetch, fallbackCdnBaseUrl } = {},
) {
  const cdnBaseUrl = fallbackCdnBaseUrl || getVehicleLibraryCdnBaseUrl();
  const requiredTypes = new Set([
    "vehicle-selector-index",
    "pdp-fitment-year-index",
    "pdp-fitment-handle-sources",
    "pdp-fitment-source-handles",
  ]);
  const required = artifacts.filter((artifact) => requiredTypes.has(artifact.type));
  const sampled = artifacts.filter((artifact) => artifact.cdnUrl).slice(0, sampleSize);
  const checks = [...required, ...sampled].filter((artifact, index, all) => {
    const key = artifact.cdnUrl || artifact.fileName;
    return all.findIndex((item) => (item.cdnUrl || item.fileName) === key) === index;
  });

  for (const artifact of checks) {
    const url = artifact.cdnUrl || new URL(artifact.fileName, cdnBaseUrl).toString();
    const response = await fetchImpl(url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`CDN 校验失败：${response.status} ${url}`);
    }
    const payload = await response.json();
    const expectedVersion = artifact.fileName.match(/-(\d{6,})/)?.[1];
    const actualVersion =
      payload.fitment_version ||
      payload.selector_version ||
      payload.artifact_version ||
      payload.compactArtifactVersion;
    if (expectedVersion && actualVersion && String(actualVersion) !== expectedVersion) {
      throw new Error(`CDN JSON 版本不匹配：${artifact.fileName}`);
    }
  }
}

export async function buildSourceHandleMap(admin, sourceUrls, { maxPagesPerCollection = 20 } = {}) {
  const sourceMap = new Map();
  for (const sourceUrl of sourceUrls) {
    const parsed = parseSourceUrl(sourceUrl);
    if (parsed.type === "product") {
      const data = await graphql(admin, PRODUCT_BY_HANDLE, { handle: parsed.handle });
      sourceMap.set(sourceUrl, {
        type: "product",
        handles: data.productByIdentifier?.handle ? [data.productByIdentifier.handle] : [parsed.handle],
        pages: 1,
        scanComplete: true,
      });
      continue;
    }
    if (parsed.type === "collection") {
      const handles = [];
      let cursor = null;
      let pages = 0;
      let hasNextPage = true;
      while (hasNextPage && pages < maxPagesPerCollection) {
        const data = await graphql(admin, COLLECTION_PRODUCTS_BY_HANDLE, {
          handle: parsed.handle,
          cursor,
        });
        const connection = data.collectionByIdentifier?.products;
        const products = connection?.nodes || [];
        products.forEach((product) => {
          const tags = (product.tags || []).map((tag) => String(tag).toLowerCase());
          if (!parsed.tag || tags.includes(parsed.tag)) {
            handles.push(product.handle);
          }
        });
        hasNextPage = !!connection?.pageInfo?.hasNextPage;
        cursor = connection?.pageInfo?.endCursor || null;
        pages += 1;
      }
      sourceMap.set(sourceUrl, {
        type: "collection",
        handles: Array.from(new Set(handles)),
        pages,
        scanComplete: !hasNextPage,
      });
      continue;
    }
    sourceMap.set(sourceUrl, {
      type: "unknown",
      handles: [],
      pages: 0,
      scanComplete: false,
      error: "Unsupported source URL",
    });
  }
  return sourceMap;
}

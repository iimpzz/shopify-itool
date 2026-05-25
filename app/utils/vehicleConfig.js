export const VEHICLE_METAOBJECT_TYPE = "vehicle_static_config";
export const VEHICLE_METAOBJECT_HANDLE = "pages-vehicle-json";
export const VEHICLE_METAOBJECT_FIELD = "vehicle";

export const VEHICLE_DYNAMIC_CATEGORY_SLUGS = [
  "led-bulbs",
  "lighting-assemblies",
  "accessories-kits",
];

export function createDefaultVehicleConfig() {
  return {
    version: 1,
    location_assets: {},
    categories: [],
    location_card_assets: {},
    location_card_aliases: {},
    category_icons: {},
    category_fallback_asset_keys: {},
  };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanString(value) {
  if (value == null) {
    return "";
  }

  return String(value).trim();
}

function cleanOptionalString(value) {
  const cleaned = cleanString(value);
  return cleaned || undefined;
}

function cleanStringList(values) {
  const rawValues = Array.isArray(values)
    ? values
    : cleanString(values)
      ? String(values)
          .split(/\r?\n|,/)
          .map((item) => item.trim())
      : [];

  const seen = new Set();
  const result = [];

  for (const rawValue of rawValues) {
    const value = cleanString(rawValue);
    const dedupeKey = value.toLowerCase();

    if (!value || seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    result.push(value);
  }

  return result;
}

function normalizeCategoryCard(card) {
  if (!isPlainObject(card)) {
    return null;
  }

  const normalizedCard = { ...card };

  normalizedCard.id = cleanString(card.id);
  normalizedCard.title = cleanString(card.title);

  const image = cleanOptionalString(card.image);
  if (image) {
    normalizedCard.image = image;
  } else {
    delete normalizedCard.image;
  }

  const mobileImage = cleanOptionalString(card.mobile_image);
  if (mobileImage) {
    normalizedCard.mobile_image = mobileImage;
  } else {
    delete normalizedCard.mobile_image;
  }

  const url = cleanOptionalString(card.url);
  if (url) {
    normalizedCard.url = url;
  } else {
    delete normalizedCard.url;
  }

  return normalizedCard;
}

function normalizeCategory(category) {
  if (!isPlainObject(category)) {
    return null;
  }

  const normalizedCategory = { ...category };

  normalizedCategory.slug = cleanString(category.slug);
  normalizedCategory.title = cleanString(category.title);

  const subtitle = cleanOptionalString(category.subtitle);
  if (subtitle) {
    normalizedCategory.subtitle = subtitle;
  } else {
    delete normalizedCategory.subtitle;
  }

  const resultsUrl = cleanOptionalString(category.results_url);
  if (resultsUrl) {
    normalizedCategory.results_url = resultsUrl;
  } else {
    delete normalizedCategory.results_url;
  }

  const activeIcon = cleanOptionalString(category.active_icon);
  if (activeIcon) {
    normalizedCategory.active_icon = activeIcon;
  } else {
    delete normalizedCategory.active_icon;
  }

  const defaultIcon = cleanOptionalString(category.default_icon);
  if (defaultIcon) {
    normalizedCategory.default_icon = defaultIcon;
  } else {
    delete normalizedCategory.default_icon;
  }

  normalizedCategory.cards = Array.isArray(category.cards)
    ? category.cards.map(normalizeCategoryCard).filter(Boolean)
    : [];

  return normalizedCategory;
}

function normalizeLocationAssets(locationAssets) {
  if (!isPlainObject(locationAssets)) {
    return {};
  }

  const normalized = {};

  for (const [rawKey, rawValue] of Object.entries(locationAssets)) {
    const key = cleanString(rawKey);

    if (!key || !isPlainObject(rawValue)) {
      continue;
    }

    const entry = { ...rawValue };
    const desktop = cleanOptionalString(rawValue.desktop);
    const mobile = cleanOptionalString(rawValue.mobile);
    const aliases = cleanStringList(rawValue.aliases);

    if (desktop) {
      entry.desktop = desktop;
    } else {
      delete entry.desktop;
    }

    if (mobile) {
      entry.mobile = mobile;
    } else {
      delete entry.mobile;
    }

    if (aliases.length > 0) {
      entry.aliases = aliases;
    } else {
      delete entry.aliases;
    }

    normalized[key] = entry;
  }

  return normalized;
}

function normalizeLocationCardAssets(locationCardAssets) {
  if (!isPlainObject(locationCardAssets)) {
    return {};
  }

  const normalized = {};

  for (const [rawKey, rawValue] of Object.entries(locationCardAssets)) {
    const key = cleanString(rawKey);

    if (!key || !isPlainObject(rawValue)) {
      continue;
    }

    const entry = { ...rawValue };
    const image = cleanOptionalString(rawValue.image);
    const thumb = cleanOptionalString(rawValue.thumb);

    if (image) {
      entry.image = image;
    } else {
      delete entry.image;
    }

    if (thumb) {
      entry.thumb = thumb;
    } else {
      delete entry.thumb;
    }

    normalized[key] = entry;
  }

  return normalized;
}

function normalizeCategoryIcons(categoryIcons) {
  if (!isPlainObject(categoryIcons)) {
    return {};
  }

  const normalized = {};

  for (const [rawKey, rawValue] of Object.entries(categoryIcons)) {
    const key = cleanString(rawKey);

    if (!key || !isPlainObject(rawValue)) {
      continue;
    }

    const entry = { ...rawValue };
    const active = cleanOptionalString(rawValue.active);
    const defaultValue = cleanOptionalString(rawValue.default);

    if (active) {
      entry.active = active;
    } else {
      delete entry.active;
    }

    if (defaultValue) {
      entry.default = defaultValue;
    } else {
      delete entry.default;
    }

    normalized[key] = entry;
  }

  return normalized;
}

function normalizeStringMap(source) {
  if (!isPlainObject(source)) {
    return {};
  }

  const normalized = {};

  for (const [rawKey, rawValue] of Object.entries(source)) {
    const key = cleanString(rawKey);
    const value = cleanOptionalString(rawValue);

    if (!key || !value) {
      continue;
    }

    normalized[key] = value;
  }

  return normalized;
}

export function normalizeVehicleConfig(config) {
  const source = isPlainObject(config) ? config : {};
  const normalized = {
    ...createDefaultVehicleConfig(),
    ...source,
  };

  const versionValue = Number(source.version);
  normalized.version = Number.isFinite(versionValue) && versionValue > 0 ? versionValue : 1;
  normalized.categories = Array.isArray(source.categories)
    ? source.categories.map(normalizeCategory).filter(Boolean)
    : [];
  normalized.location_assets = normalizeLocationAssets(source.location_assets);
  normalized.location_card_assets = normalizeLocationCardAssets(source.location_card_assets);
  normalized.location_card_aliases = normalizeStringMap(source.location_card_aliases);
  normalized.category_icons = normalizeCategoryIcons(source.category_icons);
  normalized.category_fallback_asset_keys = normalizeStringMap(source.category_fallback_asset_keys);

  return normalized;
}

function isValidUrlLike(value) {
  const input = cleanString(value);

  if (!input) {
    return true;
  }

  if (
    input.startsWith("/") ||
    input.startsWith("./") ||
    input.startsWith("../") ||
    input.startsWith("//")
  ) {
    return true;
  }

  try {
    const url = new URL(input);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

function pushUrlError(errors, path, value, label = "URL") {
  if (value && !isValidUrlLike(value)) {
    errors.push(`${path} has an invalid ${label.toLowerCase()}: ${value}`);
  }
}

export function validateVehicleConfig(config) {
  const errors = [];
  const warnings = [];
  const normalized = normalizeVehicleConfig(config);
  const seenSlugs = new Set();

  if (!isPlainObject(config || normalized)) {
    errors.push("Vehicle config must be an object.");
  }

  normalized.categories.forEach((category, categoryIndex) => {
    const categoryPath = `categories[${categoryIndex}]`;

    if (!category.slug) {
      errors.push(`${categoryPath}.slug is required.`);
    } else {
      const dedupeKey = category.slug.toLowerCase();
      if (seenSlugs.has(dedupeKey)) {
        errors.push(`Duplicate category slug: ${category.slug}`);
      }
      seenSlugs.add(dedupeKey);
    }

    if (!category.title) {
      errors.push(`${categoryPath}.title is required.`);
    }

    pushUrlError(errors, `${categoryPath}.results_url`, category.results_url, "results URL");
    pushUrlError(errors, `${categoryPath}.active_icon`, category.active_icon);
    pushUrlError(errors, `${categoryPath}.default_icon`, category.default_icon);

    const seenCardIds = new Set();

    category.cards.forEach((card, cardIndex) => {
      const cardPath = `${categoryPath}.cards[${cardIndex}]`;

      if (!card.title) {
        errors.push(`${cardPath}.title is required.`);
      }

      if (card.id) {
        const dedupeKey = card.id.toLowerCase();
        if (seenCardIds.has(dedupeKey)) {
          errors.push(`Duplicate card id in category ${category.slug || category.title || categoryIndex}: ${card.id}`);
        }
        seenCardIds.add(dedupeKey);
      }

      pushUrlError(errors, `${cardPath}.image`, card.image);
      pushUrlError(errors, `${cardPath}.mobile_image`, card.mobile_image);
      pushUrlError(errors, `${cardPath}.url`, card.url, "card URL");
    });
  });

  Object.entries(normalized.location_assets).forEach(([key, asset]) => {
    pushUrlError(errors, `location_assets["${key}"].desktop`, asset.desktop);
    pushUrlError(errors, `location_assets["${key}"].mobile`, asset.mobile);
  });

  Object.entries(normalized.location_card_assets).forEach(([key, asset]) => {
    pushUrlError(errors, `location_card_assets["${key}"].image`, asset.image);
    pushUrlError(errors, `location_card_assets["${key}"].thumb`, asset.thumb);
  });

  Object.entries(normalized.category_icons).forEach(([slug, icons]) => {
    const match = normalized.categories.some(
      (category) => category.slug.toLowerCase() === slug.toLowerCase(),
    );

    if (!match) {
      warnings.push(`category_icons references an unknown category slug: ${slug}`);
    }

    pushUrlError(errors, `category_icons["${slug}"].active`, icons.active, "active icon URL");
    pushUrlError(errors, `category_icons["${slug}"].default`, icons.default, "default icon URL");
  });

  Object.entries(normalized.location_card_aliases).forEach(([alias, target]) => {
    if (!normalized.location_card_assets[target]) {
      errors.push(`location_card_aliases["${alias}"] points to missing asset key "${target}".`);
    }
  });

  Object.entries(normalized.category_fallback_asset_keys).forEach(([categoryTitle, target]) => {
    if (!normalized.location_card_assets[target]) {
      errors.push(`category_fallback_asset_keys["${categoryTitle}"] points to missing asset key "${target}".`);
    }
  });

  return { errors, warnings, normalized };
}

export function stringifyVehicleConfig(config) {
  return JSON.stringify(normalizeVehicleConfig(config), null, 2);
}

export function getVehicleConfigStats(config) {
  const normalized = normalizeVehicleConfig(config);

  return {
    categoryCount: normalized.categories.length,
    cardCount: normalized.categories.reduce(
      (total, category) => total + category.cards.length,
      0,
    ),
    locationAssetCount: Object.keys(normalized.location_assets).length,
    locationCardAssetCount: Object.keys(normalized.location_card_assets).length,
    locationCardAliasCount: Object.keys(normalized.location_card_aliases).length,
    categoryIconCount: Object.keys(normalized.category_icons).length,
    categoryFallbackCount: Object.keys(normalized.category_fallback_asset_keys).length,
  };
}

export function isDynamicVehicleCategory(slug) {
  return VEHICLE_DYNAMIC_CATEGORY_SLUGS.includes(cleanString(slug));
}

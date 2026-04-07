import "../tailwind.css";

import PropTypes from "prop-types";
import { SaveBar, useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useEffect, useId, useRef, useState } from "react";
import { useFetcher, useLoaderData } from "react-router";
import {
  VEHICLE_DYNAMIC_CATEGORY_SLUGS,
  VEHICLE_METAOBJECT_FIELD,
  VEHICLE_METAOBJECT_HANDLE,
  VEHICLE_METAOBJECT_TYPE,
  createDefaultVehicleConfig,
  getVehicleConfigStats,
  isDynamicVehicleCategory,
  stringifyVehicleConfig,
  validateVehicleConfig,
} from "../utils/vehicleConfig";

const inputClass =
  "w-full min-w-0 rounded-2xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm text-stone-900 shadow-sm transition placeholder:text-stone-400 focus:border-amber-500 focus:outline-none focus:ring-4 focus:ring-amber-500/15";
const textareaClass = `${inputClass} min-h-[124px] resize-y`;
const buttonClass =
  "inline-flex min-h-10 items-center justify-center rounded-2xl border border-stone-200 bg-white px-3.5 py-2 text-sm font-medium text-stone-700 shadow-sm transition hover:border-stone-300 hover:bg-stone-50 focus:outline-none focus:ring-4 focus:ring-amber-500/15 disabled:cursor-not-allowed disabled:opacity-45";
const primaryButtonClass =
  "inline-flex min-h-10 items-center justify-center rounded-2xl bg-stone-950 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-stone-800 focus:outline-none focus:ring-4 focus:ring-stone-900/15 disabled:cursor-not-allowed disabled:bg-stone-400";
const dangerButtonClass =
  "inline-flex min-h-10 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-sm font-medium text-rose-700 shadow-sm transition hover:bg-rose-100 focus:outline-none focus:ring-4 focus:ring-rose-500/15 disabled:cursor-not-allowed disabled:opacity-45";

function SurfaceCard({ title, subtitle, action, children, className }) {
  return (
    <section
      className={`min-w-0 overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-[0_22px_60px_-42px_rgba(41,37,36,0.35)] ${className}`}
    >
      {(title || subtitle || action) && (
        <div className="flex min-w-0 flex-col gap-3 border-b border-stone-200 px-5 py-5 md:px-6">
          <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              {title ? (
                <h2 className="text-lg font-semibold tracking-tight text-stone-950 md:text-xl">
                  {title}
                </h2>
              ) : null}
              {subtitle ? (
                <p className="mt-1 max-w-3xl text-sm leading-6 text-stone-600">
                  {subtitle}
                </p>
              ) : null}
            </div>
            {action ? <div className="flex shrink-0 flex-wrap gap-2">{action}</div> : null}
          </div>
        </div>
      )}
      <div className="min-w-0 px-5 py-5 md:px-6">{children}</div>
    </section>
  );
}

function TonePill({ tone, children }) {
  const toneClassMap = {
    stone: "border-stone-200 bg-stone-100 text-stone-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    teal: "border-teal-200 bg-teal-50 text-teal-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold tracking-[0.02em] ${toneClassMap[tone]}`}
    >
      {children}
    </span>
  );
}

function StatTile({ label, value, hint }) {
  return (
    <div className="min-w-0 rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
        {label}
      </p>
      <p className="vehicle-mono mt-2 text-3xl font-semibold text-stone-950">{value}</p>
      {hint ? <p className="mt-1 text-xs leading-5 text-stone-500">{hint}</p> : null}
    </div>
  );
}

function SectionSwitchButton({
  label,
  code,
  description,
  value,
  active,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-w-0 rounded-[20px] border px-4 py-3 text-left transition focus:outline-none focus:ring-4 focus:ring-amber-500/15 ${
        active
          ? "border-stone-900 bg-stone-950 text-white shadow-[0_18px_36px_-28px_rgba(28,25,23,0.48)]"
          : "border-stone-200 bg-white text-stone-900 shadow-sm hover:border-stone-300 hover:bg-stone-50"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold tracking-tight">{label}</p>
            <span
              className={`vehicle-mono rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] ${
                active ? "bg-white/10 text-stone-200" : "bg-stone-100 text-stone-500"
              }`}
            >
              {code}
            </span>
          </div>
          <p
            className={`mt-1 text-xs leading-5 ${
              active ? "text-stone-300" : "text-stone-600"
            }`}
          >
            {description}
          </p>
        </div>
        <span
          className={`vehicle-mono rounded-full px-3 py-1 text-xs font-semibold ${
            active ? "bg-white/10 text-white" : "bg-stone-100 text-stone-700"
          }`}
        >
          {value}
        </span>
      </div>
    </button>
  );
}

function EmptyState({ text, action }) {
  return (
    <div className="rounded-[24px] border border-dashed border-stone-300 bg-stone-50 px-5 py-8 text-center">
      <p className="text-sm leading-6 text-stone-600">{text}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

function NoticeCard({ title, tone, children }) {
  const toneClassMap = {
    stone: "border-stone-200 bg-stone-50 text-stone-700",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    teal: "border-teal-200 bg-teal-50 text-teal-800",
    rose: "border-rose-200 bg-rose-50 text-rose-800",
  };

  return (
    <div className={`rounded-[22px] border px-4 py-4 ${toneClassMap[tone]}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">{title}</p>
      <div className="mt-2 text-sm leading-6">{children}</div>
    </div>
  );
}

function CollapsiblePanel({
  title,
  subtitle,
  open,
  onToggle,
  children,
}) {
  return (
    <section className="min-w-0 overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-[0_22px_60px_-42px_rgba(41,37,36,0.35)]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full min-w-0 items-center justify-between gap-4 px-5 py-5 text-left transition hover:bg-stone-50 focus:outline-none focus:ring-4 focus:ring-amber-500/15 md:px-6"
      >
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight text-stone-950 md:text-xl">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-1 max-w-3xl text-sm leading-6 text-stone-600">
              {subtitle}
            </p>
          ) : null}
        </div>
        <span className="shrink-0 rounded-full border border-stone-200 bg-stone-100 px-3 py-1 text-xs font-medium text-stone-700">
          {open ? "收起" : "展开"}
        </span>
      </button>
      {open ? (
        <div className="border-t border-stone-200 px-5 py-5 md:px-6">{children}</div>
      ) : null}
    </section>
  );
}

function InputField({
  label,
  hint,
  value,
  onChange,
  placeholder,
  type,
  list,
}) {
  const fieldId = useId();

  return (
    <div className="min-w-0 space-y-2">
      <div>
        <label htmlFor={fieldId} className="block text-sm font-medium text-stone-800">
          {label}
        </label>
        {hint ? <p className="mt-1 text-xs leading-5 text-stone-500">{hint}</p> : null}
      </div>
      <input
        id={fieldId}
        type={type}
        list={list}
        className={inputClass}
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function TextAreaField({ label, hint, value, onChange, placeholder }) {
  const fieldId = useId();

  return (
    <div className="min-w-0 space-y-2">
      <div>
        <label htmlFor={fieldId} className="block text-sm font-medium text-stone-800">
          {label}
        </label>
        {hint ? <p className="mt-1 text-xs leading-5 text-stone-500">{hint}</p> : null}
      </div>
      <textarea
        id={fieldId}
        className={textareaClass}
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function MediaField({ label, hint, value, onChange, placeholder, aspect }) {
  const fieldId = useId();

  return (
    <div className="min-w-0 space-y-3">
      <div>
        <label htmlFor={fieldId} className="block text-sm font-medium text-stone-800">
          {label}
        </label>
        {hint ? <p className="mt-1 text-xs leading-5 text-stone-500">{hint}</p> : null}
      </div>
      <input
        id={fieldId}
        type="url"
        className={inputClass}
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
      <div
        className={`overflow-hidden rounded-[20px] border border-stone-200 bg-stone-100 ${aspect}`}
      >
        {value ? (
          <img
            src={value}
            alt={`${label}预览`}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center px-4 text-center text-xs leading-5 text-stone-500">
            填入图片 URL 后，会在这里显示预览。
          </div>
        )}
      </div>
    </div>
  );
}

function EntryNavigator({
  title,
  subtitle,
  items,
  activeValue,
  onSelect,
  addLabel,
  onAdd,
  emptyText,
}) {
  return (
    <div className="min-w-0 rounded-[24px] border border-stone-200 bg-stone-50 p-4">
      <div className="flex min-w-0 flex-col gap-3 border-b border-stone-200 pb-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-tight text-stone-950">{title}</p>
          {subtitle ? (
            <p className="mt-1 text-xs leading-5 text-stone-500">{subtitle}</p>
          ) : null}
        </div>
        {onAdd ? (
          <button type="button" className={buttonClass} onClick={onAdd}>
            {addLabel}
          </button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <div className="pt-4">
          <EmptyState text={emptyText} />
        </div>
      ) : (
        <div className="mt-4 max-h-[360px] space-y-2 overflow-y-auto pr-1">
          {items.map((item) => {
            const isActive = item.value === activeValue;
            const badgeTone =
              item.tone === "teal"
                ? "border-teal-200 bg-teal-50 text-teal-700"
                : item.tone === "amber"
                  ? "border-amber-200 bg-amber-50 text-amber-700"
                  : item.tone === "rose"
                    ? "border-rose-200 bg-rose-50 text-rose-700"
                    : "border-stone-200 bg-stone-100 text-stone-700";

            return (
              <button
                key={`${String(item.value)}-${item.label}`}
                type="button"
                onClick={() => onSelect(item.value)}
                className={`flex w-full min-w-0 items-start justify-between gap-3 rounded-[20px] border px-3.5 py-3 text-left transition focus:outline-none focus:ring-4 focus:ring-amber-500/15 ${
                  isActive
                    ? "border-stone-900 bg-stone-950 text-white"
                    : "border-stone-200 bg-white text-stone-900 hover:border-stone-300 hover:bg-stone-100"
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.label}</p>
                  {item.meta ? (
                    <p
                      className={`mt-1 truncate text-xs ${
                        isActive ? "text-stone-300" : "text-stone-500"
                      }`}
                    >
                      {item.meta}
                    </p>
                  ) : null}
                </div>
                {item.badge ? (
                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                      isActive ? "border-white/15 bg-white/10 text-white" : badgeTone
                    }`}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function createUniqueLabel(existingKeys, baseLabel) {
  const normalizedExisting = existingKeys.map((key) => String(key || "").toLowerCase());

  if (!normalizedExisting.includes(baseLabel.toLowerCase())) {
    return baseLabel;
  }

  let index = 2;
  let nextLabel = `${baseLabel} ${index}`;

  while (normalizedExisting.includes(nextLabel.toLowerCase())) {
    index += 1;
    nextLabel = `${baseLabel} ${index}`;
  }

  return nextLabel;
}

function createUniqueSlug(existingSlugs, baseSlug) {
  const normalizedExisting = existingSlugs.map((slug) => String(slug || "").toLowerCase());

  if (!normalizedExisting.includes(baseSlug.toLowerCase())) {
    return baseSlug;
  }

  let index = 2;
  let nextSlug = `${baseSlug}-${index}`;

  while (normalizedExisting.includes(nextSlug.toLowerCase())) {
    index += 1;
    nextSlug = `${baseSlug}-${index}`;
  }

  return nextSlug;
}

function clampIndex(index, length) {
  if (length <= 0) {
    return -1;
  }

  if (!Number.isInteger(index)) {
    return 0;
  }

  return Math.min(Math.max(index, 0), length - 1);
}

function swapItems(items, fromIndex, toIndex) {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length
  ) {
    return items;
  }

  const nextItems = [...items];
  const [movedItem] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, movedItem);
  return nextItems;
}

function getActiveKey(preferredKey, source) {
  const keys = Object.keys(source || {});

  if (preferredKey && keys.includes(preferredKey)) {
    return preferredKey;
  }

  return keys[0] || "";
}

function parseAliases(value) {
  return String(value || "")
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, items) => {
      return items.findIndex((candidate) => candidate.toLowerCase() === item.toLowerCase()) === index;
    });
}

function formatAliases(aliases) {
  return Array.isArray(aliases) ? aliases.join("\n") : "";
}

function formatDateTime(value) {
  if (!value) {
    return "尚未保存";
  }

  try {
    return new Date(value).toLocaleString("zh-CN", { hour12: false });
  } catch {
    return value;
  }
}

function formatValidationMessage(message) {
  if (message === "Vehicle config must be an object.") {
    return "根配置必须是一个对象。";
  }

  if (message.endsWith(" is required.")) {
    return `${message.replace(/ is required\.$/, "")} 为必填项。`;
  }

  if (message.startsWith("Duplicate category slug: ")) {
    return `分类 slug 重复：${message.replace("Duplicate category slug: ", "")}`;
  }

  if (message.startsWith("Duplicate card id in category ")) {
    return `分类中的卡片 ID 重复：${message.replace(
      "Duplicate card id in category ",
      "",
    )}`;
  }

  const invalidUrlMatch = message.match(/^(.*) has an invalid (.*): (.*)$/);
  if (invalidUrlMatch) {
    return `${invalidUrlMatch[1]} 的 ${invalidUrlMatch[2]} 无效：${invalidUrlMatch[3]}`;
  }

  const aliasMatch = message.match(
    /^location_card_aliases\["(.+)"\] points to missing asset key "(.+)"\.$/,
  );
  if (aliasMatch) {
    return `location_card_aliases["${aliasMatch[1]}"] 指向了不存在的资源 key "${aliasMatch[2]}"。`;
  }

  const fallbackMatch = message.match(
    /^category_fallback_asset_keys\["(.+)"\] points to missing asset key "(.+)"\.$/,
  );
  if (fallbackMatch) {
    return `category_fallback_asset_keys["${fallbackMatch[1]}"] 指向了不存在的资源 key "${fallbackMatch[2]}"。`;
  }

  if (message.startsWith("category_icons references an unknown category slug: ")) {
    return `category_icons 引用了不存在的分类 slug：${message.replace(
      "category_icons references an unknown category slug: ",
      "",
    )}`;
  }

  return message;
}

function formatJsonSize(json) {
  if (!json) {
    return "0 KB";
  }

  const sizeInKb = json.length / 1024;
  return `${sizeInKb >= 10 ? sizeInKb.toFixed(0) : sizeInKb.toFixed(1)} KB`;
}

function formatSlugLabel(slug) {
  return String(slug || "")
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function VehicleImagesEditor() {
  const loaderData = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();
  const initialConfig = loaderData?.config?.vehicleConfig ?? createDefaultVehicleConfig();
  const [vehicleConfig, setVehicleConfig] = useState(initialConfig);
  const [savedConfig, setSavedConfig] = useState(initialConfig);
  const [lastSavedAt, setLastSavedAt] = useState(loaderData?.config?.updatedAt ?? null);
  const [copiedJson, setCopiedJson] = useState(false);
  const [activeSection, setActiveSection] = useState("location_assets");
  const [selectedCategoryIndex, setSelectedCategoryIndex] = useState(0);
  const [selectedCardIndexes, setSelectedCardIndexes] = useState({});
  const [selectedLocationAssetKey, setSelectedLocationAssetKey] = useState("");
  const [selectedDynamicIconSlug, setSelectedDynamicIconSlug] = useState(
    VEHICLE_DYNAMIC_CATEGORY_SLUGS[0] || "",
  );
  const [advancedPanelOpen, setAdvancedPanelOpen] = useState(false);
  const [jsonPanelOpen, setJsonPanelOpen] = useState(false);
  const submittedJsonRef = useRef(stringifyVehicleConfig(initialConfig));
  const savedJsonRef = useRef(stringifyVehicleConfig(initialConfig));
  const vehicleConfigRef = useRef(initialConfig);

  useEffect(() => {
    savedJsonRef.current = stringifyVehicleConfig(savedConfig);
  }, [savedConfig]);

  useEffect(() => {
    vehicleConfigRef.current = vehicleConfig;
  }, [vehicleConfig]);

  useEffect(() => {
    if (!loaderData?.config?.vehicleConfig) {
      return;
    }

    const nextConfig = loaderData.config.vehicleConfig;
    const currentJson = stringifyVehicleConfig(vehicleConfigRef.current);

    if (currentJson === savedJsonRef.current) {
      setVehicleConfig(nextConfig);
    }

    setSavedConfig(nextConfig);
    setLastSavedAt(loaderData.config.updatedAt ?? null);
  }, [loaderData?.config?.updatedAt, loaderData?.config?.vehicleConfig]);

  useEffect(() => {
    if (!fetcher.data) {
      return;
    }

    if (fetcher.data.success) {
      try {
        const nextSavedConfig = JSON.parse(submittedJsonRef.current);
        setSavedConfig(nextSavedConfig);
      } catch {
        setSavedConfig(vehicleConfigRef.current);
      }

      setLastSavedAt(fetcher.data.updatedAt ?? new Date().toISOString());
      shopify.toast.show("vehicle11 页面配置已保存。");
      return;
    }

    if (fetcher.data.error) {
      shopify.toast.show(fetcher.data.error, { isError: true });
    }
  }, [fetcher.data, shopify]);

  const stats = getVehicleConfigStats(vehicleConfig);
  const validation = validateVehicleConfig(vehicleConfig);
  const currentJson = stringifyVehicleConfig(vehicleConfig);
  const savedJson = stringifyVehicleConfig(savedConfig);
  const hasUnsavedChanges = currentJson !== savedJson;
  const isSaving = fetcher.state !== "idle";
  const canSave = validation.errors.length === 0 && Boolean(loaderData?.config);
  const validationErrors = validation.errors.map(formatValidationMessage);
  const validationWarnings = validation.warnings.map(formatValidationMessage);
  const editableCategoryEntries = vehicleConfig.categories
    .map((category, index) => ({ category, index }))
    .filter(({ category }) => !isDynamicVehicleCategory(category.slug));
  const safeCategoryIndex = editableCategoryEntries.some(
    ({ index }) => index === selectedCategoryIndex,
  )
    ? selectedCategoryIndex
    : (editableCategoryEntries[0]?.index ?? -1);
  const activeCategory =
    safeCategoryIndex >= 0 ? vehicleConfig.categories[safeCategoryIndex] : null;
  const activeCardIndex = activeCategory
    ? clampIndex(
        selectedCardIndexes[safeCategoryIndex] ?? 0,
        activeCategory.cards.length,
      )
    : -1;
  const activeCard =
    activeCategory && activeCardIndex >= 0
      ? activeCategory.cards[activeCardIndex]
      : null;

  const activeLocationAssetKey = getActiveKey(
    selectedLocationAssetKey,
    vehicleConfig.location_assets,
  );
  const activeLocationAsset = activeLocationAssetKey
    ? vehicleConfig.location_assets[activeLocationAssetKey]
    : null;
  const staticCategoryCount = editableCategoryEntries.length;
  const staticCardCount = editableCategoryEntries.reduce(
    (total, entry) => total + entry.category.cards.length,
    0,
  );
  const activeDynamicIconSlug = VEHICLE_DYNAMIC_CATEGORY_SLUGS.includes(selectedDynamicIconSlug)
    ? selectedDynamicIconSlug
    : (VEHICLE_DYNAMIC_CATEGORY_SLUGS[0] ?? "");
  const activeDynamicIcon = activeDynamicIconSlug
    ? vehicleConfig.category_icons[activeDynamicIconSlug] || {}
    : {};

  const layeredSectionButtons = [
    {
      id: "location_assets",
      label: "字段图片",
      code: "location_assets",
      description: "字段名、别名、桌面图和移动图。",
      value: stats.locationAssetCount,
    },
    {
      id: "categories",
      label: "静态分类",
      code: "categories",
      description: "分类、卡片、链接和静态图片。",
      value: staticCategoryCount,
    },
  ];
  const pageStatusTone =
    validation.errors.length > 0 ? "rose" : hasUnsavedChanges ? "amber" : "teal";
  const pageStatusLabel =
    validation.errors.length > 0 ? "需先修复" : hasUnsavedChanges ? "待保存" : "已同步";
  const pageStatusMessage =
    validation.errors.length > 0
      ? `当前有 ${validation.errors.length} 个错误，修复后才能保存。`
      : hasUnsavedChanges
        ? "当前有未保存修改，确认后直接使用顶部 SaveBar 保存。"
        : "当前草稿已经和 Shopify 中的最新版本同步。";

  function setCardSelection(categoryIndex, cardIndex) {
    setSelectedCardIndexes((current) => ({
      ...current,
      [categoryIndex]: cardIndex,
    }));
  }

  function updateCategoryField(categoryIndex, field, value) {
    setVehicleConfig((current) => {
      const currentCategory = current.categories[categoryIndex];

      if (!currentCategory) {
        return current;
      }

      const nextCategories = current.categories.map((category, currentIndex) =>
        currentIndex === categoryIndex ? { ...category, [field]: value } : category,
      );

      if (field !== "slug") {
        return {
          ...current,
          categories: nextCategories,
        };
      }

      const previousSlug = String(currentCategory.slug || "").trim();
      const nextSlug = String(value || "").trim();

      if (!previousSlug || previousSlug === nextSlug || !current.category_icons[previousSlug]) {
        return {
          ...current,
          categories: nextCategories,
        };
      }

      const nextCategoryIcons = { ...current.category_icons };
      const movedIcons = nextCategoryIcons[previousSlug];
      delete nextCategoryIcons[previousSlug];

      if (nextSlug) {
        nextCategoryIcons[nextSlug] = {
          ...(nextCategoryIcons[nextSlug] || {}),
          ...movedIcons,
        };
      }

      return {
        ...current,
        categories: nextCategories,
        category_icons: nextCategoryIcons,
      };
    });
  }

  function updateStaticCategoryIcon(categoryIndex, field, value) {
    const categoryField = field === "active" ? "active_icon" : "default_icon";

    setVehicleConfig((current) => {
      const currentCategory = current.categories[categoryIndex];

      if (!currentCategory) {
        return current;
      }

      const nextCategories = current.categories.map((category, currentIndex) =>
        currentIndex === categoryIndex ? { ...category, [categoryField]: value } : category,
      );
      const slug = String(currentCategory.slug || "").trim();

      if (!slug) {
        return {
          ...current,
          categories: nextCategories,
        };
      }

      const nextCategoryIcons = { ...current.category_icons };
      const nextIconEntry = {
        ...(nextCategoryIcons[slug] || {}),
        [field]: value,
      };

      if (!nextIconEntry.active && !nextIconEntry.default) {
        delete nextCategoryIcons[slug];
      } else {
        nextCategoryIcons[slug] = nextIconEntry;
      }

      return {
        ...current,
        categories: nextCategories,
        category_icons: nextCategoryIcons,
      };
    });
  }

  function updateDynamicCategoryIcon(slug, field, value) {
    if (!slug) {
      return;
    }

    setVehicleConfig((current) => {
      const nextCategoryIcons = { ...current.category_icons };
      const nextIconEntry = {
        ...(nextCategoryIcons[slug] || {}),
        [field]: value,
      };

      if (!nextIconEntry.active && !nextIconEntry.default) {
        delete nextCategoryIcons[slug];
      } else {
        nextCategoryIcons[slug] = nextIconEntry;
      }

      return {
        ...current,
        category_icons: nextCategoryIcons,
      };
    });
  }

  function addCategory() {
    const nextIndex = vehicleConfig.categories.length;
    const nextSlug = createUniqueSlug(
      vehicleConfig.categories.map((category) => category.slug),
      "new-category",
    );

    setVehicleConfig((current) => ({
      ...current,
      categories: [
        ...current.categories,
        {
          slug: nextSlug,
          title: "新分类",
          subtitle: "",
          results_url: "",
          active_icon: "",
          default_icon: "",
          cards: [],
        },
      ],
    }));
    setActiveSection("categories");
    setSelectedCategoryIndex(nextIndex);
  }

  function deleteCategory(categoryIndex) {
    const category = vehicleConfig.categories[categoryIndex];

    if (!category) {
      return;
    }

    const confirmed = window.confirm(
      `确定删除分类“${category.title || category.slug || "未命名分类"}”吗？`,
    );

    if (!confirmed) {
      return;
    }

    setVehicleConfig((current) => ({
      ...current,
      categories: current.categories.filter(
        (_, currentIndex) => currentIndex !== categoryIndex,
      ),
    }));
    setSelectedCategoryIndex(Math.max(categoryIndex - 1, 0));
  }

  function moveCategory(categoryIndex, direction) {
    const nextIndex = categoryIndex + direction;

    setVehicleConfig((current) => ({
      ...current,
      categories: swapItems(current.categories, categoryIndex, nextIndex),
    }));
    setSelectedCategoryIndex(clampIndex(nextIndex, vehicleConfig.categories.length));
  }

  function updateCardField(categoryIndex, cardIndex, field, value) {
    setVehicleConfig((current) => ({
      ...current,
      categories: current.categories.map((category, currentCategoryIndex) => {
        if (currentCategoryIndex !== categoryIndex) {
          return category;
        }

        return {
          ...category,
          cards: category.cards.map((card, currentCardIndex) =>
            currentCardIndex === cardIndex ? { ...card, [field]: value } : card,
          ),
        };
      }),
    }));
  }

  function addCard(categoryIndex) {
    const category = vehicleConfig.categories[categoryIndex];

    if (!category) {
      return;
    }

    const nextCardIndex = category.cards.length;
    const nextCardId = createUniqueSlug(
      category.cards.map((card) => card.id),
      "new-card",
    );

    setVehicleConfig((current) => ({
      ...current,
      categories: current.categories.map((currentCategory, currentCategoryIndex) => {
        if (currentCategoryIndex !== categoryIndex) {
          return currentCategory;
        }

        return {
          ...currentCategory,
          cards: [
            ...currentCategory.cards,
            {
              id: nextCardId,
              title: "新卡片",
              url: "",
              image: "",
              mobile_image: "",
            },
          ],
        };
      }),
    }));
    setActiveSection("categories");
    setSelectedCategoryIndex(categoryIndex);
    setCardSelection(categoryIndex, nextCardIndex);
  }

  function deleteCard(categoryIndex, cardIndex) {
    const category = vehicleConfig.categories[categoryIndex];
    const card = category?.cards?.[cardIndex];

    if (!category || !card) {
      return;
    }

    const confirmed = window.confirm(
      `确定删除卡片“${card.title || card.id || "未命名卡片"}”吗？`,
    );

    if (!confirmed) {
      return;
    }

    setVehicleConfig((current) => ({
      ...current,
      categories: current.categories.map((currentCategory, currentCategoryIndex) => {
        if (currentCategoryIndex !== categoryIndex) {
          return currentCategory;
        }

        return {
          ...currentCategory,
          cards: currentCategory.cards.filter(
            (_, currentCardIndex) => currentCardIndex !== cardIndex,
          ),
        };
      }),
    }));
    setCardSelection(categoryIndex, Math.max(cardIndex - 1, 0));
  }

  function moveCard(categoryIndex, cardIndex, direction) {
    const category = vehicleConfig.categories[categoryIndex];

    if (!category) {
      return;
    }

    const nextIndex = cardIndex + direction;

    setVehicleConfig((current) => ({
      ...current,
      categories: current.categories.map((currentCategory, currentCategoryIndex) => {
        if (currentCategoryIndex !== categoryIndex) {
          return currentCategory;
        }

        return {
          ...currentCategory,
          cards: swapItems(currentCategory.cards, cardIndex, nextIndex),
        };
      }),
    }));
    setCardSelection(categoryIndex, clampIndex(nextIndex, category.cards.length));
  }

  function replaceSectionEntry(sectionKey, currentKey, nextKey, nextValue) {
    setVehicleConfig((current) => {
      const source = current[sectionKey] || {};
      const nextSection = {};
      let replaced = false;

      Object.entries(source).forEach(([entryKey, entryValue]) => {
        if (entryKey === currentKey && !replaced) {
          nextSection[nextKey] = nextValue;
          replaced = true;
          return;
        }

        if (entryKey === nextKey && currentKey !== nextKey) {
          return;
        }

        nextSection[entryKey] = entryValue;
      });

      if (!replaced) {
        nextSection[nextKey] = nextValue;
      }

      return {
        ...current,
        [sectionKey]: nextSection,
      };
    });
  }

  function deleteSectionEntry(sectionKey, keyToDelete) {
    setVehicleConfig((current) => {
      const nextSection = { ...(current[sectionKey] || {}) };
      delete nextSection[keyToDelete];

      return {
        ...current,
        [sectionKey]: nextSection,
      };
    });
  }

  function addLocationAsset() {
    const nextKey = createUniqueLabel(
      Object.keys(vehicleConfig.location_assets),
      "New Location",
    );

    setVehicleConfig((current) => ({
      ...current,
      location_assets: {
        ...current.location_assets,
        [nextKey]: { desktop: "", mobile: "", aliases: [] },
      },
    }));
    setActiveSection("location_assets");
    setSelectedLocationAssetKey(nextKey);
  }

  function handleSave() {
    if (!canSave || isSaving) {
      return;
    }

    const formData = new FormData();
    submittedJsonRef.current = currentJson;
    formData.append("intent", "save");
    formData.append("vehicleConfig", currentJson);
    fetcher.submit(formData, { method: "post" });
  }

  function handleDiscard() {
    setVehicleConfig(savedConfig);
  }

  async function handleCopyJson() {
    try {
      await navigator.clipboard.writeText(currentJson);
      setCopiedJson(true);
      shopify.toast.show("当前 JSON 已复制。");
      window.setTimeout(() => setCopiedJson(false), 1500);
    } catch {
      shopify.toast.show("复制失败，请检查浏览器剪贴板权限。", {
        isError: true,
      });
    }
  }

  const categoryNavItems = vehicleConfig.categories.map((category, index) => ({
    value: index,
    label: category.title || "未命名分类",
    meta: category.slug || "未设置 slug",
    badge: `${category.cards.length} 张卡片`,
    tone: isDynamicVehicleCategory(category.slug) ? "teal" : "stone",
  }));

  const cardNavItems = activeCategory
    ? activeCategory.cards.map((card, index) => ({
        value: index,
        label: card.title || "未命名卡片",
        meta: card.id || "未设置 ID",
        badge: card.url ? "有链接" : "无链接",
        tone: "amber",
      }))
    : [];

  const locationAssetNavItems = Object.entries(vehicleConfig.location_assets).map(
    ([entryKey, asset]) => ({
      value: entryKey,
      label: entryKey || "未命名规则",
      meta:
        asset.aliases?.length > 0
          ? `${asset.aliases.length} 个别名`
          : "未配置别名",
      badge: asset.desktop || asset.mobile ? "有图片" : "待补图",
      tone: "teal",
    }),
  );

  function renderCategoriesSection() {
    if (activeSection === "categories") {
      const visibleCategoryNavItems = categoryNavItems.filter(
        (item) => !isDynamicVehicleCategory(item.meta),
      );
      const categoryStatusTone =
        activeCategory && activeCategory.cards.length > 0 ? "teal" : "amber";

      return (
        <div className="space-y-5">
          <SurfaceCard
            title="静态分类"
            subtitle="这里只维护 vehicle11 的静态分类和静态卡片。static-vehicle__product-card 的数量来自 categories[*].cards[*]，所以这里支持新增、删除和排序。"
          >
            <div className="grid gap-4 md:grid-cols-3">
              <StatTile label="静态分类" value={staticCategoryCount} hint="categories (static)" />
              <StatTile label="静态卡片" value={staticCardCount} hint="categories[*].cards[*]" />
              <StatTile
                label="当前分类卡片"
                value={activeCategory ? activeCategory.cards.length : 0}
                hint="当前选中的分类"
              />
            </div>
          </SurfaceCard>

          <EntryNavigator
            title="步骤 1 选择分类"
            subtitle="先选静态分类，再逐层编辑分类信息和卡片。"
            items={visibleCategoryNavItems}
            activeValue={safeCategoryIndex}
            onSelect={setSelectedCategoryIndex}
            addLabel="新增分类"
            onAdd={addCategory}
            emptyText="还没有静态分类，先新增一个分类。"
          />

          <SurfaceCard
            title="步骤 2 分类基础信息"
            subtitle="主区只放分类本身的信息，结果页链接和分类图标放进高级设置。"
            action={
              activeCategory ? (
                <>
                  <button
                    type="button"
                    className={buttonClass}
                    onClick={() => moveCategory(safeCategoryIndex, -1)}
                    disabled={safeCategoryIndex <= 0}
                  >
                    上移
                  </button>
                  <button
                    type="button"
                    className={buttonClass}
                    onClick={() => moveCategory(safeCategoryIndex, 1)}
                    disabled={safeCategoryIndex >= vehicleConfig.categories.length - 1}
                  >
                    下移
                  </button>
                  <button
                    type="button"
                    className={dangerButtonClass}
                    onClick={() => deleteCategory(safeCategoryIndex)}
                  >
                    删除分类
                  </button>
                </>
              ) : null
            }
          >
            {activeCategory ? (
              <div className="space-y-5">
                <div className="flex flex-wrap gap-2">
                  <TonePill tone="stone">{activeCategory.slug || "未设置 slug"}</TonePill>
                  <TonePill tone={categoryStatusTone}>
                    {activeCategory.cards.length > 0 ? "已配置卡片" : "待补卡片"}
                  </TonePill>
                </div>
                {activeCategory.cards.length === 0 ? (
                  <NoticeCard title="当前提醒" tone="amber">
                    这个分类目前还没有卡片。前台的静态卡片数量来自
                    <span className="vehicle-mono"> categories[*].cards[*] </span>
                    ，所以后面需要至少新增一张卡片。
                  </NoticeCard>
                ) : null}
                <div className="grid min-w-0 gap-4 lg:grid-cols-3">
                  <InputField
                    label="分类 slug"
                    hint="categories[*].slug"
                    value={activeCategory.slug}
                    onChange={(value) => updateCategoryField(safeCategoryIndex, "slug", value)}
                    placeholder="jump-starter"
                  />
                  <InputField
                    label="分类标题"
                    hint="categories[*].title"
                    value={activeCategory.title}
                    onChange={(value) => updateCategoryField(safeCategoryIndex, "title", value)}
                    placeholder="Jump Starter"
                  />
                  <InputField
                    label="副标题"
                    hint="categories[*].subtitle"
                    value={activeCategory.subtitle}
                    onChange={(value) =>
                      updateCategoryField(safeCategoryIndex, "subtitle", value)
                    }
                    placeholder="Universal"
                  />
                </div>
              </div>
            ) : (
              <EmptyState
                text="还没有静态分类，先创建一个分类入口。"
                action={
                  <button type="button" className={primaryButtonClass} onClick={addCategory}>
                    新增分类
                  </button>
                }
              />
            )}
          </SurfaceCard>

          <SurfaceCard
            title="步骤 3 当前分类卡片"
            subtitle="这里直接对应前台的 static-vehicle__product-card，可增加、删除和排序。"
            action={
              activeCategory ? (
                <button
                  type="button"
                  className={primaryButtonClass}
                  onClick={() => addCard(safeCategoryIndex)}
                >
                  新增卡片
                </button>
              ) : null
            }
          >
            {activeCategory ? (
              <EntryNavigator
                title="卡片列表"
                subtitle="先选一张卡片，再编辑卡片详情。"
                items={cardNavItems}
                activeValue={activeCardIndex}
                onSelect={(value) => setCardSelection(safeCategoryIndex, value)}
                addLabel="新增卡片"
                onAdd={() => addCard(safeCategoryIndex)}
                emptyText="当前分类还没有卡片，先新增一张卡片。"
              />
            ) : (
              <EmptyState text="请先选择一个静态分类。" />
            )}
          </SurfaceCard>

          <SurfaceCard
            title="步骤 4 当前卡片详情"
            subtitle="新增卡片时建议先填 ID、标题和链接，再补桌面图与移动图。"
            action={
              activeCard ? (
                <>
                  <button
                    type="button"
                    className={buttonClass}
                    onClick={() => moveCard(safeCategoryIndex, activeCardIndex, -1)}
                    disabled={activeCardIndex <= 0}
                  >
                    上移
                  </button>
                  <button
                    type="button"
                    className={buttonClass}
                    onClick={() => moveCard(safeCategoryIndex, activeCardIndex, 1)}
                    disabled={activeCardIndex >= activeCategory.cards.length - 1}
                  >
                    下移
                  </button>
                  <button
                    type="button"
                    className={dangerButtonClass}
                    onClick={() => deleteCard(safeCategoryIndex, activeCardIndex)}
                  >
                    删除卡片
                  </button>
                </>
              ) : null
            }
          >
            {activeCard ? (
              <div className="space-y-5">
                <div className="flex flex-wrap gap-2">
                  <TonePill tone="amber">categories[*].cards[*]</TonePill>
                  <TonePill tone="stone">{activeCard.id || "未设置 ID"}</TonePill>
                </div>
                <div className="grid min-w-0 gap-4 lg:grid-cols-2">
                  <InputField
                    label="卡片 ID"
                    hint="categories[*].cards[*].id"
                    value={activeCard.id}
                    onChange={(value) =>
                      updateCardField(safeCategoryIndex, activeCardIndex, "id", value)
                    }
                    placeholder="jump-starter-aj01"
                  />
                  <InputField
                    label="卡片标题"
                    hint="categories[*].cards[*].title"
                    value={activeCard.title}
                    onChange={(value) =>
                      updateCardField(safeCategoryIndex, activeCardIndex, "title", value)
                    }
                    placeholder="Jump Starter AJ01"
                  />
                </div>
                <InputField
                  label="卡片链接"
                  hint="categories[*].cards[*].url"
                  type="url"
                  value={activeCard.url}
                  onChange={(value) =>
                    updateCardField(safeCategoryIndex, activeCardIndex, "url", value)
                  }
                  placeholder="/products/example-product"
                />
                <div className="grid min-w-0 gap-4 lg:grid-cols-2">
                  <MediaField
                    label="桌面图"
                    hint="categories[*].cards[*].image"
                    value={activeCard.image}
                    onChange={(value) =>
                      updateCardField(safeCategoryIndex, activeCardIndex, "image", value)
                    }
                    placeholder="https://cdn.example.com/card-desktop.jpg"
                    aspect="aspect-[16/10]"
                  />
                  <MediaField
                    label="移动图"
                    hint="categories[*].cards[*].mobile_image"
                    value={activeCard.mobile_image}
                    onChange={(value) =>
                      updateCardField(
                        safeCategoryIndex,
                        activeCardIndex,
                        "mobile_image",
                        value,
                      )
                    }
                    placeholder="https://cdn.example.com/card-mobile.jpg"
                    aspect="aspect-[4/5]"
                  />
                </div>
              </div>
            ) : (
              <EmptyState
                text="当前分类还没有可编辑的卡片，先新增一张卡片。"
                action={
                  activeCategory ? (
                    <button
                      type="button"
                      className={primaryButtonClass}
                      onClick={() => addCard(safeCategoryIndex)}
                    >
                      新增卡片
                    </button>
                  ) : null
                }
              />
            )}
          </SurfaceCard>

          {renderAdvancedSettingsSection()}
        </div>
      );
    }

    return (
      <SurfaceCard
        title="静态分类卡片"
        subtitle="这里只维护 categories。支持新增分类、增删卡片、上下排序，后面静态入口改动就直接改这段 JSON。"
      >
        <div className="grid min-w-0 gap-5 2xl:grid-cols-[320px_minmax(0,1fr)]">
          <EntryNavigator
            title="分类入口"
            subtitle="按分类逐个编辑，不再整页往下滑。"
            items={categoryNavItems}
            activeValue={safeCategoryIndex}
            onSelect={setSelectedCategoryIndex}
            addLabel="新增分类"
            onAdd={addCategory}
            emptyText="还没有静态分类，先新建一个分类。"
          />

          <div className="min-w-0 space-y-5">
            {activeCategory ? (
              <>
                <div className="rounded-[24px] border border-stone-200 bg-stone-50 p-5">
                  <div className="flex min-w-0 flex-col gap-4 border-b border-stone-200 pb-5">
                    <div className="flex min-w-0 flex-wrap gap-2">
                      <TonePill tone={isDynamicVehicleCategory(activeCategory.slug) ? "teal" : "stone"}>
                        {isDynamicVehicleCategory(activeCategory.slug)
                          ? "动态分类增强项"
                          : "静态分类"}
                      </TonePill>
                      <TonePill tone="amber">
                        {activeCategory.slug || "未设置 slug"}
                      </TonePill>
                      <TonePill tone="stone">{activeCategory.cards.length} 张卡片</TonePill>
                    </div>
                    <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <h3 className="text-2xl font-semibold tracking-tight text-stone-950">
                          {activeCategory.title || "未命名分类"}
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-stone-600">
                          静态分类不只是图片容器，它同时包含入口标题、副标题、跳转链接和卡片数据。
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <button
                          type="button"
                          className={buttonClass}
                          onClick={() => moveCategory(safeCategoryIndex, -1)}
                          disabled={safeCategoryIndex <= 0}
                        >
                          上移
                        </button>
                        <button
                          type="button"
                          className={buttonClass}
                          onClick={() => moveCategory(safeCategoryIndex, 1)}
                          disabled={safeCategoryIndex >= vehicleConfig.categories.length - 1}
                        >
                          下移
                        </button>
                        <button
                          type="button"
                          className={dangerButtonClass}
                          onClick={() => deleteCategory(safeCategoryIndex)}
                        >
                          删除分类
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 grid min-w-0 gap-4 lg:grid-cols-2">
                    <InputField
                      label="分类 slug"
                      hint="categories[*].slug"
                      value={activeCategory.slug}
                      onChange={(value) =>
                        updateCategoryField(safeCategoryIndex, "slug", value)
                      }
                      placeholder="led-bulbs"
                    />
                    <InputField
                      label="分类标题"
                      hint="categories[*].title"
                      value={activeCategory.title}
                      onChange={(value) =>
                        updateCategoryField(safeCategoryIndex, "title", value)
                      }
                      placeholder="LED Bulbs"
                    />
                    <InputField
                      label="副标题"
                      hint="categories[*].subtitle"
                      value={activeCategory.subtitle}
                      onChange={(value) =>
                        updateCategoryField(safeCategoryIndex, "subtitle", value)
                      }
                      placeholder="Universal"
                    />
                    <InputField
                      label="结果页 URL"
                      hint="categories[*].results_url"
                      type="url"
                      value={activeCategory.results_url}
                      onChange={(value) =>
                        updateCategoryField(safeCategoryIndex, "results_url", value)
                      }
                      placeholder="/collections/led-bulbs"
                    />
                  </div>

                  <div className="mt-5 grid min-w-0 gap-4 lg:grid-cols-2">
                    <MediaField
                      label="激活图标"
                      hint="categories[*].active_icon"
                      value={activeCategory.active_icon}
                      onChange={(value) =>
                        updateCategoryField(safeCategoryIndex, "active_icon", value)
                      }
                      placeholder="https://cdn.example.com/category-active.png"
                      aspect="aspect-square"
                    />
                    <MediaField
                      label="默认图标"
                      hint="categories[*].default_icon"
                      value={activeCategory.default_icon}
                      onChange={(value) =>
                        updateCategoryField(safeCategoryIndex, "default_icon", value)
                      }
                      placeholder="https://cdn.example.com/category-default.png"
                      aspect="aspect-square"
                    />
                  </div>
                </div>

                <NoticeCard title="旧主题读取说明" tone="amber">
                  旧主题会直接消费 <span className="vehicle-mono">categories[*]</span> 的
                  title、subtitle、results_url、cards 等字段。也就是说，这里维护的是
                  “静态入口结构”，不是单纯的图片表。
                </NoticeCard>

                <div className="space-y-5">
                  <EntryNavigator
                    title="分类卡片"
                    subtitle="只看当前分类下的卡片。"
                    items={cardNavItems}
                    activeValue={activeCardIndex}
                    onSelect={(value) => setCardSelection(safeCategoryIndex, value)}
                    addLabel="新增卡片"
                    onAdd={() => addCard(safeCategoryIndex)}
                    emptyText="当前分类还没有卡片。"
                  />

                  <div className="min-w-0">
                    {activeCard ? (
                      <div className="rounded-[24px] border border-stone-200 bg-white p-5">
                        <div className="flex min-w-0 flex-col gap-4 border-b border-stone-200 pb-5">
                          <div className="flex min-w-0 flex-wrap gap-2">
                            <TonePill tone="amber">categories[*].cards[*]</TonePill>
                            <TonePill tone="stone">
                              {activeCard.id || "未设置 ID"}
                            </TonePill>
                          </div>
                          <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0">
                              <h4 className="text-xl font-semibold tracking-tight text-stone-950">
                                {activeCard.title || "未命名卡片"}
                              </h4>
                              <p className="mt-2 text-sm leading-6 text-stone-600">
                                卡片既能维护静态入口图，也能给动态列表提供现成图片，优先级高于 fallback 资源。
                              </p>
                            </div>
                            <div className="flex shrink-0 flex-wrap gap-2">
                              <button
                                type="button"
                                className={buttonClass}
                                onClick={() => moveCard(safeCategoryIndex, activeCardIndex, -1)}
                                disabled={activeCardIndex <= 0}
                              >
                                上移
                              </button>
                              <button
                                type="button"
                                className={buttonClass}
                                onClick={() => moveCard(safeCategoryIndex, activeCardIndex, 1)}
                                disabled={activeCardIndex >= activeCategory.cards.length - 1}
                              >
                                下移
                              </button>
                              <button
                                type="button"
                                className={dangerButtonClass}
                                onClick={() => deleteCard(safeCategoryIndex, activeCardIndex)}
                              >
                                删除卡片
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="mt-5 grid min-w-0 gap-4 lg:grid-cols-2">
                          <InputField
                            label="卡片 ID"
                            hint="categories[*].cards[*].id"
                            value={activeCard.id}
                            onChange={(value) =>
                              updateCardField(safeCategoryIndex, activeCardIndex, "id", value)
                            }
                            placeholder="backup-lights"
                          />
                          <InputField
                            label="卡片标题"
                            hint="categories[*].cards[*].title"
                            value={activeCard.title}
                            onChange={(value) =>
                              updateCardField(
                                safeCategoryIndex,
                                activeCardIndex,
                                "title",
                                value,
                              )
                            }
                            placeholder="Backup Lights"
                          />
                        </div>

                        <div className="mt-4">
                          <InputField
                            label="卡片链接"
                            hint="categories[*].cards[*].url"
                            type="url"
                            value={activeCard.url}
                            onChange={(value) =>
                              updateCardField(safeCategoryIndex, activeCardIndex, "url", value)
                            }
                            placeholder="/collections/backup-lights"
                          />
                        </div>

                        <div className="mt-5 grid min-w-0 gap-4 lg:grid-cols-2">
                          <MediaField
                            label="桌面图"
                            hint="categories[*].cards[*].image"
                            value={activeCard.image}
                            onChange={(value) =>
                              updateCardField(
                                safeCategoryIndex,
                                activeCardIndex,
                                "image",
                                value,
                              )
                            }
                            placeholder="https://cdn.example.com/card-desktop.jpg"
                            aspect="aspect-[4/3]"
                          />
                          <MediaField
                            label="移动端图"
                            hint="categories[*].cards[*].mobile_image"
                            value={activeCard.mobile_image}
                            onChange={(value) =>
                              updateCardField(
                                safeCategoryIndex,
                                activeCardIndex,
                                "mobile_image",
                                value,
                              )
                            }
                            placeholder="https://cdn.example.com/card-mobile.jpg"
                            aspect="aspect-[4/5]"
                          />
                        </div>
                      </div>
                    ) : (
                      <EmptyState
                        text="当前分类还没有卡片，先新增一张卡片。"
                        action={
                          <button
                            type="button"
                            className={primaryButtonClass}
                            onClick={() => addCard(safeCategoryIndex)}
                          >
                            新增卡片
                          </button>
                        }
                      />
                    )}
                  </div>
                </div>
              </>
            ) : (
              <EmptyState
                text="还没有任何分类，先创建一个分类入口。"
                action={
                  <button
                    type="button"
                    className={primaryButtonClass}
                    onClick={addCategory}
                  >
                    新增分类
                  </button>
                }
              />
            )}
          </div>
        </div>
      </SurfaceCard>
    );
  }

  function renderLocationAssetsSection() {
    if (activeSection === "location_assets") {
      return (
        <div className="space-y-5">
          <SurfaceCard
            title="字段图片"
            subtitle="这里只维护 location_assets。字段名先匹配标准 key，再匹配 aliases，命中后直接取 desktop / mobile。"
          >
            <div className="grid gap-4 md:grid-cols-3">
              <StatTile label="规则数" value={stats.locationAssetCount} hint="location_assets" />
              <StatTile
                label="当前别名"
                value={activeLocationAsset?.aliases?.length || 0}
                hint="当前规则 alias 数量"
              />
              <StatTile
                label="当前状态"
                value={activeLocationAsset?.desktop || activeLocationAsset?.mobile ? "已配图" : "待补图"}
                hint={activeLocationAssetKey || "先选择一条规则"}
              />
            </div>
          </SurfaceCard>

          <EntryNavigator
            title="步骤 1 选择字段"
            subtitle="先选一个标准 key，再维护别名和图片。"
            items={locationAssetNavItems}
            activeValue={activeLocationAssetKey}
            onSelect={setSelectedLocationAssetKey}
            addLabel="新增字段"
            onAdd={addLocationAsset}
            emptyText="还没有字段图片规则，先新增一条。"
          />

          <SurfaceCard
            title="步骤 2 字段详情"
            subtitle="一条规则对应一个标准 key，其余同义词放在 aliases 里。"
            action={
              activeLocationAsset ? (
                <button
                  type="button"
                  className={dangerButtonClass}
                  onClick={() => deleteSectionEntry("location_assets", activeLocationAssetKey)}
                >
                  删除规则
                </button>
              ) : null
            }
          >
            {activeLocationAsset ? (
              <div className="space-y-5">
                <NoticeCard title="命中说明" tone="teal">
                  旧主题会先按标准名称命中，再拿 aliases 去做归一化。所以同一类字段尽量只保留一条标准规则，其余同义词都放到 aliases 里。
                </NoticeCard>
                <div className="grid min-w-0 gap-4 lg:grid-cols-2">
                  <InputField
                    label="标准 key"
                    hint='location_assets["key"]'
                    value={activeLocationAssetKey}
                    onChange={(value) => {
                      setSelectedLocationAssetKey(value);
                      replaceSectionEntry(
                        "location_assets",
                        activeLocationAssetKey,
                        value,
                        activeLocationAsset,
                      );
                    }}
                    placeholder="ash tray"
                  />
                  <TextAreaField
                    label="别名列表"
                    hint='location_assets["key"].aliases'
                    value={formatAliases(activeLocationAsset.aliases)}
                    onChange={(value) =>
                      replaceSectionEntry(
                        "location_assets",
                        activeLocationAssetKey,
                        activeLocationAssetKey,
                        {
                          ...activeLocationAsset,
                          aliases: parseAliases(value),
                        },
                      )
                    }
                    placeholder={"ash tray light\nash tray lights"}
                  />
                </div>
                <div className="grid min-w-0 gap-4 lg:grid-cols-2">
                  <MediaField
                    label="桌面图"
                    hint='location_assets["key"].desktop'
                    value={activeLocationAsset.desktop}
                    onChange={(value) =>
                      replaceSectionEntry(
                        "location_assets",
                        activeLocationAssetKey,
                        activeLocationAssetKey,
                        {
                          ...activeLocationAsset,
                          desktop: value,
                        },
                      )
                    }
                    placeholder="https://cdn.example.com/location-desktop.jpg"
                    aspect="aspect-[16/10]"
                  />
                  <MediaField
                    label="移动图"
                    hint='location_assets["key"].mobile'
                    value={activeLocationAsset.mobile}
                    onChange={(value) =>
                      replaceSectionEntry(
                        "location_assets",
                        activeLocationAssetKey,
                        activeLocationAssetKey,
                        {
                          ...activeLocationAsset,
                          mobile: value,
                        },
                      )
                    }
                    placeholder="https://cdn.example.com/location-mobile.jpg"
                    aspect="aspect-[4/5]"
                  />
                </div>
              </div>
            ) : (
              <EmptyState
                text="还没有可编辑的字段规则，先新增一条。"
                action={
                  <button type="button" className={primaryButtonClass} onClick={addLocationAsset}>
                    新增字段
                  </button>
                }
              />
            )}
          </SurfaceCard>
        </div>
      );
    }

    return (
      <SurfaceCard
        title="动态图片映射"
        subtitle="这里只维护 location_assets。字段名先匹配标准 key，再匹配 aliases，命中后直接取 desktop / mobile 图片。"
      >
        <div className="grid min-w-0 gap-5 2xl:grid-cols-[320px_minmax(0,1fr)]">
          <EntryNavigator
            title="主图规则"
            subtitle="每条规则对应一个标准 key。"
            items={locationAssetNavItems}
            activeValue={activeLocationAssetKey}
            onSelect={setSelectedLocationAssetKey}
            addLabel="新增主图规则"
            onAdd={addLocationAsset}
            emptyText="还没有动态主图规则。"
          />

          <div className="min-w-0 space-y-5">
            {activeLocationAsset ? (
              <>
                <NoticeCard title="命中说明" tone="teal">
                  旧主题会先按标准名称命中，再拿别名表去归一化。一个 location
                  最好只维护一条标准规则，其他同义词放进 aliases 里。
                </NoticeCard>

                <div className="rounded-[24px] border border-stone-200 bg-white p-5">
                  <div className="flex min-w-0 flex-col gap-3 border-b border-stone-200 pb-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-2">
                        <TonePill tone="teal">location_assets</TonePill>
                        <TonePill tone="stone">
                          {activeLocationAsset.aliases?.length || 0} 个别名
                        </TonePill>
                      </div>
                      <h3 className="mt-3 text-2xl font-semibold tracking-tight text-stone-950">
                        {activeLocationAssetKey || "未命名规则"}
                      </h3>
                    </div>
                    <button
                      type="button"
                      className={dangerButtonClass}
                      onClick={() => deleteSectionEntry("location_assets", activeLocationAssetKey)}
                    >
                      删除规则
                    </button>
                  </div>

                  <div className="mt-5 grid min-w-0 gap-4 lg:grid-cols-2">
                    <InputField
                      label="标准 key"
                      hint='location_assets["key"]'
                      value={activeLocationAssetKey}
                      onChange={(value) => {
                        setSelectedLocationAssetKey(value);
                        replaceSectionEntry(
                          "location_assets",
                          activeLocationAssetKey,
                          value,
                          activeLocationAsset,
                        );
                      }}
                      placeholder="Back Up"
                    />
                    <TextAreaField
                      label="别名列表"
                      hint='location_assets["key"].aliases'
                      value={formatAliases(activeLocationAsset.aliases)}
                      onChange={(value) =>
                        replaceSectionEntry(
                          "location_assets",
                          activeLocationAssetKey,
                          activeLocationAssetKey,
                          {
                            ...activeLocationAsset,
                            aliases: parseAliases(value),
                          },
                        )
                      }
                      placeholder={"Backup Lights\nBack-Up Reverse Light"}
                    />
                  </div>

                  <div className="mt-5 grid min-w-0 gap-4 lg:grid-cols-2">
                    <MediaField
                      label="桌面主图"
                      hint='location_assets["key"].desktop'
                      value={activeLocationAsset.desktop}
                      onChange={(value) =>
                        replaceSectionEntry(
                          "location_assets",
                          activeLocationAssetKey,
                          activeLocationAssetKey,
                          {
                            ...activeLocationAsset,
                            desktop: value,
                          },
                        )
                      }
                      placeholder="https://cdn.example.com/location-desktop.jpg"
                      aspect="aspect-[16/10]"
                    />
                    <MediaField
                      label="移动端主图"
                      hint='location_assets["key"].mobile'
                      value={activeLocationAsset.mobile}
                      onChange={(value) =>
                        replaceSectionEntry(
                          "location_assets",
                          activeLocationAssetKey,
                          activeLocationAssetKey,
                          {
                            ...activeLocationAsset,
                            mobile: value,
                          },
                        )
                      }
                      placeholder="https://cdn.example.com/location-mobile.jpg"
                      aspect="aspect-[4/5]"
                    />
                  </div>
                </div>
              </>
            ) : (
              <EmptyState
                text="还没有主图规则，先新增一条。"
                action={
                  <button
                    type="button"
                    className={primaryButtonClass}
                    onClick={addLocationAsset}
                  >
                    新增主图规则
                  </button>
                }
              />
            )}
          </div>
        </div>
      </SurfaceCard>
    );
  }



  function renderAdvancedSettingsSection() {
    return (
      <CollapsiblePanel
        title="高级设置"
        subtitle="把低频但真实影响前台的字段收在这里，避免主编辑区过重。"
        open={advancedPanelOpen}
        onToggle={() => setAdvancedPanelOpen((current) => !current)}
      >
        <div className="space-y-5">
          <div className="rounded-[24px] border border-stone-200 bg-stone-50 p-5">
            <div className="flex min-w-0 flex-col gap-3 border-b border-stone-200 pb-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold tracking-tight text-stone-950">
                  当前分类高级设置
                </p>
                <p className="mt-1 text-xs leading-5 text-stone-500">
                  这里只放结果页链接和分类图标，避免主区被低频字段打断。
                </p>
              </div>
              {activeCategory ? (
                <TonePill tone="stone">{activeCategory.slug || "未设置 slug"}</TonePill>
              ) : null}
            </div>

            <div className="mt-4">
              {activeCategory ? (
                <div className="space-y-4">
                  <InputField
                    label="结果页 URL"
                    hint="categories[*].results_url"
                    type="url"
                    value={activeCategory.results_url}
                    onChange={(value) =>
                      updateCategoryField(safeCategoryIndex, "results_url", value)
                    }
                    placeholder="/collections/jump-starter"
                  />
                  <div className="grid min-w-0 gap-4 lg:grid-cols-2">
                    <MediaField
                      label="激活图标"
                      hint="同步到 categories[*].active_icon 和 category_icons[slug].active"
                      value={activeCategory.active_icon}
                      onChange={(value) =>
                        updateStaticCategoryIcon(safeCategoryIndex, "active", value)
                      }
                      placeholder="https://cdn.example.com/category-active.png"
                      aspect="aspect-square"
                    />
                    <MediaField
                      label="默认图标"
                      hint="同步到 categories[*].default_icon 和 category_icons[slug].default"
                      value={activeCategory.default_icon}
                      onChange={(value) =>
                        updateStaticCategoryIcon(safeCategoryIndex, "default", value)
                      }
                      placeholder="https://cdn.example.com/category-default.png"
                      aspect="aspect-square"
                    />
                  </div>
                </div>
              ) : (
                <EmptyState text="请先选择一个静态分类，再编辑结果页链接和分类图标。" />
              )}
            </div>
          </div>

          <div className="rounded-[24px] border border-stone-200 bg-stone-50 p-5">
            <div className="flex min-w-0 flex-col gap-3 border-b border-stone-200 pb-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold tracking-tight text-stone-950">
                  动态分类图标
                </p>
                <p className="mt-1 text-xs leading-5 text-stone-500">
                  动态分类不走 cards，这里只维护导航图标映射。
                </p>
              </div>
              <TonePill tone="teal">{VEHICLE_DYNAMIC_CATEGORY_SLUGS.length} 个 slug</TonePill>
            </div>

            <div className="mt-4 grid min-w-0 gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
              <div className="space-y-2">
                {VEHICLE_DYNAMIC_CATEGORY_SLUGS.map((slug) => {
                  const isActive = slug === activeDynamicIconSlug;
                  const iconEntry = vehicleConfig.category_icons[slug] || {};
                  const hasIcon = Boolean(iconEntry.active || iconEntry.default);

                  return (
                    <button
                      key={slug}
                      type="button"
                      onClick={() => setSelectedDynamicIconSlug(slug)}
                      className={`flex w-full min-w-0 items-center justify-between gap-3 rounded-[18px] border px-3.5 py-3 text-left transition focus:outline-none focus:ring-4 focus:ring-amber-500/15 ${
                        isActive
                          ? "border-stone-900 bg-stone-950 text-white"
                          : "border-stone-200 bg-white text-stone-900 hover:border-stone-300 hover:bg-stone-100"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {formatSlugLabel(slug)}
                        </p>
                        <p className={`mt-1 text-xs ${isActive ? "text-stone-300" : "text-stone-500"}`}>
                          {slug}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          isActive
                            ? "bg-white/10 text-white"
                            : hasIcon
                              ? "bg-teal-50 text-teal-700"
                              : "bg-stone-100 text-stone-600"
                        }`}
                      >
                        {hasIcon ? "已配置" : "默认"}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="grid min-w-0 gap-4 lg:grid-cols-2">
                <MediaField
                  label="激活图标"
                  hint={`category_icons["${activeDynamicIconSlug}"].active`}
                  value={activeDynamicIcon.active}
                  onChange={(value) =>
                    updateDynamicCategoryIcon(activeDynamicIconSlug, "active", value)
                  }
                  placeholder="https://cdn.example.com/dynamic-active.png"
                  aspect="aspect-square"
                />
                <MediaField
                  label="默认图标"
                  hint={`category_icons["${activeDynamicIconSlug}"].default`}
                  value={activeDynamicIcon.default}
                  onChange={(value) =>
                    updateDynamicCategoryIcon(activeDynamicIconSlug, "default", value)
                  }
                  placeholder="https://cdn.example.com/dynamic-default.png"
                  aspect="aspect-square"
                />
              </div>
            </div>
          </div>
        </div>
      </CollapsiblePanel>
    );
  }

  function renderJsonSection() {
    if (currentJson) {
      return (
        <CollapsiblePanel
          title="校验与 JSON"
          subtitle="需要时再展开查看完整校验结果和格式化后的 JSON。"
          open={jsonPanelOpen}
          onToggle={() => setJsonPanelOpen((current) => !current)}
        >
          <div className="space-y-5">
            <div className="grid gap-4 xl:grid-cols-2">
              <NoticeCard title="需要修复" tone="rose">
                {validationErrors.length > 0 ? (
                  <div className="space-y-2">
                    {validationErrors.map((item) => (
                      <div
                        key={item}
                        className="rounded-2xl bg-white px-4 py-3 text-sm leading-6 text-rose-800"
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p>当前没有阻止保存的错误。</p>
                )}
              </NoticeCard>

              <NoticeCard title="建议关注" tone="amber">
                {validationWarnings.length > 0 ? (
                  <div className="space-y-2">
                    {validationWarnings.map((item) => (
                      <div
                        key={item}
                        className="rounded-2xl bg-white px-4 py-3 text-sm leading-6 text-amber-800"
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p>当前没有额外提示。</p>
                )}
              </NoticeCard>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <StatTile label="JSON 版本" value={`v${vehicleConfig.version}`} hint="Metaobject JSON version" />
              <StatTile label="最近保存" value={formatDateTime(lastSavedAt)} hint="Shopify 中的最新保存时间" />
              <StatTile label="JSON 大小" value={formatJsonSize(currentJson)} hint={hasUnsavedChanges ? "当前草稿与已保存版本不同" : "当前草稿已同步"} />
            </div>

            <div className="rounded-[24px] border border-stone-200 bg-stone-50">
              <div className="flex min-w-0 flex-col gap-3 border-b border-stone-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-stone-900">格式化后的 Vehicle JSON</p>
                  <p className="mt-1 text-xs leading-5 text-stone-500">
                    保存时会把整份 JSON 原子回写到 Shopify Metaobject。
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <TonePill tone="stone">{VEHICLE_METAOBJECT_TYPE}</TonePill>
                  <TonePill tone="amber">{VEHICLE_METAOBJECT_HANDLE}</TonePill>
                  <TonePill tone="teal">{VEHICLE_METAOBJECT_FIELD}</TonePill>
                </div>
              </div>
              <div className="p-4">
                <pre className="vehicle-mono max-h-[520px] overflow-auto whitespace-pre-wrap break-all rounded-[20px] bg-stone-950 p-4 text-[12px] leading-6 text-stone-100">
                  {currentJson}
                </pre>
              </div>
            </div>
          </div>
        </CollapsiblePanel>
      );
    }

    return (
      <SurfaceCard
        title="校验与 JSON"
        subtitle="这里保留完整校验结果和格式化后的 JSON，方便你检查结构、复制内容，或者快速确认本次修改范围。"
        action={
          <button type="button" className={buttonClass} onClick={handleCopyJson}>
            {copiedJson ? "已复制 JSON" : "复制 JSON"}
          </button>
        }
      >
        <div className="space-y-5">
          <div className="grid gap-4 xl:grid-cols-2">
            <NoticeCard title="必须修复" tone="rose">
              {validationErrors.length > 0 ? (
                <div className="space-y-2">
                  {validationErrors.map((item) => (
                    <div
                      key={item}
                      className="rounded-2xl bg-white px-4 py-3 text-sm leading-6 text-rose-800"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              ) : (
                <p>当前没有阻止保存的错误。</p>
              )}
            </NoticeCard>

            <NoticeCard title="建议关注" tone="amber">
              {validationWarnings.length > 0 ? (
                <div className="space-y-2">
                  {validationWarnings.map((item) => (
                    <div
                      key={item}
                      className="rounded-2xl bg-white px-4 py-3 text-sm leading-6 text-amber-800"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              ) : (
                <p>当前没有额外警告。</p>
              )}
            </NoticeCard>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <StatTile
              label="当前版本"
              value={`v${vehicleConfig.version}`}
              hint="Metaobject JSON version"
            />
            <StatTile
              label="最近保存"
              value={formatDateTime(lastSavedAt)}
              hint="Shopify 中的最新保存时间"
            />
            <StatTile
              label="JSON 大小"
              value={formatJsonSize(currentJson)}
              hint={hasUnsavedChanges ? "当前草稿与已保存版本不同" : "当前草稿已同步"}
            />
          </div>

          <div className="rounded-[24px] border border-stone-200 bg-stone-50">
            <div className="flex min-w-0 flex-col gap-3 border-b border-stone-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-stone-900">格式化后的 Vehicle JSON</p>
                <p className="mt-1 text-xs leading-5 text-stone-500">
                  保存时会把整个 JSON 原子回写到 Shopify Metaobject。
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <TonePill tone="stone">{VEHICLE_METAOBJECT_TYPE}</TonePill>
                <TonePill tone="amber">{VEHICLE_METAOBJECT_HANDLE}</TonePill>
                <TonePill tone="teal">{VEHICLE_METAOBJECT_FIELD}</TonePill>
              </div>
            </div>
            <div className="p-4">
              <pre className="vehicle-mono max-h-[560px] overflow-auto whitespace-pre-wrap break-all rounded-[20px] bg-stone-950 p-4 text-[12px] leading-6 text-stone-100">
                {currentJson}
              </pre>
            </div>
          </div>
        </div>
      </SurfaceCard>
    );
  }

  function renderActiveSection() {
    switch (activeSection) {
      case "categories":
        return renderCategoriesSection();
      case "location_assets":
        return renderLocationAssetsSection();
      default:
        return renderLocationAssetsSection();
    }
  }

  return (
    <>
      <SaveBar id="vehicle-images-save-bar" open={hasUnsavedChanges} discardConfirmation>
        <button type="button" variant="primary" onClick={handleSave} disabled={!canSave || isSaving}>
          保存
        </button>
        <button type="button" onClick={handleDiscard} disabled={isSaving}>
          放弃更改
        </button>
      </SaveBar>

      <s-page heading="vehicle11 页面配置">
        <div className="vehicle-shell mx-auto w-full max-w-[1200px] overflow-x-hidden px-4 pb-10 pt-5 sm:px-6">
          <div className="space-y-5">
            {loaderData?.error ? (
              <NoticeCard title="读取失败" tone="rose">
                当前无法从 Shopify 读取 Vehicle 配置：{loaderData.error}
              </NoticeCard>
            ) : null}

            <SurfaceCard
              title="vehicle11 图片与入口配置"
              subtitle="主区只开放两个入口：字段图片和静态分类。动态只做字段名匹配图片；静态支持分类与卡片的新增、删除、排序，低频字段放到下层。"
              action={
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={buttonClass} onClick={handleCopyJson}>
                    {copiedJson ? "已复制 JSON" : "复制 JSON"}
                  </button>
                  <button
                    type="button"
                    className={buttonClass}
                    onClick={handleDiscard}
                    disabled={!hasUnsavedChanges || isSaving}
                  >
                    恢复已保存版本
                  </button>
                </div>
              }
            >
              <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
                <div className="min-w-0 space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <TonePill tone="stone">{VEHICLE_METAOBJECT_TYPE}</TonePill>
                    <TonePill tone="amber">{VEHICLE_METAOBJECT_HANDLE}</TonePill>
                    <TonePill tone="teal">{VEHICLE_METAOBJECT_FIELD}</TonePill>
                  </div>

                  <div className="grid min-w-0 gap-3 sm:grid-cols-3">
                    <StatTile label="静态分类" value={staticCategoryCount} hint="categories" />
                    <StatTile label="静态卡片" value={staticCardCount} hint="categories[*].cards[*]" />
                    <StatTile label="字段图片" value={stats.locationAssetCount} hint="location_assets" />
                  </div>

                  <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-4 text-sm leading-6 text-stone-700">
                    <p>
                      动态部分只维护 <span className="vehicle-mono">location_assets</span> 的字段名、
                      别名、桌面图和移动图。
                    </p>
                    <p className="mt-2">
                      静态部分只维护 <span className="vehicle-mono">categories</span> 的分类与卡片，
                      可按当前页面结构直接增删改。
                    </p>
                  </div>
                </div>

                <div className="rounded-[24px] border border-stone-200 bg-stone-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
                        当前状态
                      </p>
                      <p className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">
                        {pageStatusLabel}
                      </p>
                    </div>
                    <TonePill tone={pageStatusTone}>
                      {validation.errors.length > 0
                        ? `${validation.errors.length} 个错误`
                        : hasUnsavedChanges
                          ? "草稿中"
                          : "最新"}
                    </TonePill>
                  </div>

                  <p className="mt-4 text-sm leading-6 text-stone-600">{pageStatusMessage}</p>

                  <div className="mt-4 space-y-3">
                    <div className="rounded-[18px] bg-white px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
                        最近保存
                      </p>
                      <p className="vehicle-mono mt-2 break-all text-sm leading-6 text-stone-900">
                        {formatDateTime(lastSavedAt)}
                      </p>
                    </div>
                    <div className="rounded-[18px] bg-white px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
                        JSON 大小
                      </p>
                      <p className="vehicle-mono mt-2 text-sm leading-6 text-stone-900">
                        {formatJsonSize(currentJson)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </SurfaceCard>

            {(validationErrors.length > 0 || validationWarnings.length > 0) ? (
              <NoticeCard title="保存提醒" tone={validationErrors.length > 0 ? "rose" : "amber"}>
                {validationErrors.length > 0
                  ? `当前有 ${validationErrors.length} 个错误，请先修复后再保存。完整校验内容在下方 JSON 面板。`
                  : `当前有 ${validationWarnings.length} 个提醒，不影响保存，但建议检查。`}
              </NoticeCard>
            ) : null}

            <section className="grid min-w-0 max-w-[760px] gap-2 md:grid-cols-2">
              {layeredSectionButtons.map((section) => (
                <SectionSwitchButton
                  key={section.id}
                  label={section.label}
                  code={section.code}
                  description={section.description}
                  value={section.value}
                  active={activeSection === section.id}
                  onClick={() => setActiveSection(section.id)}
                />
              ))}
            </section>

            {renderActiveSection()}

            {renderJsonSection()}
          </div>
        </div>
      </s-page>
    </>
  );
}

SurfaceCard.propTypes = {
  title: PropTypes.string,
  subtitle: PropTypes.string,
  action: PropTypes.node,
  children: PropTypes.node,
  className: PropTypes.string,
};

SurfaceCard.defaultProps = {
  title: null,
  subtitle: null,
  action: null,
  children: null,
  className: "",
};

TonePill.propTypes = {
  tone: PropTypes.oneOf(["stone", "amber", "teal", "rose"]).isRequired,
  children: PropTypes.node.isRequired,
};

StatTile.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  hint: PropTypes.string,
};

StatTile.defaultProps = {
  hint: null,
};

SectionSwitchButton.propTypes = {
  label: PropTypes.string.isRequired,
  code: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  active: PropTypes.bool.isRequired,
  onClick: PropTypes.func.isRequired,
};

EmptyState.propTypes = {
  text: PropTypes.string.isRequired,
  action: PropTypes.node,
};

EmptyState.defaultProps = {
  action: null,
};

NoticeCard.propTypes = {
  title: PropTypes.string.isRequired,
  tone: PropTypes.oneOf(["stone", "amber", "teal", "rose"]).isRequired,
  children: PropTypes.node.isRequired,
};

CollapsiblePanel.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  open: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
  children: PropTypes.node.isRequired,
};

CollapsiblePanel.defaultProps = {
  subtitle: null,
};

InputField.propTypes = {
  label: PropTypes.string.isRequired,
  hint: PropTypes.string,
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  type: PropTypes.string,
  list: PropTypes.string,
};

InputField.defaultProps = {
  hint: null,
  value: "",
  placeholder: "",
  type: "text",
  list: null,
};

TextAreaField.propTypes = {
  label: PropTypes.string.isRequired,
  hint: PropTypes.string,
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
};

TextAreaField.defaultProps = {
  hint: null,
  value: "",
  placeholder: "",
};

MediaField.propTypes = {
  label: PropTypes.string.isRequired,
  hint: PropTypes.string,
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  aspect: PropTypes.string,
};

MediaField.defaultProps = {
  hint: null,
  value: "",
  placeholder: "",
  aspect: "aspect-[4/3]",
};

EntryNavigator.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  items: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      label: PropTypes.string.isRequired,
      meta: PropTypes.string,
      badge: PropTypes.string,
      tone: PropTypes.oneOf(["stone", "amber", "teal", "rose"]),
    }),
  ).isRequired,
  activeValue: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onSelect: PropTypes.func.isRequired,
  addLabel: PropTypes.string,
  onAdd: PropTypes.func,
  emptyText: PropTypes.string.isRequired,
};

EntryNavigator.defaultProps = {
  subtitle: null,
  activeValue: null,
  addLabel: null,
  onAdd: null,
};

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};

/* eslint-disable react/prop-types */
/* global process */
import { useEffect, useMemo, useState } from "react";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

const VEHICLE_LIBRARY_BATCH_SIZE = 200;
const VEHICLE_LIBRARY_STATUSES = [
  "uploaded",
  "validating",
  "generated",
  "publishing",
  "verifying",
  "published",
  "failed",
];

const IMPORT_MODES = {
  full: "全量主表",
  incremental: "增量/替换表",
};

const STATUS_LABELS = {
  uploaded: "已上传",
  validating: "校验中",
  generated: "已生成",
  publishing: "发布中",
  verifying: "验证中",
  published: "已发布",
  failed: "失败",
};

const STATUS_TONES = {
  uploaded: "info",
  validating: "info",
  generated: "success",
  publishing: "warning",
  verifying: "warning",
  published: "success",
  failed: "critical",
};

const ACTION_BUTTON_STYLES = {
  base: {
    borderRadius: 8,
    boxSizing: "border-box",
    cursor: "pointer",
    font: "inherit",
    minHeight: 36,
    padding: "7px 14px",
  },
  primary: {
    background: "#303030",
    border: "1px solid #303030",
    color: "#fff",
  },
  secondary: {
    background: "#fff",
    border: "1px solid #8a8a8a",
    color: "#303030",
  },
  disabled: {
    cursor: "not-allowed",
    opacity: 0.6,
  },
};

function actionButtonStyle(variant, disabled) {
  return {
    ...ACTION_BUTTON_STYLES.base,
    ...ACTION_BUTTON_STYLES[variant],
    ...(disabled ? ACTION_BUTTON_STYLES.disabled : {}),
  };
}

function asJson(value) {
  return JSON.stringify(value ?? null);
}

function parseJson(value, fallback = null) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round((bytes / 1024) * 10) / 10} KB`;
  return `${Math.round((bytes / 1024 / 1024) * 10) / 10} MB`;
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function normalizeVersion(value) {
  return String(value || "").trim();
}

async function readUploadBuffer(uploadedFile) {
  if (!uploadedFile || typeof uploadedFile.arrayBuffer !== "function") {
    throw new Error("请选择一个 Excel 文件");
  }
  const { Buffer } = await import("node:buffer");
  const arrayBuffer = await uploadedFile.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function persistArtifacts(jobId, artifacts) {
  await prisma.vehicleLibraryArtifact.createMany({
    data: artifacts.map((artifact) => ({
      jobId,
      type: artifact.type,
      fileName: artifact.fileName,
      byteSize: artifact.byteSize,
      checksum: artifact.checksum,
      status: "generated",
    })),
  });
}

async function updatePublishedArtifacts(jobId, publishedArtifacts) {
  await Promise.all(
    publishedArtifacts.map((artifact) =>
      prisma.vehicleLibraryArtifact.updateMany({
        where: {
          jobId,
          fileName: artifact.fileName,
        },
        data: {
          shopifyFileId: artifact.shopifyFileId,
          cdnUrl: artifact.cdnUrl,
          status: "published",
        },
      }),
    ),
  );
}

async function buildRecordsForMode({ mode, workbookRecords, admin, shop }) {
  if (mode !== "incremental") {
    return {
      records: workbookRecords,
      baseVersion: null,
      incrementalBaseCount: 0,
    };
  }

  const { fetchCurrentSearchResultRecords, mergeIncrementalRecords } = await import(
    "../vehicle-library/artifacts.server"
  );
  const { getCurrentVehicleLibraryVersion } = await import("../graphql/vehicleLibrary.server");
  const current = await getCurrentVehicleLibraryVersion(admin);
  if (!current.version) {
    throw new Error("增量模式需要先读取当前 vehicle_date.vd 版本，但当前店铺没有可用版本号");
  }
  const baseRecords = await fetchCurrentSearchResultRecords({ version: current.version, shop });
  return {
    records: mergeIncrementalRecords(baseRecords, workbookRecords),
    baseVersion: current.version,
    incrementalBaseCount: baseRecords.length,
  };
}

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const {
    buildDefaultVehicleLibraryVersion,
    buildVehicleLibraryReadConventions,
    getVehicleLibraryCdnBaseUrl,
  } = await import("../vehicle-library/artifacts.server");
  const { getCurrentVehicleLibraryVersion } = await import("../graphql/vehicleLibrary.server");
  const currentVersion = await getCurrentVehicleLibraryVersion(admin).catch(() => ({
    version: "",
    id: null,
  }));
  const [recentJobs, versions] = await Promise.all([
    prisma.vehicleLibraryImportJob.findMany({
      where: { shop: session.shop },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { artifacts: { select: { id: true } } },
    }),
    prisma.vehicleLibraryVersion.findMany({
      where: { shop: session.shop },
      orderBy: { publishedAt: "desc" },
      take: 6,
    }),
  ]);

  return {
    defaultVersion: buildDefaultVehicleLibraryVersion(),
    cdnBaseUrl: getVehicleLibraryCdnBaseUrl(session.shop),
    readConventions: buildVehicleLibraryReadConventions(),
    currentVersion,
    statuses: VEHICLE_LIBRARY_STATUSES,
    recentJobs: recentJobs.map((job) => ({
      id: job.id,
      mode: job.mode,
      version: job.version,
      status: job.status,
      originalFileName: job.originalFileName,
      artifactCount: job.artifactCount,
      totalBytes: job.totalBytes,
      batchCount: job.batchCount,
      createdAt: job.createdAt,
      publishedAt: job.publishedAt,
      summary: parseJson(job.summaryJson, {}),
      error: parseJson(job.errorJson, null),
    })),
    versions: versions.map((version) => ({
      id: version.id,
      version: version.version,
      status: version.status,
      artifactCount: version.artifactCount,
      totalBytes: version.totalBytes,
      publishedAt: version.publishedAt,
    })),
  };
};

export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const {
    buildDefaultVehicleLibraryVersion,
    buildVehicleLibraryReadConventions,
    generateVehicleLibraryArtifacts,
    getAllSourceUrls,
    getVehicleLibraryCdnBaseUrl,
    parseVehicleLibraryWorkbook,
  } = await import("../vehicle-library/artifacts.server");
  const {
    buildSourceHandleMap,
    publishVehicleLibraryArtifacts,
    updateVehicleLibraryVersion,
    verifyPublishedArtifacts,
  } = await import("../graphql/vehicleLibrary.server");
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "dry_run");
  const mode = String(formData.get("mode") || "full");
  const version = normalizeVersion(formData.get("version")) || buildDefaultVehicleLibraryVersion();
  const uploadedFile = formData.get("file");
  let job = null;
  let phase = "初始化";

  try {
    if (!["dry_run", "publish"].includes(intent)) {
      throw new Error("提交动作不正确");
    }
    if (!IMPORT_MODES[mode]) {
      throw new Error("导入模式不正确");
    }
    if (!/^\d{6,}$/.test(version)) {
      throw new Error("版本号必须是 6 位以上数字，例如 260509");
    }
    const fileName = uploadedFile?.name || "vehicle-library.xlsx";
    const fileSize = Number(uploadedFile?.size || 0);
    phase = "读取上传文件";
    const buffer = await readUploadBuffer(uploadedFile);
    const cdnBaseUrl = getVehicleLibraryCdnBaseUrl(session.shop);

    job = await prisma.vehicleLibraryImportJob.create({
      data: {
        shop: session.shop,
        mode,
        version,
        status: "uploaded",
        originalFileName: fileName,
        sourceFileSize: fileSize,
      },
    });

    await prisma.vehicleLibraryImportJob.update({
      where: { id: job.id },
      data: { status: "validating" },
    });

    phase = "校验 Excel";
    const parsed = parseVehicleLibraryWorkbook(buffer, fileName);
    if (parsed.errors.length) {
      const errorJson = {
        message: "Excel 校验失败",
        errors: parsed.errors.slice(0, 100),
        totalErrors: parsed.errors.length,
      };
      await prisma.vehicleLibraryImportJob.update({
        where: { id: job.id },
        data: { status: "failed", errorJson: asJson(errorJson) },
      });
      return { ok: false, jobId: job.id, error: errorJson };
    }

    phase = mode === "incremental" ? "读取并合并当前线上版本" : "准备生成数据";
    const recordResult = await buildRecordsForMode({
      mode,
      workbookRecords: parsed.records,
      admin,
      shop: session.shop,
    });
    phase = "生成 JSON";
    const sourceUrls = getAllSourceUrls(recordResult.records);
    if (intent === "publish") {
      phase = "补充商品 handle 映射";
    }
    const sourceHandleMap =
      intent === "publish" ? await buildSourceHandleMap(admin, sourceUrls) : new Map();
    phase = "生成 JSON";
    const generated = generateVehicleLibraryArtifacts(recordResult.records, {
      version,
      sourceHandleMap,
    });
    const summary = {
      ...generated.summary,
      mode,
      sourceFileName: fileName,
      uploadedRows: parsed.records.length,
      baseVersion: recordResult.baseVersion,
      incrementalBaseCount: recordResult.incrementalBaseCount,
      batchSize: VEHICLE_LIBRARY_BATCH_SIZE,
      cdnBaseUrl,
      readConventions: buildVehicleLibraryReadConventions(version),
      sourceHandleEnriched: intent === "publish",
    };

    await prisma.vehicleLibraryImportJob.update({
      where: { id: job.id },
      data: {
        status: "generated",
        artifactCount: summary.artifactCount,
        totalBytes: summary.totalBytes,
        batchCount: summary.batchCount,
        summaryJson: asJson(summary),
      },
    });
    await persistArtifacts(job.id, generated.artifacts);

    if (intent !== "publish") {
      return {
        ok: true,
        published: false,
        jobId: job.id,
        summary,
        sampleArtifacts: generated.artifacts.slice(0, 12).map((artifact) => ({
          type: artifact.type,
          fileName: artifact.fileName,
          byteSize: artifact.byteSize,
        })),
      };
    }

    await prisma.vehicleLibraryImportJob.update({
      where: { id: job.id },
      data: { status: "publishing" },
    });
    phase = "上传 Shopify Files";
    const publishedArtifacts = await publishVehicleLibraryArtifacts(admin, generated.artifacts, {
      fallbackCdnBaseUrl: cdnBaseUrl,
      onBatch: async ({ batchIndex, batchCount, publishedCount }) => {
        await prisma.vehicleLibraryImportJob.update({
          where: { id: job.id },
          data: {
            summaryJson: asJson({
              ...summary,
              publishProgress: {
                batchIndex: batchIndex + 1,
                batchCount,
                publishedCount,
              },
            }),
          },
        });
      },
    });
    await updatePublishedArtifacts(job.id, publishedArtifacts);

    await prisma.vehicleLibraryImportJob.update({
      where: { id: job.id },
      data: { status: "verifying" },
    });
    phase = "校验 CDN JSON";
    await verifyPublishedArtifacts(publishedArtifacts, { fallbackCdnBaseUrl: cdnBaseUrl });
    phase = "更新 vehicle_date.vd";
    await updateVehicleLibraryVersion(admin, version);

    phase = "记录发布版本";
    await prisma.vehicleLibraryVersion.upsert({
      where: {
        shop_version: {
          shop: session.shop,
          version,
        },
      },
      update: {
        jobId: job.id,
        status: "published",
        artifactCount: summary.artifactCount,
        totalBytes: summary.totalBytes,
        summaryJson: asJson(summary),
        publishedAt: new Date(),
      },
      create: {
        shop: session.shop,
        version,
        jobId: job.id,
        status: "published",
        artifactCount: summary.artifactCount,
        totalBytes: summary.totalBytes,
        summaryJson: asJson(summary),
      },
    });

    await prisma.vehicleLibraryImportJob.update({
      where: { id: job.id },
      data: { status: "published", publishedAt: new Date(), summaryJson: asJson(summary) },
    });

    return {
      ok: true,
      published: true,
      jobId: job.id,
      summary,
      publishedCount: publishedArtifacts.length,
    };
  } catch (error) {
    const errorJson = {
      phase,
      message: error.message,
      stack: process.env.NODE_ENV === "production" ? undefined : error.stack,
    };
    if (job) {
      await prisma.vehicleLibraryImportJob.update({
        where: { id: job.id },
        data: { status: "failed", errorJson: asJson(errorJson) },
      });
    }
    return { ok: false, jobId: job?.id || null, error: errorJson };
  }
};

function StatusBadge({ status }) {
  return <s-badge tone={STATUS_TONES[status] || "info"}>{STATUS_LABELS[status] || status}</s-badge>;
}

function MetricBox({ label, value, tone = "base" }) {
  return (
    <s-box padding="base" border="base" border-radius="base" background="subdued">
      <s-stack direction="block" gap="small">
        <s-text color="subdued">{label}</s-text>
        <s-text type="strong" tone={tone}>
          {value}
        </s-text>
      </s-stack>
    </s-box>
  );
}

function JobTable({ jobs }) {
  if (!jobs.length) {
    return (
      <s-box padding="base" background="subdued" border-radius="base">
        <s-text color="subdued">暂无导入任务</s-text>
      </s-box>
    );
  }
  return (
    <s-table variant="auto">
      <s-table-header-row>
        <s-table-header list-slot="primary">版本</s-table-header>
        <s-table-header>模式</s-table-header>
        <s-table-header>状态</s-table-header>
        <s-table-header>文件数</s-table-header>
        <s-table-header>大小</s-table-header>
        <s-table-header>时间</s-table-header>
      </s-table-header-row>
      <s-table-body>
        {jobs.map((job) => (
          <s-table-row key={job.id}>
            <s-table-cell>{job.version}</s-table-cell>
            <s-table-cell>{IMPORT_MODES[job.mode] || job.mode}</s-table-cell>
            <s-table-cell>
              <StatusBadge status={job.status} />
            </s-table-cell>
            <s-table-cell>{job.artifactCount}</s-table-cell>
            <s-table-cell>{formatBytes(job.totalBytes)}</s-table-cell>
            <s-table-cell>{formatDate(job.createdAt)}</s-table-cell>
          </s-table-row>
        ))}
      </s-table-body>
    </s-table>
  );
}

function ResultPanel({ data }) {
  if (!data) return null;
  if (!data.ok) {
    const errors = data.error?.errors || [];
    return (
      <s-banner tone="critical" heading="处理失败">
        <s-paragraph>{data.error?.message || "车型库处理失败"}</s-paragraph>
        {errors.length ? (
          <s-box padding="base" background="subdued" border-radius="base">
            <s-stack direction="block" gap="small">
              {errors.slice(0, 8).map((error, index) => (
                <s-text key={`${error.rowNumber}-${index}`}>
                  第 {error.rowNumber} 行：{error.message}
                </s-text>
              ))}
            </s-stack>
          </s-box>
        ) : null}
      </s-banner>
    );
  }
  const summary = data.summary || {};
  return (
    <s-banner tone={data.published ? "success" : "info"} heading={data.published ? "发布完成" : "Dry-run 完成"}>
      <s-stack direction="block" gap="base">
        <s-paragraph>
          版本 {summary.version} 已生成 {summary.artifactCount} 个 JSON，
          {summary.batchCount} 个发布批次，总大小 {formatBytes(summary.totalBytes)}。
        </s-paragraph>
        {summary.cdnBaseUrl ? <s-paragraph>CDN Base：{summary.cdnBaseUrl}</s-paragraph> : null}
        {data.sampleArtifacts?.length ? (
          <s-table variant="auto">
            <s-table-header-row>
              <s-table-header list-slot="primary">样例文件</s-table-header>
              <s-table-header>类型</s-table-header>
              <s-table-header>大小</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {data.sampleArtifacts.map((artifact) => (
                <s-table-row key={artifact.fileName}>
                  <s-table-cell>{artifact.fileName}</s-table-cell>
                  <s-table-cell>{artifact.type}</s-table-cell>
                  <s-table-cell>{formatBytes(artifact.byteSize)}</s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        ) : null}
      </s-stack>
    </s-banner>
  );
}

export default function VehicleLibraryPage() {
  const loaderData = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();
  const [mode, setMode] = useState("full");
  const [version, setVersion] = useState(loaderData.defaultVersion);
  const isSubmitting = ["loading", "submitting"].includes(fetcher.state);
  const result = fetcher.data;
  const latestJob = loaderData.recentJobs[0];
  const currentVersionLabel = loaderData.currentVersion?.version || "未读取到";
  const projectedStatus = isSubmitting ? "publishing" : latestJob?.status || "uploaded";

  const statusItems = useMemo(
    () =>
      loaderData.statuses.map((status) => ({
        status,
        active: status === projectedStatus,
      })),
    [loaderData.statuses, projectedStatus],
  );

  const handleModeChange = (event) => {
    const next = event.currentTarget?.values?.[0];
    if (next) setMode(next);
  };
  const handleVersionInput = (event) => setVersion(event.currentTarget.value);

  useEffect(() => {
    if (!fetcher.data) return;
    if (fetcher.data.ok && fetcher.data.published) {
      shopify.toast.show("车型库已发布并切换主题版本");
    } else if (fetcher.data.ok) {
      shopify.toast.show("车型库 dry-run 已完成");
    } else {
      shopify.toast.show(fetcher.data.error?.message || "车型库处理失败", { isError: true });
    }
  }, [fetcher.data, shopify]);

  return (
    <s-page heading="车型库管理" inline-size="large">
      <s-section>
        <s-grid grid-template-columns="repeat(auto-fit, minmax(min(100%, 180px), 1fr))" gap="base">
          <MetricBox label="当前线上版本" value={currentVersionLabel} tone="success" />
          <MetricBox label="默认新版本" value={loaderData.defaultVersion} />
          <MetricBox label="发布批次上限" value={`${VEHICLE_LIBRARY_BATCH_SIZE} 文件/批`} />
          <MetricBox label="最近任务状态" value={STATUS_LABELS[latestJob?.status] || "暂无任务"} />
        </s-grid>
      </s-section>

      <s-grid grid-template-columns="repeat(auto-fit, minmax(min(100%, 360px), 1fr))" gap="base">
        <s-section heading="上传并生成">
          <fetcher.Form method="post" encType="multipart/form-data">
            <input type="hidden" name="mode" value={mode} />
            <s-stack direction="block" gap="base">
              <s-banner tone="info" heading="发布会自动切换主题版本">
                <s-paragraph>
                  上传通过校验后会生成兼容当前 AUXITO 主题的 JSON。点击发布时会上传 Shopify Files，验证 CDN 可读后更新 vehicle_date.vd。
                </s-paragraph>
              </s-banner>

              <s-choice-list
                label="导入模式"
                values={[mode]}
                onChange={handleModeChange}
              >
                <s-choice value="full">全量主表</s-choice>
                <s-choice value="incremental">0429 式增量/替换表</s-choice>
              </s-choice-list>

              <s-text-field
                label="发布版本号"
                name="version"
                value={version}
                onInput={handleVersionInput}
                placeholder="260509"
                required
              ></s-text-field>

              <s-drop-zone label="上传 Excel" accept=".xlsx,.xls,.csv"></s-drop-zone>
              <input
                name="file"
                type="file"
                accept=".xlsx,.xls,.csv"
                required
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #c9cccf",
                  borderRadius: 8,
                  background: "#fff",
                  boxSizing: "border-box",
                }}
              />

              <s-stack direction="inline" gap="base">
                <button
                  type="submit"
                  name="intent"
                  value="dry_run"
                  disabled={isSubmitting}
                  style={actionButtonStyle("secondary", isSubmitting)}
                >
                  先校验并生成预览
                </button>
                <button
                  type="submit"
                  name="intent"
                  value="publish"
                  disabled={isSubmitting}
                  style={actionButtonStyle("primary", isSubmitting)}
                >
                  生成并发布到 Shopify CDN
                </button>
              </s-stack>

              {isSubmitting ? (
                <s-stack direction="inline" gap="small" align-items="center">
                  <s-spinner size="base" accessibility-label="处理中"></s-spinner>
                  <s-text>正在处理车型库任务...</s-text>
                </s-stack>
              ) : null}
            </s-stack>
          </fetcher.Form>
        </s-section>

        <s-section heading="任务状态">
          <s-stack direction="block" gap="base">
            {statusItems.map((item) => (
              <s-box
                key={item.status}
                padding="small"
                border="base"
                border-radius="base"
                background={item.active ? "subdued" : "base"}
              >
                <s-stack direction="inline" align-items="center" gap="small">
                  <StatusBadge status={item.status} />
                  <s-text>{STATUS_LABELS[item.status]}</s-text>
                </s-stack>
              </s-box>
            ))}
          </s-stack>
        </s-section>
      </s-grid>

      <ResultPanel data={result} />

      <s-section heading="主题读取约定">
        <s-stack direction="block" gap="small">
          <s-text color="subdued">CDN Base：{loaderData.cdnBaseUrl}</s-text>
          {loaderData.readConventions.map((pattern) => (
            <s-text key={pattern}>{pattern}</s-text>
          ))}
        </s-stack>
      </s-section>

      <s-section heading="最近导入任务">
        <JobTable jobs={loaderData.recentJobs} />
      </s-section>

      <s-section heading="发布版本">
        {loaderData.versions.length ? (
          <s-table variant="auto">
            <s-table-header-row>
              <s-table-header list-slot="primary">版本</s-table-header>
              <s-table-header>状态</s-table-header>
              <s-table-header>文件数</s-table-header>
              <s-table-header>大小</s-table-header>
              <s-table-header>发布时间</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {loaderData.versions.map((item) => (
                <s-table-row key={item.id}>
                  <s-table-cell>{item.version}</s-table-cell>
                  <s-table-cell>
                    <StatusBadge status={item.status} />
                  </s-table-cell>
                  <s-table-cell>{item.artifactCount}</s-table-cell>
                  <s-table-cell>{formatBytes(item.totalBytes)}</s-table-cell>
                  <s-table-cell>{formatDate(item.publishedAt)}</s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        ) : (
          <s-box padding="base" background="subdued" border-radius="base">
            <s-text color="subdued">暂无发布版本</s-text>
          </s-box>
        )}
      </s-section>
    </s-page>
  );
}

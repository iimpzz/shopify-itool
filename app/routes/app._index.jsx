import { useState, useEffect } from "react";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import {
  getCurrentProductsBulkOperation,
  runProductsExport,
  quickExportProducts,
  paginatedExportProducts,
} from "../graphql/bulkExport.server";
import * as XLSX from 'xlsx';

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  try {
    const currentOp = await getCurrentProductsBulkOperation(request);
    return { currentOp, error: null };
  } catch (error) {
    console.error("获取 Bulk Operation 状态失败:", error);
    // 返回空状态，让页面正常显示
    return { currentOp: null, error: error.message };
  }
};

export const action = async ({ request }) => {
  await authenticate.admin(request);
  
  const formData = await request.formData();
  const intent = formData.get("intent");

  try {
    // 获取用户选择的字段
    const selectedFields = {
      title: formData.get("field_title") === "on",
      description: formData.get("field_description") === "on",
      handle: formData.get("field_handle") === "on",
      status: formData.get("field_status") === "on",
      vendor: formData.get("field_vendor") === "on",
      productType: formData.get("field_productType") === "on",
      tags: formData.get("field_tags") === "on",
      createdAt: formData.get("field_createdAt") === "on",
      updatedAt: formData.get("field_updatedAt") === "on",
      publishedAt: formData.get("field_publishedAt") === "on",
      variants: formData.get("field_variants") === "on",
      images: formData.get("field_images") === "on",
    };

    if (intent === "quick_export") {
      // 快速导出：立即返回结果（最多250个）
      const result = await quickExportProducts(request, selectedFields, 250);
      return { 
        quickExportResult: result,
        error: null, 
        success: true 
      };
    }

    if (intent === "full_export") {
      // 完整导出：自动分页，导出所有商品（最多10000个）
      const result = await paginatedExportProducts(request, selectedFields, 10000);
      return { 
        quickExportResult: result,
        error: null, 
        success: true 
      };
    }

    if (intent === "start") {
      // 批量导出：启动 Bulk Operation
      await runProductsExport(request, selectedFields);
    }

    const currentOp = await getCurrentProductsBulkOperation(request);
    return { currentOp, error: null, success: true };
  } catch (error) {
    console.error("操作失败:", error);
    return { 
      currentOp: null, 
      error: error.message,
      success: false 
    };
  }
};

export default function Index() {
  const loaderData = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();
  
  // 字段选择状态
  const [selectedFields, setSelectedFields] = useState({
    title: true,
    description: true,
    handle: true,
    status: true,
    vendor: false,
    productType: false,
    tags: false,
    createdAt: false,
    updatedAt: false,
    publishedAt: false,
    variants: false,
    images: false,
  });

  const currentOp = loaderData?.currentOp;
  const loaderError = loaderData?.error;
  const displayOp = fetcher.data?.currentOp ?? currentOp;
  const displayError = fetcher.data?.error ?? loaderError;
  const quickExportResult = fetcher.data?.quickExportResult;
  const isLoading = ["loading", "submitting"].includes(fetcher.state);

  const status = displayOp?.status ?? "无";
  const url = displayOp?.url ?? null;
  const errorCode = displayOp?.errorCode ?? null;
  const objectCount = displayOp?.objectCount ?? "0";
  const rootObjectCount = displayOp?.rootObjectCount ?? "0";

  const isCompleted = status === "COMPLETED";
  const isRunning = status === "RUNNING" || status === "CREATED";

  useEffect(() => {
    if (isCompleted && fetcher.data?.currentOp) {
      shopify.toast.show("批量导出任务已完成！");
    }
    if (fetcher.data?.quickExportResult) {
      shopify.toast.show(`快速导出成功！导出了 ${fetcher.data.quickExportResult.count} 个商品`);
    }
    if (fetcher.data?.error) {
      shopify.toast.show("操作失败: " + fetcher.data.error, { 
        isError: true 
      });
    }
  }, [isCompleted, fetcher.data?.currentOp, fetcher.data?.quickExportResult, fetcher.data?.error, shopify]);

  // 格式化时间为中国习惯格式
  const formatChineseDateTime = (isoString) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      // 转换为本地时间
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    } catch (e) {
      return isoString;
    }
  };

  // 翻译状态为中文
  const translateStatus = (status) => {
    const statusMap = {
      'ACTIVE': '已上架',
      'DRAFT': '草稿',
      'ARCHIVED': '已归档',
    };
    return statusMap[status] || status;
  };

  const handleFieldChange = (field) => {
    setSelectedFields((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const handleStartExport = () => {
    const formData = new FormData();
    formData.append("intent", "start");
    
    // 添加选中的字段
    Object.entries(selectedFields).forEach(([key, value]) => {
      if (value) {
        formData.append(`field_${key}`, "on");
      }
    });
    
    fetcher.submit(formData, { method: "POST" });
  };

  const handleQuickExport = () => {
    const formData = new FormData();
    formData.append("intent", "quick_export");
    
    // 添加选中的字段
    Object.entries(selectedFields).forEach(([key, value]) => {
      if (value) {
        formData.append(`field_${key}`, "on");
      }
    });
    
    fetcher.submit(formData, { method: "POST" });
  };

  const handleFullExport = () => {
    const formData = new FormData();
    formData.append("intent", "full_export");
    
    // 添加选中的字段
    Object.entries(selectedFields).forEach(([key, value]) => {
      if (value) {
        formData.append(`field_${key}`, "on");
      }
    });
    
    fetcher.submit(formData, { method: "POST" });
  };

  const handleRefresh = () => {
    const formData = new FormData();
    formData.append("intent", "refresh");
    fetcher.submit(formData, { method: "POST" });
  };

  const handleDownloadJSON = () => {
    if (!quickExportResult?.products) return;
    
    const dataStr = JSON.stringify(quickExportResult.products, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `products-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadExcel = () => {
    if (!quickExportResult?.products) return;
    
    // 将产品数据转换为 Excel 友好的格式
    const excelData = quickExportResult.products.map(product => {
      const row = {
        '商品ID': product.id || '',
        '标题': product.title || '',
        '描述HTML': product.descriptionHtml || '',
        'URL句柄': product.handle || '',
        '状态': translateStatus(product.status) || '',
        '供应商': product.vendor || '',
        '商品类型': product.productType || '',
        '标签': Array.isArray(product.tags) ? product.tags.join(', ') : product.tags || '',
        '创建时间': formatChineseDateTime(product.createdAt),
        '更新时间': formatChineseDateTime(product.updatedAt),
        '发布时间': formatChineseDateTime(product.publishedAt),
      };

      // 处理变体数据
      if (product.variants?.edges) {
        const variants = product.variants.edges.map(e => e.node);
        row['变体数量'] = variants.length;
        row['第一个变体价格'] = variants[0]?.price || '';
        row['第一个变体SKU'] = variants[0]?.sku || '';
        row['第一个变体库存'] = variants[0]?.inventoryQuantity || '';
      }

      // 处理图片数据
      if (product.images?.edges) {
        const images = product.images.edges.map(e => e.node);
        row['图片数量'] = images.length;
        row['第一张图片URL'] = images[0]?.url || '';
      }

      return row;
    });

    // 创建工作簿和工作表
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '商品列表');

    // 如果有变体数据，创建单独的变体工作表
    const allVariants = [];
    quickExportResult.products.forEach(product => {
      if (product.variants?.edges) {
        product.variants.edges.forEach(edge => {
          const variant = edge.node;
          allVariants.push({
            '商品ID': product.id,
            '商品标题': product.title,
            '变体ID': variant.id,
            '变体标题': variant.title,
            '价格': variant.price,
            'SKU': variant.sku,
            '库存数量': variant.inventoryQuantity,
          });
        });
      }
    });

    if (allVariants.length > 0) {
      const variantsSheet = XLSX.utils.json_to_sheet(allVariants);
      XLSX.utils.book_append_sheet(workbook, variantsSheet, '变体详情');
    }

    // 如果有图片数据，创建单独的图片工作表
    const allImages = [];
    quickExportResult.products.forEach(product => {
      if (product.images?.edges) {
        product.images.edges.forEach(edge => {
          const image = edge.node;
          allImages.push({
            '商品ID': product.id,
            '商品标题': product.title,
            '图片ID': image.id,
            '图片URL': image.url,
            'Alt文本': image.altText || '',
          });
        });
      }
    });

    if (allImages.length > 0) {
      const imagesSheet = XLSX.utils.json_to_sheet(allImages);
      XLSX.utils.book_append_sheet(workbook, imagesSheet, '图片详情');
    }

    // 生成并下载文件
    const fileName = `products-export-${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  return (
    <s-page heading="商品批量导出工具">
      <s-section heading="功能说明">
        <s-paragraph>
          使用 Shopify Bulk Operation API 批量导出店铺所有商品信息。
          你可以自定义选择需要导出的字段，导出完成后下载 JSONL 格式文件（有效期 7 天）。
        </s-paragraph>
      </s-section>

      <s-section heading="选择导出字段">
        <s-stack direction="block" gap="base">
          <s-paragraph>
            <s-text as="strong">基础信息：</s-text>
          </s-paragraph>
          <s-stack direction="block" gap="small">
            <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="checkbox"
                checked={selectedFields.title}
                onChange={() => handleFieldChange("title")}
              />
              <span>商品标题 (Title)</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="checkbox"
                checked={selectedFields.description}
                onChange={() => handleFieldChange("description")}
              />
              <span>商品描述 HTML (Description HTML)</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="checkbox"
                checked={selectedFields.handle}
                onChange={() => handleFieldChange("handle")}
              />
              <span>URL 句柄 (Handle)</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="checkbox"
                checked={selectedFields.status}
                onChange={() => handleFieldChange("status")}
              />
              <span>商品状态 (Status)</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="checkbox"
                checked={selectedFields.vendor}
                onChange={() => handleFieldChange("vendor")}
              />
              <span>供应商 (Vendor)</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="checkbox"
                checked={selectedFields.productType}
                onChange={() => handleFieldChange("productType")}
              />
              <span>商品类型 (Product Type)</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="checkbox"
                checked={selectedFields.tags}
                onChange={() => handleFieldChange("tags")}
              />
              <span>标签 (Tags)</span>
            </label>
          </s-stack>

          <s-paragraph style={{ marginTop: "16px" }}>
            <s-text as="strong">时间信息：</s-text>
          </s-paragraph>
          <s-stack direction="block" gap="small">
            <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="checkbox"
                checked={selectedFields.createdAt}
                onChange={() => handleFieldChange("createdAt")}
              />
              <span>创建时间 (Created At)</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="checkbox"
                checked={selectedFields.updatedAt}
                onChange={() => handleFieldChange("updatedAt")}
              />
              <span>更新时间 (Updated At)</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="checkbox"
                checked={selectedFields.publishedAt}
                onChange={() => handleFieldChange("publishedAt")}
              />
              <span>发布时间 (Published At)</span>
            </label>
          </s-stack>

          <s-paragraph style={{ marginTop: "16px" }}>
            <s-text as="strong">关联数据：</s-text>
          </s-paragraph>
          <s-stack direction="block" gap="small">
            <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="checkbox"
                checked={selectedFields.variants}
                onChange={() => handleFieldChange("variants")}
              />
              <span>变体信息 (Variants - 包含价格、SKU、库存)</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="checkbox"
                checked={selectedFields.images}
                onChange={() => handleFieldChange("images")}
              />
              <span>商品图片 (Images - 包含 URL 和 Alt 文本)</span>
            </label>
          </s-stack>
        </s-stack>
      </s-section>

      <s-section heading="导出任务状态">
        <s-stack direction="block" gap="base">
          {displayError && (
            <s-box
              padding="base"
              borderWidth="base"
              borderRadius="base"
              background="critical-subdued"
            >
              <s-stack direction="block" gap="base">
                <s-paragraph>
                  <s-text as="strong" tone="critical">⚠️ 连接失败</s-text>
                </s-paragraph>
                <s-paragraph>
                  无法连接到 Shopify API。请检查：
                </s-paragraph>
                <s-unordered-list>
                  <s-list-item>应用是否已正确安装到 Shopify 店铺</s-list-item>
                  <s-list-item>网络连接是否正常</s-list-item>
                  <s-list-item>是否需要重新授权应用</s-list-item>
                </s-unordered-list>
                <s-paragraph>
                  <s-text tone="critical">错误详情：{displayError}</s-text>
                </s-paragraph>
              </s-stack>
            </s-box>
          )}

          <s-paragraph>
            <s-text as="strong">当前状态：</s-text>
            <s-text> {status}</s-text>
          </s-paragraph>

          {errorCode && (
            <s-paragraph>
              <s-text tone="critical">错误代码：{errorCode}</s-text>
            </s-paragraph>
          )}

          {displayOp && (
            <>
              <s-paragraph>
                <s-text as="strong">已处理对象数：</s-text> {objectCount}
              </s-paragraph>
              <s-paragraph>
                <s-text as="strong">商品数量：</s-text> {rootObjectCount}
              </s-paragraph>
            </>
          )}

          {isCompleted && url && (
            <s-box
              padding="base"
              borderWidth="base"
              borderRadius="base"
              background="success-subdued"
            >
              <s-stack direction="block" gap="base">
                <s-paragraph>
                  <s-text as="strong">✅ 导出任务已完成！</s-text>
                </s-paragraph>
                <s-paragraph>
                  点击下方链接下载 JSONL 文件（每行一个 JSON 对象）：
                </s-paragraph>
                <s-link href={url} target="_blank">
                  下载导出结果
                </s-link>
              </s-stack>
            </s-box>
          )}

          <s-stack direction="block" gap="base">
            <s-stack direction="inline" gap="base">
              <s-button
                onClick={handleQuickExport}
                variant="primary"
                {...(isLoading ? { loading: true } : {})}
              >
                ⚡ 快速预览（250个）
              </s-button>

              <s-button
                onClick={handleFullExport}
                variant="primary"
                {...(isLoading ? { loading: true } : {})}
              >
                🚀 完整导出（所有商品）
              </s-button>
            </s-stack>

            <s-paragraph>
              <s-text tone="subdued">
                推荐使用【完整导出】，自动分页获取所有商品（最多10000个），速度快不会卡住
              </s-text>
            </s-paragraph>

            <s-divider />

            <s-paragraph>
              <s-text as="strong">高级选项：</s-text>
            </s-paragraph>

            <s-stack direction="inline" gap="base">
              <s-button
                onClick={handleStartExport}
                {...(isLoading || isRunning ? { loading: true } : {})}
                {...(isRunning || displayError ? { disabled: true } : {})}
                variant="tertiary"
              >
                {isRunning ? "Bulk导出中..." : displayError ? "连接失败" : "Bulk Operation（超大量）"}
              </s-button>

              <s-button
                onClick={handleRefresh}
                {...(isLoading ? { loading: true } : {})}
                variant="tertiary"
              >
                {displayError ? "重试连接" : "刷新状态"}
              </s-button>
            </s-stack>
          </s-stack>
        </s-stack>
      </s-section>

      {quickExportResult && (
        <s-section heading="导出结果">
          <s-stack direction="block" gap="base">
            <s-box
              padding="base"
              borderWidth="base"
              borderRadius="base"
              background="success-subdued"
            >
              <s-stack direction="block" gap="base">
                <s-paragraph>
                  <s-text as="strong">✅ {quickExportResult.message}</s-text>
                </s-paragraph>
                
                <s-paragraph>
                  <s-text as="strong">选择下载格式：</s-text>
                </s-paragraph>
                
                <s-stack direction="inline" gap="base">
                  <s-button onClick={handleDownloadExcel} variant="primary">
                    📊 下载 Excel 文件（推荐）
                  </s-button>
                  <s-button onClick={handleDownloadJSON} variant="secondary">
                    📄 下载 JSON 文件
                  </s-button>
                </s-stack>

                <s-box
                  padding="base"
                  borderWidth="base"
                  borderRadius="base"
                  background="subdued"
                >
                  <s-stack direction="block" gap="small">
                    <s-paragraph>
                      <s-text as="strong">📊 Excel 文件包含：</s-text>
                    </s-paragraph>
                    <s-unordered-list>
                      <s-list-item>工作表1：商品列表（主要信息）</s-list-item>
                      {quickExportResult.products.some(p => p.variants?.edges?.length > 0) && (
                        <s-list-item>工作表2：变体详情（价格、SKU、库存）</s-list-item>
                      )}
                      {quickExportResult.products.some(p => p.images?.edges?.length > 0) && (
                        <s-list-item>工作表3：图片详情（图片链接）</s-list-item>
                      )}
                    </s-unordered-list>
                    <s-paragraph>
                      <s-text tone="subdued">可以直接用 Excel、WPS 或 Google Sheets 打开</s-text>
                    </s-paragraph>
                  </s-stack>
                </s-box>
              </s-stack>
            </s-box>

            <s-box
              padding="base"
              borderWidth="base"
              borderRadius="base"
              background="subdued"
            >
              <s-stack direction="block" gap="base">
                <s-paragraph>
                  <s-text as="strong">预览数据（前 3 个商品）：</s-text>
                </s-paragraph>
                <s-stack direction="block" gap="base">
                  {quickExportResult.products.slice(0, 3).map((product, index) => (
                    <s-box 
                      key={index}
                      padding="small" 
                      borderWidth="base" 
                      borderRadius="base"
                      background="surface"
                    >
                      <s-stack direction="block" gap="small">
                        <s-paragraph>
                          <s-text as="strong">{product.title || '无标题'}</s-text>
                        </s-paragraph>
                        <s-paragraph>
                          <s-text tone="subdued">ID: {product.id}</s-text>
                        </s-paragraph>
                        {product.status && (
                          <s-paragraph>
                            <s-text>状态: {translateStatus(product.status)}</s-text>
                          </s-paragraph>
                        )}
                        {product.createdAt && (
                          <s-paragraph>
                            <s-text tone="subdued">创建于: {formatChineseDateTime(product.createdAt)}</s-text>
                          </s-paragraph>
                        )}
                      </s-stack>
                    </s-box>
                  ))}
                </s-stack>
                <s-paragraph>
                  <s-text tone="subdued">想看完整数据？下载 Excel 或 JSON 文件</s-text>
                </s-paragraph>
              </s-stack>
            </s-box>
          </s-stack>
        </s-section>
      )}

      <s-section slot="aside" heading="导出方式">
        <s-paragraph>
          <s-text as="strong">🚀 完整导出（推荐）</s-text>
        </s-paragraph>
        <s-unordered-list>
          <s-list-item>✅ 自动分页，导出所有商品</s-list-item>
          <s-list-item>✅ 最多支持 10000 个商品</s-list-item>
          <s-list-item>✅ 速度快，不会卡住</s-list-item>
          <s-list-item>✅ 支持 Excel 和 JSON 格式</s-list-item>
          <s-list-item>⏱️ 耗时：1000个商品约5-10秒</s-list-item>
        </s-unordered-list>

        <s-paragraph style={{ marginTop: "16px" }}>
          <s-text as="strong">⚡ 快速预览</s-text>
        </s-paragraph>
        <s-unordered-list>
          <s-list-item>用于测试和预览</s-list-item>
          <s-list-item>最多 250 个商品</s-list-item>
          <s-list-item>1-2 秒完成</s-list-item>
        </s-unordered-list>

        <s-paragraph style={{ marginTop: "16px" }}>
          <s-text as="strong">📦 Bulk Operation</s-text>
        </s-paragraph>
        <s-unordered-list>
          <s-list-item>仅用于超大量（10000+）</s-list-item>
          <s-list-item>需等待数分钟</s-list-item>
          <s-list-item>JSONL 格式</s-list-item>
        </s-unordered-list>
      </s-section>

      <s-section slot="aside" heading="导出格式">
        <s-paragraph>
          <s-text as="strong">📊 Excel 格式（推荐运营使用）</s-text>
        </s-paragraph>
        <s-unordered-list>
          <s-list-item>✅ 多个工作表分类展示</s-list-item>
          <s-list-item>✅ 支持筛选、排序、公式</s-list-item>
          <s-list-item>✅ Excel/WPS/Google Sheets 打开</s-list-item>
          <s-list-item>✅ 变体和图片单独工作表</s-list-item>
        </s-unordered-list>

        <s-paragraph style={{ marginTop: "16px" }}>
          <s-text as="strong">📄 JSON 格式（开发人员）</s-text>
        </s-paragraph>
        <s-unordered-list>
          <s-list-item>结构化数据，易于程序处理</s-list-item>
          <s-list-item>包含完整的嵌套信息</s-list-item>
          <s-list-item>适合二次开发使用</s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};

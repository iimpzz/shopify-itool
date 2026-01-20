import { useState, useEffect } from "react";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import {
  quickExportBlogs,
  paginatedExportBlogs,
} from "../graphql/blogExport.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return { error: null };
};

export const action = async ({ request }) => {
  await authenticate.admin(request);
  
  const formData = await request.formData();
  const intent = formData.get("intent");

  try {
    // 获取用户选择的字段
    const selectedFields = {
      title: formData.get("field_title") === "on",
      handle: formData.get("field_handle") === "on",
      summary: formData.get("field_summary") === "on",
      content: formData.get("field_content") === "on",
      author: formData.get("field_author") === "on",
      tags: formData.get("field_tags") === "on",
      publishedAt: formData.get("field_publishedAt") === "on",
      createdAt: formData.get("field_createdAt") === "on",
      updatedAt: formData.get("field_updatedAt") === "on",
      image: formData.get("field_image") === "on",
      blogInfo: formData.get("field_blogInfo") === "on",
    };

    const exportOptions = {
      includeStyles: formData.get("option_includeStyles") === "on",
      includeSummary: formData.get("option_includeSummary") === "on",
      includeFullContent: formData.get("option_includeFullContent") === "on",
    };

    if (intent === "quick_export") {
      const result = await quickExportBlogs(request, selectedFields, 250);
      return { 
        exportResult: result,
        exportOptions,
        error: null, 
        success: true 
      };
    }

    if (intent === "full_export") {
      const result = await paginatedExportBlogs(request, selectedFields, 10000);
      return { 
        exportResult: result,
        exportOptions,
        error: null, 
        success: true 
      };
    }

    return { error: null, success: true };
  } catch (error) {
    console.error("操作失败:", error);
    return { 
      error: error.message,
      success: false 
    };
  }
};

export default function BlogExportPage() {
  const loaderData = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();
  
  // 字段选择状态
  const [selectedFields, setSelectedFields] = useState({
    title: true,
    handle: false,
    summary: true,
    content: true,
    author: true,
    tags: true,
    publishedAt: true,
    createdAt: false,
    updatedAt: false,
    image: true,
    blogInfo: true,
  });

  // 导出选项
  const [exportOptions, setExportOptions] = useState({
    includeStyles: true,
    includeSummary: true,
    includeFullContent: true,
  });

  const exportResult = fetcher.data?.exportResult;
  const displayError = fetcher.data?.error ?? loaderData?.error;
  const isLoading = ["loading", "submitting"].includes(fetcher.state);

  useEffect(() => {
    if (fetcher.data?.exportResult) {
      shopify.toast.show(`导出成功！导出了 ${fetcher.data.exportResult.count} 篇文章`);
    }
    if (fetcher.data?.error) {
      shopify.toast.show("操作失败: " + fetcher.data.error, { 
        isError: true 
      });
    }
  }, [fetcher.data?.exportResult, fetcher.data?.error, shopify]);

  const handleFieldChange = (field) => {
    setSelectedFields((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const handleOptionChange = (option) => {
    setExportOptions((prev) => ({
      ...prev,
      [option]: !prev[option],
    }));
  };

  const handleQuickExport = () => {
    const formData = new FormData();
    formData.append("intent", "quick_export");
    
    Object.entries(selectedFields).forEach(([key, value]) => {
      if (value) {
        formData.append(`field_${key}`, "on");
      }
    });

    Object.entries(exportOptions).forEach(([key, value]) => {
      if (value) {
        formData.append(`option_${key}`, "on");
      }
    });
    
    fetcher.submit(formData, { method: "POST" });
  };

  const handleFullExport = () => {
    const formData = new FormData();
    formData.append("intent", "full_export");
    
    Object.entries(selectedFields).forEach(([key, value]) => {
      if (value) {
        formData.append(`field_${key}`, "on");
      }
    });

    Object.entries(exportOptions).forEach(([key, value]) => {
      if (value) {
        formData.append(`option_${key}`, "on");
      }
    });
    
    fetcher.submit(formData, { method: "POST" });
  };

  // 格式化时间为中国习惯格式
  const formatChineseDateTime = (isoString) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
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

  const generateHTMLContent = (articles, options) => {
    const { includeSummary, includeFullContent } = options;
    const exportDate = formatChineseDateTime(new Date().toISOString());
    
    const articlesHTML = articles.map(article => {
      const authorName = article.author?.name || '未知作者';
      const publishedDate = formatChineseDateTime(article.publishedAt);
      const createdDate = formatChineseDateTime(article.createdAt);
      const updatedDate = formatChineseDateTime(article.updatedAt);
      const tags = Array.isArray(article.tags) ? article.tags.join(', ') : article.tags || '';
      const imageUrl = article.image?.url || '';
      const imageAlt = article.image?.altText || article.title;
      const blogTitle = article.blog?.title || '';

      return `
        <article class="blog-article">
          <header class="article-header">
            <h2 class="article-title">${article.title || '无标题'}</h2>
            <div class="article-meta">
              <span class="author">作者: ${authorName}</span>
              ${blogTitle ? `<span class="blog-name">博客: ${blogTitle}</span>` : ''}
              ${publishedDate ? `<span class="published-date">发布时间: ${publishedDate}</span>` : ''}
            </div>
            ${tags ? `<div class="article-tags">标签: ${tags}</div>` : ''}
          </header>

          ${imageUrl ? `
          <div class="article-image">
            <img src="${imageUrl}" alt="${imageAlt}" />
          </div>
          ` : ''}

          ${includeSummary && article.summary ? `
          <div class="article-summary">
            <h3>摘要</h3>
            <p>${article.summary}</p>
          </div>
          ` : ''}

          ${includeFullContent && article.body ? `
          <div class="article-content">
            ${article.body}
          </div>
          ` : ''}

          <footer class="article-footer">
            <div class="article-dates">
              ${createdDate ? `<span>创建时间: ${createdDate}</span>` : ''}
              ${updatedDate ? `<span>更新时间: ${updatedDate}</span>` : ''}
            </div>
          </footer>
        </article>
      `;
    }).join('\n');

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>博客文章导出</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #333; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; min-height: 100vh; }
    .container { max-width: 1200px; margin: 0 auto; background-color: #fff; padding: 50px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); border-radius: 12px; }
    .header { text-align: center; border-bottom: 4px solid #667eea; padding-bottom: 30px; margin-bottom: 50px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px; margin: -50px -50px 50px -50px; border-radius: 12px 12px 0 0; }
    .header h1 { font-size: 3em; margin-bottom: 15px; font-weight: 700; text-shadow: 2px 2px 4px rgba(0,0,0,0.2); }
    .header-info { font-size: 1.1em; opacity: 0.95; }
    .blog-article { margin-bottom: 60px; padding-bottom: 40px; border-bottom: 3px solid #f0f0f0; }
    .blog-article:last-child { border-bottom: none; }
    .article-title { color: #2c3e50; font-size: 2.5em; margin-bottom: 20px; line-height: 1.3; font-weight: 700; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .article-meta { display: flex; flex-wrap: wrap; gap: 25px; color: #666; font-size: 0.95em; margin-bottom: 15px; padding: 15px; background-color: #f8f9fa; border-radius: 8px; }
    .article-meta span { display: inline-flex; align-items: center; padding: 5px 12px; background-color: white; border-radius: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    .article-tags { color: #667eea; font-size: 0.95em; margin-top: 15px; padding: 10px 15px; background-color: #f0f4ff; border-radius: 6px; border-left: 4px solid #667eea; }
    .article-image { margin: 30px 0; text-align: center; border-radius: 12px; overflow: hidden; box-shadow: 0 8px 20px rgba(0,0,0,0.15); }
    .article-image img { max-width: 100%; height: auto; display: block; }
    .article-summary { background: linear-gradient(135deg, #f0f4ff 0%, #e8f0fe 100%); padding: 25px; border-left: 5px solid #667eea; margin: 30px 0; border-radius: 8px; }
    .article-summary h3 { color: #667eea; margin-bottom: 15px; font-size: 1.4em; font-weight: 600; }
    .article-summary p { color: #555; font-size: 1.1em; line-height: 1.8; }
    .article-content { margin: 35px 0; font-size: 1.1em; line-height: 1.9; color: #444; }
    .article-content h1, .article-content h2, .article-content h3 { margin-top: 35px; margin-bottom: 20px; color: #2c3e50; font-weight: 600; }
    .article-content p { margin-bottom: 18px; }
    .article-content img { max-width: 100%; height: auto; margin: 25px 0; border-radius: 8px; }
    .article-content a { color: #667eea; text-decoration: none; }
    .article-content a:hover { text-decoration: underline; }
    .article-footer { margin-top: 25px; padding-top: 20px; border-top: 2px solid #f0f0f0; }
    .article-dates { display: flex; gap: 25px; flex-wrap: wrap; color: #999; font-size: 0.9em; }
    .footer { text-align: center; margin-top: 50px; padding-top: 30px; border-top: 3px solid #f0f0f0; color: #999; font-size: 0.95em; }
    @media (max-width: 768px) { .container { padding: 25px; } .header { padding: 25px; margin: -25px -25px 30px -25px; } .header h1 { font-size: 2em; } .article-title { font-size: 1.8em; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>博客文章导出</h1>
      <div class="header-info">
        <p>📅 导出时间: ${exportDate}</p>
        <p>📚 文章总数: ${articles.length} 篇</p>
      </div>
    </div>
    <div class="articles">
      ${articlesHTML}
    </div>
    <div class="footer">
      <p>━━━━━━━━━━━━━━━━━━</p>
      <p>📖 本文件由 Shopify 博客导出工具自动生成</p>
      <p>💻 支持浏览器查看、打印和保存为 PDF</p>
    </div>
  </div>
</body>
</html>`;
  };

  const handleDownloadHTML = () => {
    if (!exportResult?.articles) return;
    
    const options = fetcher.data?.exportOptions || exportOptions;
    const html = generateHTMLContent(exportResult.articles, options);
    
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `blog-export-${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadJSON = () => {
    if (!exportResult?.articles) return;
    
    const dataStr = JSON.stringify(exportResult.articles, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `blog-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <s-page heading="博客文章导出工具">
      <s-section heading="功能说明">
        <s-paragraph>
          导出店铺的博客文章内容和摘要，支持导出为精美的 HTML 格式或 JSON 格式。
          HTML 格式包含完整的样式，可以直接在浏览器中查看或打印。
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
              <span>文章标题 (Title)</span>
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
                checked={selectedFields.summary}
                onChange={() => handleFieldChange("summary")}
              />
              <span>文章摘要 (Summary)</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="checkbox"
                checked={selectedFields.content}
                onChange={() => handleFieldChange("content")}
              />
              <span>完整内容 HTML (Content HTML)</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="checkbox"
                checked={selectedFields.author}
                onChange={() => handleFieldChange("author")}
              />
              <span>作者信息 (Author)</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="checkbox"
                checked={selectedFields.tags}
                onChange={() => handleFieldChange("tags")}
              />
              <span>标签 (Tags)</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="checkbox"
                checked={selectedFields.image}
                onChange={() => handleFieldChange("image")}
              />
              <span>特色图片 (Featured Image)</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="checkbox"
                checked={selectedFields.blogInfo}
                onChange={() => handleFieldChange("blogInfo")}
              />
              <span>博客信息 (Blog Info)</span>
            </label>
          </s-stack>

          <s-paragraph style={{ marginTop: "16px" }}>
            <s-text as="strong">时间信息：</s-text>
          </s-paragraph>
          <s-stack direction="block" gap="small">
            <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="checkbox"
                checked={selectedFields.publishedAt}
                onChange={() => handleFieldChange("publishedAt")}
              />
              <span>发布时间 (Published At)</span>
            </label>
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
          </s-stack>
        </s-stack>
      </s-section>

      <s-section heading="HTML 导出选项">
        <s-stack direction="block" gap="small">
          <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <input
              type="checkbox"
              checked={exportOptions.includeStyles}
              onChange={() => handleOptionChange("includeStyles")}
            />
            <span>包含样式 (推荐)</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <input
              type="checkbox"
              checked={exportOptions.includeSummary}
              onChange={() => handleOptionChange("includeSummary")}
            />
            <span>显示摘要</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <input
              type="checkbox"
              checked={exportOptions.includeFullContent}
              onChange={() => handleOptionChange("includeFullContent")}
            />
            <span>显示完整内容</span>
          </label>
        </s-stack>
      </s-section>

      <s-section heading="导出操作">
        <s-stack direction="block" gap="base">
          {displayError && (
            <s-box
              padding="base"
              borderWidth="base"
              borderRadius="base"
              background="critical-subdued"
            >
              <s-paragraph>
                <s-text tone="critical">⚠️ 错误：{displayError}</s-text>
              </s-paragraph>
            </s-box>
          )}

          <s-stack direction="inline" gap="base">
            <s-button
              onClick={handleQuickExport}
              variant="primary"
              {...(isLoading ? { loading: true } : {})}
            >
              ⚡ 快速预览（250篇）
            </s-button>

            <s-button
              onClick={handleFullExport}
              variant="primary"
              {...(isLoading ? { loading: true } : {})}
            >
              🚀 完整导出（所有文章）
            </s-button>
          </s-stack>

          <s-paragraph>
            <s-text tone="subdued">
              推荐使用【完整导出】，自动分页获取所有文章（最多10000篇）
            </s-text>
          </s-paragraph>
        </s-stack>
      </s-section>

      {exportResult && (
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
                  <s-text as="strong">✅ {exportResult.message}</s-text>
                </s-paragraph>
                
                <s-paragraph>
                  <s-text as="strong">选择下载格式：</s-text>
                </s-paragraph>
                
                <s-stack direction="inline" gap="base">
                  <s-button onClick={handleDownloadHTML} variant="primary">
                    📄 下载 HTML 文件（推荐）
                  </s-button>
                  <s-button onClick={handleDownloadJSON} variant="secondary">
                    📋 下载 JSON 文件
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
                      <s-text as="strong">📄 HTML 文件特点：</s-text>
                    </s-paragraph>
                    <s-unordered-list>
                      <s-list-item>✅ 精美的排版和样式</s-list-item>
                      <s-list-item>✅ 可直接在浏览器中打开查看</s-list-item>
                      <s-list-item>✅ 支持打印和保存为PDF</s-list-item>
                      <s-list-item>✅ 包含完整的文章内容和摘要</s-list-item>
                      <s-list-item>✅ 响应式设计，支持手机查看</s-list-item>
                    </s-unordered-list>
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
                  <s-text as="strong">预览数据（前 3 篇文章）：</s-text>
                </s-paragraph>
                <s-stack direction="block" gap="base">
                  {exportResult.articles.slice(0, 3).map((article, index) => (
                    <s-box 
                      key={index}
                      padding="small" 
                      borderWidth="base" 
                      borderRadius="base"
                      background="surface"
                    >
                      <s-stack direction="block" gap="small">
                        <s-paragraph>
                          <s-text as="strong">{article.title || '无标题'}</s-text>
                        </s-paragraph>
                        {article.summary && (
                          <s-paragraph>
                            <s-text tone="subdued">{article.summary.substring(0, 100)}...</s-text>
                          </s-paragraph>
                        )}
                        {article.author?.name && (
                          <s-paragraph>
                            <s-text>作者: {article.author.name}</s-text>
                          </s-paragraph>
                        )}
                        {article.blog?.title && (
                          <s-paragraph>
                            <s-text tone="subdued">博客: {article.blog.title}</s-text>
                          </s-paragraph>
                        )}
                      </s-stack>
                    </s-box>
                  ))}
                </s-stack>
                <s-paragraph>
                  <s-text tone="subdued">下载完整文件查看所有内容</s-text>
                </s-paragraph>
              </s-stack>
            </s-box>
          </s-stack>
        </s-section>
      )}

      <s-section slot="aside" heading="导出格式说明">
        <s-paragraph>
          <s-text as="strong">📄 HTML 格式（推荐）</s-text>
        </s-paragraph>
        <s-unordered-list>
          <s-list-item>✅ 精美的网页格式</s-list-item>
          <s-list-item>✅ 包含完整样式</s-list-item>
          <s-list-item>✅ 可直接分享或打印</s-list-item>
          <s-list-item>✅ 响应式设计</s-list-item>
        </s-unordered-list>

        <s-paragraph style={{ marginTop: "16px" }}>
          <s-text as="strong">📋 JSON 格式</s-text>
        </s-paragraph>
        <s-unordered-list>
          <s-list-item>结构化数据</s-list-item>
          <s-list-item>易于程序处理</s-list-item>
          <s-list-item>适合二次开发</s-list-item>
        </s-unordered-list>
      </s-section>

      <s-section slot="aside" heading="使用场景">
        <s-unordered-list>
          <s-list-item>📚 博客内容备份</s-list-item>
          <s-list-item>📱 离线阅读</s-list-item>
          <s-list-item>📧 内容分享</s-list-item>
          <s-list-item>🖨️ 打印存档</s-list-item>
          <s-list-item>📊 内容分析</s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};


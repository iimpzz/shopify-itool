// app/graphql/blogExport.server.js
import { authenticate } from "../shopify.server";

// 构建博客查询字段
function buildBlogFields(selectedFields) {
  const fields = ["id"];
  if (selectedFields.title) fields.push("title");
  if (selectedFields.handle) fields.push("handle");
  if (selectedFields.summary) fields.push("summary");
  if (selectedFields.content) fields.push("body");
  if (selectedFields.author) fields.push("author { name }");
  if (selectedFields.tags) fields.push("tags");
  if (selectedFields.publishedAt) fields.push("publishedAt");
  if (selectedFields.createdAt) fields.push("createdAt");
  if (selectedFields.updatedAt) fields.push("updatedAt");

  let imageField = "";
  if (selectedFields.image) {
    imageField = `
      image {
        url
        altText
      }
    `;
  }

  let blogField = "";
  if (selectedFields.blogInfo) {
    blogField = `
      blog {
        id
        title
        handle
      }
    `;
  }

  return {
    fieldsString: fields.join("\n        "),
    imageField,
    blogField
  };
}

// 快速导出博客文章（直接 GraphQL 查询，适合小量数据）
export async function quickExportBlogs(request, selectedFields, limit = 250) {
  const { admin } = await authenticate.admin(request);

  const { fieldsString, imageField, blogField } = buildBlogFields(selectedFields);

  const query = `#graphql
    query QuickExportArticles {
      articles(first: ${limit}) {
        edges {
          node {
            ${fieldsString}
            ${imageField}
            ${blogField}
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `;

  const response = await admin.graphql(query);
  const json = await response.json();

  if (json.errors) {
    throw new Error("GraphQL 错误: " + JSON.stringify(json.errors));
  }

  const articles = json.data?.articles?.edges?.map(edge => edge.node) || [];
  const hasMore = json.data?.articles?.pageInfo?.hasNextPage || false;

  return {
    articles,
    count: articles.length,
    hasMore,
    message: hasMore ? `已导出前 ${limit} 篇文章（还有更多）` : `已导出全部 ${articles.length} 篇文章`
  };
}

// 分页导出所有博客文章（自动处理分页，适合大量文章）
export async function paginatedExportBlogs(request, selectedFields, maxArticles = 10000) {
  const { admin } = await authenticate.admin(request);

  const { fieldsString, imageField, blogField } = buildBlogFields(selectedFields);
  
  let allArticles = [];
  let hasNextPage = true;
  let cursor = null;
  const pageSize = 250;

  while (hasNextPage && allArticles.length < maxArticles) {
    const query = `#graphql
      query PaginatedExportArticles${cursor ? '($cursor: String!)' : ''} {
        articles(first: ${pageSize}${cursor ? ', after: $cursor' : ''}) {
          edges {
            node {
              ${fieldsString}
              ${imageField}
              ${blogField}
            }
            cursor
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    const variables = cursor ? { cursor } : {};
    const response = await admin.graphql(query, { variables });
    const json = await response.json();

    if (json.errors) {
      throw new Error("GraphQL 错误: " + JSON.stringify(json.errors));
    }

    const edges = json.data?.articles?.edges || [];
    const articles = edges.map(edge => edge.node);
    
    allArticles = allArticles.concat(articles);
    
    hasNextPage = json.data?.articles?.pageInfo?.hasNextPage || false;
    cursor = json.data?.articles?.pageInfo?.endCursor;

    if (!hasNextPage || articles.length === 0) {
      break;
    }
  }

  const hasMore = allArticles.length >= maxArticles;

  return {
    articles: allArticles,
    count: allArticles.length,
    hasMore,
    message: hasMore 
      ? `已导出 ${allArticles.length} 篇文章（达到上限，可能还有更多）` 
      : `已成功导出全部 ${allArticles.length} 篇文章`
  };
}

// 生成 HTML 导出
export function generateHTMLExport(articles, options = {}) {
  const {
    includeSummary = true,
    includeFullContent = true,
    title = '博客文章导出'
  } = options;

  // 使用内置模板
  const template = getDefaultTemplate();

  // 格式化时间
  const formatDateTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleString('zh-CN', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // 生成文章 HTML
  const articlesHTML = articles.map(article => {
    const authorName = article.authorV2?.name || '未知作者';
    const authorEmail = article.authorV2?.email || '';
    const publishedDate = formatDateTime(article.publishedAt);
    const createdDate = formatDateTime(article.createdAt);
    const updatedDate = formatDateTime(article.updatedAt);
    const tags = Array.isArray(article.tags) ? article.tags.join(', ') : article.tags || '';
    const imageUrl = article.image?.url || '';
    const imageAlt = article.image?.altText || article.title;
    const blogTitle = article.blog?.title || '';

    return `
      <article class="blog-article">
        <header class="article-header">
          <h2 class="article-title">${article.title || '无标题'}</h2>
          <div class="article-meta">
            <span class="author">作者: ${authorName}${authorEmail ? ` (${authorEmail})` : ''}</span>
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

        ${includeFullContent && article.contentHtml ? `
        <div class="article-content">
          ${article.contentHtml}
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

  // 替换模板中的占位符
  const html = template
    .replace('{{TITLE}}', title)
    .replace('{{EXPORT_DATE}}', new Date().toLocaleString('zh-CN'))
    .replace('{{ARTICLE_COUNT}}', articles.length)
    .replace('{{ARTICLES}}', articlesHTML);

  return html;
}

// 默认 HTML 模板
function getDefaultTemplate() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{TITLE}}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f5f5f5;
      padding: 20px;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background-color: #fff;
      padding: 40px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      border-radius: 8px;
    }
    
    .header {
      text-align: center;
      border-bottom: 3px solid #007bff;
      padding-bottom: 20px;
      margin-bottom: 40px;
    }
    
    .header h1 {
      color: #007bff;
      font-size: 2.5em;
      margin-bottom: 10px;
    }
    
    .header-info {
      color: #666;
      font-size: 0.95em;
    }
    
    .blog-article {
      margin-bottom: 50px;
      padding-bottom: 30px;
      border-bottom: 2px solid #e0e0e0;
    }
    
    .blog-article:last-child {
      border-bottom: none;
    }
    
    .article-header {
      margin-bottom: 20px;
    }
    
    .article-title {
      color: #2c3e50;
      font-size: 2em;
      margin-bottom: 15px;
      line-height: 1.3;
    }
    
    .article-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      color: #666;
      font-size: 0.9em;
      margin-bottom: 10px;
    }
    
    .article-meta span {
      display: inline-flex;
      align-items: center;
    }
    
    .article-tags {
      color: #007bff;
      font-size: 0.9em;
      margin-top: 10px;
    }
    
    .article-image {
      margin: 25px 0;
      text-align: center;
    }
    
    .article-image img {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    
    .article-summary {
      background-color: #f8f9fa;
      padding: 20px;
      border-left: 4px solid #007bff;
      margin: 25px 0;
      border-radius: 4px;
    }
    
    .article-summary h3 {
      color: #007bff;
      margin-bottom: 10px;
      font-size: 1.2em;
    }
    
    .article-summary p {
      color: #555;
      font-size: 1.05em;
      line-height: 1.7;
    }
    
    .article-content {
      margin: 30px 0;
      font-size: 1.05em;
      line-height: 1.8;
    }
    
    .article-content h1, 
    .article-content h2, 
    .article-content h3, 
    .article-content h4, 
    .article-content h5, 
    .article-content h6 {
      margin-top: 30px;
      margin-bottom: 15px;
      color: #2c3e50;
    }
    
    .article-content p {
      margin-bottom: 15px;
    }
    
    .article-content img {
      max-width: 100%;
      height: auto;
      margin: 20px 0;
      border-radius: 4px;
    }
    
    .article-content a {
      color: #007bff;
      text-decoration: none;
    }
    
    .article-content a:hover {
      text-decoration: underline;
    }
    
    .article-content ul, 
    .article-content ol {
      margin: 15px 0;
      padding-left: 30px;
    }
    
    .article-content li {
      margin-bottom: 8px;
    }
    
    .article-content blockquote {
      border-left: 4px solid #ddd;
      padding-left: 20px;
      margin: 20px 0;
      color: #666;
      font-style: italic;
    }
    
    .article-content pre {
      background-color: #f4f4f4;
      padding: 15px;
      border-radius: 4px;
      overflow-x: auto;
      margin: 20px 0;
    }
    
    .article-content code {
      background-color: #f4f4f4;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Courier New', monospace;
      font-size: 0.9em;
    }
    
    .article-footer {
      margin-top: 20px;
      padding-top: 15px;
      border-top: 1px solid #e0e0e0;
    }
    
    .article-dates {
      display: flex;
      gap: 20px;
      flex-wrap: wrap;
      color: #999;
      font-size: 0.85em;
    }
    
    .footer {
      text-align: center;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #e0e0e0;
      color: #999;
      font-size: 0.9em;
    }
    
    @media print {
      body {
        background-color: #fff;
        padding: 0;
      }
      
      .container {
        box-shadow: none;
        padding: 20px;
      }
    }
    
    @media (max-width: 768px) {
      .container {
        padding: 20px;
      }
      
      .header h1 {
        font-size: 1.8em;
      }
      
      .article-title {
        font-size: 1.5em;
      }
      
      .article-meta {
        flex-direction: column;
        gap: 8px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>{{TITLE}}</h1>
      <div class="header-info">
        <p>导出时间: {{EXPORT_DATE}}</p>
        <p>文章总数: {{ARTICLE_COUNT}} 篇</p>
      </div>
    </div>
    
    <div class="articles">
      {{ARTICLES}}
    </div>
    
    <div class="footer">
      <p>本文件由 Shopify 博客导出工具自动生成</p>
    </div>
  </div>
</body>
</html>`;
}


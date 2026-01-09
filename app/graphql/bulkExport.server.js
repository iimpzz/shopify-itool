// app/graphql/bulkExport.server.js
import { authenticate } from "../shopify.server";

// ✅ 已验证的 query：查询当前 Bulk 状态
const GET_CURRENT_PRODUCTS_BULK_OPERATION = `#graphql
query GetCurrentProductsBulkOperation {
  currentBulkOperation(type: QUERY) {
    id
    status
    errorCode
    objectCount
    rootObjectCount
    url
    partialDataUrl
  }
}
`;

// 构建动态的产品导出 GraphQL 查询
function buildProductsExportQuery(selectedFields) {
  // 基础字段（始终包含 id）
  const fields = ["id"];
  
  // 根据用户选择添加字段
  if (selectedFields.title) fields.push("title");
  if (selectedFields.description) fields.push("descriptionHtml");
  if (selectedFields.handle) fields.push("handle");
  if (selectedFields.status) fields.push("status");
  if (selectedFields.vendor) fields.push("vendor");
  if (selectedFields.productType) fields.push("productType");
  if (selectedFields.tags) fields.push("tags");
  if (selectedFields.createdAt) fields.push("createdAt");
  if (selectedFields.updatedAt) fields.push("updatedAt");
  if (selectedFields.publishedAt) fields.push("publishedAt");
  
  // 变体字段
  if (selectedFields.variants) {
    fields.push(`variants(first: 250) {
      edges {
        node {
          id
          title
          price
          sku
          inventoryQuantity
        }
      }
    }`);
  }
  
  // 图片字段
  if (selectedFields.images) {
    fields.push(`images(first: 250) {
      edges {
        node {
          id
          url
          altText
        }
      }
    }`);
  }

  const fieldsString = fields.join("\n            ");
  
  return `#graphql
mutation RunProductsExport {
  bulkOperationRunQuery(
    query: """
    {
      products {
        edges {
          node {
            ${fieldsString}
          }
        }
      }
    }
    """,
    groupObjects: false
  ) {
    bulkOperation {
      id
      status
    }
    userErrors {
      field
      message
    }
  }
}
`;
}

// 启动 Bulk Operation（支持动态字段选择）
export async function runProductsExport(request, selectedFields) {
  const { admin } = await authenticate.admin(request);

  const query = buildProductsExportQuery(selectedFields);
  const response = await admin.graphql(query);
  const json = await response.json();

  const payload = json.data?.bulkOperationRunQuery;
  if (!payload) {
    throw new Error("bulkOperationRunQuery 返回为空: " + JSON.stringify(json));
  }

  if (payload.userErrors && payload.userErrors.length > 0) {
    throw new Error(
      "bulkOperationRunQuery userErrors: " + JSON.stringify(payload.userErrors)
    );
  }

  return payload.bulkOperation; // { id, status }
}

// 查询当前 Bulk 状态
export async function getCurrentProductsBulkOperation(request) {
  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(GET_CURRENT_PRODUCTS_BULK_OPERATION);
  const json = await response.json();

  return json.data?.currentBulkOperation || null;
}

// 构建产品查询字段
function buildProductFields(selectedFields) {
  const fields = ["id"];
  if (selectedFields.title) fields.push("title");
  if (selectedFields.description) fields.push("descriptionHtml");
  if (selectedFields.handle) fields.push("handle");
  if (selectedFields.status) fields.push("status");
  if (selectedFields.vendor) fields.push("vendor");
  if (selectedFields.productType) fields.push("productType");
  if (selectedFields.tags) fields.push("tags");
  if (selectedFields.createdAt) fields.push("createdAt");
  if (selectedFields.updatedAt) fields.push("updatedAt");
  if (selectedFields.publishedAt) fields.push("publishedAt");

  let variantsFields = "";
  if (selectedFields.variants) {
    variantsFields = `
      variants(first: 10) {
        edges {
          node {
            id
            title
            price
            sku
            inventoryQuantity
          }
        }
      }
    `;
  }

  let imagesFields = "";
  if (selectedFields.images) {
    imagesFields = `
      images(first: 10) {
        edges {
          node {
            id
            url
            altText
          }
        }
      }
    `;
  }

  return {
    fieldsString: fields.join("\n        "),
    variantsFields,
    imagesFields
  };
}

// 快速导出（直接 GraphQL 查询，适合小量数据）
export async function quickExportProducts(request, selectedFields, limit = 250) {
  const { admin } = await authenticate.admin(request);

  const { fieldsString, variantsFields, imagesFields } = buildProductFields(selectedFields);

  const query = `#graphql
    query QuickExportProducts {
      products(first: ${limit}) {
        edges {
          node {
            ${fieldsString}
            ${variantsFields}
            ${imagesFields}
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

  const products = json.data?.products?.edges?.map(edge => edge.node) || [];
  const hasMore = json.data?.products?.pageInfo?.hasNextPage || false;

  return {
    products,
    count: products.length,
    hasMore,
    message: hasMore ? `已导出前 ${limit} 个商品（还有更多）` : `已导出全部 ${products.length} 个商品`
  };
}

// 分页导出所有商品（自动处理分页，适合大量商品）
export async function paginatedExportProducts(request, selectedFields, maxProducts = 10000) {
  const { admin } = await authenticate.admin(request);

  const { fieldsString, variantsFields, imagesFields } = buildProductFields(selectedFields);
  
  let allProducts = [];
  let hasNextPage = true;
  let cursor = null;
  const pageSize = 250; // 每页250个，这是Shopify推荐的大小

  while (hasNextPage && allProducts.length < maxProducts) {
    const query = `#graphql
      query PaginatedExportProducts${cursor ? '($cursor: String!)' : ''} {
        products(first: ${pageSize}${cursor ? ', after: $cursor' : ''}) {
          edges {
            node {
              ${fieldsString}
              ${variantsFields}
              ${imagesFields}
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

    const edges = json.data?.products?.edges || [];
    const products = edges.map(edge => edge.node);
    
    allProducts = allProducts.concat(products);
    
    hasNextPage = json.data?.products?.pageInfo?.hasNextPage || false;
    cursor = json.data?.products?.pageInfo?.endCursor;

    // 如果没有更多数据，退出循环
    if (!hasNextPage || products.length === 0) {
      break;
    }
  }

  const hasMore = allProducts.length >= maxProducts;

  return {
    products: allProducts,
    count: allProducts.length,
    hasMore,
    message: hasMore 
      ? `已导出 ${allProducts.length} 个商品（达到上限，可能还有更多）` 
      : `已成功导出全部 ${allProducts.length} 个商品`
  };
}
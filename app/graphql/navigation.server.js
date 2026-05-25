// app/graphql/navigation.server.js
import { authenticate } from "../shopify.server";

// 查询元对象条目（通过 handle）
const GET_METAOBJECT_BY_HANDLE = `#graphql
  query GetMetaobjectByHandle($handle: MetaobjectHandleInput!) {
    metaobjectByHandle(handle: $handle) {
      id
      handle
      type
      displayName
      fields {
        key
        value
        type
      }
      updatedAt
    }
  }
`;

// 更新元对象条目
const UPDATE_METAOBJECT = `#graphql
  mutation UpdateMetaobject($id: ID!, $metaobject: MetaobjectUpdateInput!) {
    metaobjectUpdate(id: $id, metaobject: $metaobject) {
      metaobject {
        id
        handle
        fields {
          key
          value
        }
        updatedAt
      }
      userErrors {
        field
        message
      }
    }
  }
`;

// 读取导航配置
export async function getNavigationConfig(request, metaobjectType = null, handle = "main-navigation-qqzczp0o") {
  const { admin } = await authenticate.admin(request);
  
  try {
    // 如果没有提供类型，尝试常见的类型
    const typesToTry = metaobjectType 
      ? [metaobjectType] 
      : ["main_navigation", "navigation", "main-navigation", "menu"];
    
    let metaobject = null;
    let lastError = null;
    
    // 尝试不同的类型
    for (const type of typesToTry) {
      try {
        const response = await admin.graphql(GET_METAOBJECT_BY_HANDLE, {
          variables: {
            handle: {
              type: type,
              handle: handle
            }
          }
        });

        const { data, errors } = await response.json();

        if (errors) {
          lastError = new Error(`GraphQL errors: ${JSON.stringify(errors)}`);
          continue;
        }

        if (data?.metaobjectByHandle) {
          metaobject = data.metaobjectByHandle;
          break;
        }
      } catch (error) {
        lastError = error;
        continue;
      }
    }

    if (!metaobject) {
      throw lastError || new Error("未找到导航配置元对象。请检查 handle 和类型是否正确。");
    }
    
    // 查找存储 JSON 数据的字段（尝试多种可能的字段名）
    const possibleFieldKeys = ["json", "data", "navigation_data", "content", "config", "navigation"];
    let jsonField = null;
    
    for (const key of possibleFieldKeys) {
      const field = metaobject.fields.find(f => f.key === key);
      if (field && field.value) {
        // 检查是否是 JSON 格式
        try {
          JSON.parse(field.value);
          jsonField = field;
          break;
        } catch (e) {
          // 不是 JSON，继续尝试下一个字段
          continue;
        }
      }
    }
    
    // 如果没找到，尝试查找所有字段，看哪个是 JSON 类型
    if (!jsonField) {
      for (const field of metaobject.fields) {
        if (field.type === "json" || field.type === "multi_line_text_field") {
          try {
            JSON.parse(field.value);
            jsonField = field;
            break;
          } catch (e) {
            continue;
          }
        }
      }
    }

    if (!jsonField) {
      // 返回所有字段信息以便调试
      const fieldKeys = metaobject.fields.map(f => `${f.key} (${f.type})`).join(", ");
      throw new Error(`未找到 JSON 数据字段。可用字段: ${fieldKeys}`);
    }

    // 解析 JSON 数据
    let navigationData;
    try {
      navigationData = JSON.parse(jsonField.value);
    } catch (e) {
      throw new Error(`JSON 解析失败: ${e.message}`);
    }

    return {
      metaobjectId: metaobject.id,
      handle: metaobject.handle,
      type: metaobject.type,
      jsonFieldKey: jsonField.key,
      navigationData,
      updatedAt: metaobject.updatedAt,
      allFields: metaobject.fields.map(f => ({ key: f.key, type: f.type }))
    };
  } catch (error) {
    console.error("读取导航配置失败:", error);
    throw error;
  }
}

// 更新导航配置
export async function updateNavigationConfig(request, navigationData, jsonFieldKey = null) {
  const { admin } = await authenticate.admin(request);
  
  try {
    // 首先获取元对象 ID 和字段信息
    const currentConfig = await getNavigationConfig(request);
    
    // 使用检测到的字段 key，如果没有则使用传入的参数
    const fieldKey = jsonFieldKey || currentConfig.jsonFieldKey || "json";
    
    // 将导航数据转换为 JSON 字符串
    const jsonValue = JSON.stringify(navigationData, null, 2);
    
    const response = await admin.graphql(UPDATE_METAOBJECT, {
      variables: {
        id: currentConfig.metaobjectId,
        metaobject: {
          fields: [
            {
              key: fieldKey,
              value: jsonValue
            }
          ]
        }
      }
    });

    const { data, errors } = await response.json();

    if (errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(errors)}`);
    }

    if (data?.metaobjectUpdate?.userErrors?.length > 0) {
      const errorMessages = data.metaobjectUpdate.userErrors
        .map(err => `${err.field}: ${err.message}`)
        .join(", ");
      throw new Error(`更新失败: ${errorMessages}`);
    }

    return {
      success: true,
      metaobject: data.metaobjectUpdate.metaobject,
      updatedAt: data.metaobjectUpdate.metaobject.updatedAt
    };
  } catch (error) {
    console.error("更新导航配置失败:", error);
    throw error;
  }
}


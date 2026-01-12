import { useState, useEffect } from "react";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import {
  getNavigationConfig,
  updateNavigationConfig,
} from "../graphql/navigation.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  try {
    const config = await getNavigationConfig(request);
    return { config, error: null };
  } catch (error) {
    console.error("加载导航配置失败:", error);
    return {
      config: null,
      error: error.message || "加载导航配置失败",
    };
  }
};

export const action = async ({ request }) => {
  await authenticate.admin(request);

  const formData = await request.formData();
  const intent = formData.get("intent");

  try {
    if (intent === "save") {
      const navigationDataJson = formData.get("navigationData");
      const navigationData = JSON.parse(navigationDataJson);

      const result = await updateNavigationConfig(request, navigationData);
      return {
        success: true,
        message: "导航配置已保存",
        updatedAt: result.updatedAt,
        error: null,
      };
    }

    return { success: false, error: "未知操作" };
  } catch (error) {
    console.error("保存导航配置失败:", error);
    return {
      success: false,
      error: error.message || "保存导航配置失败",
    };
  }
};

// 导航项编辑组件
function NavigationItemEditor({ item, onUpdate, onDelete, level = 0 }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState(item);

  const hasChildren = item.children && item.children.length > 0;

  const handleSave = () => {
    onUpdate(editData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditData(item);
    setIsEditing(false);
  };

  const handleAddChild = () => {
    const newChild = {
      title: "新菜单项",
      handle: "",
      url: "",
      type: "http_link",
      active: false,
    };
    const updated = {
      ...editData,
      children: [...(editData.children || []), newChild],
    };
    setEditData(updated);
    onUpdate(updated);
  };

  const handleUpdateChild = (index, updatedChild) => {
    const updated = {
      ...editData,
      children: editData.children.map((child, i) =>
        i === index ? updatedChild : child
      ),
    };
    setEditData(updated);
    onUpdate(updated);
  };

  const handleDeleteChild = (index) => {
    const updated = {
      ...editData,
      children: editData.children.filter((_, i) => i !== index),
    };
    setEditData(updated);
    onUpdate(updated);
  };

  return (
    <div
      style={{
        marginLeft: `${level * 20}px`,
        marginBottom: "8px",
        border: "1px solid #e1e3e5",
        borderRadius: "4px",
        padding: "12px",
        backgroundColor: level === 0 ? "#f6f6f7" : "#ffffff",
      }}
    >
      {isEditing ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder="标题"
              value={editData.title || ""}
              onChange={(e) =>
                setEditData({ ...editData, title: e.target.value })
              }
              style={{ flex: 1, minWidth: "150px", padding: "6px" }}
            />
            <input
              type="text"
              placeholder="Handle"
              value={editData.handle || ""}
              onChange={(e) =>
                setEditData({ ...editData, handle: e.target.value })
              }
              style={{ flex: 1, minWidth: "150px", padding: "6px" }}
            />
            <select
              value={editData.type || "http_link"}
              onChange={(e) =>
                setEditData({ ...editData, type: e.target.value })
              }
              style={{ padding: "6px" }}
            >
              <option value="http_link">HTTP 链接</option>
              <option value="collection_link">集合链接</option>
              <option value="collections_link">集合链接（多）</option>
              <option value="product_link">商品链接</option>
            </select>
          </div>
          <input
            type="text"
            placeholder="URL"
            value={editData.url || ""}
            onChange={(e) => setEditData({ ...editData, url: e.target.value })}
            style={{ padding: "6px" }}
          />
          
          {/* 图片字段 */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px", borderTop: "1px solid #e1e3e5", paddingTop: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label style={{ fontSize: "12px", fontWeight: "bold", color: "#6d7175" }}>图片设置</label>
              {(editData.image || editData.imageBackground) && (
                <button
                  onClick={() => {
                    const { image, imageBackground, ...rest } = editData;
                    setEditData(rest);
                  }}
                  style={{
                    padding: "2px 8px",
                    fontSize: "11px",
                    backgroundColor: "#d72c0d",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  清除图片
                </button>
              )}
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: "200px" }}>
                <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                  <input
                    type="text"
                    placeholder="图片 URL (image)"
                    value={editData.image || ""}
                    onChange={(e) => setEditData({ ...editData, image: e.target.value })}
                    style={{ flex: 1, padding: "6px" }}
                  />
                  {editData.image && (
                    <button
                      onClick={() => {
                        const { image, ...rest } = editData;
                        setEditData(rest);
                      }}
                      style={{
                        padding: "4px 8px",
                        fontSize: "11px",
                        backgroundColor: "#d72c0d",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
                {editData.image && (
                  <img
                    src={editData.image}
                    alt="预览"
                    style={{
                      maxWidth: "100px",
                      maxHeight: "100px",
                      marginTop: "4px",
                      border: "1px solid #e1e3e5",
                      borderRadius: "4px",
                    }}
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                  />
                )}
              </div>
              <div style={{ flex: 1, minWidth: "200px" }}>
                <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                  <input
                    type="text"
                    placeholder="背景图片 URL (imageBackground)"
                    value={editData.imageBackground || ""}
                    onChange={(e) => setEditData({ ...editData, imageBackground: e.target.value })}
                    style={{ flex: 1, padding: "6px" }}
                  />
                  {editData.imageBackground && (
                    <button
                      onClick={() => {
                        const { imageBackground, ...rest } = editData;
                        setEditData(rest);
                      }}
                      style={{
                        padding: "4px 8px",
                        fontSize: "11px",
                        backgroundColor: "#d72c0d",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
                {editData.imageBackground && (
                  <img
                    src={editData.imageBackground}
                    alt="预览"
                    style={{
                      maxWidth: "100px",
                      maxHeight: "100px",
                      marginTop: "4px",
                      border: "1px solid #e1e3e5",
                      borderRadius: "4px",
                    }}
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                  />
                )}
              </div>
            </div>
          </div>

          {/* 特性字段 */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px", borderTop: "1px solid #e1e3e5", paddingTop: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label style={{ fontSize: "12px", fontWeight: "bold", color: "#6d7175" }}>特性设置</label>
              {(editData.features || editData.featuresMobie) && (
                <button
                  onClick={() => {
                    const { features, featuresColor, featuresMobie, featuresColorMobie, ...rest } = editData;
                    setEditData(rest);
                  }}
                  style={{
                    padding: "2px 8px",
                    fontSize: "11px",
                    backgroundColor: "#d72c0d",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  清除特性
                </button>
              )}
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <input
                type="text"
                placeholder="特性文本 (features)"
                value={editData.features || ""}
                onChange={(e) => setEditData({ ...editData, features: e.target.value })}
                style={{ flex: 1, minWidth: "150px", padding: "6px" }}
              />
              <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                <input
                  type="text"
                  placeholder="#f51515"
                  value={editData.featuresColor || ""}
                  onChange={(e) => {
                    const color = e.target.value;
                    if (color === "" || /^#?[0-9A-Fa-f]{0,6}$/.test(color.replace("#", ""))) {
                      const normalizedColor = color.startsWith("#") ? color : color ? `#${color}` : "";
                      setEditData({ ...editData, featuresColor: normalizedColor });
                    }
                  }}
                  style={{ padding: "4px", width: "80px", fontFamily: "monospace" }}
                />
                <input
                  type="color"
                  value={editData.featuresColor || "#f51515"}
                  onChange={(e) => setEditData({ ...editData, featuresColor: e.target.value })}
                  style={{ width: "40px", height: "30px", cursor: "pointer" }}
                  title="特性颜色"
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <input
                type="text"
                placeholder="移动端特性 (featuresMobie)"
                value={editData.featuresMobie || ""}
                onChange={(e) => setEditData({ ...editData, featuresMobie: e.target.value })}
                style={{ flex: 1, minWidth: "150px", padding: "6px" }}
              />
              <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                <input
                  type="text"
                  placeholder="#f51515"
                  value={editData.featuresColorMobie || ""}
                  onChange={(e) => {
                    const color = e.target.value;
                    if (color === "" || /^#?[0-9A-Fa-f]{0,6}$/.test(color.replace("#", ""))) {
                      const normalizedColor = color.startsWith("#") ? color : color ? `#${color}` : "";
                      setEditData({ ...editData, featuresColorMobie: normalizedColor });
                    }
                  }}
                  style={{ padding: "4px", width: "80px", fontFamily: "monospace" }}
                />
                <input
                  type="color"
                  value={editData.featuresColorMobie || "#f51515"}
                  onChange={(e) => setEditData({ ...editData, featuresColorMobie: e.target.value })}
                  style={{ width: "40px", height: "30px", cursor: "pointer" }}
                  title="移动端特性颜色"
                />
              </div>
            </div>
          </div>

          {/* 其他字段 */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px", borderTop: "1px solid #e1e3e5", paddingTop: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label style={{ fontSize: "12px", fontWeight: "bold", color: "#6d7175" }}>其他信息</label>
              {(editData.parameters || editData.dec) && (
                <button
                  onClick={() => {
                    const { parameters, dec, ...rest } = editData;
                    setEditData(rest);
                  }}
                  style={{
                    padding: "2px 8px",
                    fontSize: "11px",
                    backgroundColor: "#d72c0d",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  清除其他
                </button>
              )}
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <input
                type="text"
                placeholder="参数 (parameters)"
                value={editData.parameters || ""}
                onChange={(e) => setEditData({ ...editData, parameters: e.target.value })}
                style={{ flex: 1, minWidth: "150px", padding: "6px" }}
              />
              <input
                type="text"
                placeholder="描述 (dec)"
                value={editData.dec || ""}
                onChange={(e) => setEditData({ ...editData, dec: e.target.value })}
                style={{ flex: 1, minWidth: "150px", padding: "6px" }}
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <input
                type="checkbox"
                checked={editData.active || false}
                onChange={(e) =>
                  setEditData({ ...editData, active: e.target.checked })
                }
              />
              <span>激活</span>
            </label>
            {editData.badge && (
              <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                <input
                  type="text"
                  placeholder="徽章文本"
                  value={editData.badge.text || ""}
                  onChange={(e) =>
                    setEditData({
                      ...editData,
                      badge: { ...editData.badge, text: e.target.value },
                    })
                  }
                  style={{ padding: "4px", width: "100px" }}
                />
                <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                  <input
                    type="text"
                    placeholder="#FF9519"
                    value={editData.badge.color || "#FF9519"}
                    onChange={(e) => {
                      const color = e.target.value;
                      // 验证十六进制颜色格式
                      if (color === "" || /^#?[0-9A-Fa-f]{0,6}$/.test(color.replace("#", ""))) {
                        const normalizedColor = color === "" ? "" : (color.startsWith("#") ? color : `#${color}`);
                        setEditData({
                          ...editData,
                          badge: { ...editData.badge, color: normalizedColor },
                        });
                      }
                    }}
                    style={{ padding: "4px", width: "80px", fontFamily: "monospace" }}
                  />
                  <input
                    type="color"
                    value={editData.badge.color || "#FF9519"}
                    onChange={(e) =>
                      setEditData({
                        ...editData,
                        badge: { ...editData.badge, color: e.target.value },
                      })
                    }
                    style={{ width: "40px", height: "30px", cursor: "pointer" }}
                    title="选择颜色"
                  />
                </div>
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={handleSave}
              style={{
                padding: "6px 12px",
                backgroundColor: "#008060",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              保存
            </button>
            <button
              onClick={handleCancel}
              style={{
                padding: "6px 12px",
                backgroundColor: "#6d7175",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              取消
            </button>
            {!editData.badge && (
              <button
                onClick={() =>
                  setEditData({
                    ...editData,
                    badge: { text: "NEW", color: "#FF9519" },
                  })
                }
                style={{
                  padding: "6px 12px",
                  backgroundColor: "#6d7175",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                添加徽章
              </button>
            )}
            {editData.badge && (
              <button
                onClick={() => {
                  const { badge, ...rest } = editData;
                  setEditData(rest);
                }}
                style={{
                  padding: "6px 12px",
                  backgroundColor: "#d72c0d",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                删除徽章
              </button>
            )}
          </div>
        </div>
      ) : (
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "8px",
            }}
          >
            {hasChildren && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                style={{
                  padding: "4px 8px",
                  border: "none",
                  backgroundColor: "transparent",
                  cursor: "pointer",
                }}
              >
                {isExpanded ? "▼" : "▶"}
              </button>
            )}
            <span style={{ fontWeight: "bold", flex: 1 }}>
              {item.title || "未命名"}
            </span>
            {item.badge && (
              <span
                style={{
                  backgroundColor: item.badge.color || "#FF9519",
                  color: "white",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  fontSize: "12px",
                }}
              >
                {item.badge.text}
              </span>
            )}
            <span
              style={{
                fontSize: "12px",
                color: "#6d7175",
                marginRight: "8px",
              }}
            >
              {item.type}
            </span>
            <button
              onClick={() => setIsEditing(true)}
              style={{
                padding: "4px 8px",
                backgroundColor: "#008060",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              编辑
            </button>
            <button
              onClick={onDelete}
              style={{
                padding: "4px 8px",
                backgroundColor: "#d72c0d",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              删除
            </button>
          </div>
          {item.url && (
            <div style={{ fontSize: "12px", color: "#6d7175", marginBottom: "4px" }}>
              URL: {item.url}
            </div>
          )}
          {item.image && (
            <div style={{ fontSize: "12px", color: "#6d7175", marginBottom: "4px" }}>
              <img
                src={item.image}
                alt={item.title}
                style={{
                  maxWidth: "60px",
                  maxHeight: "60px",
                  border: "1px solid #e1e3e5",
                  borderRadius: "4px",
                  marginRight: "8px",
                  verticalAlign: "middle",
                }}
                onError={(e) => {
                  e.target.style.display = "none";
                }}
              />
              <span>图片: {item.image.substring(0, 50)}...</span>
            </div>
          )}
          {item.imageBackground && (
            <div style={{ fontSize: "12px", color: "#6d7175", marginBottom: "4px" }}>
              <span>背景图: {item.imageBackground.substring(0, 50)}...</span>
            </div>
          )}
          {item.features && (
            <div style={{ fontSize: "12px", color: "#6d7175", marginBottom: "4px" }}>
              特性: <span style={{ color: item.featuresColor || "#000" }}>{item.features}</span>
            </div>
          )}
          {item.parameters && (
            <div style={{ fontSize: "12px", color: "#6d7175", marginBottom: "4px" }}>
              参数: {item.parameters}
            </div>
          )}
          {item.dec && (
            <div style={{ fontSize: "12px", color: "#6d7175", marginBottom: "4px" }}>
              描述: {item.dec}
            </div>
          )}
        </div>
      )}

      {hasChildren && isExpanded && (
        <div style={{ marginTop: "12px" }}>
          {editData.children.map((child, index) => (
            <NavigationItemEditor
              key={index}
              item={child}
              onUpdate={(updated) => handleUpdateChild(index, updated)}
              onDelete={() => handleDeleteChild(index)}
              level={level + 1}
            />
          ))}
          {isEditing && (
            <button
              onClick={handleAddChild}
              style={{
                marginTop: "8px",
                padding: "6px 12px",
                backgroundColor: "#008060",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              + 添加子菜单
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function NavigationConfig() {
  const loaderData = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();

  const [navigationData, setNavigationData] = useState(
    loaderData?.config?.navigationData || { links: [] }
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (loaderData?.config?.navigationData) {
      setNavigationData(loaderData.config.navigationData);
    }
  }, [loaderData]);

  useEffect(() => {
    if (fetcher.data?.success) {
      shopify.toast.show("导航配置已保存成功！");
      setIsSaving(false);
    }
    if (fetcher.data?.error) {
      shopify.toast.show("保存失败: " + fetcher.data.error, { isError: true });
      setIsSaving(false);
    }
  }, [fetcher.data, shopify]);

  const handleAddItem = () => {
    const newItem = {
      title: "新菜单项",
      handle: "",
      url: "",
      type: "http_link",
      active: false,
    };
    setNavigationData({
      ...navigationData,
      links: [...(navigationData.links || []), newItem],
    });
  };

  const handleUpdateItem = (index, updatedItem) => {
    const updated = {
      ...navigationData,
      links: navigationData.links.map((item, i) =>
        i === index ? updatedItem : item
      ),
    };
    setNavigationData(updated);
  };

  const handleDeleteItem = (index) => {
    if (confirm("确定要删除这个菜单项吗？")) {
      const updated = {
        ...navigationData,
        links: navigationData.links.filter((_, i) => i !== index),
      };
      setNavigationData(updated);
    }
  };

  const handleSave = () => {
    setIsSaving(true);
    const formData = new FormData();
    formData.append("intent", "save");
    formData.append("navigationData", JSON.stringify(navigationData, null, 2));
    fetcher.submit(formData, { method: "POST" });
  };

  if (loaderData?.error) {
    const isPermissionError = loaderData.error.includes("Access denied") || 
                              loaderData.error.includes("access scope") ||
                              loaderData.error.includes("read_metaobjects") ||
                              loaderData.error.includes("write_metaobjects");
    
    return (
      <s-page heading="导航配置">
        <s-section heading="错误">
          <s-box
            padding="base"
            borderWidth="base"
            borderRadius="base"
            background="critical-subdued"
          >
            <s-paragraph>
              <s-text tone="critical" as="strong">错误信息：</s-text>
            </s-paragraph>
            <s-paragraph>
              <s-text tone="critical">{loaderData.error}</s-text>
            </s-paragraph>
            
            {isPermissionError && (
              <>
                <s-divider style={{ margin: "16px 0" }} />
                <s-paragraph>
                  <s-text as="strong">权限问题解决方案：</s-text>
                </s-paragraph>
                <s-unordered-list>
                  <s-list-item>
                    <s-text as="strong">步骤 1：</s-text> 确保 <s-text as="code">shopify.app.toml</s-text> 中的权限配置正确：
                    <s-box
                      padding="small"
                      borderWidth="base"
                      borderRadius="base"
                      background="surface"
                      style={{ marginTop: "8px", fontFamily: "monospace", fontSize: "12px" }}
                    >
                      [access_scopes]
                      <br />
                      scopes = "read_products,write_products,read_metaobjects,write_metaobjects"
                    </s-box>
                  </s-list-item>
                  <s-list-item>
                    <s-text as="strong">步骤 2：</s-text> 重新部署应用以更新权限配置：
                    <s-box
                      padding="small"
                      borderWidth="base"
                      borderRadius="base"
                      background="surface"
                      style={{ marginTop: "8px", fontFamily: "monospace", fontSize: "12px" }}
                    >
                      shopify app deploy
                    </s-box>
                  </s-list-item>
                  <s-list-item>
                    <s-text as="strong">步骤 3：</s-text> 重新授权应用：
                    <s-unordered-list style={{ marginTop: "8px" }}>
                      <s-list-item>在 Shopify 后台卸载并重新安装应用</s-list-item>
                      <s-list-item>或者在应用设置中更新权限范围</s-list-item>
                      <s-list-item>或者运行 <s-text as="code">shopify app dev</s-text> 重新授权</s-list-item>
                    </s-unordered-list>
                  </s-list-item>
                  <s-list-item>
                    <s-text as="strong">步骤 4：</s-text> 如果使用环境变量，确保 <s-text as="code">SCOPES</s-text> 环境变量包含：
                    <s-box
                      padding="small"
                      borderWidth="base"
                      borderRadius="base"
                      background="surface"
                      style={{ marginTop: "8px", fontFamily: "monospace", fontSize: "12px" }}
                    >
                      SCOPES=read_products,write_products,read_metaobjects,write_metaobjects
                    </s-box>
                  </s-list-item>
                </s-unordered-list>
              </>
            )}
            
            {!isPermissionError && (
              <>
                <s-divider style={{ margin: "16px 0" }} />
                <s-paragraph>
                  <s-text as="strong">请检查：</s-text>
                </s-paragraph>
                <s-unordered-list>
                  <s-list-item>元对象类型和 handle 是否正确（当前: main-navigation-qqzczp0o）</s-list-item>
                  <s-list-item>元对象中是否存在存储 JSON 数据的字段</s-list-item>
                  <s-list-item>应用是否已正确安装并授权</s-list-item>
                </s-unordered-list>
              </>
            )}
          </s-box>
        </s-section>
      </s-page>
    );
  }

  return (
    <s-page heading="导航配置">
      <s-section heading="功能说明">
        <s-paragraph>
          可视化配置商店导航菜单。修改后点击保存按钮，配置将同步更新到 Shopify 元对象。
        </s-paragraph>
      </s-section>

      <s-section heading="导航菜单项">
        <s-stack direction="block" gap="base">
          <div style={{ marginBottom: "16px" }}>
            <button
              onClick={handleAddItem}
              style={{
                padding: "8px 16px",
                backgroundColor: "#008060",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                marginRight: "8px",
              }}
            >
              + 添加菜单项
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              style={{
                padding: "8px 16px",
                backgroundColor: isSaving ? "#6d7175" : "#008060",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: isSaving ? "not-allowed" : "pointer",
              }}
            >
              {isSaving ? "保存中..." : "💾 保存配置"}
            </button>
          </div>

          {navigationData.links && navigationData.links.length > 0 ? (
            <div>
              {navigationData.links.map((item, index) => (
                <NavigationItemEditor
                  key={index}
                  item={item}
                  onUpdate={(updated) => handleUpdateItem(index, updated)}
                  onDelete={() => handleDeleteItem(index)}
                  level={0}
                />
              ))}
            </div>
          ) : (
            <s-box
              padding="base"
              borderWidth="base"
              borderRadius="base"
              background="subdued"
            >
              <s-paragraph>
                <s-text tone="subdued">暂无菜单项，点击"添加菜单项"开始配置</s-text>
              </s-paragraph>
            </s-box>
          )}
        </s-stack>
      </s-section>

      {loaderData?.config && (
        <s-section heading="配置信息">
          <s-stack direction="block" gap="small">
            <s-paragraph>
              <s-text as="strong">元对象 ID：</s-text>
              <s-text tone="subdued">{loaderData.config.metaobjectId}</s-text>
            </s-paragraph>
            <s-paragraph>
              <s-text as="strong">类型：</s-text>
              <s-text tone="subdued">{loaderData.config.type || "未知"}</s-text>
            </s-paragraph>
            <s-paragraph>
              <s-text as="strong">Handle：</s-text>
              <s-text tone="subdued">{loaderData.config.handle}</s-text>
            </s-paragraph>
            <s-paragraph>
              <s-text as="strong">JSON 字段：</s-text>
              <s-text tone="subdued">{loaderData.config.jsonFieldKey || "未知"}</s-text>
            </s-paragraph>
            {loaderData.config.updatedAt && (
              <s-paragraph>
                <s-text as="strong">最后更新：</s-text>
                <s-text tone="subdued">
                  {new Date(loaderData.config.updatedAt).toLocaleString("zh-CN")}
                </s-text>
              </s-paragraph>
            )}
            {loaderData.config.allFields && loaderData.config.allFields.length > 0 && (
              <s-paragraph>
                <s-text as="strong">所有字段：</s-text>
                <s-text tone="subdued">
                  {loaderData.config.allFields.map(f => `${f.key} (${f.type})`).join(", ")}
                </s-text>
              </s-paragraph>
            )}
          </s-stack>
        </s-section>
      )}

      <s-section slot="aside" heading="使用说明">
        <s-paragraph>
          <s-text as="strong">编辑菜单项</s-text>
        </s-paragraph>
        <s-unordered-list>
          <s-list-item>点击"编辑"按钮修改菜单项信息</s-list-item>
          <s-list-item>可以设置标题、URL、类型等属性</s-list-item>
          <s-list-item>支持添加徽章（Badge）显示</s-list-item>
          <s-list-item>可以添加子菜单项</s-list-item>
        </s-unordered-list>

        <s-paragraph style={{ marginTop: "16px" }}>
          <s-text as="strong">保存配置</s-text>
        </s-paragraph>
        <s-unordered-list>
          <s-list-item>修改完成后点击"保存配置"按钮</s-list-item>
          <s-list-item>配置将同步更新到 Shopify 元对象</s-list-item>
          <s-list-item>保存成功后会在前端立即生效</s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};


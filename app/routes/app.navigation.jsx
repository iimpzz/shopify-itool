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
// 使用模块级变量存储拖拽信息，避免 dataTransfer 的限制
let dragState = null;

function NavigationItemEditor({ item, onUpdate, onDelete, onMoveUp, onMoveDown, canMoveUp, canMoveDown, onDragStart, onDragOver, onDrop, isDragging, level = 0, index = 0 }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState(item);
  const [dragOver, setDragOver] = useState(false);

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

  const handleUpdateChild = (childIndex, updatedChild) => {
    const updated = {
      ...editData,
      children: (editData.children || []).map((child, i) =>
        i === childIndex ? updatedChild : child
      ),
    };
    setEditData(updated);
    onUpdate(updated);
  };

  const handleDeleteChild = (childIndex) => {
    const updated = {
      ...editData,
      children: editData.children.filter((_, i) => i !== childIndex),
    };
    setEditData(updated);
    onUpdate(updated);
  };

  const handleMoveChildUp = (childIndex) => {
    if (childIndex === 0) return;
    const children = [...(editData.children || [])];
    [children[childIndex - 1], children[childIndex]] = [children[childIndex], children[childIndex - 1]];
    const updated = { ...editData, children };
    setEditData(updated);
    onUpdate(updated);
  };

  const handleMoveChildDown = (childIndex) => {
    if (childIndex >= (editData.children || []).length - 1) return;
    const children = [...(editData.children || [])];
    [children[childIndex], children[childIndex + 1]] = [children[childIndex + 1], children[childIndex]];
    const updated = { ...editData, children };
    setEditData(updated);
    onUpdate(updated);
  };

  const handleDragStart = (e) => {
    if (isEditing) {
      e.preventDefault();
      return;
    }
    // 阻止事件冒泡，避免父元素的拖拽事件覆盖子元素的拖拽状态
    e.stopPropagation();
    e.dataTransfer.effectAllowed = "move";
    // 同时使用 dataTransfer 和全局变量存储拖拽信息
    e.dataTransfer.setData("text/plain", index.toString());
    e.dataTransfer.setData("level", level.toString());
    // 使用全局变量存储，确保在 drop 时能读取到
    dragState = { index, level };
    console.log("拖拽开始:", { index, level, itemTitle: item.title || item.handle, dragState });
    if (onDragStart) {
      onDragStart(index);
    }
  };

  const handleDragOver = (e) => {
    if (isEditing) return;
    e.preventDefault();
    // 不阻止冒泡，让父元素也能处理拖拽悬停
    e.dataTransfer.dropEffect = "move";
    if (onDragOver) {
      onDragOver(index);
    }
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    if (isEditing) return;
    // 只有当离开整个元素时才清除拖拽状态
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOver(false);
    }
  };

  const handleDrop = (e) => {
    if (isEditing) return;
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    
    // 优先使用全局变量，如果不存在则尝试从 dataTransfer 读取
    let draggedIndex, draggedLevel;
    
    if (dragState) {
      draggedIndex = dragState.index;
      draggedLevel = dragState.level;
      console.log("使用全局 dragState:", dragState);
    } else {
      // 回退到 dataTransfer
      const draggedIndexStr = e.dataTransfer.getData("text/plain");
      const draggedLevelStr = e.dataTransfer.getData("level");
      
      if (!draggedIndexStr || draggedIndexStr === "" || !draggedLevelStr || draggedLevelStr === "") {
        console.log("✗ 无法获取拖拽数据");
        if (onDragStart) {
          onDragStart(null);
        }
        return;
      }
      
      draggedIndex = parseInt(draggedIndexStr, 10);
      draggedLevel = parseInt(draggedLevelStr, 10);
      
      if (isNaN(draggedIndex) || isNaN(draggedLevel)) {
        console.log("✗ 拖拽数据解析失败");
        if (onDragStart) {
          onDragStart(null);
        }
        return;
      }
    }
    
    // 只允许同级别的拖拽
    console.log("拖拽放置检查:", { 
      hasOnDrop: !!onDrop, 
      draggedIndex, 
      index, 
      draggedLevel, 
      level,
      sameIndex: draggedIndex === index,
      sameLevel: draggedLevel === level,
      itemTitle: item.title || item.handle
    });
    
    if (onDrop && draggedIndex !== index && draggedLevel === level) {
      console.log("✓ 调用 onDrop:", { draggedIndex, index, draggedLevel, level });
      try {
        onDrop(draggedIndex, index);
        console.log("✓ onDrop 执行成功");
      } catch (error) {
        console.error("✗ onDrop 执行错误:", error);
      }
    } else {
      console.log("✗ 拖拽条件不满足:", { 
        hasOnDrop: !!onDrop, 
        draggedIndex, 
        index, 
        draggedLevel, 
        level,
        sameIndex: draggedIndex === index,
        sameLevel: draggedLevel === level,
        condition: draggedIndex !== index && draggedLevel === level
      });
    }
    
    // 清除拖拽状态
    dragState = null;
    if (onDragStart) {
      onDragStart(null);
    }
  };

  const handleDragEnd = () => {
    setDragOver(false);
    // 清除全局拖拽状态
    dragState = null;
    if (onDragStart) {
      onDragStart(null); // 清除拖拽状态
    }
  };

  return (
    <div
      draggable={!isEditing}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onDragEnd={handleDragEnd}
      style={{
        marginLeft: `${level * 20}px`,
        marginBottom: "8px",
        border: dragOver ? "2px solid #008060" : isDragging ? "2px dashed #6d7175" : "1px solid #e1e3e5",
        borderRadius: "4px",
        padding: "12px",
        backgroundColor: dragOver ? "#e8f5e9" : (isDragging ? "#f5f5f5" : (level === 0 ? "#f6f6f7" : "#ffffff")),
        cursor: isEditing ? "default" : "grab",
        opacity: isDragging ? 0.5 : 1,
        transition: "all 0.2s ease",
        userSelect: "none",
        position: "relative",
      }}
      onClick={(e) => {
        // 防止拖拽时触发点击事件
        if (e.detail > 1) {
          e.preventDefault();
        }
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
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
                onMouseDown={(e) => e.stopPropagation()}
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
            {!isEditing && (
              <span
                style={{
                  marginRight: "8px",
                  fontSize: "18px",
                  color: "#6d7175",
                  cursor: "grab",
                  userSelect: "none",
                  display: "inline-block",
                  lineHeight: "1",
                }}
                title="拖拽此处排序（或使用 ↑↓ 按钮）"
                onMouseDown={(e) => e.stopPropagation()}
              >
                ⋮⋮
              </span>
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
            {/* 排序按钮 */}
            <div style={{ display: "flex", gap: "4px", marginRight: "4px" }}>
              {onMoveUp && (
                <button
                  onClick={onMoveUp}
                  disabled={!canMoveUp}
                  title="上移"
                  style={{
                    padding: "4px 8px",
                    backgroundColor: canMoveUp ? "#008060" : "#e1e3e5",
                    color: canMoveUp ? "white" : "#999",
                    border: "none",
                    borderRadius: "4px",
                    cursor: canMoveUp ? "pointer" : "not-allowed",
                    fontSize: "14px",
                    fontWeight: "bold",
                    minWidth: "32px",
                  }}
                >
                  ↑
                </button>
              )}
              {onMoveDown && (
                <button
                  onClick={onMoveDown}
                  disabled={!canMoveDown}
                  title="下移"
                  style={{
                    padding: "4px 8px",
                    backgroundColor: canMoveDown ? "#008060" : "#e1e3e5",
                    color: canMoveDown ? "white" : "#999",
                    border: "none",
                    borderRadius: "4px",
                    cursor: canMoveDown ? "pointer" : "not-allowed",
                    fontSize: "14px",
                    fontWeight: "bold",
                    minWidth: "32px",
                  }}
                >
                  ↓
                </button>
              )}
            </div>
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
        <div 
          style={{ marginTop: "12px" }}
          onDragOver={(e) => {
            // 允许在子菜单容器上拖拽，但不阻止子元素的拖拽事件
            e.preventDefault();
            // 不调用 stopPropagation，让事件继续传播到子元素
          }}
        >
          {(editData.children || []).map((child, childIndex) => (
            <NavigationItemEditor
              key={childIndex}
              item={child}
              index={childIndex}
              onUpdate={(updated) => handleUpdateChild(childIndex, updated)}
              onDelete={() => handleDeleteChild(childIndex)}
              onMoveUp={childIndex > 0 ? () => handleMoveChildUp(childIndex) : null}
              onMoveDown={childIndex < (editData.children || []).length - 1 ? () => handleMoveChildDown(childIndex) : null}
              canMoveUp={childIndex > 0}
              canMoveDown={childIndex < (editData.children || []).length - 1}
              onDragStart={(idx) => {
                // 子菜单拖拽开始，可以在这里添加状态管理
              }}
              onDragOver={(idx) => {
                // 子菜单拖拽悬停，可以在这里添加视觉反馈
              }}
              onDrop={(fromIdx, toIdx) => {
                // 子菜单拖拽放置处理
                console.log("子菜单拖拽:", { fromIdx, toIdx, children: editData.children?.length });
                if (fromIdx !== null && toIdx !== null && fromIdx !== toIdx && !isNaN(fromIdx) && !isNaN(toIdx)) {
                  const children = [...(editData.children || [])];
                  if (fromIdx >= 0 && fromIdx < children.length && toIdx >= 0 && toIdx <= children.length) {
                    const [moved] = children.splice(fromIdx, 1);
                    children.splice(toIdx, 0, moved);
                    const updated = { ...editData, children };
                    setEditData(updated);
                    onUpdate(updated);
                    console.log("子菜单拖拽完成:", { newOrder: children.map(c => c.title || c.handle) });
                  }
                }
              }}
              isDragging={false}
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
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [initialData, setInitialData] = useState(
    loaderData?.config?.navigationData || { links: [] }
  );
  const [draggedIndex, setDraggedIndex] = useState(null);

  useEffect(() => {
    if (loaderData?.config?.navigationData) {
      const data = loaderData.config.navigationData;
      setNavigationData(data);
      setInitialData(data);
      setHasUnsavedChanges(false);
    }
  }, [loaderData]);

  // 检测是否有未保存的更改
  useEffect(() => {
    const currentJson = JSON.stringify(navigationData, null, 2);
    const initialJson = JSON.stringify(initialData, null, 2);
    setHasUnsavedChanges(currentJson !== initialJson);
  }, [navigationData, initialData]);

  useEffect(() => {
    if (fetcher.data?.success) {
      shopify.toast.show("导航配置已保存成功！");
      setIsSaving(false);
      // 更新初始数据，清除未保存标记
      setInitialData(navigationData);
      setHasUnsavedChanges(false);
    }
    if (fetcher.data?.error) {
      shopify.toast.show("保存失败: " + fetcher.data.error, { isError: true });
      setIsSaving(false);
    }
  }, [fetcher.data, shopify, navigationData]);

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
      links: (navigationData.links || []).map((item, i) =>
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

  const handleMoveItemUp = (index) => {
    if (index === 0) return;
    const links = [...navigationData.links];
    [links[index - 1], links[index]] = [links[index], links[index - 1]];
    setNavigationData({ ...navigationData, links });
    // 排序操作会触发未保存更改检测
  };

  const handleMoveItemDown = (index) => {
    if (index >= navigationData.links.length - 1) return;
    const links = [...navigationData.links];
    [links[index], links[index + 1]] = [links[index + 1], links[index]];
    setNavigationData({ ...navigationData, links });
    // 排序操作会触发未保存更改检测
  };

  const handleDragStart = (index) => {
    if (index !== null) {
      setDraggedIndex(index);
    } else {
      setDraggedIndex(null);
    }
  };

  const handleDragOver = (index) => {
    // 可以在这里添加视觉反馈，但主要反馈在组件内部处理
  };

  const handleDrop = (fromIndex, toIndex) => {
    if (fromIndex === null || toIndex === null || fromIndex === toIndex) {
      setDraggedIndex(null);
      return;
    }
    const links = [...navigationData.links];
    const [moved] = links.splice(fromIndex, 1);
    links.splice(toIndex, 0, moved);
    setNavigationData({ ...navigationData, links });
    setDraggedIndex(null);
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
          <div style={{ marginBottom: "16px", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <button
              onClick={handleAddItem}
              style={{
                padding: "8px 16px",
                backgroundColor: "#008060",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              + 添加菜单项
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !hasUnsavedChanges}
              style={{
                padding: "8px 16px",
                backgroundColor: isSaving || !hasUnsavedChanges ? "#6d7175" : "#008060",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: isSaving || !hasUnsavedChanges ? "not-allowed" : "pointer",
                fontWeight: hasUnsavedChanges ? "bold" : "normal",
                position: "relative",
              }}
            >
              {isSaving ? "保存中..." : hasUnsavedChanges ? "💾 保存配置（有未保存更改）" : "💾 保存配置"}
            </button>
            {hasUnsavedChanges && (
              <span
                style={{
                  padding: "4px 12px",
                  backgroundColor: "#fff4e6",
                  color: "#b98900",
                  borderRadius: "4px",
                  fontSize: "12px",
                  fontWeight: "bold",
                  border: "1px solid #ffd89b",
                }}
              >
                ⚠️ 有未保存的更改
              </span>
            )}
            {!hasUnsavedChanges && !isSaving && (
              <span
                style={{
                  padding: "4px 12px",
                  backgroundColor: "#e8f5e9",
                  color: "#2e7d32",
                  borderRadius: "4px",
                  fontSize: "12px",
                  fontWeight: "bold",
                  border: "1px solid #a5d6a7",
                }}
              >
                ✅ 已保存
              </span>
            )}
          </div>

          {navigationData.links && navigationData.links.length > 0 ? (
            <div>
              {(navigationData.links || []).map((item, index) => (
                <NavigationItemEditor
                  key={index}
                  item={item}
                  index={index}
                  onUpdate={(updated) => handleUpdateItem(index, updated)}
                  onDelete={() => handleDeleteItem(index)}
                  onMoveUp={index > 0 ? () => handleMoveItemUp(index) : null}
                  onMoveDown={index < navigationData.links.length - 1 ? () => handleMoveItemDown(index) : null}
                  canMoveUp={index > 0}
                  canMoveDown={index < navigationData.links.length - 1}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  isDragging={draggedIndex === index}
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
                  {(loaderData.config.allFields || []).map(f => `${f.key} (${f.type})`).join(", ")}
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
          <s-text as="strong">排序功能</s-text>
        </s-paragraph>
        <s-unordered-list>
          <s-list-item>使用 ↑ 和 ↓ 按钮调整菜单项顺序</s-list-item>
          <s-list-item>支持对主菜单和子菜单进行排序</s-list-item>
          <s-list-item>第一个项目不能上移，最后一个项目不能下移</s-list-item>
          <s-list-item>排序后记得点击"保存配置"按钮</s-list-item>
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


import { useMemo, useState } from "react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function nl2brHtml(text) {
  const raw = String(text ?? "").trim();
  if (!raw) return "";
  return escapeHtml(raw).replaceAll(/\r?\n/g, "<br/>");
}

function buildSpecTableHtml({ title, headers, rows }) {
  const safeTitle = escapeHtml(title || "");

  const headerCells = headers
    .map((h) => `<th>${escapeHtml(h || "")}</th>`)
    .join("");

  const bodyRows = rows
    .filter((r) => r.name || r.cols.some((v) => String(v ?? "").trim() !== ""))
    .map((r) => {
      const href = escapeAttr(r.href || "#");
      const imgSrc = escapeAttr(r.img || "");
      const name = escapeHtml(r.name || "");

      // 动态列（除第一列 SERIES 外）
      const dataCells = r.cols
        .map((c) => `  <td>${nl2brHtml(c)}</td>`)
        .join("\n");

      return [
        "<tr>",
        "  <td>",
        `    <a class="series-wrapper" href="${href}">`,
        imgSrc
          ? `      <img class="auxito-product-img" src="${imgSrc}">`
          : `      <span style="display:inline-block;width:50px;height:50px;"></span>`,
        `      <span class="auxito-product-name">${name}</span>`,
        "    </a>",
        "  </td>",
        dataCells,
        "</tr>",
      ].join("\n");
    })
    .join("\n");

  return [
    '<div class="collection-page--container">',
    `  <h2>${safeTitle}</h2>`,
    "  <style>",
    "    .auxito-table-container {",
    "      border: 4px solid #fecb00;",
    "      border-radius: 15px;",
    "      overflow: hidden;",
    "      display: block;",
    "      width: 100%;",
    "      max-width: 100%;",
    "      background-color: #000;",
    "      font-family: Arial, sans-serif;",
    "      box-sizing: border-box;",
    "    }",
    "",
    "    .auxito-table-scroll {",
    "      width: 100%;",
    "      max-width: 100%;",
    "      overflow-x: auto;",
    "      overflow-y: hidden;",
    "      -webkit-overflow-scrolling: touch;",
    "      overscroll-behavior-x: contain;",
    "      box-sizing: border-box;",
    "    }",
    "",
    "    .auxito-comparison-table {",
    "      border-collapse: separate !important;",
    "      border-spacing: 5px;",
    "      background-color: #000;",
    "      width: 100%;",
    "      min-width: 600px;",
    "      border: none;",
    "      margin: 0;",
    "      box-sizing: border-box;",
    "    }",
    "",
    "    .auxito-comparison-table th,",
    "    .auxito-comparison-table td {",
    "      background-color: #fff;",
    "      padding: 12px 15px;",
    "      text-align: center;",
    "      font-size: 14px;",
    "      font-weight: bold;",
    "      color: #333;",
    "      border: none;",
    "      border-radius: 4px;",
    "      vertical-align: middle;",
    "    }",
    "",
    "    .auxito-comparison-table th {",
    "      background-color: #fecb00;",
    "      color: #000;",
    "      text-transform: uppercase;",
    "      font-weight: 800;",
    "      padding: 8px 15px;",
    "    }",
    "",
    "    .series-wrapper {",
    "      display: flex;",
    "      align-items: center;",
    "      justify-content: center;",
    "      gap: 10px;",
    "      height: 100%;",
    "      min-width: 0;",
    "      flex-wrap: nowrap;",
    "    }",
    "",
    "    .auxito-comparison-table td:first-child,",
    "    .auxito-comparison-table th:first-child {",
    "      border-right: 3px solid #000;",
    "    }",
    "",
    "    .auxito-comparison-table td:first-child {",
    "      min-width: 120px;",
    "      position: relative;",
    "      box-shadow: inset -10px 0 10px -10px rgba(0, 0, 0, 0.1);",
    "    }",
    "",
    "    .auxito-product-img {",
    "      width: 50px;",
    "      height: 50px;",
    "      object-fit: contain;",
    "      display: block;",
    "    }",
    "",
    "    .auxito-product-name {",
    "      font-weight: 900;",
    "      color: #c5862b;",
    "      font-size: 14px;",
    "      white-space: nowrap;",
    "    }",
    "",
    "    @media (max-width: 768px) {",
    "      .auxito-table-scroll {",
    "        overflow-x: hidden;",
    "      }",
    "",
    "      .auxito-comparison-table {",
    "        min-width: 100%;",
    "        width: 100%;",
    "        table-layout: fixed;",
    "        border-spacing: 3px;",
    "      }",
    "",
    "      .auxito-product-name {",
    "        font-size: 12px;",
    "      }",
    "",
    "      .auxito-comparison-table th,",
    "      .auxito-comparison-table td {",
    "        padding: 6px 6px;",
    "        font-size: 12px;",
    "        overflow-wrap: normal;",
    "        word-break: normal;",
    "        font-weight: 500;",
    "      }",
    "",
    "      .auxito-comparison-table th {",
    "        word-break: break-word;",
    "      }",
    "",
    "      .auxito-comparison-table th:first-child,",
    "      .auxito-comparison-table td:first-child {",
    "        width: 28%;",
    "        box-sizing: border-box;",
    "      }",
    "",
    "      .auxito-comparison-table td {",
    "        white-space: normal;",
    "        overflow-wrap: break-word;",
    "        word-break: normal;",
    "        hyphens: auto;",
    "      }",
    "",
    "      .auxito-comparison-table td:first-child {",
    "        overflow-wrap: normal;",
    "        word-break: normal;",
    "      }",
    "",
    "      .auxito-product-img {",
    "        width: 40px;",
    "        height: 40px;",
    "      }",
    "",
    "      .series-wrapper {",
    "        flex-direction: row;",
    "        flex-wrap: nowrap;",
    "        gap: 6px;",
    "        justify-content: flex-start;",
    "        min-width: 0;",
    "      }",
    "",
    "      .auxito-product-name {",
    "        white-space: normal;",
    "        flex: 1 1 auto;",
    "        min-width: 0;",
    "        line-height: 1.15;",
    "        overflow-wrap: break-word;",
    "      }",
    "    }",
    "",
    "    @media (max-width: 480px) {",
    "      .auxito-comparison-table {",
    "        border-spacing: 2px;",
    "      }",
    "      .auxito-comparison-table th,",
    "      .auxito-comparison-table td {",
    "        padding: 6px 6px;",
    "        font-size: 11px;",
    "      }",
    "    }",
    "  </style>",
    "",
    '  <div class="auxito-table-container">',
    '    <div class="auxito-table-scroll">',
    '      <table class="auxito-comparison-table">',
    "        <thead>",
    "          <tr>",
    `            ${headerCells}`,
    "          </tr>",
    "        </thead>",
    "        <tbody>",
    bodyRows || "          <!-- 这里还没有行：请先在左侧添加数据 -->",
    "        </tbody>",
    "      </table>",
    "    </div>",
    "  </div>",
    "</div>",
  ].join("\n");
}

// 默认表头（第一列固定是 SERIES，后面可以自定义）
const defaultHeaders = [
  "SERIES",
  "LUMEN/PAIR",
  "POWER/PAIR",
  "COLOR OPTION",
  "WATERPROOF",
];

// 创建新行时，cols 数量要和 headers 数量 - 1 匹配（第一列是 SERIES）
const createNewRow = (colCount) => ({
  name: "",
  href: "",
  img: "",
  cols: Array(colCount).fill(""),
});

export default function CollectionSpecGenerator() {
  const [title, setTitle] = useState("Comparison of LED Headlight Bulbs Series");
  const [headers, setHeaders] = useState(defaultHeaders);
  const [rows, setRows] = useState([
    {
      name: "M6",
      href: "/collections/led-fog-lights/m6",
      img: "https://auxito.com/cdn/shop/files/auxito-h10-9140-9145-led-fog-lights-6500k-cool-white-600-brighter-mini-size-plug-play-42281674277108_128x128.jpg?v=1726314545",
      cols: ["9000LM", "40W", "6500 White\n3000K Amber", "IP67"],
    },
  ]);
  const [copied, setCopied] = useState(false);

  // 数据列数量 = headers.length - 1（第一列是 SERIES）
  const dataColCount = headers.length - 1;

  const html = useMemo(() => buildSpecTableHtml({ title, headers, rows }), [title, headers, rows]);

  const previewSrcDoc = useMemo(() => {
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:16px;background:#fff;">${html}</body></html>`;
  }, [html]);

  const setRow = (idx, patch) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const setRowCol = (rowIdx, colIdx, value) => {
    setRows((prev) =>
      prev.map((r, i) =>
        i === rowIdx
          ? { ...r, cols: r.cols.map((c, ci) => (ci === colIdx ? value : c)) }
          : r
      )
    );
  };

  const addRow = () => setRows((prev) => [...prev, createNewRow(dataColCount)]);
  const removeRow = (idx) => setRows((prev) => prev.filter((_, i) => i !== idx));

  // 添加一列（表头 + 所有行都要加）
  const addColumn = () => {
    setHeaders((prev) => [...prev, `列${prev.length}`]);
    setRows((prev) => prev.map((r) => ({ ...r, cols: [...r.cols, ""] })));
  };

  // 删除一列（表头 + 所有行都要删）
  const removeColumn = (colIdx) => {
    if (headers.length <= 2) return; // 至少保留 SERIES + 1 列
    // colIdx 是相对于 headers 的索引，headers[0] 是 SERIES，所以 cols 的索引是 colIdx - 1
    const dataColIdx = colIdx - 1;
    setHeaders((prev) => prev.filter((_, i) => i !== colIdx));
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        cols: r.cols.filter((_, i) => i !== dataColIdx),
      }))
    );
  };

  // 更新表头
  const updateHeader = (idx, value) => {
    setHeaders((prev) => prev.map((h, i) => (i === idx ? value : h)));
  };

  const copyHtml = async () => {
    try {
      await navigator.clipboard.writeText(html);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
      alert("自动复制失败，请手动从下方代码框复制。");
    }
  };

  const downloadHtml = () => {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `collection-spec-${new Date().toISOString().slice(0, 10)}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <s-page heading="collection 规格快速生成">
      <s-section heading="使用方式">
        <s-paragraph>
          左侧填写标题、表头、每行规格数据；右侧实时预览。确认无误后点击"一键复制 HTML"，运营同学直接粘贴到 collection 页富文本/自定义
          HTML 即可。
        </s-paragraph>
      </s-section>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          alignItems: "start",
        }}
      >
        {/* Left: Form */}
        <s-section heading="填写规格数据">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontWeight: 600 }}>标题（h2）</div>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例如：Comparison of LED Headlight Bulbs Series"
                style={{
                  padding: "10px 12px",
                  border: "1px solid #d0d5dd",
                  borderRadius: 8,
                }}
              />
            </label>

            {/* 表头编辑区 */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontWeight: 600 }}>表头（{headers.length} 列）</div>
                <s-button onClick={addColumn} variant="tertiary">
                  + 添加列
                </s-button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {headers.map((h, idx) => (
                  <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      value={h}
                      onChange={(e) => updateHeader(idx, e.target.value)}
                      placeholder={idx === 0 ? "第一列（固定 SERIES）" : `第${idx + 1}列`}
                      style={{
                        flex: 1,
                        padding: "10px 12px",
                        border: "1px solid #d0d5dd",
                        borderRadius: 8,
                        background: idx === 0 ? "#f9fafb" : "#fff",
                      }}
                    />
                    {idx > 0 && (
                      <button
                        onClick={() => removeColumn(idx)}
                        disabled={headers.length <= 2}
                        style={{
                          padding: "8px 12px",
                          border: "1px solid #f04438",
                          borderRadius: 8,
                          background: "#fff",
                          color: "#f04438",
                          cursor: headers.length <= 2 ? "not-allowed" : "pointer",
                          opacity: headers.length <= 2 ? 0.5 : 1,
                        }}
                      >
                        删除
                      </button>
                    )}
                    {idx === 0 && (
                      <span style={{ color: "#667085", fontSize: 12, whiteSpace: "nowrap" }}>
                        （固定列）
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <div style={{ fontWeight: 600 }}>行数据</div>
              <s-button onClick={addRow} variant="primary">
                + 添加一行
              </s-button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {rows.map((r, idx) => (
                <div
                  key={idx}
                  style={{
                    border: "1px solid #e4e7ec",
                    borderRadius: 10,
                    padding: 12,
                    background: "#fff",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ fontWeight: 700 }}>第 {idx + 1} 行</div>
                    <s-button
                      onClick={() => removeRow(idx)}
                      variant="secondary"
                      {...(rows.length <= 1 ? { disabled: true } : {})}
                    >
                      删除
                    </s-button>
                  </div>

                  <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                    {/* 第一列：SERIES（固定：名称 + 链接 + 图片）*/}
                    <div
                      style={{
                        padding: 10,
                        background: "#f9fafb",
                        borderRadius: 8,
                        border: "1px solid #e4e7ec",
                      }}
                    >
                      <div style={{ fontWeight: 600, marginBottom: 8, color: "#344054" }}>
                        {headers[0] || "SERIES"}（名称 + 链接 + 图片）
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <span style={{ fontSize: 12, color: "#667085" }}>系列名</span>
                          <input
                            value={r.name}
                            onChange={(e) => setRow(idx, { name: e.target.value })}
                            placeholder="例如：M6"
                            style={{
                              padding: "8px 10px",
                              border: "1px solid #d0d5dd",
                              borderRadius: 6,
                            }}
                          />
                        </label>

                        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <span style={{ fontSize: 12, color: "#667085" }}>链接（href）</span>
                          <input
                            value={r.href}
                            onChange={(e) => setRow(idx, { href: e.target.value })}
                            placeholder="/collections/xxx/handle"
                            style={{
                              padding: "8px 10px",
                              border: "1px solid #d0d5dd",
                              borderRadius: 6,
                            }}
                          />
                        </label>

                        <label style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: "1 / -1" }}>
                          <span style={{ fontSize: 12, color: "#667085" }}>图片（img src）</span>
                          <input
                            value={r.img}
                            onChange={(e) => setRow(idx, { img: e.target.value })}
                            placeholder="https://...jpg"
                            style={{
                              padding: "8px 10px",
                              border: "1px solid #d0d5dd",
                              borderRadius: 6,
                            }}
                          />
                        </label>
                      </div>
                    </div>

                    {/* 动态数据列 */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                      {r.cols.map((colValue, colIdx) => (
                        <label key={colIdx} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>
                            {headers[colIdx + 1] || `第${colIdx + 2}列`}
                          </span>
                          <textarea
                            value={colValue}
                            onChange={(e) => setRowCol(idx, colIdx, e.target.value)}
                            placeholder={`填写 ${headers[colIdx + 1] || `第${colIdx + 2}列`} 的值`}
                            rows={2}
                            style={{
                              padding: "8px 10px",
                              border: "1px solid #d0d5dd",
                              borderRadius: 6,
                              resize: "vertical",
                              fontSize: 13,
                            }}
                          />
                        </label>
                      ))}
                    </div>
                    <div style={{ color: "#667085", fontSize: 11 }}>
                      提示：在单元格内换行会自动转成 &lt;br/&gt;
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <s-button onClick={copyHtml} variant="primary">
                {copied ? "✅ 已复制" : "一键复制 HTML"}
              </s-button>
              <s-button onClick={downloadHtml} variant="secondary">
                下载 HTML 文件
              </s-button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontWeight: 600 }}>生成的 HTML（可直接复制粘贴）</div>
              <textarea
                readOnly
                value={html}
                rows={12}
                style={{
                  width: "100%",
                  padding: 12,
                  border: "1px solid #d0d5dd",
                  borderRadius: 10,
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
                  fontSize: 12,
                }}
              />
            </div>
          </div>
        </s-section>

        {/* Right: Preview */}
        <s-section heading="实时预览">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ color: "#667085", fontSize: 12 }}>
              预览用 iframe 隔离了样式（避免影响 Shopify 后台样式）。你粘贴到 collection 页时会以模板样式显示。
            </div>
            <iframe
              title="spec-preview"
              srcDoc={previewSrcDoc}
              style={{
                width: "100%",
                height: 620,
                border: "1px solid #e4e7ec",
                borderRadius: 10,
                background: "#fff",
              }}
            />
          </div>
        </s-section>
      </div>
    </s-page>
  );
}

# 车型库管理功能需求说明

## 背景

当前车型库维护依赖人工整理表格、转换 JSON、上传文件、同步主题版本。这个流程容易出现格式错误、漏传文件、版本不一致和重复劳动。

本次需求是把车型库维护流程产品化到 Shopify App 后台中，让运营同学只需要上传整理好的车型库表格，系统自动完成校验、转换、发布和版本切换。

## 目标

- 在 Shopify App 后台提供“车型库管理”入口。
- 支持上传 Excel/CSV 车型库表格。
- 自动校验表头、年份、车型字段、分类分组、商品/集合 URL 格式。
- 自动生成主题可读取的车型库 JSON 文件。
- 自动发布 JSON 到 Shopify Files/CDN。
- 发布完成后更新 `vehicle_date.vd`，让主题读取新的车型库版本。
- 记录每次导入任务、生成文件、发布版本和失败原因，便于追踪和复查。

## 输入表格约定

运营表格继续使用以下表头：

```text
year
group
category
make
model
trim
body_style
position
note
product_urls
```

约束：

- `year` 必须是 4 位年份或 `Universal`。
- `group` 必须能映射到 `led-bulbs`、`lighting-assemblies`、`accessories-kits`。
- `category`、`make`、`model` 不能为空。
- `product_urls` 只支持 `/products/...` 或 `/collections/...`，多值用 `|` 分隔。

## 输出 JSON 约定

主题侧按版本号读取以下文件：

```text
vehicle-selector-index-{version}.json
vehicle-selector-year-{version}-{year}.json
search-result-fitment-{version}-{year}-{group}.json
pdp-fitment-year-index-{version}.json
pdp-fitment-year-groups-{version}-{year}.json
```

这些文件覆盖三个主题使用场景：

- 车型筛选器：年份、品牌、车型选择。
- 搜索结果页：按车型和产品组读取适配结果。
- PDP 适配匹配：按当前商品 handle、年份、车型读取 compact fitment 数据。

## 后台流程

1. 运营进入 App 后台的“车型库管理”页面。
2. 选择导入模式：
   - 全量主表：直接用上传表格生成完整车型库。
   - 增量/替换表：读取当前线上版本，合并上传表格后重新生成完整车型库。
3. 输入发布版本号，例如 `260509`。
4. 上传 Excel/CSV。
5. 先校验并生成预览，或直接生成并发布。
6. 发布时系统自动执行：
   - 解析表格。
   - 生成 JSON artifact。
   - 通过 Shopify Admin GraphQL 创建 staged upload。
   - 上传到 Shopify Files。
   - 轮询文件 READY 状态。
   - 抽样校验 CDN JSON 可读且版本一致。
   - 更新 `vehicle_date.vd` 为新版本。
   - 写入导入任务和发布版本记录。

## 当前改动文件用途

这 8 个工作区改动都不是随机文件，作用如下：

| 文件 | 是否有用 | 用途 |
| --- | --- | --- |
| `.gitignore` | 有用，清理项 | 忽略本地数据库、Codex 配置和已确认删除的无关目录，保持工作区干净。 |
| `app/routes/app.jsx` | 有用 | 在 App 导航中增加“车型库管理”入口。 |
| `app/routes/app.vehicle-library.jsx` | 有用 | 车型库管理后台页面、上传表单、任务状态、发布版本展示和 action 主流程。 |
| `app/vehicle-library/artifacts.server.js` | 有用 | Excel/CSV 解析、字段校验、车型库 JSON 生成、增量合并、CDN base 配置。 |
| `app/graphql/vehicleLibrary.server.js` | 有用 | Shopify Files 上传、文件 READY 轮询、CDN 校验、商品 handle 映射、`vehicle_date.vd` 更新。 |
| `prisma/schema.prisma` | 有用 | 增加车型库导入任务、artifact、发布版本三张 Prisma 模型。 |
| `prisma/migrations/20260509000000_vehicle_library/migration.sql` | 有用 | 对应数据库迁移，创建车型库相关表和索引。 |
| `shopify.app.toml` | 有用 | 增加发布车型库所需 scopes：files、metaobjects 读写权限。 |

## 验收标准

- App 后台可以打开“车型库管理”页面。
- 上传缺字段或格式错误的表格时，页面能返回明确错误。
- 上传有效表格 dry-run 时，能生成 artifact 预览和任务记录。
- 发布时能把 JSON 上传到 Shopify Files，并通过 CDN URL 读取。
- 发布完成后 `vehicle_date.vd` 切换到新版本。
- 数据库中能查到本次导入任务、生成文件和发布版本。
- 主题侧按约定文件名读取 JSON 后，车型筛选、搜索结果展示、PDP 适配匹配可以使用同一套版本数据。

## 暂不包含

- 不改主题页面业务逻辑。
- 不做一键回滚 UI。
- 不做复杂审核流或多人审批。
- 不扩展新的车型库字段，仍沿用当前表格结构。

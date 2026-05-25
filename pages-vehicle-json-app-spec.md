# `pages-vehicle-json` App 维护功能文档

## 1. 目标

这份文档用于指导 Shopify App 项目为主题里的 `pages-vehicle-json` 提供可视化维护能力。

当前主题已经把车型静态配置统一收口到一个 Shopify Metaobject 条目中，后续 App 需要负责：

- 读取当前配置
- 可视化编辑 JSON
- 做基础校验
- 把完整 JSON 回写到 Shopify

这不是“主题内编辑器”，而是“商店后台里的配置维护工具”。

---

## 2. 当前主题接入方式

### 2.1 Metaobject 读取约定

主题当前固定读取：

- Metaobject type: `vehicle_static_config`
- Entry handle: `pages-vehicle-json`
- Field: `vehicle`

主题读取位置：

- [snippets/vehicle-static-config.liquid](C:/Users/Administrator/Desktop/oldauxito/shopify_auxito/snippets/vehicle-static-config.liquid)

主题当前等价于读取：

```liquid
shop.metaobjects.vehicle_static_config['pages-vehicle-json'].vehicle
```

App 必须继续兼容这三个固定值，否则主题前台不会命中配置。

### 2.2 主题消费页面

这个 JSON 当前被两个前台页面消费：

- `vehicle11` 页面
  - [sections/static-vehicle.liquid](C:/Users/Administrator/Desktop/oldauxito/shopify_auxito/sections/static-vehicle.liquid)
- `search-result` 页面
  - [templates/page.search-result.liquid](C:/Users/Administrator/Desktop/oldauxito/shopify_auxito/templates/page.search-result.liquid)
  - [assets/search-result-dynamic.js](C:/Users/Administrator/Desktop/oldauxito/shopify_auxito/assets/search-result-dynamic.js)

### 2.3 页面消费范围

不是所有字段都被两个页面同时使用。

`vehicle11` 使用：

- `categories`
- `location_assets`
- `location_card_assets`
- `location_card_aliases`
- `category_icons`
- `category_fallback_asset_keys`

`search-result` 当前只使用：

- `categories`

也就是说，App 后台可以统一维护一份 JSON，但要在 UI 上标明哪些字段是“仅 vehicle11 使用”。

---

## 3. JSON 数据结构

建议 App 始终输出一个完整 JSON 对象，当前顶层结构如下：

```json
{
  "version": 1,
  "location_assets": {},
  "categories": [],
  "location_card_assets": {},
  "location_card_aliases": {},
  "category_icons": {},
  "category_fallback_asset_keys": {}
}
```

---

## 4. 字段说明

## 4.1 `version`

类型：

```json
1
```

作用：

- 配置版本号
- 主要用于人工识别、排错、后续扩展

当前主题不会基于它做复杂分支，但建议 App 保留。

---

## 4.2 `categories`

类型：

```json
[
  {
    "slug": "off-road-lights",
    "title": "Off Road Lights",
    "subtitle": "Universal",
    "results_url": "/collections/off-road-lights",
    "active_icon": "https://cdn.xxx/active.png",
    "default_icon": "https://cdn.xxx/default.png",
    "cards": [
      {
        "id": "7in-driving-lights",
        "title": "7in Driving Lights",
        "image": "https://cdn.xxx/card-desktop.jpg",
        "mobile_image": "https://cdn.xxx/card-mobile.jpg",
        "url": "/collections/7-inch-driving-lights"
      }
    ]
  }
]
```

字段说明：

- `slug`
  - 必填
  - 分类唯一标识
  - 用于前台分类排序、路由参数、icon 匹配

- `title`
  - 必填
  - 前台显示的分类名称

- `subtitle`
  - 可选
  - `vehicle11` 分类副标题
  - 默认为 `Universal`

- `results_url`
  - 可选，但对 `search-result` 很重要
  - 该分类在 `/pages/search-result` 的静态结果入口 URL
  - 如果为空，则会尝试退到该分类第一张 card 的 `url`

- `active_icon`
  - 可选
  - 该分类激活态 icon

- `default_icon`
  - 可选
  - 该分类默认态 icon

- `cards`
  - 对 `vehicle11` 静态分类来说基本可视为必填
  - 每个 card 代表一个静态 location 入口

`cards[*]` 字段：

- `id`
  - 建议必填
  - 用于 `/pages/search-result` 的 `static_item` 参数
  - 如果不填，主题会退回使用 `title`

- `title`
  - 必填
  - 卡片标题

- `image`
  - 可选
  - `vehicle11` 桌面端卡片主图

- `mobile_image`
  - 可选
  - `vehicle11` 移动端卡片主图

- `url`
  - 推荐必填
  - 点击卡片后落到的 collection / product / search result URL

### `categories` 的主题行为

在 `vehicle11`：

- 只有 `cards.length > 0` 的静态分类才会展示
- 静态分类会参与顶部/左侧分类导航

在 `search-result`：

- 只读取 `categories`
- 只把“不属于动态分类”的分类当作 `Universal Products`
- 如果某个分类没有 `results_url`，也没有第一张 card 的 `url`，它不会显示在 `search-result` 侧边栏

当前动态分类 slug 为：

- `led-bulbs`
- `lighting-assemblies`
- `accessories-kits`

因此 App 后台里建议把 `categories` 分成两类显示：

- 动态分类增强项
- 静态/通用分类

其中真正由运营长期维护的重点通常是静态/通用分类。

---

## 4.3 `location_assets`

类型：

```json
{
  "Back Up": {
    "desktop": "https://cdn.xxx/back-up-desktop.jpg",
    "mobile": "https://cdn.xxx/back-up-mobile.jpg",
    "aliases": ["Back-Up Reverse Light", "Backup Lights"]
  }
}
```

作用：

- `vehicle11` location 主图覆盖
- 用于卡片 fallback 主图
- 支持桌面/移动端分图

字段说明：

- key
  - location 的标准名称
  - 主题读取时会做归一化处理，不要求大小写严格一致

- `desktop`
  - 桌面主图

- `mobile`
  - 移动端主图
  - 如果不填，主题会回退到 `desktop`

- `aliases`
  - 该 location 的别名列表
  - 这里的 alias 会被自动转换为运行时 alias map

注意：

- `location_assets` 是“主图覆盖”
- 它不是 card 缩略图配置

---

## 4.4 `location_card_assets`

类型：

```json
{
  "Back Up": {
    "image": "https://cdn.xxx/card-back-up.jpg",
    "thumb": "https://cdn.xxx/card-back-up-thumb.png"
  }
}
```

作用：

- `vehicle11` fallback 卡片图片资源
- 当某个卡片没有自己的 `image/mobile_image`，也拿不到产品图时，会退回这里

字段说明：

- key
  - location card 的标准标签

- `image`
  - fallback 大图

- `thumb`
  - fallback 小图
  - 如果不填，会回退到 `image`

---

## 4.5 `location_card_aliases`

类型：

```json
{
  "Back-Up Reverse Light": "Back Up",
  "Backup Lights": "Back Up"
}
```

作用：

- 把各种业务文案别名归并到 `location_card_assets` 的标准 key

要求：

- value 必须指向一个真实存在的 `location_card_assets` key

---

## 4.6 `category_icons`

类型：

```json
{
  "off-road-lights": {
    "active": "https://cdn.xxx/icon-active.png",
    "default": "https://cdn.xxx/icon-default.png"
  }
}
```

作用：

- 覆盖分类导航 icon
- `vehicle11` 动态分类和静态分类都会吃这套配置

要求：

- key 必须是分类 `slug`
- 建议 `active` 和 `default` 成对提供

icon 优先级：

1. `categories[*].active_icon/default_icon`
2. `category_icons[slug]`
3. 主题内置 legacy 默认 icon

---

## 4.7 `category_fallback_asset_keys`

类型：

```json
{
  "LED Bulbs": "High Beam - Off-road Use",
  "Lighting Assemblies": "License Plate Light"
}
```

作用：

- 当某个分类下的 location 没命中具体卡片图时，回退到哪张默认卡片图

要求：

- key 是分类显示名称，不是 slug
- value 必须指向一个存在于 `location_card_assets` 的 key

---

## 5. 图片命中优先级

App 后台最好把这部分写在帮助文案里，不然运营会困惑“为什么我改了图但前台没变”。

### 5.1 `vehicle11` 卡片主图优先级

静态卡片：

1. `categories[*].cards[*].image/mobile_image`
2. 如果没有，再走 fallback 资源

动态卡片：

1. 产品/集合返回的 product image
2. `location_assets` 主图覆盖
3. `location_card_assets`
4. `category_fallback_asset_keys`

### 5.2 分类导航 icon 优先级

1. 分类自身 `active_icon/default_icon`
2. `category_icons`
3. 主题内置默认 icon

### 5.3 `search-result` 使用范围

`search-result` 当前只关心：

- `categories[*].slug`
- `categories[*].title`
- `categories[*].subtitle`
- `categories[*].results_url`
- `categories[*].cards[*].title`
- `categories[*].cards[*].url`

它不会读取：

- `location_assets`
- `location_card_assets`
- `location_card_aliases`
- `category_icons`
- `category_fallback_asset_keys`

---

## 6. App 后台建议功能结构

建议做成一个单页配置中心，不要拆成多个独立资源页。因为主题最终只读一份完整 JSON，拆散后会增加同步成本。

建议 UI 分为 5 个区域：

### 6.1 概览

展示：

- Metaobject type: `vehicle_static_config`
- Handle: `pages-vehicle-json`
- Field: `vehicle`
- 当前版本号
- 最近保存时间

### 6.2 分类管理

管理 `categories`

建议支持：

- 分类增删改
- 分类排序
- 每个分类下 cards 的增删改排序
- icon URL 编辑
- results URL 编辑

### 6.3 主图覆盖

管理 `location_assets`

建议支持：

- 标准名称
- desktop URL
- mobile URL
- aliases 多值录入

### 6.4 卡片 fallback 资源

管理：

- `location_card_assets`
- `location_card_aliases`
- `category_fallback_asset_keys`

建议把这三块放在同一页，因为它们互相依赖。

### 6.5 原始 JSON

建议保留一个只读/可切换编辑的 raw JSON 面板，用于：

- 高级维护
- 紧急修复
- 导入/导出

---

## 7. 保存规则

App 保存时应采用“整份 JSON 原子覆盖”，不要只改某一个局部字段。

原因：

- 主题当前读取的是一个完整 JSON 字符串
- 分散 patch 容易导致结构不一致
- 整体序列化更利于 diff、回滚、排错

建议保存流程：

1. 读取 Metaobject 当前值
2. 解析为对象
3. 在 App 内编辑完整对象
4. 做前端校验
5. 序列化为格式化 JSON 字符串
6. 回写到 `vehicle_static_config / pages-vehicle-json / vehicle`

建议 JSON 序列化格式：

- UTF-8
- 两空格缩进
- 不要额外包一层字符串

---

## 8. 校验规则

App 至少要做这些校验：

### 8.1 基础结构校验

- 顶层必须是 object
- `categories` 必须是 array
- 其余映射字段必须是 object

### 8.2 分类校验

- `slug` 必填且唯一
- `title` 必填
- `cards[*].title` 必填
- `cards[*].id` 建议唯一，至少在分类内唯一

### 8.3 URL 校验

- icon / image / mobile_image / results_url / card.url 应为非空字符串或合法 URL
- 如果某静态分类要在 `search-result` 展示，必须满足：
  - `results_url` 有值，或
  - 第一张 card 的 `url` 有值

### 8.4 引用关系校验

- `location_card_aliases` 的 value 必须存在于 `location_card_assets`
- `category_fallback_asset_keys` 的 value 必须存在于 `location_card_assets`
- `category_icons` 的 key 最好能在分类 slug 中找到对应项

### 8.5 数据清洗

- 自动 trim 首尾空格
- 去除空对象、空数组中的无效条目
- 避免重复 alias

---

## 9. 推荐的实现约束

### 9.1 Shopify API

建议使用 Shopify Admin GraphQL，不要走 REST。

App 需要的能力至少包括：

- 读取 metaobject
- 更新 metaobject

如果 App 里还要支持上传图片到 Shopify Files，再额外加文件上传能力；如果只是粘贴 CDN URL，则不需要做文件托管。

### 9.2 权限

至少需要能读写 Metaobject 的相关权限。

### 9.3 保存策略

建议加：

- 草稿态本地编辑
- 发布前 diff 预览
- 保存成功提示
- 保存失败回滚

### 9.4 不建议做的事情

- 不要把这份配置拆成多个 metaobject 条目
- 不要把 handle 改成动态可配置
- 不要在 App 内只维护部分字段而忽略整份 JSON
- 不要把主题里仍然硬编码的 artifacts 配置混进这份 JSON

---

## 10. 主题侧现状与边界

当前主题里，以下内容仍然是硬编码，不在 `pages-vehicle-json` 内：

- vehicle selector artifacts
- search-result artifacts
- fitment shard base URL / version
- 旧的 legacy fallback 常量

`pages-vehicle-json` 主要负责的是“运营需要维护、且可能持续变化”的那部分映射数据，而不是所有车型逻辑。

---

## 11. App 验收标准

App 完成后，至少验证这几件事：

### 11.1 分类配置

- 新增一个静态分类后，`vehicle11` 能看到它
- 如果带 `results_url` 或首卡 `url`，`search-result` 也能看到它

### 11.2 分类 icon

- 修改某个 slug 的 icon 后，`vehicle11` 顶部导航和移动端侧栏 icon 同步变化

### 11.3 location 主图

- 修改 `location_assets` 后，`vehicle11` 对应 location fallback 主图变化
- 桌面和移动端能读到不同图

### 11.4 fallback 卡片图

- 修改 `location_card_assets` 或 `location_card_aliases` 后，对应 fallback 卡片图变化

### 11.5 JSON 保存

- 保存后刷新页面，不报解析错误
- 控制台里能读到：

```js
document.getElementById('vehicle11-static-config')
document.getElementById('search-result-static-config')
```

并确认主题命中的还是：

- handle: `pages-vehicle-json`
- field: `vehicle`

---

## 12. 给 App 项目的直接结论

如果只保留一句实现要求，可以概括成：

“做一个针对 `vehicle_static_config/pages-vehicle-json/vehicle` 的单页可视化 JSON 管理器，主功能是维护分类、图标、location 主图、location fallback 卡片图和 alias 映射，并以整份 JSON 原子保存回 Shopify。” 

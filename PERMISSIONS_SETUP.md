# 权限配置说明

## 问题：Access denied for metaobjectByHandle field

如果遇到权限错误，请按照以下步骤解决：

## 解决方案

### 方法 1：使用 Shopify CLI 重新部署（推荐）

1. **确保 `shopify.app.toml` 配置正确**：
   ```toml
   [access_scopes]
   scopes = "read_products,write_products,read_metaobjects,write_metaobjects"
   ```

2. **重新部署应用**：
   ```bash
   shopify app deploy
   ```

3. **重新授权应用**：
   - 在 Shopify 后台卸载应用
   - 重新安装应用（会自动请求新权限）
   - 或者运行 `shopify app dev` 重新授权

### 方法 2：更新环境变量

如果您的应用使用环境变量配置权限（如 Render、Heroku 等），需要更新 `SCOPES` 环境变量：

```bash
SCOPES=read_products,write_products,read_metaobjects,write_metaobjects
```

**在 Render 中设置环境变量**：
1. 进入 Render Dashboard
2. 选择您的服务
3. 进入 Environment 标签
4. 添加或更新 `SCOPES` 变量
5. 重启服务

### 方法 3：手动更新权限

1. 进入 Shopify Partner Dashboard
2. 选择您的应用
3. 进入 "App setup" > "Client credentials"
4. 查看当前的权限范围
5. 如果缺少 `read_metaobjects` 或 `write_metaobjects`，需要：
   - 更新 `shopify.app.toml` 文件
   - 重新部署应用
   - 重新授权

## 验证权限

部署后，可以通过以下方式验证：

1. 访问应用页面，查看是否还有权限错误
2. 检查 Shopify 后台的应用权限设置
3. 查看应用日志，确认权限请求成功

## 注意事项

- 权限更改后，**必须重新授权应用**才能生效
- 如果应用已安装到多个商店，每个商店都需要重新授权
- 权限更改可能需要几分钟才能完全生效


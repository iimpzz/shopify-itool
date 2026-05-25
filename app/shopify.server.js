import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

// 默认权限范围（如果环境变量未设置，使用这些）
const DEFAULT_SCOPES = [
  "read_products",
  "write_products",
  "read_metaobjects",
  "write_metaobjects",
];

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.October25,
  // 优先使用环境变量，如果没有则使用默认值
  scopes: process.env.SCOPES?.split(",").filter(Boolean) || DEFAULT_SCOPES,
  // Render 会提供 RENDER_EXTERNAL_URL（带 https），本地/其他平台继续用 SHOPIFY_APP_URL
  appUrl: process.env.SHOPIFY_APP_URL || process.env.RENDER_EXTERNAL_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  future: {
    expiringOfflineAccessTokens: true,
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.October25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;

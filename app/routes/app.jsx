import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  // eslint-disable-next-line no-undef
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <s-app-nav>
        {/* Note: s-app-nav tends to only render known nav items (links). Use s-link for guaranteed rendering. */}
        <s-link
          href="/app"
          style={{
            display: "block",
            padding: "10px 12px 6px",
            fontWeight: 800,
            textTransform: "uppercase",
          }}
        >
          auxito
        </s-link>
        <s-link href="/app" style={{ display: "block", padding: "6px 12px 6px 24px" }}>
          商品导出
        </s-link>
        <s-link href="/app/collection-spec" style={{ display: "block", padding: "6px 12px 10px 24px" }}>
          collection 规格快速生成
        </s-link>
      </s-app-nav>
      <Outlet />
    </AppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};

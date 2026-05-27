import { createStorefrontApiClient } from "@shopify/storefront-api-client";

const domain = import.meta.env.PUBLIC_SHOPIFY_DOMAIN;
const publicAccessToken = import.meta.env.PUBLIC_SHOPIFY_STOREFRONT_TOKEN;
const apiVersion = import.meta.env.PUBLIC_SHOPIFY_API_VERSION ?? "2026-04";

if (!domain || !publicAccessToken) {
  throw new Error(
    "Missing PUBLIC_SHOPIFY_DOMAIN or PUBLIC_SHOPIFY_STOREFRONT_TOKEN. Check .env.",
  );
}

export const shopify = createStorefrontApiClient({
  storeDomain: `https://${domain}`,
  apiVersion,
  publicAccessToken,
});

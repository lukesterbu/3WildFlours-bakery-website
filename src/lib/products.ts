import { shopify } from "./shopify";

export interface ShopifyImage {
  url: string;
  altText: string | null;
  width: number;
  height: number;
}

export interface ShopifyProduct {
  id: string;
  handle: string;
  title: string;
  description: string;
  /** First variant's ID — used by the Cart API to add items. */
  variantId: string;
  /** Formatted price string, e.g. "$7.00". */
  price: string;
  available: boolean;
  image: ShopifyImage | null;
}

export interface ShopifyCollection {
  id: string;
  handle: string;
  title: string;
  products: ShopifyProduct[];
}

const COLLECTIONS_QUERY = /* GraphQL */ `
  query MenuCollections($first: Int!, $productsFirst: Int!) {
    collections(first: $first) {
      nodes {
        id
        handle
        title
        products(first: $productsFirst) {
          nodes {
            id
            handle
            title
            description
            availableForSale
            featuredImage {
              url
              altText
              width
              height
            }
            variants(first: 1) {
              nodes {
                id
                price {
                  amount
                  currencyCode
                }
              }
            }
          }
        }
      }
    }
  }
`;

interface CollectionsResponse {
  collections: {
    nodes: Array<{
      id: string;
      handle: string;
      title: string;
      products: {
        nodes: Array<{
          id: string;
          handle: string;
          title: string;
          description: string;
          availableForSale: boolean;
          featuredImage: ShopifyImage | null;
          variants: {
            nodes: Array<{
              id: string;
              price: { amount: string; currencyCode: string };
            }>;
          };
        }>;
      };
    }>;
  };
}

function formatPrice(amount: string, currencyCode: string): string {
  const value = Number(amount);
  if (currencyCode === "USD") {
    return `$${value.toFixed(2)}`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
  }).format(value);
}

/**
 * Fetches all collections with their products, in the order Shopify returns them.
 * The menu page filters to a known set of titles (Breads, Pastries).
 */
export async function getCollections(): Promise<ShopifyCollection[]> {
  const { data, errors } = await shopify.request<CollectionsResponse>(
    COLLECTIONS_QUERY,
    { variables: { first: 10, productsFirst: 50 } },
  );

  if (errors) {
    throw new Error(
      `Shopify Storefront API error: ${JSON.stringify(errors, null, 2)}`,
    );
  }
  if (!data) {
    throw new Error("Shopify Storefront API returned no data.");
  }

  return data.collections.nodes.map((collection) => ({
    id: collection.id,
    handle: collection.handle,
    title: collection.title,
    products: collection.products.nodes
      .filter((p) => p.variants.nodes.length > 0)
      .map((p) => {
        const variant = p.variants.nodes[0];
        return {
          id: p.id,
          handle: p.handle,
          title: p.title,
          description: p.description,
          variantId: variant.id,
          price: formatPrice(variant.price.amount, variant.price.currencyCode),
          available: p.availableForSale,
          image: p.featuredImage,
        };
      }),
  }));
}

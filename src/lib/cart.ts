import { shopify } from "./shopify";

const CART_ID_STORAGE_KEY = "3wf_cart_id";
const CART_UPDATED_EVENT = "cart-updated";

export interface CartLine {
  id: string;
  quantity: number;
  merchandise: {
    id: string;
    product: {
      title: string;
      handle: string;
      featuredImage: { url: string; altText: string | null } | null;
    };
    price: { amount: string; currencyCode: string };
  };
  cost: { totalAmount: { amount: string; currencyCode: string } };
}

export interface Cart {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  subtotal: string;
  lines: CartLine[];
}

const CART_FRAGMENT = /* GraphQL */ `
  fragment CartFragment on Cart {
    id
    checkoutUrl
    totalQuantity
    cost {
      subtotalAmount {
        amount
        currencyCode
      }
    }
    lines(first: 50) {
      nodes {
        id
        quantity
        merchandise {
          ... on ProductVariant {
            id
            product {
              title
              handle
              featuredImage {
                url
                altText
              }
            }
            price {
              amount
              currencyCode
            }
          }
        }
        cost {
          totalAmount {
            amount
            currencyCode
          }
        }
      }
    }
  }
`;

interface RawCart {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  cost: { subtotalAmount: { amount: string; currencyCode: string } };
  lines: { nodes: CartLine[] };
}

function formatMoney(amount: string, currencyCode: string): string {
  const value = Number(amount);
  if (currencyCode === "USD") return `$${value.toFixed(2)}`;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
  }).format(value);
}

function normalize(raw: RawCart): Cart {
  return {
    id: raw.id,
    checkoutUrl: raw.checkoutUrl,
    totalQuantity: raw.totalQuantity,
    subtotal: formatMoney(
      raw.cost.subtotalAmount.amount,
      raw.cost.subtotalAmount.currencyCode,
    ),
    lines: raw.lines.nodes,
  };
}

function getStoredCartId(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(CART_ID_STORAGE_KEY);
}

function setStoredCartId(id: string | null): void {
  if (typeof localStorage === "undefined") return;
  if (id) localStorage.setItem(CART_ID_STORAGE_KEY, id);
  else localStorage.removeItem(CART_ID_STORAGE_KEY);
}

function dispatchCartUpdate(cart: Cart | null): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<Cart | null>(CART_UPDATED_EVENT, { detail: cart }),
  );
}

export function onCartUpdated(handler: (cart: Cart | null) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<Cart | null>).detail);
  window.addEventListener(CART_UPDATED_EVENT, listener);
  return () => window.removeEventListener(CART_UPDATED_EVENT, listener);
}

export async function getCart(): Promise<Cart | null> {
  const id = getStoredCartId();
  if (!id) return null;

  const { data, errors } = await shopify.request<{ cart: RawCart | null }>(
    /* GraphQL */ `
      query GetCart($id: ID!) {
        cart(id: $id) {
          ...CartFragment
        }
      }
      ${CART_FRAGMENT}
    `,
    { variables: { id } },
  );

  if (errors || !data?.cart) {
    setStoredCartId(null);
    return null;
  }
  return normalize(data.cart);
}

export async function addToCart(
  variantId: string,
  quantity = 1,
): Promise<Cart> {
  const existingId = getStoredCartId();
  const lines = [{ merchandiseId: variantId, quantity }];

  if (!existingId) {
    const { data, errors } = await shopify.request<{
      cartCreate: { cart: RawCart | null; userErrors: { message: string }[] };
    }>(
      /* GraphQL */ `
        mutation CartCreate($lines: [CartLineInput!]!) {
          cartCreate(input: { lines: $lines }) {
            cart {
              ...CartFragment
            }
            userErrors {
              message
            }
          }
        }
        ${CART_FRAGMENT}
      `,
      { variables: { lines } },
    );
    if (errors || !data?.cartCreate.cart) {
      throw new Error(
        data?.cartCreate.userErrors?.[0]?.message ?? "Failed to create cart",
      );
    }
    setStoredCartId(data.cartCreate.cart.id);
    const cart = normalize(data.cartCreate.cart);
    dispatchCartUpdate(cart);
    return cart;
  }

  const { data, errors } = await shopify.request<{
    cartLinesAdd: { cart: RawCart | null; userErrors: { message: string }[] };
  }>(
    /* GraphQL */ `
      mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
        cartLinesAdd(cartId: $cartId, lines: $lines) {
          cart {
            ...CartFragment
          }
          userErrors {
            message
          }
        }
      }
      ${CART_FRAGMENT}
    `,
    { variables: { cartId: existingId, lines } },
  );
  if (errors || !data?.cartLinesAdd.cart) {
    throw new Error(
      data?.cartLinesAdd.userErrors?.[0]?.message ?? "Failed to add to cart",
    );
  }
  const cart = normalize(data.cartLinesAdd.cart);
  dispatchCartUpdate(cart);
  return cart;
}

export async function updateLineQuantity(
  lineId: string,
  quantity: number,
): Promise<Cart> {
  if (quantity <= 0) return removeFromCart(lineId);
  const cartId = getStoredCartId();
  if (!cartId) throw new Error("No active cart");

  const { data, errors } = await shopify.request<{
    cartLinesUpdate: {
      cart: RawCart | null;
      userErrors: { message: string }[];
    };
  }>(
    /* GraphQL */ `
      mutation CartLinesUpdate(
        $cartId: ID!
        $lines: [CartLineUpdateInput!]!
      ) {
        cartLinesUpdate(cartId: $cartId, lines: $lines) {
          cart {
            ...CartFragment
          }
          userErrors {
            message
          }
        }
      }
      ${CART_FRAGMENT}
    `,
    { variables: { cartId, lines: [{ id: lineId, quantity }] } },
  );
  if (errors || !data?.cartLinesUpdate.cart) {
    throw new Error(
      data?.cartLinesUpdate.userErrors?.[0]?.message ?? "Failed to update cart",
    );
  }
  const cart = normalize(data.cartLinesUpdate.cart);
  dispatchCartUpdate(cart);
  return cart;
}

export async function removeFromCart(lineId: string): Promise<Cart> {
  const cartId = getStoredCartId();
  if (!cartId) throw new Error("No active cart");

  const { data, errors } = await shopify.request<{
    cartLinesRemove: {
      cart: RawCart | null;
      userErrors: { message: string }[];
    };
  }>(
    /* GraphQL */ `
      mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
        cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
          cart {
            ...CartFragment
          }
          userErrors {
            message
          }
        }
      }
      ${CART_FRAGMENT}
    `,
    { variables: { cartId, lineIds: [lineId] } },
  );
  if (errors || !data?.cartLinesRemove.cart) {
    throw new Error(
      data?.cartLinesRemove.userErrors?.[0]?.message ?? "Failed to remove item",
    );
  }
  const cart = normalize(data.cartLinesRemove.cart);
  dispatchCartUpdate(cart);
  return cart;
}

export function formatLinePrice(line: CartLine): string {
  return formatMoney(
    line.cost.totalAmount.amount,
    line.cost.totalAmount.currencyCode,
  );
}

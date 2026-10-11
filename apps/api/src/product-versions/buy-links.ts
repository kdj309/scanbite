import type { BuyLink } from "@foodscanner/shared";

type ProductForSearch = {
  name: string;
  brand: string;
  quantity: string | null;
};

/**
 * Store search links for a product ("Parle Jimjam 57g"). Search, not a
 * product page: we don't know each store's item id, and the user picks the
 * exact pack. No links when we don't know the product's name.
 */
/** Our affiliate tag per store, from server config (none = plain link). */
export type AffiliateTags = Partial<Record<BuyLink["store"], string>>;

export function buyLinks(
  product: ProductForSearch,
  tags: AffiliateTags = {}
): BuyLink[] {
  const search = searchText(product);
  if (!search) {
    return [];
  }
  return STORES.map(({ store, searchUrl, queryParam, tagParam }) => {
    const url = new URL(searchUrl);
    url.searchParams.set(queryParam, search);
    const tag = tagParam ? tags[store] : undefined;
    if (tagParam && tag) {
      url.searchParams.set(tagParam, tag);
    }
    return { store, url: url.toString(), affiliate: Boolean(tag) };
  });
}

/**
 * The "Buy on" buttons, in display order. Adding or swapping a store is a
 * row here (plus its name in the shared buyLinkSchema). BigBasket becomes
 * an affiliate link once we join a network such as Cuelinks.
 */
const STORES: Array<{
  store: BuyLink["store"];
  searchUrl: string;
  queryParam: string;
  /** Where the affiliate tag goes, for stores we have an account with. */
  tagParam?: string;
}> = [
  {
    store: "amazon",
    searchUrl: "https://www.amazon.in/s",
    queryParam: "k",
    tagParam: "tag",
  },
  {
    store: "bigbasket",
    searchUrl: "https://www.bigbasket.com/ps/",
    queryParam: "q",
  },
];

/** Brand + name + pack size, without repeating a brand the name starts with. */
function searchText({ name, brand, quantity }: ProductForSearch): string {
  const known = (value: string | null) =>
    value && value.trim().toLowerCase() !== "unknown" ? value.trim() : "";
  const productName = known(name);
  if (!productName) {
    return "";
  }
  const brandName = known(brand);
  const withBrand =
    brandName && !productName.toLowerCase().startsWith(brandName.toLowerCase())
      ? `${brandName} ${productName}`
      : productName;
  const size = known(quantity);
  return size && !squash(withBrand).includes(squash(size))
    ? `${withBrand} ${size}`
    : withBrand;
}

/** "57 g" and "57g" are the same size. */
function squash(text: string): string {
  return text.toLowerCase().replace(/\s+/g, "");
}

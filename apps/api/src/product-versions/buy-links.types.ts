import type { BuyLink } from "@foodscanner/shared";

/** How to search one store for a product. */
export type StoreSearch = {
  store: BuyLink["store"];
  searchUrl: string;
  queryParam: string;
  /** Where the affiliate tag goes, for stores we have an account with. */
  tagParam?: string;
};

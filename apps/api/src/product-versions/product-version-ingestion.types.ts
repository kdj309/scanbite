import type { DeclaredVeg } from "@foodscanner/shared";
import type { Types } from "mongoose";
import type { DeclaredAllergens } from "../allergens/allergen-evidence";
import type { ProductVersionSource } from "../database/schemas/product-version.schema";
import type { ResolvedIngredientRow } from "./product-version-ingestion.service";

export type PendingVersionInput = {
  barcode: string;
  name: string;
  brand: string;
  category: string;
  ingredients: ResolvedIngredientRow[];
  nutrition: Record<string, number | string | null>;
  nova_group?: number;
  additive_count?: number;
  /** How sure the photo read was. Not set for catalog imports: a first
   *  version goes live without it. */
  extraction_confidence?: number;
  source: ProductVersionSource;
  image_url?: string | null;
  quantity?: string | null;
  declared_allergens?: DeclaredAllergens | null;
  declared_veg?: DeclaredVeg | null;
  submitted_by?: Types.ObjectId;
};

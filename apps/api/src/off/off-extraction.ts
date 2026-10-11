import type { DeclaredVeg } from "@foodscanner/shared";
import type { DeclaredAllergens } from "../allergens/allergen-evidence";

/** Subset of ExtractionOutput that OFF can actually supply — no photo_consistency, that's vision-specific. */
export type OffExtraction = {
  name: string;
  brand: string;
  category: string;
  ingredients: string[];
  nutrition: Record<string, number | string | null>;
  nova_group?: number;
  additive_count?: number;
  extraction_confidence: number;
  image_url: string | null;
  quantity: string | null;
  declared_allergens: DeclaredAllergens | null;
  declared_veg: DeclaredVeg | null;
};

/** Minimal shape we read off the OFF v2 product API response — only the fields we request. */
export type OffProductPayload = {
  status: 0 | 1;
  product?: {
    product_name?: string;
    brands?: string;
    categories?: string;
    categories_tags?: string[];
    ingredients_text?: string;
    ingredients?: Array<{ text?: string }>;
    nutriments?: Record<string, number | string | undefined>;
    nova_group?: number;
    additives_n?: number;
    states_tags?: string[];
    data_quality_errors_tags?: string[];
    quantity?: string;
    product_quantity_unit?: string;
    image_front_url?: string;
    allergens_tags?: string[];
    traces_tags?: string[];
    labels_tags?: string[];
  };
};

import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { ProductSummary } from "@foodscanner/shared";
import type { Env } from "../config/env";
import { buyLinks, type AffiliateTags } from "./buy-links";
import type { Types } from "mongoose";
import type { ProductVersionDocument } from "../database/schemas/product-version.schema";
import type { LabelFacts } from "../database/schemas/submission.schema";
import { shelfOf } from "./shelves";

type VersionFields = Pick<
  ProductVersionDocument,
  | "id"
  | "name"
  | "brand"
  | "source"
  | "image_url"
  | "quantity"
  | "submitted_by"
  | "confirmed_at"
  | "declared_veg"
  | "ingredients"
  | "category"
>;

/** What the app shows about a product. Built per request, never cached:
 *  `verifying` changes when a confirmation lands, without a re-score. */
export function productSummary(
  version: VersionFields,
  tags: AffiliateTags = {}
): ProductSummary {
  const aiPhotos = version.source === "user_submission";
  return {
    name: version.name,
    brand: version.brand,
    product_version_id: version.id as string,
    source: aiPhotos ? "ai_photos" : "catalog",
    verifying: aiPhotos && !version.confirmed_at,
    has_ingredients: version.ingredients.length > 0,
    image_url: version.image_url ?? null,
    quantity: version.quantity ?? null,
    shelf: shelfOf(version.category),
    veg: version.declared_veg ?? "unknown",
    buy_links: buyLinks(version, tags),
  };
}

/** A label check shown like a product (design 2d): read from this
 *  person's own photos, so nothing to confirm and nowhere to buy it. */
export function labelCheckSummary(
  labelCheckId: string,
  label: Pick<LabelFacts, "name" | "brand" | "ingredients">
): ProductSummary {
  return {
    name: label.name,
    brand: label.brand,
    product_version_id: labelCheckId,
    source: "label_check",
    verifying: false,
    has_ingredients: label.ingredients.length > 0,
    image_url: null,
    quantity: null,
    // Not a catalogue product: nothing to compare it with.
    shelf: null,
    veg: "unknown",
    buy_links: [],
  };
}

/**
 * Whether a submission that matched this live version confirms it: only
 * an AI-read version not yet confirmed, and only by someone other than
 * who sent the original photos (re-scanning your own product proves
 * nothing). Versions from before `submitted_by` existed can't tell who
 * that was, so they stay unconfirmed rather than risk self-confirmation.
 */
export function confirmsVersion(
  version: Pick<
    ProductVersionDocument,
    "source" | "submitted_by" | "confirmed_at"
  >,
  submitterId: Types.ObjectId
): boolean {
  return (
    version.source === "user_submission" &&
    !version.confirmed_at &&
    version.submitted_by !== null &&
    version.submitted_by !== undefined &&
    !version.submitted_by.equals(submitterId)
  );
}

/** productSummary with server config (affiliate tags) filled in. */
@Injectable()
export class ProductSummaryService {
  private readonly tags: AffiliateTags;

  constructor(config: ConfigService<Env, true>) {
    this.tags = { amazon: config.get("AMAZON_ASSOCIATE_TAG", { infer: true }) };
  }

  summarize(version: VersionFields): ProductSummary {
    return productSummary(version, this.tags);
  }
}

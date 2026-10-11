import type { ProductSummary } from "@foodscanner/shared";
import type { Types } from "mongoose";
import type { ProductVersionDocument } from "../database/schemas/product-version.schema";

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
>;

/** What the app shows about a product. Built per request, never cached:
 *  `verifying` changes when a confirmation lands, without a re-score. */
export function productSummary(version: VersionFields): ProductSummary {
  const aiPhotos = version.source === "user_submission";
  return {
    name: version.name,
    brand: version.brand,
    product_version_id: version.id as string,
    source: aiPhotos ? "ai_photos" : "catalog",
    verifying: aiPhotos && !version.confirmed_at,
    image_url: version.image_url ?? null,
    quantity: version.quantity ?? null,
    veg: version.declared_veg ?? "unknown",
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

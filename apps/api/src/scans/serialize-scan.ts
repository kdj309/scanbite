import type { ProductSummary, Scan as ScanDto } from "@foodscanner/shared";
import { toIso } from "../common/dates";
import type { ScanDocument } from "../database/schemas/scan.schema";

export function serializeScan(
  scan: ScanDocument,
  product: ProductSummary | null
): ScanDto {
  return {
    id: scan.id as string,
    barcode: scan.barcode,
    member_id: scan.member_id ? String(scan.member_id) : null,
    product_version_id: scan.product_version_id
      ? String(scan.product_version_id)
      : null,
    product,
    found: scan.found,
    severity: scan.severity,
    verdicts: (scan.verdicts ?? []).map((verdict) => ({
      member_id: String(verdict.member_id),
      severity: verdict.severity,
    })),
    rule_set_version: scan.rule_set_version,
    created_at: toIso(scan.created_at),
  };
}

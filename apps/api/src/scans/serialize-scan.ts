import type { Scan as ScanDto } from "@foodscanner/shared";
import { toIso } from "../common/dates";
import type { ScanDocument } from "../database/schemas/scan.schema";

export function serializeScan(scan: ScanDocument): ScanDto {
  return {
    id: scan.id as string,
    barcode: scan.barcode,
    member_id: String(scan.member_id),
    product_version_id: scan.product_version_id
      ? String(scan.product_version_id)
      : null,
    found: scan.found,
    created_at: toIso(scan.created_at),
  };
}

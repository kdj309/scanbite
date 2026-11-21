import type { CreateScanResponse } from "@foodscanner/shared";
import type { PermissionResponse } from "expo-camera";

export type LookupState =
  | { kind: "looking" }
  | { kind: "notFound" }
  | { kind: "error"; message: string };

export interface ScannerProps {
  memberId: string | undefined;
  label: string | undefined;
  noBarcode: boolean;
  permission: PermissionResponse;
  onAllow: () => Promise<PermissionResponse>;
}

export interface ViewfinderProps {
  scanning: boolean;
}

export interface TypeBarcodeProps {
  onCancel: () => void;
  onLookUp: (barcode: string) => void;
}

export interface LookupQuery {
  isError: boolean;
  error: Error | null;
  data: CreateScanResponse | undefined;
}

export interface LookupSheetProps {
  barcode: string;
  state: LookupState;
  onRetry: () => void;
  onScanAnother: () => void;
}

export interface CameraPermissionProps {
  permission: PermissionResponse;
  onAllow: () => Promise<PermissionResponse>;
  onType: () => void;
}

/** Route params for /scan; `for` is who to scan for. */
export type ScanParams = {
  for?: string;
  /** A known product whose label couldn't be read (design 2c). */
  label?: string;
  /** Check a pack with no barcode by its label (design 2d). */
  noBarcode?: string;
};

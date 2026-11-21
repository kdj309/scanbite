import type { CameraView } from "expo-camera";
import type { ReactNode, RefObject } from "react";
import type { LabelState } from "./label-progress";

export interface LabelCaptureProps {
  title: string;
  /** "Not now" when the app offered this; "Cancel" when it was asked for. */
  cancelLabel: string;
  onDone: (photoUris: string[]) => void;
  onCancel: () => void;
}

export interface VideoCaptureProps {
  camera: RefObject<CameraView | null>;
  ready: boolean;
  recording: boolean;
  onRecordingChange: (recording: boolean) => void;
  onRecorded: (uri: string, seconds: number) => void;
  onFailed: () => void;
}

export interface ProgressRingProps {
  progress: number;
}

export interface PhotoCaptureProps {
  camera: RefObject<CameraView | null>;
  ready: boolean;
  onSend: (uris: string[]) => void;
}

export interface LabelFlowProps {
  /** null = a label check: a pack with no barcode. */
  barcode: string | null;
  /** Who it's scanned for; omitted = everyone. */
  memberId?: string;
  inFront: boolean;
  /** Keep checking, but let the person scan the next product. */
  onBack: () => void;
  /** Back in front, e.g. to try the label again. */
  onFront: () => void;
  /** Nothing more to do here. */
  onDone: () => void;
  /** Read and ready: open its verdict. */
  onReady: (submissionId: string) => void;
}

export interface WaitingProps {
  submissionId: string;
  labelCheck: boolean;
  inFront: boolean;
  onBack: () => void;
  onDone: () => void;
  onReady: (submissionId: string) => void;
  onRetry: () => void;
}

export interface BannerProps {
  text: string;
  action: string;
  onPress: () => void;
}

export interface LabelProgressProps {
  state: LabelState;
  /** A pack with no barcode, checked for this person only (design 2d). */
  labelCheck: boolean;
  onScanNext: () => void;
  onRetry: () => void;
  onHome: () => void;
}

export interface ReadingProps {
  sending: boolean;
  labelCheck: boolean;
  onScanNext: () => void;
}

export interface ChecklistProps {
  sending: boolean;
}

export interface SheetProps {
  tint: string;
  title: string;
  line: string;
  jump?: boolean;
  children: ReactNode;
}

import { CameraView } from "expo-camera";
import { type RefObject, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import { Bitey, Icon, Text } from "@/components";
import { colors, minTouchTarget, radii, spacing } from "@/theme";
import { inTurn, shrinkPhoto, videoFrames } from "./frames";

type Mode = "video" | "photos";

/** A label video: long enough to turn the pack, short enough to upload. */
const MIN_SECONDS = 4;
const MAX_SECONDS = 15;
const MAX_PHOTOS = 3;

/**
 * "New product! Show me the label" (design S10): a short video (the phone
 * picks the frames) or up to 3 photos. Hands back JPEGs to upload.
 */
export function LabelCapture({
  onDone,
  onCancel,
}: {
  onDone: (photoUris: string[]) => void;
  onCancel: () => void;
}) {
  const camera = useRef<CameraView>(null);
  const [mode, setMode] = useState<Mode>("video");
  const [ready, setReady] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string>();

  async function finish(make: () => Promise<string[]>) {
    setPreparing(true);
    setError(undefined);
    try {
      onDone(await make());
    } catch (cause) {
      if (__DEV__) {
        console.warn("Preparing the label failed", cause);
      }
      setError("Couldn’t use that. Please try again.");
      setPreparing(false);
    }
  }

  return (
    <View style={styles.screen}>
      <CameraView
        ref={camera}
        style={StyleSheet.absoluteFill}
        facing="back"
        mode={mode === "video" ? "video" : "picture"}
        // The label is what matters; no microphone needed.
        mute
        onCameraReady={() => setReady(true)}
      />
      <SafeAreaView style={styles.overlay}>
        <View style={styles.banner}>
          <View style={styles.bannerIcon}>
            <Bitey size={30} />
          </View>
          <Text variant="title" style={styles.fill}>
            New product! Show me the label
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={onCancel}
            hitSlop={spacing.xs}
            style={styles.notNow}
          >
            <Text variant="label" color="secondary">
              Not now
            </Text>
          </Pressable>
        </View>
        {/* No switching mid-video: the camera can't change mode while recording. */}
        {!preparing && !recording && (
          <View
            style={styles.modes}
            accessibilityRole="radiogroup"
            accessibilityLabel="Capture mode"
          >
            {(["video", "photos"] as const).map((option) => (
              <Pressable
                key={option}
                accessibilityRole="radio"
                accessibilityState={{ checked: mode === option }}
                onPress={() => {
                  setMode(option);
                  setError(undefined);
                }}
                style={[styles.mode, mode === option && styles.modeOn]}
              >
                <Text
                  variant="label"
                  color={mode === option ? "brand" : "onBrand"}
                >
                  {option === "video" ? "Video" : "Photos"}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
        <View style={styles.frame} pointerEvents="none" />
        <View style={styles.hud}>
          {error && (
            <Text
              variant="label"
              color="onBrand"
              style={styles.centered}
              accessibilityRole="alert"
            >
              {error}
            </Text>
          )}
          {preparing ? (
            <View style={styles.preparing}>
              <ActivityIndicator color={colors.onBrand} />
              <Text variant="title" color="onBrand">
                {mode === "video"
                  ? "Picking the clearest frames…"
                  : "Getting the photos ready…"}
              </Text>
            </View>
          ) : mode === "video" ? (
            <VideoCapture
              camera={camera}
              ready={ready}
              recording={recording}
              onRecordingChange={(on) => {
                setRecording(on);
                setError(undefined);
              }}
              onRecorded={(uri, seconds) =>
                void finish(() => videoFrames(uri, seconds))
              }
              onFailed={() => setError("Couldn’t record. Please try again.")}
            />
          ) : (
            <PhotoCapture
              camera={camera}
              ready={ready}
              onSend={(uris) => void finish(() => inTurn(uris, shrinkPhoto))}
            />
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

function VideoCapture({
  camera,
  ready,
  recording,
  onRecordingChange,
  onRecorded,
  onFailed,
}: {
  camera: RefObject<CameraView | null>;
  ready: boolean;
  recording: boolean;
  onRecordingChange: (recording: boolean) => void;
  onRecorded: (uri: string, seconds: number) => void;
  onFailed: () => void;
}) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!recording) {
      return;
    }
    const started = Date.now();
    const tick = setInterval(
      () => setSeconds((Date.now() - started) / 1000),
      100
    );
    return () => clearInterval(tick);
  }, [recording]);

  async function start() {
    setSeconds(0);
    onRecordingChange(true);
    const started = Date.now();
    try {
      // Resolves when stopped, or by itself at the longest length.
      const video = await camera.current?.recordAsync({
        maxDuration: MAX_SECONDS,
      });
      onRecordingChange(false);
      if (video) {
        onRecorded(video.uri, (Date.now() - started) / 1000);
      }
    } catch (cause) {
      if (__DEV__) {
        console.warn("Recording the label failed", cause);
      }
      onRecordingChange(false);
      onFailed();
    }
  }

  const canStop = seconds >= MIN_SECONDS;
  // Blur comes from distance and movement: ask for each side close and still.
  let title = "Hold each side close and still";
  let hint = "Ingredients, then the nutrition table · 2 seconds each";
  if (recording) {
    title = canStop
      ? "Now the nutrition table, close and still"
      : "Ingredients first, close and still";
    hint = canStop
      ? `Tap to stop · stops by itself in ${Math.ceil(MAX_SECONDS - seconds)}s`
      : `Keep going · ${Math.ceil(MIN_SECONDS - seconds)}s until you can stop`;
  }

  return (
    <>
      <View style={styles.text}>
        <Text variant="title" color="onBrand" style={styles.centered}>
          {title}
        </Text>
        <Text variant="caption" color="onBrand" style={styles.centered}>
          {hint}
        </Text>
      </View>
      <View style={styles.shutterRow}>
        <View style={styles.ringWrap}>
          <ProgressRing progress={recording ? seconds / MAX_SECONDS : 0} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              recording ? "Stop recording" : "Start recording"
            }
            disabled={!ready || (recording && !canStop)}
            onPress={() =>
              recording ? camera.current?.stopRecording() : void start()
            }
            style={styles.shutter}
          >
            <View style={recording ? styles.stopMark : styles.recMark} />
          </Pressable>
        </View>
      </View>
    </>
  );
}

const RING = 84;
const RING_RADIUS = 38;

/** How much of the longest video is used up. */
function ProgressRing({ progress }: { progress: number }) {
  const length = 2 * Math.PI * RING_RADIUS;
  return (
    <Svg
      width={RING}
      height={RING}
      style={StyleSheet.absoluteFill}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Circle
        cx={RING / 2}
        cy={RING / 2}
        r={RING_RADIUS}
        stroke="rgba(255,255,255,0.3)"
        strokeWidth={4}
        fill="none"
      />
      {progress > 0 && (
        <Circle
          cx={RING / 2}
          cy={RING / 2}
          r={RING_RADIUS}
          stroke={colors.mango}
          strokeWidth={4}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${Math.min(progress, 1) * length} ${length}`}
          transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
        />
      )}
    </Svg>
  );
}

function PhotoCapture({
  camera,
  ready,
  onSend,
}: {
  camera: RefObject<CameraView | null>;
  ready: boolean;
  onSend: (uris: string[]) => void;
}) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [taking, setTaking] = useState(false);

  async function shoot() {
    setTaking(true);
    try {
      const photo = await camera.current?.takePictureAsync({ quality: 0.8 });
      if (!photo) {
        return;
      }
      const next = [...photos, photo.uri];
      setPhotos(next);
      // The third photo is the last: send without another tap.
      if (next.length === MAX_PHOTOS) {
        onSend(next);
      }
    } finally {
      setTaking(false);
    }
  }

  return (
    <>
      <Text variant="title" color="onBrand" style={styles.centered}>
        {photos.length >= MAX_PHOTOS
          ? "All 3 done"
          : `Ingredients or nutrition table · ${photos.length + 1} of ${MAX_PHOTOS}`}
      </Text>
      <View style={styles.slots}>
        {Array.from({ length: MAX_PHOTOS }, (_, i) => (
          <View key={i} style={styles.slot}>
            {photos[i] ? (
              <>
                <Image
                  source={{ uri: photos[i] }}
                  style={styles.slotImage}
                  accessibilityIgnoresInvertColors
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Retake photo ${i + 1}`}
                  onPress={() =>
                    setPhotos((all) => all.filter((_, j) => j !== i))
                  }
                  hitSlop={spacing.xs}
                  style={styles.retake}
                >
                  <Icon name="close" size={12} color={colors.onBrand} />
                </Pressable>
              </>
            ) : (
              <Text variant="label" color="onBrand">
                {i + 1}
              </Text>
            )}
          </View>
        ))}
      </View>
      <View style={styles.shutterRow}>
        <View style={styles.side} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Take photo"
          disabled={!ready || taking || photos.length >= MAX_PHOTOS}
          onPress={() => void shoot()}
          style={styles.shutter}
        >
          <View style={styles.photoMark} />
        </Pressable>
        <View style={[styles.side, styles.sideEnd]}>
          {photos.length > 0 && photos.length < MAX_PHOTOS && (
            <Pressable
              accessibilityRole="button"
              onPress={() => onSend(photos)}
              style={styles.send}
            >
              <Text variant="label">Send</Text>
            </Pressable>
          )}
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centered: { textAlign: "center" },
  screen: { flex: 1, backgroundColor: colors.ink },
  overlay: { flex: 1, paddingHorizontal: spacing.md },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: spacing.xs,
    padding: 10,
    borderRadius: 18,
    backgroundColor: colors.surface,
    boxShadow: "0 8px 20px rgba(0,0,0,0.25)",
  },
  bannerIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.mango,
  },
  notNow: { minHeight: minTouchTarget, justifyContent: "center" },
  modes: {
    alignSelf: "center",
    flexDirection: "row",
    marginTop: spacing.sm,
    padding: spacing.xxs,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  mode: {
    minWidth: 100,
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.pill,
  },
  modeOn: { backgroundColor: colors.surface },
  frame: {
    flex: 1,
    marginVertical: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.6)",
    borderStyle: "dashed",
  },
  hud: { gap: spacing.sm, paddingBottom: spacing.lg },
  text: { gap: 2 },
  preparing: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    minHeight: RING,
  },
  shutterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  ringWrap: {
    width: RING,
    height: RING,
    alignItems: "center",
    justifyContent: "center",
  },
  shutter: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: colors.onBrand,
  },
  recMark: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.record,
  },
  stopMark: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: colors.record,
  },
  photoMark: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.onBrand,
  },
  slots: { flexDirection: "row", justifyContent: "center", gap: 14 },
  slot: {
    width: 56,
    height: 56,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.5)",
    borderStyle: "dashed",
  },
  slotImage: { width: "100%", height: "100%", borderRadius: 10 },
  retake: {
    position: "absolute",
    top: -8,
    right: -8,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.ink,
  },
  side: { width: 80 },
  sideEnd: { alignItems: "flex-end" },
  send: {
    minHeight: minTouchTarget,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.mango,
  },
});

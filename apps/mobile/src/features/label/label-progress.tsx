import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bitey, Button, Icon, Text } from "@/components";
import {
  colors,
  radii,
  screenGutter,
  severityColors,
  spacing,
  sheetBottomPadding,
} from "@/theme";
import type {
  ChecklistProps,
  LabelProgressProps,
  ReadingProps,
  SheetProps,
} from "./label.types";

/** What the sheet shows while and after the label is read (design S10, 10a, 10b). */
export type LabelState = "sending" | "processing" | "needs_review" | "failed";

const STEPS = [
  "Reading the label",
  "Checking ingredients & nutrition",
  "Matching your family",
];

/** Roughly when each step starts, while we wait (it takes about a minute). */
const STEP_AFTER_SECONDS = [0, 8, 25];

/** Well past the usual minute: say so rather than look stuck. */
const SLOW_SECONDS = 180;

/** Seconds since `running` became true. */
function useSeconds(running: boolean): number {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!running) {
      return;
    }
    const tick = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(tick);
  }, [running]);
  return seconds;
}

export function LabelProgress({
  state,
  labelCheck,
  onScanNext,
  onRetry,
  onHome,
}: LabelProgressProps) {
  if (state === "needs_review") {
    return (
      <Sheet
        tint={colors.brandTint}
        title="Taking a closer look"
        line="Thanks for adding it!"
      >
        <View style={styles.note}>
          <View style={styles.info}>
            <Text variant="label" color="brand">
              i
            </Text>
          </View>
          <Text variant="bodyStrong" style={styles.fill}>
            Part of the label was hard to read, so a person will check it. I’ll
            let you know when it’s ready.
          </Text>
        </View>
        <View style={styles.actions}>
          <Button title="Scan the next product" onPress={onScanNext} />
          <Button
            title="Back to Home"
            variant="link"
            onPress={onHome}
            style={styles.centerSelf}
          />
        </View>
      </Sheet>
    );
  }
  if (state === "failed") {
    return (
      <Sheet
        tint={colors.mangoTint}
        title="Couldn’t read the label"
        line="Let’s try once more."
      >
        <View style={styles.tips}>
          <Text variant="title">Tips for a clear shot</Text>
          <Text color="secondary">
            · Good light, no glare on the pack{"\n"}· Fill the frame with the
            ingredients or nutrition table{"\n"}· Hold still for a second
          </Text>
        </View>
        <View style={styles.actions}>
          <Button title="Try again" onPress={onRetry} />
          <Button
            title="Not now"
            variant="link"
            onPress={onHome}
            style={styles.centerSelf}
          />
        </View>
      </Sheet>
    );
  }
  return (
    <Reading
      sending={state === "sending"}
      labelCheck={labelCheck}
      onScanNext={onScanNext}
    />
  );
}

/** "You added a new product!" while the label is read (design S10). */
function Reading({ sending, labelCheck, onScanNext }: ReadingProps) {
  const seconds = useSeconds(!sending);
  return (
    <Sheet
      tint={colors.mango}
      title={labelCheck ? "Checking your label" : "You added a new product!"}
      line={
        labelCheck
          ? "Only you will see this result, in your recent scans."
          : "Everyone who scans it next gets the answer instantly."
      }
      jump
    >
      <Checklist sending={sending} />
      <Text variant="caption" accessibilityLiveRegion="polite">
        {seconds >= SLOW_SECONDS
          ? "This is taking longer than usual. I’ll let you know when it’s ready."
          : "Keep shopping. I’ll show the result here as soon as it’s ready."}
      </Text>
      <Button title="Scan the next product" onPress={onScanNext} />
    </Sheet>
  );
}

/** The three steps, ticking along while we wait. */
function Checklist({ sending }: ChecklistProps) {
  const seconds = useSeconds(!sending);
  const current = sending
    ? 0
    : STEP_AFTER_SECONDS.filter((after) => seconds >= after).length - 1;

  return (
    <View style={styles.steps} accessibilityLiveRegion="polite">
      {STEPS.map((label, i) => {
        const done = i < current;
        const now = i === current;
        return (
          <View key={label} style={styles.step}>
            <View
              style={[
                styles.stepMark,
                done && styles.stepDone,
                now && styles.stepNow,
              ]}
            >
              {done && <Icon name="check" size={14} color={colors.onBrand} />}
            </View>
            <Text
              variant="title"
              color={done || now ? "ink" : "secondary"}
              accessibilityLabel={`${label}${done ? ", done" : now ? ", in progress" : ""}`}
            >
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function Sheet({ tint, title, line, jump = false, children }: SheetProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.host}>
      <View
        style={[
          styles.sheet,
          { paddingBottom: sheetBottomPadding(insets.bottom) },
        ]}
      >
        <View style={styles.grab} />
        <View style={styles.head}>
          <View style={[styles.badge, { backgroundColor: tint }]}>
            <Bitey size={54} motion={jump ? "jump" : "bob"} />
          </View>
          <View style={styles.fill}>
            <Text variant="h2" accessibilityRole="header">
              {title}
            </Text>
            <Text variant="caption">{line}</Text>
          </View>
        </View>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centerSelf: { alignSelf: "center" },
  host: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: "flex-end",
    backgroundColor: "rgba(26,21,35,0.35)",
  },
  sheet: {
    gap: 14,
    paddingHorizontal: screenGutter,
    paddingTop: spacing.sm,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    backgroundColor: colors.background,
  },
  grab: {
    alignSelf: "center",
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.hairline,
  },
  head: { flexDirection: "row", alignItems: "center", gap: 14 },
  badge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  steps: { gap: 14, paddingVertical: 6 },
  step: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  stepMark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.hairline,
  },
  stepDone: { backgroundColor: severityColors.green.solid },
  stepNow: { backgroundColor: colors.brand },
  note: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  info: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brandTint,
  },
  tips: {
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  actions: { gap: spacing.xs },
});

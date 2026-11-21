import { useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Bitey, Text } from "@/components";
import { askForPushAfterLabel, ignorePushError } from "@/features/push/push";
import { colors, radii, spacing } from "@/theme";
import { uploadLabel, useSubmission } from "./api";
import { LabelCapture } from "./label-capture";
import { LabelProgress } from "./label-progress";
import type { BannerProps, LabelFlowProps, WaitingProps } from "./label.types";

/**
 * Adding one new product from its label (design S10, 10a, 10b), or with
 * no barcode, checking one pack's label for this person only (2d):
 * capture, upload, then wait for it to be read. In front, it shows the camera and
 * the progress sheet; sent to the back ("Scan the next product"), it keeps
 * checking and shows a banner once there's something to see.
 */
export function LabelFlow({
  barcode,
  memberId,
  inFront,
  onBack,
  onFront,
  onDone,
  onReady,
}: LabelFlowProps) {
  const labelCheck = barcode === null;
  const [submissionId, setSubmissionId] = useState<string>();
  const upload = useMutation({
    mutationFn: (photoUris: string[]) =>
      uploadLabel(barcode, photoUris, memberId),
    onSuccess: ({ submission_id }) => {
      setSubmissionId(submission_id);
      // "We'll tell you when it's ready": the moment to ask (decided 11-21).
      void askForPushAfterLabel().catch(ignorePushError);
    },
  });

  if (submissionId === undefined) {
    if (!inFront) {
      // Sent to the back while sending: say so if the sending failed.
      return upload.isError ? (
        <Banner
          text="Couldn’t send that label"
          action="Try again"
          onPress={onFront}
        />
      ) : null;
    }
    if (upload.isPending) {
      return (
        <LabelProgress
          state="sending"
          labelCheck={labelCheck}
          onScanNext={onBack}
          onRetry={onFront}
          onHome={onDone}
        />
      );
    }
    return (
      <>
        <LabelCapture
          // A label check was asked for, so no question and no "Not now".
          title={
            labelCheck ? "Show me the label" : "New product! Show me the label"
          }
          cancelLabel={labelCheck ? "Cancel" : "Not now"}
          onDone={(uris) => upload.mutate(uris)}
          onCancel={onDone}
        />
        {upload.isError && (
          <View style={styles.errorBar} accessibilityLiveRegion="polite">
            <Text variant="label" color="onBrand" accessibilityRole="alert">
              Couldn’t send the label. {upload.error.message}
            </Text>
          </View>
        )}
      </>
    );
  }
  return (
    <Waiting
      submissionId={submissionId}
      labelCheck={labelCheck}
      inFront={inFront}
      onBack={onBack}
      onDone={onDone}
      onReady={onReady}
      onRetry={() => {
        // A new try is a new submission.
        setSubmissionId(undefined);
        upload.reset();
        onFront();
      }}
    />
  );
}

function Waiting({
  submissionId,
  labelCheck,
  inFront,
  onBack,
  onDone,
  onReady,
  onRetry,
}: WaitingProps) {
  const submission = useSubmission(submissionId);
  const status = submission.data?.status ?? "processing";

  // In front, a ready product opens straight away.
  useEffect(() => {
    if (status === "ready" && inFront) {
      onReady(submissionId);
    }
  }, [status, inFront, onReady, submissionId]);

  if (inFront) {
    return (
      <LabelProgress
        state={status === "ready" ? "processing" : status}
        labelCheck={labelCheck}
        onScanNext={onBack}
        onRetry={onRetry}
        onHome={() => {
          onDone();
          router.navigate("/");
        }}
      />
    );
  }
  if (status === "ready") {
    return (
      <Banner
        text={
          labelCheck ? "Your label is checked" : "Your new product is ready"
        }
        action="See it"
        onPress={() => onReady(submissionId)}
      />
    );
  }
  if (status === "failed") {
    return (
      <Banner
        text="Couldn’t read that label"
        action="Try again"
        onPress={onRetry}
      />
    );
  }
  return null;
}

/** Over the scanner, like a notification (design S10, "ready"). */
function Banner({ text, action, onPress }: BannerProps) {
  return (
    <SafeAreaView style={styles.bannerHost} pointerEvents="box-none">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${text}. ${action}`}
        onPress={onPress}
        style={styles.banner}
      >
        <View style={styles.bannerIcon}>
          <Bitey size={30} />
        </View>
        <Text variant="title" style={styles.fill}>
          {text}
        </Text>
        <Text variant="label" color="brand">
          {action}
        </Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  errorBar: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    bottom: 140,
    padding: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: "rgba(26,21,35,0.8)",
  },
  bannerHost: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 56,
    padding: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    boxShadow: "0 8px 20px rgba(0,0,0,0.25)",
  },
  bannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand,
  },
});

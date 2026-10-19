import { router } from "expo-router";
import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Bitey,
  Button,
  IconButton,
  SpeechBubble,
  StepProgress,
  Text,
} from "@/components";
import { screenGutter, spacing } from "@/theme";

/** Who, about, conditions, allergies. */
const SETUP_STEPS = 4;

type StepScreenProps = {
  step: number;
  say: string;
  title: string;
  children: ReactNode;
  /** The main button; a step that only offers choices (tiles) has none. */
  nextLabel?: string;
  onNext?: () => void;
  nextDisabled?: boolean;
  saving?: boolean;
};

/** The frame every step of adding a person shares (design S0, 8a). */
export function StepScreen({
  step,
  say,
  title,
  children,
  nextLabel,
  onNext,
  nextDisabled = false,
  saving = false,
}: StepScreenProps) {
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.safe}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.top}>
          <StepProgress current={step} total={SETUP_STEPS} />
          <View style={styles.bitey}>
            <Bitey size={64} />
            <SpeechBubble style={styles.bubble}>{say}</SpeechBubble>
          </View>
        </View>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text variant="h1">{title}</Text>
          {children}
        </ScrollView>
        <View style={styles.footer}>
          <IconButton
            icon="chevronLeft"
            label="Back"
            variant="outline"
            onPress={() => router.back()}
          />
          {nextLabel !== undefined && onNext !== undefined && (
            <Button
              title={nextLabel}
              onPress={onNext}
              disabled={nextDisabled}
              loading={saving}
              style={styles.next}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  top: { paddingHorizontal: screenGutter, paddingTop: screenGutter },
  bitey: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingTop: 14,
  },
  bubble: { flex: 1, marginBottom: 18 },
  content: {
    paddingHorizontal: screenGutter,
    paddingTop: 10,
    paddingBottom: spacing.md,
    gap: 14,
  },
  footer: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: screenGutter,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  next: { flex: 1 },
});

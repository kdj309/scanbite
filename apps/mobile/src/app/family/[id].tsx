import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, IconButton, Text } from "@/components";
import {
  deleteMember,
  showRemovedMember,
  showSavedMember,
  updateMember,
  useHousehold,
} from "@/features/household/api";
import {
  editRequest,
  formFromMember,
  type MemberForm,
} from "@/features/household/edit-member";
import { HouseholdLoading } from "@/features/household/household-loading";
import { nameMissing } from "@/features/household/members";
import {
  AgePicker,
  AllergiesPicker,
  ConditionsPicker,
  NameField,
} from "@/features/household/profile-pickers";
import { colors, screenGutter, spacing } from "@/theme";
import type { EditFormProps } from "@/features/household/household.types";

/** Edit one person: name, age, conditions, allergies; or remove them. */
export default function EditMember() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const household = useHousehold();
  const member = household.data?.members.find((m) => m.id === id);

  if (household.data === undefined) {
    return <HouseholdLoading household={household} />;
  }
  if (!member) {
    // Removed meanwhile (or a stale link).
    return (
      <SafeAreaView style={[styles.center, styles.gap]}>
        <Text>This person isn’t in your family any more.</Text>
        <Button
          title="Back"
          variant="secondary"
          onPress={() => router.back()}
        />
      </SafeAreaView>
    );
  }
  // Keyed, so switching to another person starts a fresh form.
  return <EditForm key={member.id} member={member} />;
}

function EditForm({ member }: EditFormProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<MemberForm>(() => formFromMember(member));
  const [scrolled, setScrolled] = useState(false);
  const self = member.relationship === "self";
  const update = (patch: Partial<MemberForm>) =>
    setForm((current) => ({ ...current, ...patch }));

  const save = useMutation({
    mutationFn: () => updateMember(member.id, editRequest(member, form)),
    onSuccess: (saved) => {
      showSavedMember(queryClient, saved);
      router.back();
    },
  });
  const remove = useMutation({
    mutationFn: () => deleteMember(member.id),
    // Back first: without them, this screen has no one left to show.
    onSuccess: () => {
      router.back();
      showRemovedMember(queryClient, member.id);
    },
  });
  const busy = save.isPending || remove.isPending;
  const error = save.error ?? remove.error;

  function confirmRemove() {
    Alert.alert(
      `Remove ${member.name}?`,
      "Scans will stop showing a verdict for them.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => remove.mutate(),
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.safe} behavior="padding">
        {/* A line once scrolled, so content clearly passes under the bar. */}
        <View style={[styles.bar, scrolled && styles.barScrolled]}>
          <IconButton
            icon="chevronLeft"
            label="Back"
            onPress={() => router.back()}
          />
          <Text variant="h2">
            {self ? "Your profile" : `Edit ${member.name}`}
          </Text>
        </View>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={32}
          onScroll={(event) =>
            setScrolled(event.nativeEvent.contentOffset.y > 0)
          }
        >
          <NameField
            relationship={member.relationship}
            value={form.name}
            onChange={(name) => update({ name })}
          />
          <View style={styles.section}>
            <Text variant="h2">Age</Text>
            <AgePicker
              value={form.ageBand}
              onChange={(ageBand) => update({ ageBand })}
            />
          </View>
          <View style={styles.section}>
            <Text variant="h2">Conditions</Text>
            <ConditionsPicker
              value={form.conditions}
              onChange={(conditions) => update({ conditions })}
            />
          </View>
          <View style={styles.section}>
            <Text variant="h2">Allergies</Text>
            <AllergiesPicker
              value={form.allergies}
              onChange={(allergies) => update({ allergies })}
            />
          </View>
        </ScrollView>
        <View style={styles.footer}>
          {/* By the buttons, not the end of the form: always in view. */}
          {error && (
            <Text variant="caption" accessibilityRole="alert">
              Couldn’t save. {error.message}
            </Text>
          )}
          <Button
            title="Save changes"
            onPress={() => save.mutate()}
            loading={save.isPending}
            disabled={busy || nameMissing(member.relationship, form.name)}
          />
          {!self && (
            <Button
              variant="danger"
              icon="trash"
              title={`Remove ${member.name}`}
              accessibilityHint="Removes them from your family"
              onPress={confirmRemove}
              disabled={busy}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  gap: { gap: spacing.sm, padding: screenGutter },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  content: {
    paddingHorizontal: screenGutter,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    gap: spacing.xl,
  },
  section: { gap: spacing.sm },
  footer: {
    gap: 10,
    paddingHorizontal: screenGutter,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  barScrolled: {
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
});

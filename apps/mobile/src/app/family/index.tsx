import {
  HEALTH_CONDITION_SHORT_LABELS,
  type HouseholdMember,
} from "@foodscanner/shared";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import {
  Button,
  Card,
  Chip,
  DotPattern,
  Icon,
  IconButton,
  Text,
} from "@/components";
import { useHousehold } from "@/features/household/api";
import { editLabel, openEdit } from "@/features/household/edit-link";
import { HouseholdLoading } from "@/features/household/household-loading";
import { MemberAvatar } from "@/features/household/member-avatar";
import { familyProgress, listName } from "@/features/household/members";
import { colors, radii, screenGutter, spacing } from "@/theme";

/** Everyone in the family, each with an edit button (design 8). */
export default function Family() {
  const household = useHousehold();
  const members = household.data?.members;
  if (members === undefined) {
    return <HouseholdLoading household={household} />;
  }
  const progress = familyProgress(members);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <DotPattern />
        <SafeAreaView edges={["top"]} style={styles.headerContent}>
          <ProgressRing done={progress.done} total={progress.total} />
          <View style={styles.headerText}>
            <Text variant="h1" color="onBrand">
              Your family
            </Text>
            <Text variant="bodyStrong" color="onBrand">
              {progressMessage(progress.next)}
            </Text>
          </View>
        </SafeAreaView>
      </View>
      <ScrollView style={styles.sheet} contentContainerStyle={styles.content}>
        {members.map((member) => (
          <MemberCard key={member.id} member={member} />
        ))}
        <Button
          title="Add family member"
          variant="secondary"
          icon="plus"
          onPress={() => router.push("/family/add")}
        />
        <Text variant="caption" style={styles.centered}>
          Conditions stay on your account. We never share them.
        </Text>
      </ScrollView>
    </View>
  );
}

function progressMessage(next: HouseholdMember | undefined): string {
  if (!next) {
    return "Every scan is checked for everyone.";
  }
  return next.relationship === "self"
    ? "Add your own conditions to finish your family profile."
    : `Add ${next.name}'s conditions to finish your family profile.`;
}

function MemberCard({ member }: { member: HouseholdMember }) {
  return (
    <Card style={styles.card}>
      <MemberAvatar member={member} size={48} />
      <View style={styles.cardText}>
        <Text variant="h2">{listName(member)}</Text>
        <View style={styles.chips}>
          {member.conditions.map((code) => (
            <Chip key={code} label={HEALTH_CONDITION_SHORT_LABELS[code]} />
          ))}
          {/* Allergies get no chips (too many); conditions can still be added. */}
          {member.conditions.length === 0 && (
            <AddConditionsChip
              label={
                member.relationship === "self"
                  ? "Add your conditions"
                  : `Add conditions for ${member.name}`
              }
              onPress={() => openEdit(member)}
            />
          )}
        </View>
      </View>
      <IconButton
        icon="pencil"
        label={editLabel(member)}
        color={colors.brandText}
        onPress={() => openEdit(member)}
      />
    </Card>
  );
}

/** Dashed, so it reads as "nothing here yet — tap to add". */
function AddConditionsChip({
  label,
  onPress,
}: {
  /** For screen readers: who it's for. */
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={spacing.xs}
      style={({ pressed }) => [styles.addChip, pressed && styles.addPressed]}
    >
      <Icon name="plus" size={14} color={colors.brandText} />
      <Text variant="label" color="brand">
        Add conditions
      </Text>
    </Pressable>
  );
}

/** "2/3": people scans are personal for, out of everyone. */
function ProgressRing({ done, total }: { done: number; total: number }) {
  const radius = 36;
  const length = 2 * Math.PI * radius;
  const filled = total === 0 ? 0 : (done / total) * length;
  return (
    <View
      accessible
      accessibilityLabel={`${done} of ${total} set up`}
      style={styles.ring}
    >
      <Svg width={84} height={84} viewBox="0 0 84 84">
        <Circle
          cx={42}
          cy={42}
          r={radius}
          stroke="rgba(255,255,255,0.25)"
          strokeWidth={8}
          fill="none"
        />
        <Circle
          cx={42}
          cy={42}
          r={radius}
          stroke={colors.mango}
          strokeWidth={8}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${length}`}
          transform="rotate(-90 42 42)"
        />
      </Svg>
      <Text variant="h2" color="onBrand" style={styles.ringLabel}>
        {done}/{total}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.brand, paddingBottom: 44 },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: screenGutter,
    paddingTop: 22,
  },
  headerText: { flex: 1, gap: 2 },
  ring: {
    width: 84,
    height: 84,
    alignItems: "center",
    justifyContent: "center",
  },
  ringLabel: { position: "absolute" },
  // The cream sheet overlaps the blue band (design).
  sheet: {
    flex: 1,
    marginTop: -26,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    backgroundColor: colors.background,
  },
  content: { padding: screenGutter, gap: spacing.sm },
  card: { flexDirection: "row", alignItems: "center", gap: 14 },
  cardText: { flex: 1, gap: 6 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  addChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.brandText,
    backgroundColor: colors.surface,
  },
  addPressed: { backgroundColor: colors.brandTint },
  centered: { textAlign: "center" },
});

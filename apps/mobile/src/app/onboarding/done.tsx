import {
  HEALTH_CONDITION_SHORT_LABELS,
  type HouseholdMember,
} from "@foodscanner/shared";
import { router } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import {
  Avatar,
  Bitey,
  Button,
  Card,
  Chip,
  Confetti,
  Text,
} from "@/components";
import { useHousehold } from "@/features/household/api";
import { displayName, hasDetails } from "@/features/household/members";
import {
  colors,
  radii,
  relationshipTints,
  screenGutter,
  spacing,
} from "@/theme";

/** The family that was just set up. */
export default function Done() {
  const household = useHousehold();
  const members = (household.data?.members ?? []).filter(hasDetails);
  const tracked = members.reduce(
    (sum, member) => sum + member.conditions.length,
    0
  );

  return (
    <View style={styles.screen}>
      <Confetti />
      <SafeAreaView style={styles.safe}>
        {/* Scrolls for big families or large text; the button stays put. */}
        <ScrollView contentContainerStyle={styles.content}>
          <Bitey size={130} motion="jump" />
          <View style={styles.heading}>
            <Text variant="display" style={styles.title}>
              Your family is ready!
            </Text>
            <Text color="secondary" style={styles.centered}>
              Every scan now shows a verdict for each person.
            </Text>
          </View>
          {members.length > 0 && (
            <Card style={styles.card}>
              {members.map((member, i) => (
                <MemberRow
                  key={member.id}
                  member={member}
                  last={i === members.length - 1}
                />
              ))}
            </Card>
          )}
          {tracked > 0 && (
            <View style={styles.tracked}>
              <Star />
              <Text variant="title">
                {tracked === 1
                  ? "1 condition tracked across your family"
                  : `${tracked} conditions tracked across your family`}
              </Text>
            </View>
          )}
        </ScrollView>
        <Button
          title="Start scanning"
          onPress={() => router.replace("/")}
          style={styles.start}
        />
      </SafeAreaView>
    </View>
  );
}

function MemberRow({
  member,
  last,
}: {
  member: HouseholdMember;
  last: boolean;
}) {
  const tint = relationshipTints[member.relationship];
  const name = displayName(member);
  return (
    <View style={[styles.row, !last && styles.divider]}>
      <Avatar
        initials={name.charAt(0).toUpperCase()}
        background={tint.background}
        color={tint.text}
      />
      <View style={styles.rowText}>
        <Text variant="title">
          {member.age_band ? `${name} · ${member.age_band}` : name}
        </Text>
        {member.conditions.length > 0 && (
          <View style={styles.chips}>
            {member.conditions.map((code) => (
              <Chip key={code} label={HEALTH_CONDITION_SHORT_LABELS[code]} />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

function Star() {
  return (
    <Svg
      width={20}
      height={20}
      viewBox="0 0 20 20"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Path
        d="M10 1.5L12.6 7L18.5 7.6L14 11.6L15.3 17.5L10 14.5L4.7 17.5L6 11.6L1.5 7.6L7.4 7Z"
        fill={colors.star}
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: screenGutter, paddingBottom: spacing.md },
  content: {
    alignItems: "center",
    gap: 14,
    paddingTop: 50,
    paddingBottom: spacing.md,
  },
  heading: { gap: 6 },
  title: { fontSize: 30, lineHeight: 36, textAlign: "center" },
  centered: { textAlign: "center" },
  card: { alignSelf: "stretch", paddingVertical: 6 },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    paddingVertical: 14,
  },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.hairline },
  rowText: { flex: 1, gap: 6 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tracked: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.mangoTint,
    borderRadius: radii.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  start: { alignSelf: "stretch" },
});

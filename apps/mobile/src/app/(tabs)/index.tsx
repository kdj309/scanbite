import type { HouseholdMember } from "@foodscanner/shared";
import { useQueryClient } from "@tanstack/react-query";
import { Redirect, router } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bitey, Button, DotPattern, Text } from "@/components";
import { ScanCard } from "@/features/home/scan-card";
import { scanCardCopy } from "@/features/home/scan-copy";
import { useHousehold } from "@/features/household/api";
import { openEdit } from "@/features/household/edit-link";
import { HouseholdLoading } from "@/features/household/household-loading";
import {
  hasHealthProfile,
  ownName,
  selfMember,
} from "@/features/household/members";
import {
  clearSetupSeen,
  setupSeenQueryKey,
  useSetupSeen,
} from "@/features/onboarding/setup-seen";
import { useRecentScans } from "@/features/scans/api";
import { joinNames, sentenceName } from "@/features/scans/recent";
import { RecentScanRow } from "@/features/scans/recent-scan-row";
import { colors, radii, screenGutter, shadows, spacing } from "@/theme";

/** Scan, recent scans, and a nudge to finish the family (design S1). */
export default function Home() {
  const setupSeen = useSetupSeen();
  const household = useHousehold();
  const insets = useSafeAreaInsets();

  if (setupSeen.isPending) {
    return <ActivityIndicator style={styles.fill} />;
  }
  if (setupSeen.data === false) {
    return <Redirect href="/onboarding" />;
  }
  if (household.data === undefined) {
    return <HouseholdLoading household={household} />;
  }
  const { members } = household.data;
  const self = selfMember(members);
  const name = self && ownName(self);
  // Scans are personal only for people with conditions or allergies.
  const checked = members.filter(hasHealthProfile);

  return (
    <View style={styles.fill}>
      <View style={[styles.header, { paddingTop: insets.top + 18 }]}>
        <DotPattern />
        <View style={styles.greeting}>
          <View style={styles.fill}>
            <Text variant="label" color="onBrand">
              {name ? `Namaste, ${name}` : "Namaste"}
            </Text>
            <Text variant="h1" color="onBrand" accessibilityRole="header">
              What’s in the basket?
            </Text>
          </View>
          <View style={styles.biteyDisc}>
            <Bitey size={48} />
          </View>
        </View>
        <ScanCard {...scanCardCopy(checked)} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <RecentScans members={members} checked={checked} />
        <FamilyNudge self={self} checked={checked} />
        {__DEV__ && <ReplaySetup />}
      </ScrollView>
    </View>
  );
}

function RecentScans({
  members,
  checked,
}: {
  members: readonly HouseholdMember[];
  checked: readonly HouseholdMember[];
}) {
  const scans = useRecentScans();
  if (scans.data === undefined) {
    return scans.isError ? (
      <View style={styles.center}>
        <Text color="secondary">Can’t load your scans right now.</Text>
        <Button
          title="Try again"
          variant="link"
          onPress={() => void scans.refetch()}
        />
      </View>
    ) : (
      <ActivityIndicator style={styles.center} />
    );
  }
  if (scans.data.items.length === 0) {
    return <NoScansYet />;
  }
  return (
    <View>
      <View style={styles.sectionHead}>
        <Text variant="h2" accessibilityRole="header">
          Recent scans
        </Text>
        {checked.length > 0 && (
          <Text variant="caption">
            {checked.length > 2
              ? `Checked for ${checked.length} people`
              : `Checked for ${joinNames(checked.map(sentenceName), "&")}`}
          </Text>
        )}
      </View>
      {scans.data.items.map((scan) => (
        <RecentScanRow key={scan.id} scan={scan} members={members} />
      ))}
    </View>
  );
}

/** First launch (design S1a): Bitey with a barcode, where scans will go. */
function NoScansYet() {
  return (
    <View style={styles.empty}>
      <View
        style={styles.emptyArt}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Bitey size={100} />
        <View style={styles.barcodeCard}>
          {[3, 1, 2, 1, 3, 1, 1, 2, 3, 1].map((width, i) => (
            <View key={i} style={[styles.bar, { width }]} />
          ))}
        </View>
      </View>
      <Text variant="bodyStrong" color="secondary">
        Your scans will show up here
      </Text>
    </View>
  );
}

/** Points at whoever scans can't check yet: the whole family, or you. */
function FamilyNudge({
  self,
  checked,
}: {
  self: HouseholdMember | undefined;
  checked: readonly HouseholdMember[];
}) {
  let nudge: { text: string; action: string; onPress: () => void };
  if (checked.length === 0) {
    nudge = {
      text: "Set up your family so every scan checks them",
      action: "Set up",
      onPress: () => router.navigate("/family"),
    };
  } else if (self && !hasHealthProfile(self)) {
    nudge = {
      text: "Add your own conditions so scans check you too",
      action: "Add",
      onPress: () => openEdit(self),
    };
  } else {
    return null;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${nudge.text}. ${nudge.action}`}
      onPress={nudge.onPress}
      style={({ pressed }) => [styles.nudge, pressed && styles.nudgePressed]}
    >
      <Text variant="label" style={styles.fill}>
        {nudge.text}
      </Text>
      <Text variant="label" color="brand">
        {nudge.action}
      </Text>
    </Pressable>
  );
}

/** Setup is first-run only; this replays it while developing. */
function ReplaySetup() {
  const queryClient = useQueryClient();
  return (
    <Button
      title="Replay setup (dev)"
      variant="link"
      onPress={() =>
        void clearSetupSeen().then(() =>
          queryClient.setQueryData(setupSeenQueryKey, false)
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    gap: 14,
    paddingHorizontal: screenGutter,
    paddingBottom: screenGutter,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: "hidden",
    backgroundColor: colors.brand,
  },
  greeting: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  // White behind Bitey on blue (design), so the blue body stands out.
  biteyDisc: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  content: {
    flexGrow: 1,
    gap: spacing.sm,
    paddingHorizontal: screenGutter,
    paddingTop: 14,
    paddingBottom: spacing.md,
  },
  center: { paddingVertical: spacing.xl, alignItems: "center" },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.xs,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: spacing.xl,
  },
  emptyArt: { width: 150, height: 120 },
  barcodeCard: {
    position: "absolute",
    right: 0,
    bottom: 4,
    width: 70,
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    borderRadius: 10,
    backgroundColor: colors.surface,
    boxShadow: shadows.float,
    transform: [{ rotate: "-8deg" }],
  },
  bar: { height: 30, backgroundColor: colors.ink },
  nudge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.brandTint,
  },
  nudgePressed: { backgroundColor: colors.brandTintPressed },
});

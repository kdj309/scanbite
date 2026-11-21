import type { Scan } from "@foodscanner/shared";
import { router } from "expo-router";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { Icon, Text } from "@/components";
import { colors, radii, severityColors, spacing } from "@/theme";
import {
  checkedVerdicts,
  ringsFor,
  scanSeverity,
  scanSummary,
  timeAgo,
} from "./recent";
import { memberInitials } from "@/features/household/member-avatar";
import { VerdictRing } from "./verdict-ring";
import type { MoreRingProps, RecentScanRowProps } from "./scans.types";

/** One Home "Recent scans" row: product, who it's bad for, and when. */
export function RecentScanRow({
  scan,
  members,
  onPress = () => openScan(scan),
  onRemove,
}: RecentScanRowProps) {
  const checked = checkedVerdicts(scan, members);
  const severity = scanSeverity(scan, checked);
  const tone = severity ? severityColors[severity] : undefined;
  const name = scan.product?.name ?? "Unknown product";
  const summary = `${scanSummary(scan, checked)} · ${timeAgo(scan.created_at)}`;
  const rings = ringsFor(checked);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}. ${summary}`}
      onPress={onPress}
      accessibilityActions={
        onRemove ? [{ name: "remove", label: "Remove" }] : undefined
      }
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "remove") {
          onRemove?.();
        }
      }}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View
        style={[
          styles.thumb,
          { backgroundColor: tone?.tint ?? colors.hairline },
        ]}
      >
        {scan.product?.image_url ? (
          <Image
            source={{ uri: scan.product.image_url }}
            style={styles.image}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <Icon
            name={scan.label_check_id ? "label" : "package"}
            size={24}
            color={tone?.onTint ?? colors.inkSecondary}
          />
        )}
      </View>
      <View style={styles.text}>
        <Text variant="title" numberOfLines={1}>
          {name}
        </Text>
        <Text
          variant="label"
          numberOfLines={2}
          style={{ color: tone?.onTint ?? colors.inkSecondary }}
        >
          {summary}
        </Text>
      </View>
      <View style={styles.rings}>
        {rings.shown.map(({ member, severity: s }, i) => (
          // Earlier rings sit on top, so no corner mark gets covered.
          <View
            key={member.id}
            style={[
              i > 0 && styles.overlap,
              { zIndex: rings.shown.length - i },
            ]}
          >
            <VerdictRing
              initials={memberInitials(member).charAt(0)}
              severity={s}
            />
          </View>
        ))}
        {rings.more > 0 && (
          <View style={styles.overlap}>
            <MoreRing count={rings.more} />
          </View>
        )}
      </View>
    </Pressable>
  );
}

/** A product opens by its barcode; a label check (no barcode) by its id. */
function openScan(scan: Scan) {
  if (scan.label_check_id) {
    router.push({
      pathname: "/label-check/[id]",
      params: { id: scan.label_check_id },
    });
  } else if (scan.barcode) {
    router.push({
      pathname: "/product/[barcode]",
      params: { barcode: scan.barcode },
    });
  }
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  pressed: { opacity: 0.6 },
  thumb: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.sm,
    overflow: "hidden",
  },
  image: { width: "100%", height: "100%" },
  text: { flex: 1, minWidth: 0, gap: 2 },
  // Room on the right for the last ring's corner mark.
  rings: { flexDirection: "row", paddingRight: 6 },
  // Each ring tucks a little under the one before (design).
  overlap: { marginLeft: -6 },
  more: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2.5,
    borderColor: colors.hairline,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
});

/** "+3": the people past the shown rings; the summary names them. */
function MoreRing({ count }: MoreRingProps) {
  return (
    <View
      style={styles.more}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text variant="label" color="secondary" maxFontSizeMultiplier={1}>
        +{count}
      </Text>
    </View>
  );
}

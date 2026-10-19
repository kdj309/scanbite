import { router } from "expo-router";
import type { BottomTabBarProps } from "expo-router/tabs";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, type IconName, Text } from "@/components";
import { colors, minTouchTarget, radii, shadows, spacing } from "@/theme";

/** Each tab route's label and icon, by route name. */
const TABS: Record<string, { label: string; icon: IconName }> = {
  index: { label: "Home", icon: "home" },
  family: { label: "Family", icon: "family" },
};

/** Home · [Scan] · Family (design S1): scanning sits in the middle. */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const tabs = state.routes.map((route, index) => {
    const focused = state.index === index;
    const { label, icon } = TABS[route.name];
    const color = focused ? colors.brandText : colors.inkSecondary;
    return (
      <Pressable
        key={route.key}
        accessibilityRole="tab"
        accessibilityLabel={label}
        accessibilityState={{ selected: focused }}
        onPress={() => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        }}
        style={[styles.slot, styles.tab]}
      >
        <Icon name={icon} size={22} color={color} />
        <Text variant="label" style={{ color }}>
          {label}
        </Text>
      </Pressable>
    );
  });
  const middle = Math.ceil(tabs.length / 2);

  return (
    <View
      accessibilityRole="tablist"
      style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 18) }]}
    >
      {tabs.slice(0, middle)}
      <View style={styles.slot}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Scan a product"
          onPress={() => router.push("/scan")}
          style={({ pressed }) => [styles.scan, pressed && styles.scanPressed]}
        >
          <Icon name="scan" size={26} color={colors.onBrand} />
        </Pressable>
      </View>
      {tabs.slice(middle)}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 10,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  // Equal slots (the scan button too), so spacing stays even.
  slot: { flex: 1, alignItems: "center" },
  tab: {
    minWidth: 56,
    minHeight: minTouchTarget,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  // Raised half out of the bar.
  scan: {
    width: 60,
    height: 60,
    marginTop: -30,
    borderRadius: radii.xl,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand,
    boxShadow: shadows.scanButton,
  },
  scanPressed: { backgroundColor: colors.brandText },
});

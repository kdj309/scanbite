import { Tabs } from "expo-router/tabs";
import { TabBar } from "@/features/navigation/tab-bar";
import { colors } from "@/theme";

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      {/* Order is the tab bar's; Scan is added in the middle. Explore
          comes back with Profile, keeping two tabs either side of Scan. */}
      <Tabs.Screen name="index" />
      <Tabs.Screen name="family" />
    </Tabs>
  );
}

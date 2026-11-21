// Per-weight imports: the package root would bundle all seven weights.
import { Manrope_500Medium } from "@expo-google-fonts/manrope/500Medium";
import { Manrope_600SemiBold } from "@expo-google-fonts/manrope/600SemiBold";
import { Manrope_700Bold } from "@expo-google-fonts/manrope/700Bold";
import { Manrope_800ExtraBold } from "@expo-google-fonts/manrope/800ExtraBold";
import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { usePush } from "@/features/push/use-push";
import { queryClient } from "@/query/query-client";
import { SessionProvider } from "@/session/session-provider";
import { colors } from "@/theme";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // Keys become the family names in theme/typography.ts.
  const [fontsLoaded, fontError] = useFonts({
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });
  // A font that fails to load falls back to the system font; don't block.
  const ready = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (ready) {
      void SplashScreen.hideAsync();
    }
  }, [ready]);

  if (!ready) {
    return null;
  }
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <AppStack />
      </SessionProvider>
    </QueryClientProvider>
  );
}

/** The screens, once there's a session (push registers with it). */
function AppStack() {
  usePush();
  return (
    <Stack
      screenOptions={{
        // Every screen draws its own top bar (design canvas).
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}

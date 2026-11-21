import { router } from "expo-router";

/** Back where you came from, or Home when there's nothing to go back to. */
export function closeScreen() {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace("/");
  }
}

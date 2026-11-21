import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useEffect } from "react";
import {
  ignorePushError,
  refreshPushRegistration,
  registerToken,
} from "./push";
import { routeForPush } from "./push-route";
import type { PushData } from "./push.types";

// Shown while the app is open too: the scanner's own banner covers only
// the scanner.
Notifications.setNotificationHandler({
  handleNotification: () =>
    Promise.resolve({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
});

/**
 * Once there's a session: keeps this phone registered (on open, and when
 * the token changes), and opens what a tapped notification is about,
 * including the one that launched the app.
 */
export function usePush(): void {
  useEffect(() => {
    void refreshPushRegistration().catch(ignorePushError);
    const subscription = Notifications.addPushTokenListener((token) => {
      void registerToken(token.data).catch(ignorePushError);
    });
    return () => subscription.remove();
  }, []);

  // Covers both a tap while running and the tap that launched the app.
  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!response) {
      return;
    }
    // Cleared once opened, so a remount (a new session after deleting the
    // account) doesn't open it again.
    void Notifications.clearLastNotificationResponseAsync();
    const data = response.notification.request.content.data as PushData;
    router.push(routeForPush(data));
  }, [response]);
}

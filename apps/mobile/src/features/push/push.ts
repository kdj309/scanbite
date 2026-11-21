import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { api, NO_CONTENT } from "@/api/client";

/** Android 8+ shows notifications only through a channel. */
const ANDROID_CHANNEL = "default";

/** Set once we've asked, so a "Don't allow" is never asked again. */
const ASKED_KEY = "scanbite.push-asked";

/** Registered in this run of the app: later labels needn't again. */
let registered = false;

/**
 * Right after a label is sent, when "we'll tell you when it's ready"
 * makes sense (decided 2026-11-21): ask once ever, then register this
 * phone. Best effort: a refusal or a failure never gets in the label's way.
 */
export async function askForPushAfterLabel(): Promise<void> {
  if (registered) {
    return;
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.status !== "granted") {
    const asked = (await SecureStore.getItemAsync(ASKED_KEY)) === "true";
    if (asked || !current.canAskAgain) {
      return;
    }
    // Android 13 asks only once a channel exists.
    await createChannel();
    await SecureStore.setItemAsync(ASKED_KEY, "true");
    const answer = await Notifications.requestPermissionsAsync();
    if (answer.status !== "granted") {
      return;
    }
  }
  await registerThisPhone();
}

/** On every open, if already allowed: keeps the token current. Never asks. */
export async function refreshPushRegistration(): Promise<void> {
  const current = await Notifications.getPermissionsAsync();
  if (current.status === "granted") {
    await registerThisPhone();
  }
}

async function registerThisPhone(): Promise<void> {
  await createChannel();
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as
    string | undefined;
  const { data: token } = await Notifications.getExpoPushTokenAsync({
    projectId,
  });
  await registerToken(token);
}

/** Tells the API where to reach this phone (PUT /devices is idempotent). */
export async function registerToken(token: string): Promise<void> {
  await api("/devices", NO_CONTENT, {
    method: "PUT",
    body: {
      expo_push_token: token,
      platform: Platform.OS === "ios" ? "ios" : "android",
    },
  });
  registered = true;
}

async function createChannel(): Promise<void> {
  if (Platform.OS !== "android") {
    return;
  }
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, {
    name: "Label checks",
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/** Push is best effort: log for us, never bother the person. */
export function ignorePushError(error: unknown): void {
  if (__DEV__) {
    console.warn("push registration failed", error);
  }
}

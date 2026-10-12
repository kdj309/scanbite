import { z } from "zod";

/** What expo-notifications' getExpoPushTokenAsync() returns. */
export const expoPushTokenSchema = z
  .string()
  .regex(/^Expo(nent)?PushToken\[[^\]]+\]$/, "Not an Expo push token");

export const registerDeviceRequestSchema = z.object({
  expo_push_token: expoPushTokenSchema,
  platform: z.enum(["ios", "android"]),
});
export type RegisterDeviceRequest = z.infer<typeof registerDeviceRequestSchema>;

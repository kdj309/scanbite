import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * app.json, plus the Firebase config Android push needs. It stays out of
 * git: EAS gets it as the GOOGLE_SERVICES_JSON file variable (eas
 * env:create --type file). Without it, Android still builds, just
 * without push.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON;
  return {
    ...(config as ExpoConfig),
    android: {
      ...config.android,
      ...(googleServicesFile && { googleServicesFile }),
    },
  };
};

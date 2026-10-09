import { z } from "zod";

/** "a, b,," -> ["a", "b"]; unset -> [] (feature disabled). */
const commaList = z
  .string()
  .optional()
  .transform((raw) =>
    (raw ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  );

/** Base64 key decoded once at startup; must be exactly 32 bytes (AES-256). */
const aes256Key = z
  .string()
  .optional()
  .transform((raw, ctx) => {
    if (!raw) {
      return undefined;
    }
    const key = Buffer.from(raw, "base64");
    if (key.length !== 32) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "must be 32 bytes, base64-encoded",
      });
      return z.NEVER;
    }
    return key;
  });

const baseEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  MONGODB_URI: z.string().min(1),
  REDIS_URL: z.string().min(1),
  VERDICT_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
  JWT_SECRET: z.string().min(16),
  // Access tokens are short-lived now that refresh tokens exist; the
  // client refreshes silently. Value is a jsonwebtoken duration ("15m").
  JWT_EXPIRES_IN: z.string().min(1).default("15m"),
  // Long, because an anonymous account has no other way back in: losing
  // the refresh token means losing the household. Rotated on every use.
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(180),
  // Comma-separated OAuth client IDs whose Google ID tokens we accept —
  // must include the WEB client id (Android's token audience). Empty =
  // Google sign-in disabled.
  GOOGLE_CLIENT_IDS: commaList,
  // Comma-separated Apple audiences (iOS bundle id / Services ID). Empty =
  // Apple sign-in disabled.
  APPLE_CLIENT_IDS: commaList,
  // Needed with APPLE_CLIENT_IDS: the Sign in with Apple key from Apple
  // Developer (Keys) used to sign the client secret for /auth/token and
  // /auth/revoke. APPLE_PRIVATE_KEY is the .p8 contents; "\n" escapes are
  // accepted so it fits on one .env line.
  APPLE_TEAM_ID: z.string().min(1).optional(),
  APPLE_KEY_ID: z.string().min(1).optional(),
  APPLE_PRIVATE_KEY: z
    .string()
    .min(1)
    .optional()
    .transform((pem) => pem?.replace(/\\n/g, "\n")),
  // 32 random bytes, base64 — encrypts stored provider refresh tokens.
  TOKEN_ENCRYPTION_KEY: aes256Key,
  // Gets the admin role — only when proven by signing in with Google using
  // this Gmail/Workspace address (the only email we treat as verified).
  ADMIN_EMAIL: z.string().email().optional(),
  S3_ENDPOINT: z.string().url(),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_REGION: z.string().min(1).default("us-east-1"),
  S3_FORCE_PATH_STYLE: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .default("true")
    .transform((value) => value === true || value === "true"),
  VISION_PROVIDER: z.enum(["stub", "tiered"]).default("stub"),
  // Optional at the field level (a stub-only deployment doesn't need these),
  // but required together when VISION_PROVIDER=tiered — enforced below.
  OPENROUTER_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  GEMINI_OPENROUTER_MODEL: z.string().min(1).default("google/gemini-2.5-flash"),
  WORKER_MODE: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .default("false")
    .transform((value) => value === true || value === "true"),
});

/**
 * Fail fast at startup, not several layers deep into a tiered vision call
 * the first time a real extraction runs — a misconfigured deployment
 * should never discover "VISION_PROVIDER=tiered but no API keys" via a
 * confusing runtime error inside TieredVisionAdapter's fallback chain.
 */
export const envSchema = baseEnvSchema.superRefine((env, ctx) => {
  if (env.APPLE_CLIENT_IDS.length > 0) {
    for (const key of [
      "APPLE_TEAM_ID",
      "APPLE_KEY_ID",
      "APPLE_PRIVATE_KEY",
      "TOKEN_ENCRYPTION_KEY",
    ] as const) {
      if (!env[key]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} is required when APPLE_CLIENT_IDS is set`,
        });
      }
    }
  }
  if (env.VISION_PROVIDER !== "tiered") {
    return;
  }
  if (!env.OPENROUTER_API_KEY) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["OPENROUTER_API_KEY"],
      message: "OPENROUTER_API_KEY is required when VISION_PROVIDER=tiered",
    });
  }
  if (!env.ANTHROPIC_API_KEY) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["ANTHROPIC_API_KEY"],
      message: "ANTHROPIC_API_KEY is required when VISION_PROVIDER=tiered",
    });
  }
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  return envSchema.parse(config);
}

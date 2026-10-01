import { z } from "zod";

const baseEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  MONGODB_URI: z.string().min(1),
  REDIS_URL: z.string().min(1),
  VERDICT_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().min(1).default("7d"),
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

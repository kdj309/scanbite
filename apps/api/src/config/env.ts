import { z } from "zod";

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  MONGODB_URI: z.string().min(1),
  REDIS_URL: z.string().min(1),
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
  VISION_PROVIDER: z.enum(["stub"]).default("stub"),
  WORKER_MODE: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .default("false")
    .transform((value) => value === true || value === "true"),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  return envSchema.parse(config);
}

import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.string().transform(Number).default("8000"),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string(),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL_DAYS: z.string().transform(Number).default("14"),
  AI_CLASSIFIER_URL: z.string().optional(),
  PUBLIC_WEB_URL: z.string().optional(),
  PUBLIC_API_URL: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().transform(Number).optional(),
  SMTP_USERNAME: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  // SMS Configuration
  SMS_PROVIDER: z.enum(["twilio", "aws-sns", "custom"]).optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().optional(),
  SMS_CUSTOM_API_URL: z.string().optional(),
  SMS_CUSTOM_API_KEY: z.string().optional(),
});

export const env = envSchema.parse(process.env);

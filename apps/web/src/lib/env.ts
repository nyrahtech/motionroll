import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

const defaults = {
  DATABASE_URL: "postgres://postgres:postgres@127.0.0.1:5432/motionroll",
  DIRECT_URL: "postgres://postgres:postgres@127.0.0.1:5432/motionroll",
  LOCAL_OWNER_EMAIL: "owner@motionroll.local",
  STORAGE_BUCKET: "motionroll-assets",
  STORAGE_REGION: "auto",
  STORAGE_ENDPOINT: "http://127.0.0.1:9000",
  STORAGE_PUBLIC_BASE_URL: "http://127.0.0.1:9000/motionroll-assets",
  STORAGE_ACCESS_KEY_ID: "minioadmin",
  STORAGE_SECRET_ACCESS_KEY: "minioadmin",
  STORAGE_FORCE_PATH_STYLE: "true",
  PROCESSING_TEMP_DIR: "./apps/web/uploads",
  UPLOAD_MAX_VIDEO_BYTES: "524288000",
  PROCESSING_MAX_FRAMES: "900",
  SOURCE_RETENTION_DEFAULT: "delete_after_success",
  FFMPEG_BINARY: "ffmpeg",
  CREDENTIAL_ENCRYPTION_KEY: "dev-dev-dev-dev-dev-dev-dev-dev",
  INNGEST_EVENT_KEY: "local-dev-key",
  INNGEST_SIGNING_KEY: "local-signing-key",
  PUBLISH_EMBED_BASE_URL: "http://localhost:3000/embed",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  NEXT_PUBLIC_LOCAL_OWNER_ID: "local-owner",
};

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    DIRECT_URL: z.string().url(),
    LOCAL_OWNER_EMAIL: z.string().email(),
    STORAGE_BUCKET: z.string().min(1),
    STORAGE_REGION: z.string().min(1),
    STORAGE_ENDPOINT: z.string().url(),
    STORAGE_PUBLIC_BASE_URL: z.string().url(),
    STORAGE_ACCESS_KEY_ID: z.string().min(1),
    STORAGE_SECRET_ACCESS_KEY: z.string().min(1),
    STORAGE_FORCE_PATH_STYLE: z.coerce.boolean().default(true),
    PROCESSING_TEMP_DIR: z.string().min(1),
    UPLOAD_MAX_VIDEO_BYTES: z.coerce.number().int().positive(),
    PROCESSING_MAX_FRAMES: z.coerce.number().int().min(30).max(5000),
    SOURCE_RETENTION_DEFAULT: z.enum(["delete_after_success", "keep_source"]),
    FFMPEG_BINARY: z.string().min(1),
    CREDENTIAL_ENCRYPTION_KEY: z.string().min(16),
    INNGEST_EVENT_KEY: z.string().min(1),
    INNGEST_SIGNING_KEY: z.string().min(1),
    PUBLISH_EMBED_BASE_URL: z.string().url(),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url(),
    NEXT_PUBLIC_LOCAL_OWNER_ID: z.string().min(1),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL ?? defaults.DATABASE_URL,
    DIRECT_URL: process.env.DIRECT_URL ?? defaults.DIRECT_URL,
    LOCAL_OWNER_EMAIL: process.env.LOCAL_OWNER_EMAIL ?? defaults.LOCAL_OWNER_EMAIL,
    STORAGE_BUCKET: process.env.STORAGE_BUCKET ?? defaults.STORAGE_BUCKET,
    STORAGE_REGION: process.env.STORAGE_REGION ?? defaults.STORAGE_REGION,
    STORAGE_ENDPOINT: process.env.STORAGE_ENDPOINT ?? defaults.STORAGE_ENDPOINT,
    STORAGE_PUBLIC_BASE_URL:
      process.env.STORAGE_PUBLIC_BASE_URL ?? defaults.STORAGE_PUBLIC_BASE_URL,
    STORAGE_ACCESS_KEY_ID:
      process.env.STORAGE_ACCESS_KEY_ID ?? defaults.STORAGE_ACCESS_KEY_ID,
    STORAGE_SECRET_ACCESS_KEY:
      process.env.STORAGE_SECRET_ACCESS_KEY ?? defaults.STORAGE_SECRET_ACCESS_KEY,
    STORAGE_FORCE_PATH_STYLE:
      process.env.STORAGE_FORCE_PATH_STYLE ?? defaults.STORAGE_FORCE_PATH_STYLE,
    PROCESSING_TEMP_DIR: process.env.PROCESSING_TEMP_DIR ?? defaults.PROCESSING_TEMP_DIR,
    UPLOAD_MAX_VIDEO_BYTES:
      process.env.UPLOAD_MAX_VIDEO_BYTES ?? defaults.UPLOAD_MAX_VIDEO_BYTES,
    PROCESSING_MAX_FRAMES:
      process.env.PROCESSING_MAX_FRAMES ?? defaults.PROCESSING_MAX_FRAMES,
    SOURCE_RETENTION_DEFAULT:
      process.env.SOURCE_RETENTION_DEFAULT ?? defaults.SOURCE_RETENTION_DEFAULT,
    FFMPEG_BINARY: process.env.FFMPEG_BINARY ?? defaults.FFMPEG_BINARY,
    CREDENTIAL_ENCRYPTION_KEY:
      process.env.CREDENTIAL_ENCRYPTION_KEY ?? defaults.CREDENTIAL_ENCRYPTION_KEY,
    INNGEST_EVENT_KEY: process.env.INNGEST_EVENT_KEY ?? defaults.INNGEST_EVENT_KEY,
    INNGEST_SIGNING_KEY:
      process.env.INNGEST_SIGNING_KEY ?? defaults.INNGEST_SIGNING_KEY,
    PUBLISH_EMBED_BASE_URL:
      process.env.PUBLISH_EMBED_BASE_URL ?? defaults.PUBLISH_EMBED_BASE_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? defaults.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_LOCAL_OWNER_ID:
      process.env.NEXT_PUBLIC_LOCAL_OWNER_ID ?? defaults.NEXT_PUBLIC_LOCAL_OWNER_ID,
  },
});

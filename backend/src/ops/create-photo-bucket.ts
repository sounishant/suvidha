import { z } from "zod";
import { createPrivateBucket, PHOTO_BUCKET } from "../clients/storage.ts";
import { MAX_PHOTO_BYTES, PHOTO_TYPES } from "../clients/whatsapp.ts";
import { readEnv } from "../config.ts";

// npm run create-photo-bucket: creates the private job-photos bucket, or confirms it is there.
const env = readEnv(z.object({ SUPABASE_URL: z.string().url(), SUPABASE_SERVICE_ROLE_KEY: z.string().min(1) }), process.env);
const bucket = await createPrivateBucket(
  { url: env.SUPABASE_URL, serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY },
  PHOTO_BUCKET,
  { maxBytes: MAX_PHOTO_BYTES, mimeTypes: PHOTO_TYPES },
);
console.log(`bucket ${bucket.id} on ${new URL(env.SUPABASE_URL).host}: ${bucket.public ? "PUBLIC (make it private!)" : "private"}`);
if (bucket.public) process.exitCode = 1;

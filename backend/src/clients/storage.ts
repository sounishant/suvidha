export const PHOTO_BUCKET = "job-photos";

export type StorageClient = {
  // False when there are no Supabase keys, so nothing was stored.
  upload(path: string, bytes: Uint8Array<ArrayBuffer>, mimeType: string): Promise<boolean>;
  // A short-lived link to a private file; null without Supabase keys.
  signedUrl(path: string, expiresInSec: number): Promise<string | null>;
};

type SupabaseConfig = { url: string; serviceRoleKey: string };

const headers = (cfg: SupabaseConfig) => ({ authorization: `Bearer ${cfg.serviceRoleKey}`, apikey: cfg.serviceRoleKey });

async function failure(res: Response) {
  const body = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
  return `HTTP ${res.status} ${body.message ?? body.error ?? ""}`.trim();
}

export function supabaseStorage(cfg: SupabaseConfig, bucket = PHOTO_BUCKET, fetchFn: typeof fetch = fetch): StorageClient {
  return {
    async upload(path, bytes, mimeType) {
      const res = await fetchFn(`${cfg.url}/storage/v1/object/${bucket}/${path}`, {
        method: "POST",
        // x-upsert: Meta may resend the same photo, and overwriting the same path is harmless.
        headers: { ...headers(cfg), "content-type": mimeType, "x-upsert": "true" },
        body: bytes,
      });
      if (!res.ok) throw new Error(`photo upload failed: ${await failure(res)}`);
      return true;
    },
    async signedUrl(path, expiresInSec) {
      const res = await fetchFn(`${cfg.url}/storage/v1/object/sign/${bucket}/${path}`, {
        method: "POST",
        headers: { ...headers(cfg), "content-type": "application/json" },
        body: JSON.stringify({ expiresIn: expiresInSec }),
      });
      if (!res.ok) throw new Error(`photo link failed: ${await failure(res)}`);
      const { signedURL } = (await res.json()) as { signedURL: string };
      return `${cfg.url}/storage/v1${signedURL}`;
    },
  };
}

export function offlineStorage(log: (line: string) => void): StorageClient {
  return {
    async upload(path) {
      log(`[storage offline] ${path} not stored`);
      return false;
    },
    async signedUrl() {
      return null;
    },
  };
}

// One-time setup; safe to run again.
export async function createPrivateBucket(cfg: SupabaseConfig, bucket: string, opts: { maxBytes: number; mimeTypes: string[] }, fetchFn: typeof fetch = fetch) {
  const res = await fetchFn(`${cfg.url}/storage/v1/bucket`, {
    method: "POST",
    headers: { ...headers(cfg), "content-type": "application/json" },
    body: JSON.stringify({ id: bucket, name: bucket, public: false, file_size_limit: opts.maxBytes, allowed_mime_types: opts.mimeTypes }),
  });
  if (!res.ok) {
    const reason = await failure(res);
    if (!/already exists|duplicate/i.test(reason)) throw new Error(`bucket not created: ${reason}`);
  }
  const check = await fetchFn(`${cfg.url}/storage/v1/bucket/${bucket}`, { headers: headers(cfg) });
  if (!check.ok) throw new Error(`bucket check failed: ${await failure(check)}`);
  return (await check.json()) as { id: string; public: boolean };
}

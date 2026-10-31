import { describe, expect, it } from "vitest";
import { createPrivateBucket, offlineStorage, supabaseStorage } from "../src/clients/storage.ts";
import { cloudWhatsApp, MAX_PHOTO_BYTES, offlineWhatsApp } from "../src/clients/whatsapp.ts";

type Call = { url: string; init: RequestInit | undefined };

// Answers each request in turn and records what was asked.
function stubFetch(...replies: Response[]) {
  const calls: Call[] = [];
  const fetchFn = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return replies.shift()!;
  }) as typeof fetch;
  return { fetchFn, calls };
}

const json = (body: object, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const meta = { accessToken: "meta-token", phoneNumberId: "pn-1", apiVersion: "v26.0" };
const supabase = { url: "https://proj.supabase.co", serviceRoleKey: "service-key" };

describe("downloadMedia", () => {
  it("looks the photo up, then downloads it with the same token", async () => {
    const { fetchFn, calls } = stubFetch(
      json({ url: "https://lookaside.fbsbx.com/x", mime_type: "image/jpeg", file_size: 3 }),
      new Response(new Uint8Array([1, 2, 3])),
    );
    const media = await cloudWhatsApp(meta, fetchFn).downloadMedia("12345");
    expect(media).toEqual({ bytes: new Uint8Array([1, 2, 3]), mimeType: "image/jpeg" });
    expect(calls.map((c) => c.url)).toEqual(["https://graph.facebook.com/v26.0/12345", "https://lookaside.fbsbx.com/x"]);
    for (const c of calls) expect((c.init?.headers as Record<string, string>).authorization).toBe("Bearer meta-token");
  });

  it("surfaces Meta's error", async () => {
    const { fetchFn } = stubFetch(json({ error: { message: "Invalid media id", code: 100 } }, 400));
    await expect(cloudWhatsApp(meta, fetchFn).downloadMedia("bad")).rejects.toThrow("Invalid media id");
  });

  it("refuses anything that is not a jpeg, png or webp photo, before downloading it", async () => {
    const { fetchFn, calls } = stubFetch(json({ url: "https://x", mime_type: "application/pdf", file_size: 10 }));
    await expect(cloudWhatsApp(meta, fetchFn).downloadMedia("1")).rejects.toThrow("not a photo");
    expect(calls).toHaveLength(1);
  });

  it("refuses photos over 5 MB, by the size Meta reports or the bytes received", async () => {
    const big = stubFetch(json({ url: "https://x", mime_type: "image/png", file_size: MAX_PHOTO_BYTES + 1 }));
    await expect(cloudWhatsApp(meta, big.fetchFn).downloadMedia("1")).rejects.toThrow("too large");

    const lying = stubFetch(json({ url: "https://x", mime_type: "image/png" }), new Response(new Uint8Array(MAX_PHOTO_BYTES + 1)));
    await expect(cloudWhatsApp(meta, lying.fetchFn).downloadMedia("1")).rejects.toThrow("too large");
  });

  it("returns nothing without Meta keys", async () => {
    const lines: string[] = [];
    expect(await offlineWhatsApp((l) => lines.push(l)).downloadMedia("12345")).toBeNull();
    expect(lines[0]).toContain("not downloaded");
  });

  it("hides codes in the offline log except on a dev machine", async () => {
    const lines: string[] = [];
    await offlineWhatsApp((l) => lines.push(l)).sendText("919811111111", "Your code is *123456*");
    await offlineWhatsApp((l) => lines.push(l), true).sendText("919811111111", "Your code is *123456*");
    expect(lines[0]).not.toContain("123456");
    expect(lines[1]).toContain("*123456*");
  });
});

describe("photo storage", () => {
  it("uploads to the private bucket with the service key and overwrites on a retry", async () => {
    const { fetchFn, calls } = stubFetch(json({ Key: "job-photos/J4K8/1.jpg" }));
    const bytes = new Uint8Array([9, 9]);
    expect(await supabaseStorage(supabase, "job-photos", fetchFn).upload("J4K8/1.jpg", bytes, "image/jpeg")).toBe(true);
    expect(calls[0]!.url).toBe("https://proj.supabase.co/storage/v1/object/job-photos/J4K8/1.jpg");
    expect(calls[0]!.init).toMatchObject({
      method: "POST",
      body: bytes,
      headers: { authorization: "Bearer service-key", apikey: "service-key", "content-type": "image/jpeg", "x-upsert": "true" },
    });
  });

  it("throws when Supabase refuses the upload", async () => {
    const { fetchFn } = stubFetch(json({ message: "Bucket not found" }, 404));
    await expect(supabaseStorage(supabase, "job-photos", fetchFn).upload("a.jpg", new Uint8Array(1), "image/jpeg")).rejects.toThrow("Bucket not found");
  });

  it("stores nothing without Supabase keys", async () => {
    const lines: string[] = [];
    expect(await offlineStorage((l) => lines.push(l)).upload("J4K8/1.jpg", new Uint8Array(1), "image/jpeg")).toBe(false);
    expect(lines[0]).toContain("not stored");
  });

  it("creates the bucket as private, and accepts one that already exists", async () => {
    const created = stubFetch(json({ name: "job-photos" }), json({ id: "job-photos", public: false }));
    expect(await createPrivateBucket(supabase, "job-photos", { maxBytes: 5, mimeTypes: ["image/png"] }, created.fetchFn)).toEqual({ id: "job-photos", public: false });
    expect(JSON.parse(String(created.calls[0]!.init?.body))).toMatchObject({ id: "job-photos", public: false, allowed_mime_types: ["image/png"] });

    const existing = stubFetch(json({ message: "The resource already exists" }, 409), json({ id: "job-photos", public: false }));
    await expect(createPrivateBucket(supabase, "job-photos", { maxBytes: 5, mimeTypes: [] }, existing.fetchFn)).resolves.toMatchObject({ public: false });
  });
});

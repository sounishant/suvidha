import { randomUUID } from "node:crypto";
import { maskPhone } from "../core/phone.ts";

export type Button = { id: string; title: string };

export type Media = { bytes: Uint8Array<ArrayBuffer>; mimeType: string };

export type ListRow = { id: string; title: string; description?: string };
export type ListMessage = { header: string; body: string; button: string; sections: { title: string; rows: ListRow[] }[] };

export type WhatsAppClient = {
  sendText(to: string, text: string): Promise<string>;
  sendButtons(to: string, text: string, buttons: Button[]): Promise<string>;
  sendList(to: string, list: ListMessage): Promise<string>;
  // WhatsApp fetches the image from `link`, so it must be reachable for a few minutes.
  sendImage(to: string, link: string, caption: string): Promise<string>;
  // Null when there are no Meta keys to fetch with.
  downloadMedia(mediaId: string): Promise<Media | null>;
};

export class WhatsAppError extends Error {
  code: number | undefined;
  constructor(message: string, code: number | undefined) {
    super(message);
    this.code = code;
  }
}

export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
// WhatsApp itself caps images at 5 MB.
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

type CloudConfig = { accessToken: string; phoneNumberId: string; apiVersion: string };

// `to` is the number without "+", as WhatsApp writes it. Returns Meta's message id.
export function cloudWhatsApp(cfg: CloudConfig, fetchFn: typeof fetch = fetch): WhatsAppClient {
  const auth = { authorization: `Bearer ${cfg.accessToken}` };

  async function send(to: string, message: object) {
    const res = await fetchFn(`https://graph.facebook.com/${cfg.apiVersion}/${cfg.phoneNumberId}/messages`, {
      method: "POST",
      headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, ...message }),
    });
    const body = (await res.json()) as { messages?: { id: string }[]; error?: { message: string; code: number } };
    if (!res.ok || !body.messages?.[0]) throw new WhatsAppError(body.error?.message ?? `HTTP ${res.status}`, body.error?.code);
    return body.messages[0].id;
  }

  // Meta's download link needs the same token and expires within minutes, so fetch it straight away.
  async function downloadMedia(mediaId: string): Promise<Media> {
    const res = await fetchFn(`https://graph.facebook.com/${cfg.apiVersion}/${encodeURIComponent(mediaId)}`, { headers: auth });
    const info = (await res.json()) as { url?: string; mime_type?: string; file_size?: number; error?: { message: string; code: number } };
    if (!res.ok || !info.url) throw new WhatsAppError(info.error?.message ?? `media lookup HTTP ${res.status}`, info.error?.code);

    const mimeType = (info.mime_type ?? "").split(";")[0]!.trim();
    if (!PHOTO_TYPES.includes(mimeType)) throw new WhatsAppError(`not a photo: ${mimeType || "unknown type"}`, undefined);
    if ((info.file_size ?? 0) > MAX_PHOTO_BYTES) throw new WhatsAppError(`photo too large: ${info.file_size} bytes`, undefined);

    const file = await fetchFn(info.url, { headers: auth });
    if (!file.ok) throw new WhatsAppError(`media download HTTP ${file.status}`, undefined);
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.byteLength > MAX_PHOTO_BYTES) throw new WhatsAppError(`photo too large: ${bytes.byteLength} bytes`, undefined);
    return { bytes, mimeType };
  }

  return {
    sendText: (to, text) => send(to, { type: "text", text: { body: text } }),
    sendButtons: (to, text, buttons) =>
      send(to, {
        type: "interactive",
        interactive: {
          type: "button",
          body: { text },
          action: { buttons: buttons.map((b) => ({ type: "reply", reply: b })) },
        },
      }),
    sendList: (to, list) =>
      send(to, {
        type: "interactive",
        interactive: {
          type: "list",
          header: { type: "text", text: list.header },
          body: { text: list.body },
          action: { button: list.button, sections: list.sections },
        },
      }),
    sendImage: (to, link, caption) => send(to, { type: "image", image: { link, caption } }),
    downloadMedia,
  };
}

// Until the Meta app keys are in .env: log what would be sent so flows still run end to end.
// Codes show only on a dev machine; on a server this log would let anyone sign in as anyone.
export function offlineWhatsApp(log: (line: string) => void, showCodes = false): WhatsAppClient {
  const record = async (to: string, text: string, buttons: Button[] = []) => {
    const shown = showCodes ? text : text.replace(/\*\d{4,6}\*/g, "*****");
    log(`[whatsapp offline] to ${maskPhone(to)}: ${shown.replace(/\n/g, " / ")}${buttons.length ? ` [${buttons.map((b) => b.id).join(", ")}]` : ""}`);
    return `offline.${randomUUID()}`;
  };
  return {
    sendText: (to, text) => record(to, text),
    sendButtons: record,
    sendList: (to, list) => record(to, `${list.header}: ${list.body}`, list.sections.flatMap((s) => s.rows.map((r) => ({ id: r.id, title: r.title })))),
    sendImage: (to, link, caption) => record(to, `[photo] ${caption}`),
    downloadMedia: async (mediaId) => {
      log(`[whatsapp offline] media ${mediaId} not downloaded`);
      return null;
    },
  };
}

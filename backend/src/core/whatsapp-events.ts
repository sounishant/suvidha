import { z } from "zod";
import type { Ctx } from "./context.ts";
import { addPhoto, answerFollowup, noteCustomerChange } from "./jobs.ts";
import { toE164 } from "./phone.ts";
import { bookQuote, forwardPhoto } from "./quotes.ts";

const Message = z.object({
  from: z.string(),
  type: z.string(),
  text: z.object({ body: z.string() }).optional(),
  interactive: z
    .object({ list_reply: z.object({ id: z.string() }).optional(), button_reply: z.object({ id: z.string() }).optional() })
    .optional(),
  image: z.object({ id: z.string() }).optional(),
});

const Envelope = z.object({
  entry: z.array(
    z.object({
      changes: z.array(
        z.object({
          value: z.object({
            messages: z.array(Message).optional(),
            statuses: z.array(z.object({ id: z.string(), status: z.string(), recipient_id: z.string().optional() })).optional(),
          }),
        }),
      ),
    }),
  ),
});

export async function handleWhatsApp(ctx: Ctx, body: unknown) {
  const envelope = Envelope.safeParse(body);
  if (!envelope.success) return;
  const values = envelope.data.entry.flatMap((e) => e.changes.map((c) => c.value));

  for (const message of values.flatMap((v) => v.messages ?? [])) {
    const phone = toE164(message.from);
    await ctx.sql`update customers set has_whatsapp = true where phone = ${phone}`;
    const choice = message.interactive?.list_reply?.id ?? message.interactive?.button_reply?.id ?? "";
    if (choice.startsWith("book:")) {
      await bookQuote(ctx, phone, choice.slice("book:".length));
    } else if (message.type === "image" && message.image) {
      const photo = await addPhoto(ctx, phone, message.image.id);
      if (photo?.path && (photo.status === "inviting" || photo.status === "quotes_in")) await forwardPhoto(ctx, photo.jobId);
    } else if (message.type === "text" && message.text?.body.trim()) {
      const text = message.text.body.trim();
      if (!(await answerFollowup(ctx, phone, text))) await noteCustomerChange(ctx, phone, text);
    }
  }

  for (const status of values.flatMap((v) => v.statuses ?? [])) {
    await ctx.sql`update contacts set status = ${status.status} where wa_message_id = ${status.id}`;
    if (status.status === "failed" && status.recipient_id) {
      await ctx.sql`update customers set has_whatsapp = false where phone = ${toE164(status.recipient_id)}`;
    }
  }
}

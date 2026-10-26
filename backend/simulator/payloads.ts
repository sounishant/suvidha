import { randomUUID } from "node:crypto";

// Sample payloads from docs/contracts.md, with fresh ids so repeated runs don't collide.

export function createJob(executionId = randomUUID()) {
  return {
    from_number: "+919876543210", execution_id: executionId, language: "hi", customer_name: "Sunita",
    trade: "plumber", job_type: "unclear", problem: "Kitchen ka nal leak ho raha hai",
    address: "12 Civil Lines, Roorkee", landmark: "near Gurudwara", urgency: "normal", time_window: "aaj shaam se pehle",
  };
}

export function bolnaCallStatus(id: string, status: string) {
  return {
    id, agent_id: "agent-worker", status, conversation_duration: status === "completed" ? 28 : 0,
    user_number: "+919812345678", agent_number: "+918035739222",
    transcript: "assistant: Namaste Kalpana…", total_cost: 3,
    telephony_data: { duration: 28, call_type: "outbound", hangup_by: "Caller" },
  };
}

function whatsappEnvelope(from: string, message: object) {
  return {
    object: "whatsapp_business_account",
    entry: [{ id: "waba", changes: [{ field: "messages", value: {
      messaging_product: "whatsapp", metadata: { phone_number_id: "test" },
      contacts: [{ profile: { name: "Sunita" }, wa_id: from }],
      messages: [message],
    } }] }],
  };
}

export function confirmTap(jobId: string, messageId = `wamid.${randomUUID()}`) {
  return whatsappEnvelope("919876543210", {
    from: "919876543210", id: messageId, type: "interactive",
    interactive: { type: "button_reply", button_reply: { id: `confirm:${jobId}`, title: "Confirm" } },
  });
}

export function offerAccept(offerId: string, minutes: number, messageId = `wamid.${randomUUID()}`) {
  return whatsappEnvelope("919812345678", {
    from: "919812345678", id: messageId, type: "interactive",
    interactive: { type: "list_reply", list_reply: { id: `offer:${offerId}:accept:${minutes}`, title: `Accept · ${minutes} min` } },
  });
}

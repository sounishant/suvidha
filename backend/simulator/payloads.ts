import { randomUUID } from "node:crypto";

// Sample payloads as Bolna and Meta send them. Numbers starting +91 1 are not real mobiles, so nobody gets messaged.

export function registerWorker(callerRef = "ZZZZ") {
  return {
    caller_ref: callerRef, name: "Mohit", trades: "electrician", skills: "fan fitting", areas: "Civil Lines",
    working_hours: "9 am to 7 pm", has_smartphone: "yes", language: "hi", consent_ai_calls: "yes",
  };
}

// The job card fields Bolna's extraction fills from the confirmed read-back.
export function jobCard(overrides: Record<string, string> = {}) {
  return {
    trade: "carpenter", job_type: "door_repair", problem: "Room door won't close; one hinge broken",
    material: "worker_brings", first_name: "Rohan", address: "Civil Lines, Roorkee, near Gurudwara",
    time_window: "aaj shaam tak", time_window_latest: "", priority_first: "speed", budget: "",
    safety_note: "Gate pe naam likhwana padta hai", complexity: "standard", language: "hinglish",
    ...overrides,
  };
}

export function bolnaCallStatus(id: string, status: string, extra: Record<string, unknown> = {}) {
  return {
    id, agent_id: "agent-customer", status, conversation_duration: status === "completed" ? 95 : 0,
    user_number: "+911000000002", agent_number: "+918035739222",
    transcript: "assistant: Namaste…", total_cost: 3,
    telephony_data: { duration: 95, call_type: "inbound", hangup_by: "Caller" },
    ...extra,
  };
}

export function customerCallEnded(id: string, callerRef: string, card: Record<string, string>) {
  return bolnaCallStatus(id, "completed", {
    extracted_data: { "Job Card": card },
    context_details: { recipient_data: { timezone: "Asia/Kolkata", call_type: "inbound", caller_ref: callerRef } },
  });
}

function whatsappEnvelope(from: string, message: object) {
  return {
    object: "whatsapp_business_account",
    entry: [{ id: "waba", changes: [{ field: "messages", value: {
      messaging_product: "whatsapp", metadata: { phone_number_id: "test" },
      contacts: [{ profile: { name: "Rohan" }, wa_id: from }],
      messages: [message],
    } }] }],
  };
}

export function textReply(body: string, from = "911000000001", messageId = `wamid.${randomUUID()}`) {
  return whatsappEnvelope(from, { from, id: messageId, type: "text", text: { body } });
}

export function bookTap(quoteRef: string, from = "911000000001", messageId = `wamid.${randomUUID()}`) {
  return whatsappEnvelope(from, {
    from, id: messageId, type: "interactive",
    interactive: { type: "list_reply", list_reply: { id: `book:${quoteRef}`, title: "1. Kalpana" } },
  });
}

import { randomUUID } from "node:crypto";
import { maskPhone } from "../core/phone.ts";

export type CallRequest = {
  agentId: string;
  from: string;
  to: string;
  userData: Record<string, string>;
};

export type BolnaClient = { call(req: CallRequest): Promise<string> };

// Returns Bolna's execution id, which every later webhook for this call carries as `id`.
export function bolnaApi(apiKey: string, fetchFn: typeof fetch = fetch): BolnaClient {
  return {
    async call(req) {
      const res = await fetchFn("https://api.bolna.ai/call", {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          agent_id: req.agentId,
          recipient_phone_number: req.to,
          from_phone_number: req.from,
          // No language: the agent opens in its default and follows the worker, as it does with customers.
          user_data: req.userData,
        }),
      });
      const body = (await res.json()) as { execution_id?: string; message?: string };
      if (!res.ok || !body.execution_id) throw new Error(`Bolna call failed: ${res.status} ${body.message ?? ""}`.trim());
      return body.execution_id;
    },
  };
}

export function offlineBolna(log: (line: string) => void): BolnaClient {
  return {
    async call(req) {
      log(`[bolna offline] ${req.userData.call_type ?? "call"} to ${maskPhone(req.to)}`);
      return `offline-${randomUUID()}`;
    },
  };
}

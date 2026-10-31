import { randomUUID } from "node:crypto";
import { maskPhone } from "../core/phone.ts";

export type CallRequest = {
  agentId: string;
  from: string;
  to: string;
  userData: Record<string, string>;
};

// What Bolna's web-call SDK needs to place one call from a browser; single use, valid for about two minutes.
export type WebSession = { run_id: string } & Record<string, unknown>;

export type BolnaClient = {
  call(req: CallRequest): Promise<string>;
  webSession(agentId: string, userData: Record<string, string>): Promise<WebSession>;
};

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
    async webSession(agentId, userData) {
      const res = await fetchFn("https://api.bolna.ai/web-call/session", {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({ agent_id: agentId, user_data: userData }),
      });
      const body = (await res.json()) as Partial<WebSession> & { detail?: unknown };
      if (!res.ok || !body.run_id) throw new Error(`Bolna web session failed: ${res.status} ${JSON.stringify(body.detail ?? "")}`);
      return body as WebSession;
    },
  };
}

export function offlineBolna(log: (line: string) => void): BolnaClient {
  return {
    async call(req) {
      log(`[bolna offline] ${req.userData.call_type ?? "call"} to ${maskPhone(req.to)}`);
      return `offline-${randomUUID()}`;
    },
    async webSession() {
      log("[bolna offline] web session");
      return { run_id: `offline-${randomUUID()}` };
    },
  };
}

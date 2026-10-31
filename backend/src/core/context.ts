import type { Sql } from "postgres";
import type { BolnaClient } from "../clients/bolna.ts";
import type { MapsClient } from "../clients/maps.ts";
import type { StorageClient } from "../clients/storage.ts";
import type { WhatsAppClient } from "../clients/whatsapp.ts";

type Line = { agentId: string; number: string };

export type Limits = {
  inviteDelaySec: number;
  parallelCalls: number;
  maxWorkerCalls: number;
  quotesWanted: number;
  callTimeoutSec: number;
  extractionWaitSec: number;
};

export type Ctx = {
  sql: Sql;
  whatsapp: WhatsAppClient;
  bolna: BolnaClient;
  storage: StorageClient;
  maps: MapsClient;
  // Null until the agent and a number to call from exist in Bolna.
  customerLine: Line | null;
  workerLine: Line | null;
  customerLineMode: "live" | "test";
  limits: Limits;
  now: () => Date;
  log: (line: string) => void;
  // Work that runs after the reply is sent (WhatsApp, outbound calls), so Bolna and Meta never wait on it.
  background: (task: () => Promise<void>) => void;
};

export type FnReply = { ok: true; [key: string]: unknown } | { ok: false; say: string };

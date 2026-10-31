"use client";

import type { BolnaWebCall } from "@bolna/web-call";
import { useEffect, useRef, useState } from "react";
import { CallScreen, Chat, Phone, type Bubble } from "@/site/components/demo/Phone";
import { shrinkPhoto } from "@/lib/shrink-photo";
import { copy } from "@/site/content/copy";

type Message = { id: number; kind: string; body: Record<string, unknown> };
type Job = { ref: string; status: string; trade: string; problem: string | null; locality: string | null; time_window_text: string | null; priorities: string[]; next_action_at: string | null };
type Quote = { name: string; rating: number | null; status: string; price: number | null; visit_charge: number | null; arrival: string | null };
type Feed = { messages: Message[]; job: Job | null; quotes: Quote[] };

type Phase = "idle" | "starting" | "calling" | "after";

const POLL_MS = 1500;
// A silent clip played inside the click, so the browser lets the agent's voice play once the call connects.
const SILENT_WAV = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

function toBubble(m: Message, photoUrl: string | null): Bubble {
  const b = m.body;
  if (m.kind === "sent") return { id: m.id, from: "person", text: String(b.text), photo: Boolean(b.photo), image: b.photo ? (photoUrl ?? undefined) : undefined };
  if (m.kind === "image") return { id: m.id, from: "suvidha", text: String(b.caption), photo: true };
  if (m.kind === "buttons") return { id: m.id, from: "suvidha", text: String(b.text), buttons: b.buttons as Bubble["buttons"] };
  if (m.kind === "list") {
    const sections = b.sections as { rows: { id: string; title: string; description?: string }[] }[];
    return { id: m.id, from: "suvidha", text: `*${String(b.header)}*\n${String(b.body)}`, list: { button: String(b.button), rows: sections.flatMap((s) => s.rows) } };
  }
  return { id: m.id, from: "suvidha", text: String(b.text) };
}

function jobLine(job: Job, now: number) {
  const { status } = copy.tryLive;
  if (job.status === "confirmed" && job.next_action_at) {
    const left = Math.max(0, (new Date(job.next_action_at).getTime() - now) / 1000);
    return status.confirmed.replace("{time}", clock(left));
  }
  return status[job.status as keyof typeof status] ?? job.status;
}

export function TryLive({ api }: { api: string }) {
  const t = copy.tryLive;
  const [phase, setPhase] = useState<Phase>("idle");
  const [problem, setProblem] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const [token, setToken] = useState<string | null>(null);
  const [feed, setFeed] = useState<Feed>({ messages: [], job: null, quotes: [] });
  const [draft, setDraft] = useState("");
  const [now, setNow] = useState(0);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [sendingPhoto, setSendingPhoto] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const call = useRef<BolnaWebCall | null>(null);
  const speaker = useRef<HTMLAudioElement>(null);
  const after = useRef(0);

  useEffect(() => {
    void import("@bolna/web-call");
    return () => void call.current?.stop();
  }, []);

  useEffect(() => {
    if (!token) return;
    let stopped = false;
    const poll = async () => {
      try {
        const res = await fetch(`${api}/demo/${token}/feed?after=${after.current}`);
        if (res.ok && !stopped) {
          const next = (await res.json()) as Feed;
          if (next.messages.length) after.current = next.messages.at(-1)!.id;
          setFeed((f) => ({ messages: [...f.messages, ...next.messages], job: next.job, quotes: next.quotes }));
        }
      } catch {
        // A missed poll is retried on the next tick.
      }
      setNow(Date.now());
    };
    void poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [api, token]);

  useEffect(() => {
    if (phase !== "calling") return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  const start = async () => {
    const el = speaker.current!;
    el.src = SILENT_WAV;
    void el.play().catch(() => {});
    setProblem("");
    setPhase("starting");
    try {
      const res = await fetch(`${api}/demo/start`, { method: "POST" });
      const body = (await res.json()) as { ok: boolean; reason?: "limit" | "closed"; token?: string; session?: never };
      if (!body.ok) {
        setProblem(body.reason === "limit" ? t.errors.limit : t.errors.closed);
        return setPhase("idle");
      }
      const { BolnaWebCall } = await import("@bolna/web-call");
      const c = new BolnaWebCall({ session: body.session, audioElement: el });
      call.current = c;
      c.on("volume-level", setLevel);
      c.on("call-end", () => setPhase("after"));
      c.on("error", (e) => {
        setProblem(e.code === "at_capacity" ? t.errors.busy : e.code === "microphone_denied" ? t.errors.mic : t.errors.closed);
        setPhase((p) => (p === "calling" && e.code !== "at_capacity" && e.code !== "microphone_denied" ? "after" : "idle"));
      });
      after.current = 0;
      setFeed({ messages: [], job: null, quotes: [] });
      setSeconds(0);
      setToken(body.token!);
      setPhase("calling");
      await c.start();
    } catch {
      setProblem(t.errors.closed);
      setPhase("idle");
    }
  };

  const reply = async (body: object) => {
    if (!token) return;
    await fetch(`${api}/demo/${token}/reply`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  };

  const sendPhoto = async (file: File | undefined) => {
    if (!file || !token) return;
    setSendingPhoto(true);
    setProblem("");
    try {
      const photo = await shrinkPhoto(file).catch(() => file);
      const res = await fetch(`${api}/demo/${token}/photo`, { method: "POST", headers: { "content-type": photo.type }, body: photo });
      if (res.ok) setPhotoUrl(URL.createObjectURL(photo));
      else setProblem(res.status === 409 ? t.errors.photoEarly : t.errors.photo);
    } catch {
      setProblem(t.errors.photo);
    }
    setSendingPhoto(false);
  };

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    void reply({ text });
  };

  const { job, quotes } = feed;
  const bubbles = feed.messages.map((m) => toBubble(m, photoUrl));

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[1fr_1.15fr]">
      <audio ref={speaker} className="hidden" />
      <Phone label={t.phoneLabel} title="Suvidha">
        {phase === "calling" ? (
          <CallScreen name="Suvidha AI" status={seconds ? `On call · ${clock(seconds)}` : "Connecting…"} lines={[]} level={level} note={t.hint} />
        ) : (
          <>
            <Chat bubbles={bubbles} onChoose={(id, title) => void reply({ choice: id, label: title })} empty={phase === "after" ? t.waiting : t.idle} />
            {token && (
              <form onSubmit={send} className="flex gap-2 bg-[#f0f2f5] p-2">
                <input ref={picker} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => void sendPhoto(e.target.files?.[0]).finally(() => (e.target.value = ""))} />
                <button
                  type="button"
                  aria-label={t.sendPhoto}
                  title={t.sendPhoto}
                  disabled={!job || sendingPhoto}
                  onClick={() => picker.current?.click()}
                  className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-[#54656f] hover:bg-white disabled:cursor-default disabled:opacity-40"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 fill-none stroke-current stroke-2 [stroke-linecap:round] [stroke-linejoin:round]">
                    <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
                    <circle cx="12" cy="13" r="3.5" />
                  </svg>
                </button>
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Message"
                  aria-label="Reply on WhatsApp"
                  className="min-w-0 flex-1 rounded-full bg-white px-4 py-2 outline-none"
                />
                <button type="submit" className="cursor-pointer rounded-full bg-[#00a884] px-4 font-medium text-white">
                  Send
                </button>
              </form>
            )}
          </>
        )}
      </Phone>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          {phase === "calling" ? (
            <button type="button" onClick={() => void call.current?.stop()} className="btn cursor-pointer bg-[#d92d20] text-white hover:bg-[#b42318]">
              {t.hangUp}
            </button>
          ) : (
            <button type="button" disabled={phase === "starting"} onClick={() => void start()} className="btn btn-primary cursor-pointer disabled:opacity-60">
              {phase === "starting" ? t.starting : token ? t.again : t.start}
            </button>
          )}
        </div>
        {problem && <p role="alert" className="rounded-card bg-tint p-4 font-medium">{problem}</p>}

        <div className="rounded-card bg-panel p-5 text-white sm:p-6">
          <p className="text-small font-medium opacity-75">Inside Suvidha</p>
          {job ? (
            <>
              <p className="mt-3 font-semibold">{jobLine(job, now)}</p>
              <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-xl bg-white/10 p-4 text-small">
                {[
                  ["Job", `${job.trade}${job.problem ? `: ${job.problem}` : ""}`],
                  ["Area", job.locality ?? "–"],
                  ["Needed by", job.time_window_text ?? "–"],
                  ["Priority", job.priorities.join(", ") || "–"],
                ].map(([name, value]) => (
                  <div key={name} className="contents">
                    <dt className="opacity-70">{name}</dt>
                    <dd className="font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
              {quotes.length > 0 && (
                <ul className="mt-4 space-y-2 text-small">
                  {quotes.map((q) => (
                    <li key={q.name} className="flex items-center justify-between gap-3 rounded-xl bg-white/10 px-4 py-2.5">
                      <span>
                        <span className="font-medium">{q.name}</span>
                        <span className="opacity-60"> · {q.rating ?? "new"}★</span>
                      </span>
                      <span className="tabular-nums">
                        {q.status === "calling" ? "Calling…" : q.status === "no_answer" ? "No answer" : q.price ? `₹${q.price}${q.arrival ? ` · ${time(q.arrival)}` : ""}` : q.visit_charge ? `Visit ₹${q.visit_charge}` : "Quoted"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="mt-3 text-small opacity-80">{phase === "after" ? t.building : phase === "calling" ? t.during : t.before}</p>
          )}
        </div>
        <p className="text-small text-muted">{t.note}</p>
      </div>
    </div>
  );
}

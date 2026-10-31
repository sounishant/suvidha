"use client";

import { useEffect, useRef, useState } from "react";
import { CallScreen, Chat, Phone, type Bubble } from "@/components/demo/Phone";
import { replayCard, replayFacts, replaySteps, type ReplayStep } from "@/content/replay";

const STEP_MS = 1600;
// Without sound, calls play at this speed so the whole job fits in about a minute.
const SILENT_SPEED = 4;

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

// Lines appear in proportion to their length, which tracks the recording closely enough.
function linesAt(step: Extract<ReplayStep, { kind: "call" }>, progress: number) {
  const total = step.lines.reduce((sum, l) => sum + l.text.length, 0);
  let seen = 0;
  return step.lines.filter((l) => {
    const start = seen / total;
    seen += l.text.length;
    return start <= progress;
  });
}

function sideView(side: "customer" | "worker", index: number, progress: number) {
  const current = replaySteps[index];
  if (current?.kind === "call" && current.side === side) {
    return { call: current, lines: linesAt(current, progress), bubbles: [] as Bubble[] };
  }
  const bubbles = replaySteps.slice(0, index + 1).flatMap((step, i): Bubble[] =>
    step.kind === "message" && step.side === side
      ? [{ id: i, ...step.message, buttons: step.message.buttons?.map((title) => ({ id: title, title })), list: step.message.list ? { button: step.message.list, rows: [] } : undefined }]
      : [],
  );
  return { call: null, lines: [], bubbles };
}

export function Replay() {
  const [index, setIndex] = useState(-1);
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [sound, setSound] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);
  const step = replaySteps[index];
  const done = index >= replaySteps.length - 1 && step?.kind !== "call";

  const next = () => {
    setProgress(0);
    setIndex((i) => {
      if (i + 1 >= replaySteps.length) setPlaying(false);
      return Math.min(i + 1, replaySteps.length - 1);
    });
  };

  useEffect(() => {
    if (!playing || !step) return;
    if (step.kind !== "call") {
      if (index === replaySteps.length - 1) return setPlaying(false);
      const timer = setTimeout(next, STEP_MS);
      return () => clearTimeout(timer);
    }
    const el = audio.current;
    if (sound && el) {
      if (!el.src.endsWith(step.audio)) el.src = step.audio;
      el.play().catch(() => setSound(false));
      const tick = () => setProgress(el.duration ? el.currentTime / el.duration : 0);
      el.addEventListener("timeupdate", tick);
      el.addEventListener("ended", next);
      return () => {
        el.pause();
        el.removeEventListener("timeupdate", tick);
        el.removeEventListener("ended", next);
      };
    }
    const started = performance.now() - progress * (step.seconds * 1000) / SILENT_SPEED;
    const timer = setInterval(() => {
      const p = ((performance.now() - started) * SILENT_SPEED) / (step.seconds * 1000);
      if (p >= 1) {
        clearInterval(timer);
        next();
      } else setProgress(p);
    }, 200);
    return () => clearInterval(timer);
    // progress is read once when a call (re)starts, not on every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, index, sound]);

  const start = () => {
    if (done || index < 0) {
      setIndex(0);
      setProgress(0);
    }
    setPlaying(true);
  };

  const customer = sideView("customer", index, progress);
  const worker = sideView("worker", index, progress);
  const now = step ? step.at + (step.kind === "call" ? progress * step.seconds : 0) : 0;
  const statuses = replaySteps.slice(0, index + 1).filter((s) => s.kind === "status");
  const showCard = statuses.some((s) => s.card);

  return (
    <div>
      <audio ref={audio} preload="none" />
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={playing ? () => setPlaying(false) : start} className="btn btn-primary cursor-pointer">
          {playing ? "Pause" : done ? "Watch again" : index < 0 ? "Play the real job" : "Resume"}
        </button>
        <button type="button" aria-pressed={sound} onClick={() => setSound((s) => !s)} className="btn btn-quiet cursor-pointer">
          {sound ? "Sound on" : "Turn sound on to hear the calls"}
        </button>
        {step?.kind === "call" && playing && (
          <button type="button" onClick={next} className="btn btn-quiet cursor-pointer">
            Skip call
          </button>
        )}
        <span className="ml-auto text-small text-muted tabular-nums">Real time since the call began: {clock(now)}</span>
      </div>

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[1fr_1.1fr_1fr]">
        <Phone label="Customer's phone" title="Suvidha">
          {customer.call ? (
            <CallScreen name={customer.call.caller} status={`Call · ${clock(progress * customer.call.seconds)}`} lines={customer.lines} />
          ) : (
            <Chat bubbles={customer.bubbles} empty={index < 0 ? "Press play to watch a real job" : undefined} />
          )}
        </Phone>

        <div className="rounded-card bg-panel p-5 text-white sm:p-6">
          <p className="text-small font-medium opacity-75">Inside Suvidha</p>
          {showCard ? (
            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-xl bg-white/10 p-4 text-small">
              {replayCard.map(([name, value]) => (
                <div key={name} className="contents">
                  <dt className="opacity-70">{name}</dt>
                  <dd className="font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-4 rounded-xl bg-white/10 p-4 text-small opacity-80">The job card fills in from the call, once the caller hangs up.</p>
          )}
          <ol className="mt-4 space-y-2 text-small">
            {statuses.map((s) => (
              <li key={s.at + s.text} className="flex gap-3">
                <span className="w-10 shrink-0 tabular-nums opacity-60">{clock(s.at)}</span>
                <span>{s.text}</span>
              </li>
            ))}
          </ol>
        </div>

        <Phone label="Worker's phone (Kalpana, plumber)" title="Suvidha">
          {worker.call ? (
            <CallScreen name={worker.call.caller} status={`Call · ${clock(progress * worker.call.seconds)}`} lines={worker.lines} />
          ) : (
            <Chat bubbles={worker.bubbles} empty="No job yet" />
          )}
        </Phone>
      </div>

      <dl className="mt-10 grid gap-6 sm:grid-cols-3">
        {replayFacts.map((fact) => (
          <div key={fact.value} className="flex flex-col-reverse justify-end">
            <dt className="mt-2 text-muted">{fact.label}</dt>
            <dd className="text-figure leading-none tracking-[-0.04em] text-accent-text tabular-nums">{fact.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

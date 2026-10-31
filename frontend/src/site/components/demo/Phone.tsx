import type { ReactNode } from "react";

export type Bubble = {
  id: string | number;
  from: "suvidha" | "person";
  text: string;
  photo?: boolean;
  buttons?: { id: string; title: string }[];
  list?: { button: string; rows: { id: string; title: string; description?: string }[] };
};

export type CallLine = { who: "agent" | "person"; text: string; en?: string };

// WhatsApp marks *bold*; links in the text (the payment page) stay clickable.
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*[^*\n]+\*|https?:\/\/\S+)/g).map((part, i) =>
        part.startsWith("*") && part.endsWith("*") && part.length > 2 ? (
          <strong key={i}>{part.slice(1, -1)}</strong>
        ) : part.startsWith("http") ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="break-all text-[#027eb5] underline">
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </>
  );
}

export function Phone({ label, title, children }: { label: string; title: string; children: ReactNode }) {
  return (
    <figure className="mx-auto w-full max-w-[340px]">
      <figcaption className="mb-3 text-center text-small font-medium text-muted">{label}</figcaption>
      <div className="overflow-hidden rounded-[32px] border-[6px] border-[#0c1d40] bg-[#0c1d40] dark:border-white/15 shadow-[0_18px_50px_-20px_rgb(12_29_64/0.45)]">
        <div className="flex items-center gap-3 bg-[#075e54] px-4 py-3 text-white">
          <span className="flex size-8 items-center justify-center rounded-full bg-white/20 text-small font-semibold">{title.slice(0, 1)}</span>
          <span className="text-small font-semibold">{title}</span>
        </div>
        <div className="flex h-[400px] flex-col lg:h-[440px] bg-[#efeae2] text-[0.875rem] leading-snug text-[#111b21]">{children}</div>
      </div>
    </figure>
  );
}

type ChatProps = {
  bubbles: Bubble[];
  onChoose?: (id: string, title: string) => void;
  empty?: string;
};

export function Chat({ bubbles, onChoose, empty }: ChatProps) {
  return (
    <div className="flex flex-1 flex-col-reverse overflow-y-auto px-3 py-3">
      <div className="space-y-2">
        {!bubbles.length && empty && <p className="mx-auto w-fit rounded-lg bg-white/80 px-3 py-1.5 text-center text-[0.8rem] text-[#54656f]">{empty}</p>}
        {bubbles.map((b) => (
          <div key={b.id} className={`flex ${b.from === "person" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-lg px-3 py-2 shadow-[0_1px_0.5px_rgb(0_0_0/0.13)] ${b.from === "person" ? "bg-[#d9fdd3]" : "bg-white"}`}>
              {b.photo && (
                <div className="mb-1.5 flex h-24 min-w-36 items-center justify-center rounded-md px-3 bg-[#d1d7db] text-[0.8rem] text-[#54656f]">
                  Photo of the job
                </div>
              )}
              {!(b.photo && b.from === "person") && (
                <p className="whitespace-pre-line">
                  <Rich text={b.text} />
                </p>
              )}
              {b.buttons?.map((button) => (
                <button
                  key={button.id}
                  type="button"
                  disabled={!onChoose}
                  onClick={() => onChoose?.(button.id, button.title)}
                  className="mt-2 block w-full border-t border-[#e9edef] pt-2 text-center font-medium text-[#027eb5] enabled:cursor-pointer"
                >
                  {button.title}
                </button>
              ))}
              {b.list && <ListPicker list={b.list} onChoose={onChoose} />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ListPicker({ list, onChoose }: { list: NonNullable<Bubble["list"]>; onChoose?: ChatProps["onChoose"] }) {
  if (!onChoose) {
    return <p className="mt-2 border-t border-[#e9edef] pt-2 text-center font-medium text-[#027eb5]">{list.button}</p>;
  }
  return (
    <details className="mt-2 border-t border-[#e9edef] pt-2">
      <summary className="cursor-pointer list-none text-center font-medium text-[#027eb5]">{list.button}</summary>
      <ul className="mt-2 space-y-1">
        {list.rows.map((row) => (
          <li key={row.id}>
            <button type="button" onClick={() => onChoose(row.id, row.title)} className="w-full cursor-pointer rounded-md bg-[#f0f2f5] px-3 py-2 text-left hover:bg-[#e4e8eb]">
              <span className="block font-medium">{row.title}</span>
              {row.description && <span className="block text-[0.8rem] text-[#54656f]">{row.description}</span>}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}

type CallScreenProps = { name: string; status: string; lines: CallLine[]; level?: number; note?: ReactNode };

export function CallScreen({ name, status, lines, level = 0, note }: CallScreenProps) {
  return (
    <div className="flex flex-1 flex-col bg-[#0b141a] text-white">
      <div className="flex flex-col items-center gap-2 pt-6 pb-4">
        <span
          className="flex size-16 items-center justify-center rounded-full bg-[#1b4fd1] text-title font-semibold transition-shadow"
          style={{ boxShadow: `0 0 0 ${Math.round(level * 14)}px rgb(27 79 209 / 0.35)` }}
        >
          S
        </span>
        <span className="font-semibold">{name}</span>
        <span className="text-small text-white/65 tabular-nums">{status}</span>
      </div>
      <div className="flex flex-1 flex-col-reverse overflow-y-auto px-3 pb-3">
        <div className="space-y-2">
          {note && <div className="rounded-lg bg-[#202c33] px-3 py-2.5 text-white/85">{note}</div>}
          {lines.map((line, i) => (
            <div key={i} className={`flex ${line.who === "person" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[88%] rounded-lg px-3 py-2 ${line.who === "person" ? "bg-[#005c4b]" : "bg-[#202c33]"}`}>
                <p>{line.text}</p>
                {line.en && <p className="mt-1 text-[0.78rem] text-white/60">{line.en}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

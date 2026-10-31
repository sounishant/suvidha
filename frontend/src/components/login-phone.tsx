import type { Role } from "@/app/(app)/login/actions";

type Message = { from: "suvidha" | "me"; lines: string[]; photo?: boolean; action?: string };

// An example chat, in the WhatsApp copy each side really receives.
const CHATS: Record<Role, Message[]> = {
  customer: [
    {
      from: "suvidha",
      lines: [
        "*Nal badalna* ke liye rates:",
        "1. *Kalpana* - ₹200 · kal 4 pm · 4.8★",
        "2. *Ramesh* - ₹250 · kal 6 pm · 4.6★",
        "3. *Salim* - ₹180 · parso 11 am · 4.3★",
      ],
      action: "Worker chuniye",
    },
    { from: "me", lines: ["Kalpana"] },
    {
      from: "suvidha",
      lines: ["*Booking confirm ho gayi*", "Worker: Kalpana", "Aane ka time: kal 4:00 pm", "Rate: ₹200", "Start code: *4821*"],
    },
  ],
  worker: [
    {
      from: "suvidha",
      photo: true,
      lines: ["*Naya kaam*", "Kaam: Nal badalna (bathroom)", "Jagah: Civil Lines · 1 km", "Kab tak: kal 7:00 pm", "Suvidha se aapko abhi call aayegi."],
    },
    {
      from: "suvidha",
      lines: ["*Kaam confirm ho gaya*", "Rate: ₹200 (aapka rate)", "Time: kal 4:00 pm", "Address: Civil Lines, Roorkee"],
      action: "Nikal raha hoon",
    },
  ],
};

function Line({ text }: { text: string }) {
  return (
    <p>
      {text.split(/(\*[^*]+\*)/g).map((part, i) =>
        part.startsWith("*") && part.endsWith("*") ? <strong key={i}>{part.slice(1, -1)}</strong> : part,
      )}
    </p>
  );
}

export function LoginPhone({ role }: { role: Role }) {
  return (
    <div
      role="img"
      aria-label={role === "customer" ? "A Suvidha WhatsApp chat: three worker rates, then a confirmed booking" : "A Suvidha WhatsApp chat: a new job card, then a confirmed job"}
      className="w-[340px] overflow-hidden rounded-[34px] border-[7px] border-[#0c1d40] bg-[#0c1d40] shadow-[0_30px_70px_-25px_rgb(12_29_64/0.7)]"
    >
      <div className="flex items-center gap-3 bg-[#075e54] px-4 py-3 text-white">
        <span className="flex size-8 items-center justify-center rounded-full bg-white/20 text-sm font-semibold">S</span>
        <span className="text-sm font-semibold">Suvidha</span>
      </div>
      <div className="space-y-2.5 bg-[#efeae2] px-3 py-4 text-[13px] leading-snug text-[#111b21]">
        {CHATS[role].map((m, i) => (
          <div key={i} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[88%] rounded-lg px-3 py-2 shadow-[0_1px_0.5px_rgb(0_0_0/0.13)] ${m.from === "me" ? "bg-[#d9fdd3]" : "bg-white"}`}>
              {m.photo && <div className="mb-2 h-20 rounded-md bg-gradient-to-br from-[#c7d3dd] to-[#9fb0be]" />}
              <div className="space-y-0.5">
                {m.lines.map((line) => (
                  <Line key={line} text={line} />
                ))}
              </div>
              {m.action && <p className="mt-2 border-t border-[#e9edef] pt-2 text-center font-medium text-[#027eb5]">{m.action}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

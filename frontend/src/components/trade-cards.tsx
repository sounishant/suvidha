import Image from "next/image";

// Fanned like a hand of cards, rising from the panel's bottom edge; the middle one stands upright.
const CARDS = [
  { title: "Painter", hindi: "पेंटर", jobs: "Kamra, seelan, putty", img: "painter", tilt: -8, drop: 52 },
  { title: "Electrician", hindi: "इलेक्ट्रीशियन", jobs: "Pankha, switch, MCB", img: "electrician", tilt: -5, drop: 22 },
  { title: "Plumber", hindi: "प्लंबर", jobs: "Nal, pipe, tanki, geyser", img: "plumber", tilt: 0, drop: 0, main: true },
  { title: "Carpenter", hindi: "कारपेंटर", jobs: "Darwaza, almari, tala", img: "carpenter", tilt: 5, drop: 22 },
  { title: "AC mechanic", hindi: "एसी मैकेनिक", jobs: "AC, cooler, machine", img: "acmechanic", tilt: 8, drop: 52 },
];

export function TradeCards() {
  return (
    <ul aria-label="Plumber, electrician, carpenter, painter and AC mechanic" className="flex items-end justify-center">
      {CARDS.map((c) => (
        <li
          key={c.title}
          style={{ transform: `translateY(${c.drop}px) rotate(${c.tilt}deg)` }}
          className={`relative -mx-3.5 shrink-0 origin-bottom overflow-hidden rounded-t-[26px] px-4 pt-4 text-[#0c1d40] shadow-[0_-12px_40px_-18px_rgb(12_29_64/0.6)] ${
            c.main ? "z-10 h-[clamp(300px,24vw,360px)] w-[clamp(165px,13vw,190px)] bg-white" : "h-[clamp(260px,20.5vw,310px)] w-[clamp(125px,9.5vw,145px)] bg-[#e3ecff]"
          }`}
        >
          <p className="text-base leading-tight font-bold">{c.title}</p>
          <p lang="hi" className="font-[family-name:var(--font-hind)] text-sm">
            {c.hindi}
          </p>
          <p className="mt-1 text-xs text-[#0c1d40]/75">{c.jobs}</p>
          <Image src={`/people/${c.img}.svg`} alt="" width={220} height={220} unoptimized className="absolute -bottom-1 left-1/2 w-[96%] -translate-x-1/2" />
        </li>
      ))}
    </ul>
  );
}

// Placeholders until the Bolna customer line and the Meta WhatsApp number are live.
export const CALL = { tel: "tel:+910000000000", label: "98XXX XXXXX" };
const WHATSAPP_NUMBER = "910000000000";

export const whatsappLink = (text: string) => `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;

export const SERVICES = [
  { slug: "plumber", name: "Plumber", hint: "Nal, pipe, tanki, geyser", ask: "mujhe plumber chahiye" },
  { slug: "electrician", name: "Electrician", hint: "Pankha, switch, MCB, wiring", ask: "mujhe electrician chahiye" },
  { slug: "carpenter", name: "Carpenter", hint: "Darwaza, almari, bed, tala", ask: "mujhe carpenter chahiye" },
  { slug: "painter", name: "Painter", hint: "Kamra, seelan, putty", ask: "mujhe painter chahiye" },
  { slug: "ac", name: "AC mechanic", hint: "AC, cooler, washing machine", ask: "mujhe AC mechanic chahiye" },
  { slug: "mason", name: "Raajmistri", hint: "Tile, plaster, chhoti deewar", ask: "mujhe raajmistri chahiye" },
] as const;

export type ServiceSlug = (typeof SERVICES)[number]["slug"];

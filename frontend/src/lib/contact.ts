// Placeholders until the Bolna customer line and the Meta WhatsApp number are live.
export const CALL = { tel: "tel:+910000000000", label: "98XXX XXXXX" };
const WHATSAPP_NUMBER = "910000000000";

export const whatsappLink = (text: string) => `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;

export const SERVICES = [
  { slug: "plumber", name: "Plumber", hint: "Taps, pipes, tanks, geysers", ask: "I need a plumber" },
  { slug: "electrician", name: "Electrician", hint: "Fans, switches, MCB, wiring", ask: "I need an electrician" },
  { slug: "carpenter", name: "Carpenter", hint: "Doors, wardrobes, beds, locks", ask: "I need a carpenter" },
  { slug: "painter", name: "Painter", hint: "Rooms, damp walls, putty", ask: "I need a painter" },
  { slug: "ac", name: "AC mechanic", hint: "AC, cooler, washing machine", ask: "I need an AC mechanic" },
  { slug: "mason", name: "Mason", hint: "Tiles, plaster, small walls", ask: "I need a mason" },
] as const;

export type ServiceSlug = (typeof SERVICES)[number]["slug"];

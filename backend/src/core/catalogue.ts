export const TRADES = ["carpenter", "plumber", "electrician", "other"] as const;
export type Trade = (typeof TRADES)[number];

// Short job-type lists per trade, from the job card spec's question sets; "other" keeps the caller's words.
export const JOB_TYPES: Record<Trade, string[]> = {
  carpenter: [
    "door_repair", "window_repair", "wardrobe_repair", "bed_repair", "table_repair",
    "shelf_install", "furniture_assembly", "new_furniture", "lock_hinge_handle", "other",
  ],
  plumber: [
    "tap_repair", "flush_repair", "pipe_leak", "drain_block", "washbasin_install",
    "geyser_connection", "new_fitting", "other",
  ],
  electrician: ["switch_socket", "fan", "light", "mcb_trip", "wiring", "appliance_install", "other"],
  other: ["other"],
};

const norm = (text: string) => text.trim().toLowerCase().replace(/[\s-]+/g, "_");

export function toTrade(text: string): Trade {
  const code = norm(text);
  return (TRADES as readonly string[]).includes(code) ? (code as Trade) : "other";
}

export function toJobType(trade: Trade, text: string) {
  const code = norm(text);
  return JOB_TYPES[trade].includes(code) ? code : "other";
}

export function skillsFor(trade: Trade) {
  return JOB_TYPES[trade];
}

import { randomInt } from "node:crypto";

// No 0/O or 1/I, so the agent can't copy a look-alike.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function newRef() {
  return Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}

export function cleanRef(text: string) {
  return text.replace(/[\s-]/g, "").toUpperCase();
}

const UNIQUE_VIOLATION = "23505";

// About a million codes, so a clash is rare; on one, try a fresh code.
export async function withFreshRef<T>(insert: (ref: string) => Promise<T>, tries = 5): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await insert(newRef());
    } catch (err) {
      if (i >= tries || (err as { code?: string }).code !== UNIQUE_VIOLATION) throw err;
    }
  }
}

// India has no daylight saving, so IST is always UTC+5:30.
const IST_OFFSET_MS = 330 * 60_000;

function ist(date: Date) {
  return new Date(date.getTime() + IST_OFFSET_MS);
}

export function istHour(date: Date) {
  return ist(date).getUTCHours();
}

export function istDayStart(date: Date) {
  const d = ist(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - IST_OFFSET_MS);
}

// "6:40", the way the agent says a time on the phone.
export function istClock(date: Date) {
  const d = ist(date);
  return `${d.getUTCHours() % 12 || 12}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

export function inCustomerCallingHours(date: Date) {
  const hour = istHour(date);
  return hour >= 8 && hour < 21;
}

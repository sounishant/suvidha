// Bolna sends "+919876543210", WhatsApp "919876543210"; we store E.164.
export function toE164(text: string) {
  const digits = text.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return `+${digits}`;
}

// Logs keep only the last 4 digits.
export function maskPhone(phone: string) {
  return `…${phone.slice(-4)}`;
}

export function toWhatsApp(e164: string) {
  return e164.replace(/^\+/, "");
}

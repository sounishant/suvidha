export type Links = {
  phone: string;
  howVideo: string;
  listenDemo: string;
  webApp: string;
  pitch: string;
  github: string;
};

// Placeholders are written in square brackets until the real value goes in.
export const isSet = (value: string) => !value.startsWith("[");

// Indian numbers written with a leading 0 become +91, so the link also works from abroad.
export const telHref = (phone: string) => `tel:${phone.replace(/[^+\d]/g, "").replace(/^0/, "+91")}`;

export const withPhone = (text: string, phone: string) => text.replace("{PHONE_NUMBER}", phone);

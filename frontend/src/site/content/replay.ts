// A real job (AVT3, Roorkee, Oct 31 2026), replayed from its call recordings, transcripts and message log.
// `at` is seconds since the customer's call began; the clock on the page shows it.

export type Line = { who: "agent" | "person"; text: string; en: string };
export type ReplayMessage = { from: "suvidha" | "person"; text: string; photo?: boolean; buttons?: string[]; list?: string };

export type ReplayStep =
  | { kind: "call"; side: "customer" | "worker"; at: number; seconds: number; audio: string; caller: string; lines: Line[] }
  | { kind: "message"; side: "customer" | "worker"; at: number; message: ReplayMessage }
  | { kind: "status"; at: number; text: string; card?: boolean };

export const replayCard = [
  ["Trade", "Plumber"],
  ["Job", "Bathroom tap leaking, replace it"],
  ["Material", "Worker brings"],
  ["Area", "IIT Roorkee, near the bus stand"],
  ["Needed by", "Tomorrow, 7 pm"],
  ["Priority", "Speed (last worker came late)"],
  ["Safety note", "Gate pass needed"],
] as const;

const customerCall: Line[] = [
  { who: "agent", text: "नमस्ते, मैं Suvidha AI हूँ. बताइए, किस काम में मदद चाहिए?", en: "Hello, I'm Suvidha AI. What do you need help with?" },
  { who: "person", text: "मेरे बाथरूम का नल लीक हो रहा है, रिप्लेस करवाना है।", en: "My bathroom tap is leaking. I want it replaced." },
  { who: "agent", text: "Saaman आप देंगे या worker लाए?", en: "Will you give the part, or should the worker bring it?" },
  { who: "person", text: "वर्कर नया टैप लेके आ जाए तो अच्छा रहेगा।", en: "Better if the worker brings a new tap." },
  { who: "agent", text: "कब तक हो जाना चाहिए?", en: "By when should it be done?" },
  { who: "person", text: "ये कल शाम तक हो जाए तो चलेगा, मैं 7 बजे तक शाम को घर पे ही हूँ कल तो।", en: "Tomorrow evening is fine. I'm home until 7 pm tomorrow." },
  { who: "agent", text: "पास के workers के लिए, address और landmark बता दीजिए.", en: "For workers nearby, tell me the address and a landmark." },
  { who: "person", text: "एड्रेस है राजीव भवन आई आई टी रुड़की और लैंडमार्क है गवर्नमेंट बस स्टैंड रुड़की।", en: "Rajiv Bhawan, IIT Roorkee. Landmark: Government Bus Stand." },
  { who: "agent", text: "पिछली बार ऐसे काम में सबसे बड़ी परेशानी क्या थी, worker late आया, पैसे ज़्यादा लिए, या काम अच्छा नहीं हुआ?", en: "Last time, what went wrong: the worker came late, overcharged, or did poor work?" },
  { who: "person", text: "वर्कर लेट। कर रहा। रहता बहुत ज्यादा।", en: "The worker comes very late." },
  { who: "agent", text: "Worker को कुछ और पता होना चाहिए, जैसे gate pass?", en: "Anything else the worker should know, like a gate pass?" },
  { who: "person", text: "हाँ जी गेट पास लगता है कॉलेज के अंदर आने के लिए।", en: "Yes, a gate pass is needed to enter the campus." },
  { who: "agent", text: "तो, बाथरूम का नल रिप्लेस करवाना है, saaman worker लाएगा, IIT रुड़की, गवर्नमेंट बस स्टैंड के पास, कल शाम 7 बजे तक. सही है?", en: "So: replace the bathroom tap, worker brings the part, IIT Roorkee near the bus stand, by 7 pm tomorrow. Right?" },
  { who: "person", text: "आज। हाँ सही है।", en: "Today. Yes, right." },
  { who: "agent", text: "ठीक है, तो बाथरूम का नल रिप्लेस करवाना है, saaman worker लाएगा, IIT रुड़की, गवर्नमेंट बस स्टैंड के पास, आज. सही है?", en: "OK: replace the bathroom tap, worker brings the part, IIT Roorkee near the bus stand, today. Right?" },
  { who: "person", text: "हाँ सही है।", en: "Yes, right." },
  { who: "agent", text: "बढ़िया. व्हाट्सएप पर summary आएगी, उसमें काम की photo भेजेंगे तो rate सही आएगा. Rates भी वहीं आएंगे, धन्यवाद.", en: "Great. A summary is coming on WhatsApp. Send a photo there for accurate rates; the rates arrive there too. Thank you." },
];

const workerCall: Line[] = [
  { who: "agent", text: "नमस्ते Kalpana जी, मैं सुविधा AI हूँ. आपके लिए एक काम है.", en: "Hello Kalpana ji, I'm Suvidha AI. There's a job for you." },
  { who: "person", text: "जी बताइए।", en: "Yes, tell me." },
  { who: "agent", text: "IIT रुड़की, गवर्नमेंट बस स्टैंड के पास 1 किलोमीटर में, बाथरूम का नल लीक कर रहा है और उसे बदलना है. फोटो व्हाट्सएप पर भेजी है, आराम से देख लीजिए.", en: "Near IIT Roorkee, 1 km away: a leaking bathroom tap to replace. The photo is on your WhatsApp, have a look." },
  { who: "person", text: "ठीक है, देख रहा हूँ।", en: "OK, looking." },
  { who: "agent", text: "जी, आराम से देख लीजिए.", en: "Take your time." },
  { who: "person", text: "हाँ जी देख ली।", en: "Yes, seen it." },
  { who: "agent", text: "कल शाम 7 बजे से पहले काम खत्म हो जाना चाहिए, और नया नल आपको लाना होगा. कर पाएंगे?", en: "It must be done before 7 pm tomorrow, and you bring the new tap. Can you do it?" },
  { who: "person", text: "हाँ जी हो जाएगा।", en: "Yes, it will be done." },
  { who: "agent", text: "कस्टमर रेट और टाइम देखकर ही चुनेंगे. आप इसका कितना लेंगे?", en: "The customer picks by rate and time. How much will you charge?" },
  { who: "person", text: "दो सौ रुपये।", en: "₹200." },
  { who: "agent", text: "ऊपर-नीचे कितना हो सकता है?", en: "Could that change?" },
  { who: "person", text: "नहीं फिक्स है।", en: "No, it's fixed." },
  { who: "agent", text: "और नल का अलग से कितना लगेगा, या इसी में है?", en: "And the tap itself: extra, or included?" },
  { who: "person", text: "पचास रुपये लगेगा।", en: "₹50 extra." },
  { who: "agent", text: "काम में कितना टाइम लगेगा?", en: "How long will the work take?" },
  { who: "person", text: "लगभग आधा घंटा।", en: "About half an hour." },
  { who: "agent", text: "कितने बजे आकर काम शुरू कर सकते हैं?", en: "When can you come and start?" },
  { who: "person", text: "कल दोपहर को 4 बजे आ जाएंगे।", en: "Tomorrow at 4 pm." },
  { who: "agent", text: "एक बात, गेट पास लगेगा, बुकिंग के बाद कस्टमर बता देंगे. तो, दो सौ रुपये, नल का पचास अलग, कल 4 बजे शुरू करेंगे, आधा घंटा लगेगा. ठीक है?", en: "One thing: a gate pass is needed; the customer shares it after booking. So ₹200, ₹50 for the tap, tomorrow at 4, half an hour. OK?" },
  { who: "person", text: "हाँ जी, ठीक है।", en: "Yes, OK." },
  { who: "agent", text: "ठीक है Kalpana जी, धन्यवाद. कस्टमर चुनेंगे तो आपको ऐप पर और व्हाट्सएप पर पूरी जानकारी मिल जाएगी.", en: "Thank you, Kalpana ji. If the customer picks you, the full details come on the app and WhatsApp." },
];

export const replaySteps: ReplayStep[] = [
  { kind: "call", side: "customer", at: 0, seconds: 92, audio: "/replay/customer-call.mp3", caller: "Suvidha AI", lines: customerCall },
  { kind: "status", at: 92, text: "Caller hangs up" },
  { kind: "status", at: 106, text: "Job card built from the call", card: true },
  {
    kind: "message", side: "customer", at: 109,
    message: {
      from: "suvidha",
      text: "*Aapki Suvidha request*\nKaam: Nal badalna (bathroom)\nSaaman: Worker laayega\nAddress: IIT Roorkee, Government Bus Stand ke paas\nKab tak: kal 7:00 pm\nPasand: Jaldi aana\n\nKaam ki ek photo bhejiye, taaki workers sahi rate de sakein. Koi jaankari galat ho to isi message par reply kijiye.",
    },
  },
  { kind: "message", side: "customer", at: 130, message: { from: "person", text: "Photo", photo: true } },
  { kind: "status", at: 130, text: "Photo in, so worker calls start now" },
  {
    kind: "message", side: "worker", at: 132,
    message: {
      from: "suvidha", photo: true,
      text: "*Naya kaam*\nKaam: Nal badalna (bathroom)\nJagah: IIT Roorkee, Government Bus Stand ke paas · 1 km\nKab tak: kal 7:00 pm\nSaaman: Worker laayega\nDhyan dein: Gate pass lagta hai\n\nSuvidha se aapko abhi call aayegi. Call par apna rate bataiye.",
    },
  },
  { kind: "status", at: 132, text: "Calling Kalpana: plumber, 1 km, rated 4.8" },
  { kind: "call", side: "worker", at: 132, seconds: 88, audio: "/replay/worker-call.mp3", caller: "Suvidha AI", lines: workerCall },
  { kind: "status", at: 252, text: "Quote read from the call: ₹200 fixed, tomorrow 4 pm" },
  {
    kind: "message", side: "customer", at: 254,
    message: {
      from: "suvidha", list: "Worker chuniye",
      text: "*Nal badalna* ke liye rates:\n\n1. *Kalpana* - ₹200 + ₹29 fee\n    Aayenge: kal 4:00 pm · Rating 4.8\n    Sabse jaldi · saaman alag se\n\nBook karne ke liye *Worker chuniye* dabaiye.",
    },
  },
  { kind: "message", side: "customer", at: 275, message: { from: "person", text: "Kalpana" } },
  {
    kind: "message", side: "customer", at: 277,
    message: { from: "suvidha", text: "*Booking fee pay kijiye*\nWorker: Kalpana\nBooking fee: ₹29\n\nFee pay hote hi booking confirm ho jaayegi. Worker ka rate (₹200) aap kaam ke baad seedha worker ko denge." },
  },
  { kind: "status", at: 326, text: "Booking fee paid. Booked." },
  {
    kind: "message", side: "customer", at: 328,
    message: { from: "suvidha", text: "*Booking confirm ho gayi*\nWorker: Kalpana\nAane ka time: kal 4:00 pm\nRate: ₹200 (kaam ke baad seedha worker ko dijiye)\nBooking fee: ₹29 (pay ho gayi)\nStart code: *••••*" },
  },
  {
    kind: "message", side: "worker", at: 328,
    message: { from: "suvidha", buttons: ["Nikal raha hoon"], text: "*Kaam confirm ho gaya*\nKaam: Nal badalna (bathroom)\nAddress: Rajiv Bhawan, IIT Roorkee\nTime: kal 4:00 pm\nDhyan dein: Gate pass lagta hai\n\nKaam shuru karne se pehle customer se start code lijiye." },
  },
];

export const replayFacts = [
  { value: "1 call", label: "from the customer, 92 seconds" },
  { value: "3 min 54 s", label: "from hang-up to a booked worker" },
  { value: "0 forms", label: "for the customer or the worker" },
];

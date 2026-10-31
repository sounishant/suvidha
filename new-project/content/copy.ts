// All page wording lives here. Links and the phone number are at the top of app/page.tsx.
// {PHONE_NUMBER} is replaced with the real number when the page renders.

export type Mark = "yes" | "no" | "partly";

export const copy = {
  brand: "Suvidha",

  nav: {
    links: [
      { label: "How it works", href: "#how" },
      { label: "Try it live", href: "#try" },
      { label: "Watch a real job", href: "#listen" },
    ],
    call: "Call Suvidha",
    callShort: "Call",
    menu: "Menu",
  },

  hero: {
    headline: ["One call.", "Three quotes.", "Zero chasing."],
    sub: "Tell Suvidha your job in one phone call. It calls nearby workers and sends you the best rates on WhatsApp.",
    primary: "Call {PHONE_NUMBER}",
    strip: "Built on Bolna voice agents · Hindi & Hinglish · Real phone calls",
    stage: {
      call: { title: "One call", body: "You describe the job in Hindi or Hinglish." },
      workers: { title: "Suvidha calls workers near you", trades: ["Carpenters", "Plumbers", "Electricians"] },
      result: { title: "Best rates on WhatsApp", body: "A shortlist ranked by speed, price or quality." },
    },
  },


  problem: {
    heading: ["Today you have", "three options"],
    cards: [
      {
        title: "Book on an app",
        points: [
          "Premium prices, even for small jobs",
          "An inspection fee before custom jobs get a price",
          "Mostly available in big cities",
        ],
      },
      {
        title: "Call someone you know",
        points: [
          "They don’t always pick up, or they come late",
          "One rate, with nothing to compare it against",
        ],
      },
      {
        title: "Call 2–3 local shops",
        points: [
          "Calling around and waiting for call-backs",
          "The rate changes once they arrive",
          "No way to know if the work will be good",
        ],
      },
    ],
    bridge: "Suvidha gives you the comparison of an app with the reach of your local workers, in one phone call.",
  },


  how: {
    heading: ["How it", "works"],
    steps: [
      { title: "You call and describe the job", body: "Speak naturally in Hindi or Hinglish. No forms to fill." },
      { title: "Suvidha understands what you need", body: "The problem, timing and location become a job card." },
      { title: "It calls workers near you", body: "Nearby carpenters, plumbers or electricians share their rate and earliest time." },
      { title: "You pick the best fit", body: "A shortlist on WhatsApp, ranked by what matters to you: speed, price or quality." },
    ],
    videoTitle: "How Suvidha works, from call to booking",
    videoCaption: "See the full flow, from call to booking.",
    videoEmpty: "Video coming soon",
    videoPoster: "/demo-suvidha-poster.jpg",
  },

  tryLive: {
    heading: ["Try it", "live"],
    body: "Talk to the real Suvidha agent from your browser, in Hindi or Hinglish. Your WhatsApp messages appear on the phone here, and demo workers send you their rates.",
    start: "Start a call",
    starting: "Connecting…",
    again: "Try another job",
    hangUp: "Hang up",
    phoneLabel: "Your phone, in this demo",
    hint: "Allow the microphone, then describe the job. For example: “Kitchen ka nal leak ho raha hai, kal shaam tak chahiye. Address Civil Lines, Roorkee.”",
    idle: "Your WhatsApp messages from Suvidha will appear here",
    waiting: "Call ended. Your WhatsApp summary arrives in a few seconds…",
    before: "Start a call. When you hang up, your job card appears here; then demo workers are called and their rates arrive on the phone.",
    during: "Listening. The job card is built when you hang up.",
    building: "Building your job card from the call…",
    note: "Demo workers stand in for real ones, so nobody’s phone rings. On a real job Suvidha calls real workers, as in the replay below.",
    status: {
      draft: "A detail is missing. Answer the question on the phone.",
      confirmed: "Calling demo workers in {time}",
      inviting: "Calling demo workers…",
      quotes_in: "Rates are on your phone. Pick a worker.",
      awaiting_payment: "Open the link on the phone to pay the booking fee (a demo page, no real money).",
      booked: "Booked. That is the whole flow.",
      no_workers: "No demo worker for this trade. Try a plumber, electrician or carpenter job.",
      cancelled: "Request cancelled.",
      done: "Job done.",
    },
    errors: {
      limit: "Today’s 50 live calls are used up. Watch the real job below, or come back tomorrow.",
      busy: "Both live lines are busy. Try again in a minute, or watch the real job below.",
      mic: "Suvidha needs your microphone to hear you. Allow it in the browser and try again.",
      closed: "The live line couldn’t start just now. Try again in a minute.",
    },
  },

  listen: {
    heading: ["Watch a", "real job"],
    body: "A real customer in Roorkee and a real plumber, from the first hello to a booked worker. Turn sound on to hear both calls.",
  },


  why: {
    heading: ["Why voice,", "why now"],
    blocks: [
      {
        title: "Market & untapped segment",
        stats: [
          {
            value: "Under 1%",
            label: "of India’s ~Rs 5.1 lakh crore home-services market is online, and 85–90% of online demand sits in the top 8 cities.",
            sources: [{ name: "Outlook Business / Redseer", url: "https://www.outlookbusiness.com/news/indias-online-home-services-market-to-grow-at-22-to-hit-88-billion-by-fy30-report" }],
          },
          {
            value: "85.5%",
            label: "of Indian households own at least one smartphone, and every phone can make a call.",
            sources: [{ name: "IANS / MoSPI", url: "https://ianslive.in/855-pc-of-indian-households-now-own-at-least-1-smartphone-centre--20250529163413" }],
          },
        ],
      },
      {
        title: "Customers and workers are both unhappy",
        stats: [
          {
            value: "Price",
            label: "High pricing and unexpected charges are among the main complaints in Urban Company’s Google Play reviews.",
            sources: [{ name: "Kimola report on Google Play reviews (archived)", url: "https://web.archive.org/web/20251006111050/https://kimola.com/reports/insightful-urban-company-feedback-report-google-play-en-157520" }],
          },
          {
            value: "~Rs 304",
            label: "an hour is what Urban Company partners earn after fees and costs.",
            sources: [{ name: "Zerodha Daily Brief", url: "https://thedailybrief.zerodha.com/p/urban-company-big-ipo-bigger-questions" }],
          },
          {
            value: "30%",
            label: "was Urban Company’s top commission until worker protests. Unions have also raised joining fees and ID blocking.",
            sources: [
              { name: "Free Press Journal", url: "https://www.freepressjournal.in/business/urban-company-cuts-commission-to-25-from-30-after-workers-protest" },
              { name: "MediaNama", url: "https://www.medianama.com/2025/06/223-urban-company-worker-union-campaign-ipo/" },
            ],
          },
          {
            value: "~$8M",
            label: "a month is what instant home-services startups were burning in late 2025.",
            sources: [{ name: "Inc42", url: "https://inc42.com/features/snabbit-says-the-discount-game-is-almost-over-the-hard-part-comes-next/" }],
          },
        ],
      },
      {
        title: "Voice AI is ready now",
        stats: [
          {
            value: "94%",
            label: "of Indians would trust an AI agent to schedule appointments.",
            sources: [{ name: "Twilio via Digital Terminal", url: "https://digitalterminal.in/trending/ai-takes-over-customer-service-but-indian-consumers-still-struggle-to-be-recognised-twilio" }],
          },
          {
            value: "500K+",
            label: "job seekers a year are placed in India through Vahan, using a voice AI recruiter.",
            sources: [{ name: "NITI Frontier Tech", url: "https://frontiertech.niti.gov.in/story/voice-ai-at-scale-powering-half-a-million-jobs-a-year-in-india/" }],
          },
          {
            value: "2M",
            label: "minutes of partner support automated by Urban Company with voice AI.",
            sources: [{ name: "ElevenLabs", url: "https://elevenlabs.io/webinars/behind-the-agent-how-urban-company-automated-2m-minutes-of-partner-support" }],
          },
        ],
      },
    ],
    closer: "Indian-language speech models, sub-second replies and low per-minute costs now make a phone call a real interface, not a fallback.",
  },

  sides: {
    heading: ["Built for", "both sides"],
    groups: [
      {
        title: "For customers",
        rows: [
          ["One call", "instead of five"],
          ["Real rates", "before anyone arrives"],
          ["Your choice", "speed, price or quality"],
          ["Works on", "any phone"],
          ["The app", "another way to book and manage jobs"],
        ],
      },
      {
        title: "For workers",
        rows: [
          ["Jobs", "come to their area"],
          ["The app", "another way to manage their work"],
          ["Their own rate", "no bargaining"],
          ["Calls", "short and respectful"],
          ["Customer’s address and number", "shared only after booking"],
        ],
      },
    ],
  },

  hood: {
    heading: ["Under the", "hood"],
    flow: [
      "Phone call",
      "Bolna voice agent (Sarvam voice, Hindi/Hinglish)",
      "Job card",
      "Worker voice agent",
      "Quotes",
      "WhatsApp shortlist",
      "Web app booking",
    ],
    metrics: [
      { value: "~90 sec", label: "customer call" },
      { value: "<0.5 sec", label: "agent reply time" },
      { value: "~Rs 8", label: "per customer call" },
      { value: "2", label: "voice agents: customer + worker" },
    ],
  },

  compare: {
    heading: ["How Suvidha", "compares"],
    columns: ["Suvidha", "Booking apps", "Calling around", "Online quote sites"],
    rows: [
      { label: "App needed?", note: "*", marks: ["no", "yes", "no", "partly"] },
      { label: "Works in Hindi on a phone call?", marks: ["yes", "no", "yes", "partly"] },
      { label: "Compare rates upfront?", marks: ["yes", "partly", "no", "partly"] },
      { label: "Local workers you choose?", marks: ["yes", "no", "yes", "yes"] },
      { label: "Worker keeps fair earnings?", note: "†", marks: ["yes", "no", "yes", "partly"] },
    ] as { label: string; note?: string; marks: Mark[] }[],
    notes: [
      "* Not needed: a phone call and WhatsApp are enough. The Suvidha app is an alternative way to use and manage the platform.",
      "† Workers on Suvidha set their own rate.",
    ],
  },

  footer: {
    links: {
      webApp: "Try the app",
      listen: "Watch a real job",
      pitch: "Pitch video",
      github: "GitHub",
      call: "Call {PHONE_NUMBER}",
    },
    line: "Built for the Bolna Buildathon 2026.",
  },
};

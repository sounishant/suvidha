import { Nav } from "@/components/Nav";
import { Compare, Footer, Hero, Hood, How, Problem, Sides, TryAndListen, Why } from "@/components/Sections";
import type { Links } from "@/lib/links";

const PHONE_NUMBER = "07965481722";
const HOW_IT_WORKS_VIDEO_URL = "/demo-suvidha.mp4";
const LISTEN_DEMO_URL = "[job registration recording URL]";
const WEB_APP_URL = "[Vercel app URL]";
const PITCH_VIDEO_URL = "[pitch video URL]";
const GITHUB_URL = "[repo URL]";

const links: Links = {
  phone: PHONE_NUMBER,
  howVideo: HOW_IT_WORKS_VIDEO_URL,
  listenDemo: LISTEN_DEMO_URL,
  webApp: WEB_APP_URL,
  pitch: PITCH_VIDEO_URL,
  github: GITHUB_URL,
};

export default function Page() {
  return (
    <>
      <Nav phone={links.phone} />
      <main>
        <Hero links={links} />
        <Problem />
        <How links={links} />
        <TryAndListen links={links} />
        <Why />
        <Sides />
        <Hood />
        <Compare />
      </main>
      <Footer links={links} />
    </>
  );
}

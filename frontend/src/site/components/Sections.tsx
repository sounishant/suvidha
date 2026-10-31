import { Logo } from "@/site/components/Logo";
import { Replay } from "@/site/components/Replay";
import { TryLive } from "@/site/components/TryLive";
import { copy, type Mark } from "@/site/content/copy";
import { isSet, telHref, withPhone, type Links } from "@/site/lib/links";

const SECTION = "border-b border-line";
const BODY = "frame py-16 md:py-24";
const HANDSET_PATH =
  "M109 83C97 71 83 86 73 97l-17 18c-13 14-17 34-10 52 26 69 79 123 148 149 18 7 38 3 52-10l18-17c14-13 15-35 1-49l-35-35c-13-13-34-14-48-2l-16 14c-29-16-53-41-69-70l14-16c12-14 11-35-2-48z";

function Heading({ parts }: { parts: string[] }) {
  return (
    <h2 data-reveal className="text-head">
      {parts[0]} <em className="text-accent-text">{parts[1]}</em>
    </h2>
  );
}

function CallButton({ phone, label, className = "btn-primary" }: { phone: string; label: string; className?: string }) {
  const text = withPhone(label, phone);
  if (!isSet(phone)) return <span className={`btn ${className}`}>{text}</span>;
  return (
    <a href={telHref(phone)} className={`btn ${className}`}>
      {text}
    </a>
  );
}

function Signal() {
  return (
    <div aria-hidden="true" className="flex h-9 items-center justify-center lg:h-auto lg:w-14">
      <div className="relative h-full w-0 border-l-2 border-dashed border-accent/35 lg:h-0 lg:w-full lg:border-t-2 lg:border-l-0">
        <span className="signal absolute top-1/2 size-2.5 rounded-full bg-accent lg:top-0" />
      </div>
    </div>
  );
}

function Stage() {
  const { call, workers, result } = copy.hero.stage;
  return (
    <div data-reveal className="rounded-stage bg-tint p-4 sm:p-8 lg:p-10">
      <div className="flex flex-col lg:grid lg:grid-cols-[1fr_auto_1.15fr_auto_1fr]">
        <div className="rounded-card bg-card p-6">
          <span className="flex size-11 items-center justify-center rounded-full bg-accent">
            <svg aria-hidden="true" viewBox="30 60 260 270" className="size-5 fill-white">
              <path d={HANDSET_PATH} />
            </svg>
          </span>
          <p className="mt-5 text-title font-semibold tracking-[-0.02em]">{call.title}</p>
          <p className="mt-1 text-muted">{call.body}</p>
        </div>

        <Signal />

        <div className="rounded-card bg-card p-6">
          <p className="text-title leading-tight font-semibold tracking-[-0.02em]">{workers.title}</p>
          <ul className="mt-4 space-y-2">
            {workers.trades.map((trade) => (
              <li key={trade} className="flex items-center gap-3 rounded-xl bg-tint px-4 py-2.5 font-medium">
                <span aria-hidden="true" className="size-2 rounded-full bg-accent-text" />
                {trade}
              </li>
            ))}
          </ul>
        </div>

        <Signal />

        <div className="rounded-card bg-accent p-6 text-white">
          <span className="flex size-11 items-center justify-center rounded-full bg-white">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 fill-none stroke-accent stroke-2 [stroke-linecap:round] [stroke-linejoin:round]">
              <path d="M21 12a8.5 8.5 0 0 1-12.6 7.4L3 21l1.6-5.4A8.5 8.5 0 1 1 21 12z" />
            </svg>
          </span>
          <p className="mt-5 text-title leading-tight font-semibold tracking-[-0.02em]">{result.title}</p>
          <p className="mt-1 opacity-85">{result.body}</p>
        </div>
      </div>
    </div>
  );
}

export function Hero({ links }: { links: Links }) {
  const { headline, sub, primary, strip } = copy.hero;
  return (
    <section id="top" className={SECTION}>
      <div className="frame pt-12 pb-6 md:pt-20 md:pb-10">
        <div className="grid items-end gap-8 lg:grid-cols-[7fr_5fr] lg:gap-12">
          <h1 data-reveal className="text-display">
            <span className="block">{headline[0]}</span>
            <span className="block">{headline[1]}</span>
            <em className="block text-accent-text">{headline[2]}</em>
          </h1>
          <div data-reveal>
            <p className="text-lead leading-relaxed text-muted">{sub}</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <CallButton phone={links.phone} label={primary} />
            </div>
          </div>
        </div>
        <div className="mt-10 md:mt-14">
          <Stage />
        </div>
        <p className="mt-6 text-center text-small text-muted">{strip}</p>
      </div>
    </section>
  );
}

export function Problem() {
  const { heading, cards, bridge } = copy.problem;
  return (
    <section id="problem" className={SECTION}>
      <div className={BODY}>
        <Heading parts={heading} />
        <div className="mt-10 grid gap-4 md:mt-14 lg:grid-cols-3">
          {cards.map((card) => (
            <div key={card.title} data-reveal className="rounded-card border border-line bg-card p-6 sm:p-7">
              <h3 className="text-title leading-tight font-semibold tracking-[-0.02em]">{card.title}</h3>
              <ul className="mt-5 space-y-3">
                {card.points.map((point) => (
                  <li key={point} className="flex gap-3 text-muted">
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="mt-1 size-4 shrink-0 fill-none stroke-accent-text stroke-[2.5] [stroke-linecap:round]">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p data-reveal className="mt-4 rounded-card bg-panel p-6 text-lead leading-snug font-medium text-white sm:p-8">
          {bridge}
        </p>
      </div>
    </section>
  );
}

type MediaProps = { url: string; title: string; empty: string; poster?: string; onTint?: boolean };

// Takes an audio file, a video file or an embed URL. A bracketed placeholder shows the empty state.
function Media({ url, title, empty, poster, onTint = false }: MediaProps) {
  if (!isSet(url)) {
    return (
      <div className={`flex aspect-video items-center justify-center rounded-stage ${onTint ? "bg-card" : "bg-tint"}`}>
        <span className="flex items-center gap-3 font-medium">
          <span className="flex size-14 items-center justify-center rounded-full bg-accent">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="ml-0.5 size-6 fill-white">
              <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z" />
            </svg>
          </span>
          {empty}
        </span>
      </div>
    );
  }
  if (/\.(mp3|m4a|wav|ogg)$/.test(url)) {
    return <audio src={url} aria-label={title} controls preload="none" className="w-full" />;
  }
  if (url.endsWith(".mp4")) {
    return (
      <video
        src={url}
        poster={poster}
        aria-label={title}
        controls
        playsInline
        preload="none"
        className="aspect-video w-full rounded-stage bg-tint"
      />
    );
  }
  return (
    <iframe
      src={url}
      title={title}
      loading="lazy"
      allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
      allowFullScreen
      className="aspect-video w-full rounded-stage bg-tint"
    />
  );
}

export function How({ links }: { links: Links }) {
  const { heading, steps, videoCaption, videoTitle, videoEmpty, videoPoster } = copy.how;
  return (
    <section id="how" className={SECTION}>
      <div className={BODY}>
        <Heading parts={heading} />
        <div className="mt-10 grid items-start gap-10 md:mt-14 lg:grid-cols-[5fr_7fr] lg:gap-14">
          <ol>
            {steps.map((step, i) => (
              <li key={step.title} data-reveal className="flex gap-4 border-t border-line py-5 first:border-t-0 first:pt-0">
                <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-tint text-small font-semibold text-accent-text">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-semibold">{step.title}</h3>
                  <p className="mt-0.5 text-muted">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <figure data-reveal className="lg:sticky lg:top-24">
            <Media url={links.howVideo} title={videoTitle} empty={videoEmpty} poster={videoPoster} />
            <figcaption className="mt-3 text-small text-muted">{videoCaption}</figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}

export function TryAndListen({ links }: { links: Links }) {
  const { tryLive, listen } = copy;
  return (
    <>
      <section id="try" className={SECTION}>
        <div className={BODY}>
          <Heading parts={tryLive.heading} />
          <p data-reveal className="mt-4 max-w-2xl text-lead leading-snug text-muted">
            {tryLive.body}
          </p>
          <div className="mt-10 md:mt-14">
            <TryLive api={links.demoApi} />
          </div>
        </div>
      </section>
      <section id="listen" className={SECTION}>
        <div className={BODY}>
          <Heading parts={listen.heading} />
          <p data-reveal className="mt-4 max-w-2xl text-lead leading-snug text-muted">
            {listen.body}
          </p>
          <div className="mt-10 md:mt-14">
            <Replay />
          </div>
        </div>
      </section>
    </>
  );
}

function SourceLink({ name, url }: { name: string; url: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="text-small text-muted underline decoration-line underline-offset-4 hover:text-ink">
      {name}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

export function Why() {
  const { heading, blocks, closer } = copy.why;
  return (
    <section id="why" className={SECTION}>
      <div className={BODY}>
        <Heading parts={heading} />
        <div className="mt-10 md:mt-14">
          {blocks.map((block) => (
            <div key={block.title} className="border-t border-line py-8 md:py-10">
              <h3 data-reveal className="font-semibold">
                {block.title}
              </h3>
              <div className={`mt-6 grid gap-x-10 gap-y-8 sm:grid-cols-2 ${{ 2: "lg:grid-cols-2", 3: "lg:grid-cols-3", 4: "lg:grid-cols-4" }[block.stats.length]}`}>
                {block.stats.map((stat) => (
                  <div key={stat.value} data-reveal>
                    <p className="text-figure leading-none font-normal tracking-[-0.04em] text-accent-text tabular-nums">{stat.value}</p>
                    <p className="mt-3 text-muted">{stat.label}</p>
                    <p className="mt-2 flex flex-wrap gap-x-3">
                      {stat.sources.map((source) => (
                        <SourceLink key={source.url} {...source} />
                      ))}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p data-reveal className="rounded-card bg-tint p-6 text-lead leading-snug font-medium sm:p-8">
          <em>{closer}</em>
        </p>
      </div>
    </section>
  );
}

export function Sides() {
  const { heading, groups } = copy.sides;
  return (
    <section id="sides" className={SECTION}>
      <div className={BODY}>
        <Heading parts={heading} />
        <div className="mt-10 grid overflow-hidden rounded-card border border-line md:mt-14 md:grid-cols-2">
          {groups.map((group, g) => (
            <div key={group.title} data-reveal className={`p-6 sm:p-8 ${g > 0 ? "border-t border-line md:border-t-0 md:border-l" : ""}`}>
              <h3 className="text-title font-semibold tracking-[-0.02em]">{group.title}</h3>
              <dl className="mt-4">
                {group.rows.map(([name, value]) => (
                  <div key={name} className="border-t border-line py-3 first:border-t-0">
                    <dt className="font-semibold">{name}</dt>
                    <dd className="text-muted">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Hood() {
  const { heading, flow, metrics } = copy.hood;
  return (
    <section id="hood" className={SECTION}>
      <div className={BODY}>
        <div className="rounded-stage bg-panel p-6 text-white sm:p-10 lg:p-14">
          <h2 data-reveal className="text-head">
            {heading[0]} <em>{heading[1]}</em>
          </h2>
          <ol data-reveal className="mt-8 flex flex-wrap items-center gap-x-2 gap-y-2">
            {flow.map((step, i) => (
              <li key={step} className="flex items-center gap-2">
                {i > 0 && (
                  <span aria-hidden="true" className="opacity-60">
                    →
                  </span>
                )}
                <span className="rounded-full bg-white/10 px-3.5 py-1.5 text-small font-medium">{step}</span>
              </li>
            ))}
          </ol>
          <dl className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-card bg-white/15 lg:grid-cols-4">
            {metrics.map((metric) => (
              <div key={metric.label} data-reveal className="flex flex-col-reverse justify-end bg-[#0c1d40] p-5 sm:p-6">
                <dt className="mt-2 text-small opacity-75">{metric.label}</dt>
                <dd className="text-[clamp(1.75rem,1.3rem+1.8vw,2.75rem)] leading-none tracking-[-0.03em] tabular-nums">{metric.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}

function MarkCell({ mark }: { mark: Mark }) {
  if (mark === "partly") return <span className="text-muted">Partly</span>;
  return (
    <>
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className={`size-5 fill-none stroke-[2.5] [stroke-linecap:round] [stroke-linejoin:round] ${mark === "yes" ? "stroke-accent-text" : "stroke-muted"}`}
      >
        <path d={mark === "yes" ? "M4 13l5 6L20 5" : "M6 6l12 12M18 6L6 18"} />
      </svg>
      <span className="sr-only">{mark === "yes" ? "Yes" : "No"}</span>
    </>
  );
}

export function Compare() {
  const { heading, columns, rows, notes } = copy.compare;
  return (
    <section id="compare">
      <div className={BODY}>
        <Heading parts={heading} />
        <div
          data-reveal
          tabIndex={0}
          role="region"
          aria-label={heading.join(" ")}
          className="relative -mx-5 mt-10 overflow-x-auto px-5 sm:mx-0 sm:px-0 md:mt-14"
        >
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 bg-bg py-3 pr-4">
                  <span className="sr-only">Question</span>
                </th>
                {columns.map((column, i) => (
                  <th
                    key={column}
                    scope="col"
                    className={`px-4 py-3 align-bottom font-semibold ${i === 0 ? "rounded-t-card bg-accent text-white" : ""}`}
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => (
                <tr key={row.label} className="border-t border-line">
                  <th scope="row" className="sticky left-0 max-w-[11rem] bg-bg py-3.5 pr-4 font-medium">
                    {row.label}
                    {row.note}
                  </th>
                  {row.marks.map((mark, i) => (
                    <td key={columns[i]} className={`px-4 py-3.5 ${i === 0 ? `bg-tint ${r === rows.length - 1 ? "rounded-b-card" : ""}` : ""}`}>
                      <MarkCell mark={mark} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-5 text-small text-muted">
          {notes.map((note) => (
            <p key={note}>{note}</p>
          ))}
        </div>
      </div>
    </section>
  );
}

function FooterLink({ href, label }: { href: string; label: string }) {
  const style = "btn border border-white/30 text-white hover:bg-white/10";
  if (!isSet(href)) return <span className={style}>{label}</span>;
  // Sections and app pages open here; files such as the pitch video open in a new tab.
  if (href.startsWith("#") || (href.startsWith("/") && !/\.\w+$/.test(href))) {
    return (
      <a href={href} className={style}>
        {label}
      </a>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={style}>
      {label}
    </a>
  );
}

export function Footer({ links }: { links: Links }) {
  const { headline } = copy.hero;
  const { links: labels, line } = copy.footer;
  return (
    <footer>
      <div className="frame pb-8">
        <div className="rounded-stage bg-accent px-6 py-14 text-center text-white sm:px-10 md:py-20">
          <p data-reveal className="text-head leading-[1.05] font-medium tracking-[-0.035em]">
            <span className="block sm:inline">{headline[0]}</span> <span className="block sm:inline">{headline[1]}</span>{" "}
            <em className="block sm:inline">{headline[2]}</em>
          </p>
          <div data-reveal className="mt-8 flex flex-col justify-center gap-3 sm:flex-row sm:flex-wrap">
            <CallButton phone={links.phone} label={labels.call} className="bg-white font-semibold !text-[#1b4fd1] hover:bg-[#e3ecff]" />
            <FooterLink href={links.webApp} label={labels.webApp} />
            <FooterLink href="#listen" label={labels.listen} />
            <FooterLink href={links.pitch} label={labels.pitch} />
            <FooterLink href={links.github} label={labels.github} />
          </div>
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <Logo />
          <p className="text-small text-muted">{line}</p>
        </div>
      </div>
    </footer>
  );
}

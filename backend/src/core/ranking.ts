export type Priority = "speed" | "price" | "quality";
export const PRIORITIES: Priority[] = ["speed", "price", "quality"];

export type QuoteForRanking = {
  id: string;
  available: boolean | null;
  priceType: "fixed" | "range" | "visit_only" | null;
  priceMin: number | null;
  priceMax: number | null;
  earliestArrival: Date | null;
  rating: number | null;
  ratedJobs: number;
  distanceKm: number | null;
  quotedAt: Date;
  materialIncluded: "yes" | "no" | "partly" | null;
};

export type RankRequest = {
  priorities: Priority[];
  budgetInr: number | null;
  windowEnd: Date | null;
  customerExpectsMaterial: boolean;
};

export type Measure = Priority;
export type RankedQuote = {
  id: string;
  group: "ranked" | "visit" | "later";
  rank: number;
  score: number | null;
  measures: Record<Measure, number> | null;
  // The measure that added most to the score; the reason line is written from it.
  lead: Measure | null;
  labels: ("above_budget" | "material_extra" | "after_window")[];
};

const TIE = 0.05;
const OVER_BUDGET_PENALTY = 0.2;
const NEW_WORKER_QUALITY = 0.5;
const MIN_RATED_JOBS = 3;

export function weightsFor(priorities: Priority[]): Record<Priority, number> {
  const order = [...new Set(priorities)];
  if (order.length === 0) return { speed: 1 / 3, price: 1 / 3, quality: 1 / 3 };
  // Only the first priority known: the other two share the rest equally.
  if (order.length === 1) return Object.fromEntries(PRIORITIES.map((p) => [p, p === order[0] ? 0.6 : 0.2])) as Record<Priority, number>;
  const rest = PRIORITIES.filter((p) => !order.includes(p));
  const full = [...order, ...rest];
  return { [full[0]!]: 0.6, [full[1]!]: 0.3, [full[2]!]: 0.1 } as Record<Priority, number>;
}

export function priceOf(q: Pick<QuoteForRanking, "priceMin" | "priceMax">) {
  const min = q.priceMin ?? q.priceMax!;
  const max = q.priceMax ?? q.priceMin!;
  return (min + max) / 2;
}

// Best on this job's quotes gets 1, worst 0; a single quote, or all equal, gets 1.
function scale(values: number[], higherIsBetter: boolean) {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  return values.map((v) => (hi === lo ? 1 : higherIsBetter ? (v - lo) / (hi - lo) : (hi - v) / (hi - lo)));
}

export function rankQuotes(quotes: QuoteForRanking[], req: RankRequest): RankedQuote[] {
  const offered = quotes.filter((q) => q.available === true && q.priceType !== null);
  const visit = offered.filter((q) => q.priceType === "visit_only");
  const priced = offered.filter((q) => q.priceType !== "visit_only");
  const late = priced.filter((q) => req.windowEnd && q.earliestArrival && q.earliestArrival > req.windowEnd);
  const inWindow = priced.filter((q) => !late.includes(q));

  const weights = weightsFor(req.priorities);
  const farFuture = Number.MAX_SAFE_INTEGER;
  const speed = scale(inWindow.map((q) => -(q.earliestArrival?.getTime() ?? farFuture)), true);
  const price = scale(inWindow.map(priceOf), false);
  const established = inWindow.filter((q) => q.ratedJobs >= MIN_RATED_JOBS);
  const qualityScaled = scale(established.length ? established.map((q) => q.rating ?? 0) : [0], true);

  const labelsFor = (q: QuoteForRanking): RankedQuote["labels"] => [
    ...(req.budgetInr !== null && q.priceType !== "visit_only" && priceOf(q) > req.budgetInr ? (["above_budget"] as const) : []),
    ...(req.customerExpectsMaterial && (q.materialIncluded === "no" || q.materialIncluded === "partly") ? (["material_extra"] as const) : []),
  ];

  const scored = inWindow.map((q, i) => {
    const quality = q.ratedJobs >= MIN_RATED_JOBS ? qualityScaled[established.indexOf(q)]! : NEW_WORKER_QUALITY;
    const measures = { speed: speed[i]!, price: price[i]!, quality };
    const labels = labelsFor(q);
    const contributions = PRIORITIES.map((m) => [m, measures[m] * weights[m]] as const);
    const raw = contributions.reduce((sum, [, c]) => sum + c, 0);
    const lead = contributions.reduce((best, c) => (c[1] > best[1] ? c : best))[0];
    return { q, measures, labels, lead, score: raw - (labels.includes("above_budget") ? OVER_BUDGET_PENALTY : 0) };
  });

  // Scores within 0.05 of the top of their cluster count as tied: closer worker first, then whoever quoted first.
  scored.sort((a, b) => b.score - a.score);
  const ordered: typeof scored = [];
  for (let i = 0; i < scored.length; ) {
    let j = i + 1;
    while (j < scored.length && scored[i]!.score - scored[j]!.score <= TIE + 1e-9) j++;
    const cluster = scored.slice(i, j).sort(
      (a, b) =>
        (a.q.distanceKm ?? Infinity) - (b.q.distanceKm ?? Infinity) || a.q.quotedAt.getTime() - b.q.quotedAt.getTime(),
    );
    ordered.push(...cluster);
    i = j;
  }

  const byArrival = (a: QuoteForRanking, b: QuoteForRanking) =>
    (a.earliestArrival?.getTime() ?? farFuture) - (b.earliestArrival?.getTime() ?? farFuture);
  return [
    ...ordered.map((s) => ({ id: s.q.id, group: "ranked" as const, score: s.score, measures: s.measures, lead: s.lead, labels: s.labels })),
    ...visit.sort((a, b) => a.quotedAt.getTime() - b.quotedAt.getTime())
      .map((q) => ({ id: q.id, group: "visit" as const, score: null, measures: null, lead: null, labels: labelsFor(q) })),
    ...late.sort(byArrival)
      .map((q) => ({ id: q.id, group: "later" as const, score: null, measures: null, lead: null, labels: [...labelsFor(q), "after_window" as const] })),
  ].map((r, i) => ({ ...r, rank: i + 1 }));
}

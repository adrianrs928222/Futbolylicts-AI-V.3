import { competitionCategory, isExcludedFixture, isPreferredOfficialCompetition } from "@/lib/config/competitions";
import { getFixturesByDate, getFixtureTeamStatistics, getRecentTeamFixtures } from "@/lib/providers/apiFootball";
import type { Fixture } from "@/lib/engine/types";

type MetricKey = "cards" | "corners" | "shotsOnTarget" | "shots";
type Outcome = "HOME" | "DRAW" | "AWAY";

export interface MajorNumberMarket {
  metric: MetricKey;
  label: string;
  homeProbability: number;
  drawProbability: number;
  awayProbability: number;
  prediction: Outcome;
  predictionLabel: string;
  probability: number;
  estimatedOdds: number;
  score: number;
  homeAverage: number;
  awayAverage: number;
  sampleHome: number;
  sampleAway: number;
  edge: number;
  intelligenceScore: number;
  reasoning: string;
  source: "API-Football";
  homeTotal: number;
  awayTotal: number;
}

export interface MajorNumberFixture {
  fixtureId: number;
  fixtureLabel: string;
  leagueName: string;
  category: string;
  kickoff: string;
  home: { id: number; name: string; logo?: string | null };
  away: { id: number; name: string; logo?: string | null };
  markets: MajorNumberMarket[];
  best: MajorNumberMarket | null;
}

export interface MajorNumberComboPick {
  fixtureId: number;
  fixtureLabel: string;
  leagueName: string;
  market: MetricKey;
  marketLabel: string;
  selection: string;
  probability: number;
  estimatedOdds: number;
  score: number;
  intelligenceScore: number;
  reasoning: string;
  source: "API-Football";
  homeTotal: number;
  awayTotal: number;
}

export interface MajorNumberAnalysis {
  date: string;
  generatedAt: string;
  fixtures: MajorNumberFixture[];
  combo: { picks: MajorNumberComboPick[]; totalOdds: number; globalProbability: number; score: number };
  note: string;
  warnings: string[];
}

const LABELS: Record<MetricKey, string> = {
  cards: "Tarjetas",
  corners: "Córners",
  shotsOnTarget: "Remates a puerta",
  shots: "Remates",
};
const METRICS: MetricKey[] = ["cards", "corners", "shotsOnTarget", "shots"];

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function mean(values: number[]) { return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0; }
function variance(values: number[], avg: number) { return values.length > 1 ? values.reduce((a, v) => a + (v - avg) ** 2, 0) / (values.length - 1) : Math.max(1, avg * .5); }

function probabilities(homeValues: number[], awayValues: number[]) {
  const hm = mean(homeValues), am = mean(awayValues);
  const hv = variance(homeValues, hm), av = variance(awayValues, am);
  const spread = Math.sqrt(Math.max(.8, hv + av));
  const z = (hm - am) / spread;
  // Probabilidad base de superioridad, suavizada para no vender falsa precisión.
  const homeEdge = 1 / (1 + Math.exp(-1.15 * z));
  const closeness = Math.exp(-Math.abs(z) * 1.7);
  const draw = clamp(.07 + .18 * closeness, .06, .25);
  const remaining = 1 - draw;
  const home = clamp(homeEdge * remaining, .08, .84);
  const away = remaining - home;
  return { home, draw, away, hm, am };
}

function scoreFromProbability(p: number, samples: number) {
  return clamp(5.8 + (p - .45) * 10 + Math.min(1.0, samples * .10), 5.5, 9.4);
}
function estimatedOdds(probability: number) {
  const p = clamp(.5 + (probability - .5) * .78, .20, .82);
  return clamp(1 / (p * 1.055), 1.18, 4.50);
}

function stability(values: number[]) {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const sd = Math.sqrt(variance(values, avg));
  const cv = avg > .2 ? sd / avg : sd;
  return clamp(1 - cv / 1.15, 0, 1);
}

function smartMarketQuality(probability: number, secondProbability: number, homeValues: number[], awayValues: number[]) {
  const edge = Math.max(0, probability - secondProbability);
  const sample = Math.min(homeValues.length, awayValues.length);
  const sampleQuality = clamp((sample - 2) / 3, 0, 1);
  const stable = (stability(homeValues) + stability(awayValues)) / 2;
  const confidence = clamp((probability - .45) / .37, 0, 1);
  const edgeQuality = clamp(edge / .28, 0, 1);
  const quality = 10 * (.42 * confidence + .28 * edgeQuality + .18 * stable + .12 * sampleQuality);
  return { edge, intelligenceScore: clamp(quality, 0, 10), stable, sample };
}

async function teamMetricHistory(teamId: number, recent: Awaited<ReturnType<typeof getRecentTeamFixtures>>, maxMatches: number) {
  const values: Record<MetricKey, number[]> = { cards: [], corners: [], shotsOnTarget: [], shots: [] };
  for (const item of recent.slice(0, maxMatches)) {
    try {
      const stats = await getFixtureTeamStatistics(item.fixture.id);
      const row = stats.find((s) => s.teamId === teamId);
      if (!row) continue;
      for (const metric of METRICS) {
        const v = row[metric];
        if (typeof v === "number" && Number.isFinite(v)) values[metric].push(v);
      }
    } catch {
      // Si se agota presupuesto o una competición no tiene stats, seguimos con lo disponible.
    }
  }
  return values;
}

function makeMarket(metric: MetricKey, homeName: string, awayName: string, homeValues: number[], awayValues: number[]): MajorNumberMarket | null {
  if (homeValues.length < 2 || awayValues.length < 2) return null;
  const p = probabilities(homeValues, awayValues);
  const ranked: Array<[Outcome, number]> = [["HOME", p.home], ["DRAW", p.draw], ["AWAY", p.away]];
  ranked.sort((a, b) => b[1] - a[1]);
  const [prediction, probability] = ranked[0];
  const secondProbability = ranked[1]?.[1] ?? 0;
  const smart = smartMarketQuality(probability, secondProbability, homeValues, awayValues);
  const predictionLabel = prediction === "HOME" ? homeName : prediction === "AWAY" ? awayName : "Empate";
  const score = clamp(scoreFromProbability(probability, smart.sample) * .72 + smart.intelligenceScore * .28, 5.5, 9.6);
  const reasoning = `Probabilidad ${Math.round(probability * 100)}%, ventaja de ${Math.round(smart.edge * 100)} puntos sobre la segunda opción, ${smart.sample} partidos útiles por equipo y estabilidad ${Math.round(smart.stable * 100)}%.`;
  return {
    metric, label: LABELS[metric], homeProbability: p.home, drawProbability: p.draw, awayProbability: p.away,
    prediction, predictionLabel, probability, estimatedOdds: estimatedOdds(probability),
    score,
    homeAverage: p.hm, awayAverage: p.am, sampleHome: homeValues.length, sampleAway: awayValues.length,
    edge: smart.edge, intelligenceScore: smart.intelligenceScore, reasoning,
    source: "API-Football",
    homeTotal: homeValues.reduce((a, b) => a + b, 0),
    awayTotal: awayValues.reduce((a, b) => a + b, 0),
  };
}

function prematch(f: Fixture) { return ["NS", "TBD"].includes(f.status); }

export async function buildMajorNumberAnalysis(date: string): Promise<MajorNumberAnalysis> {
  const warnings: string[] = [];
  const all = await getFixturesByDate(date);
  const fixtures = all.filter((f) => prematch(f) && !isExcludedFixture(f) && isPreferredOfficialCompetition(f));
  const maxFixtures = Math.max(1, Number(process.env.MAJOR_NUMBER_MAX_FIXTURES ?? 12));
  const historyMatches = Math.max(2, Math.min(5, Number(process.env.MAJOR_NUMBER_HISTORY_MATCHES ?? 3)));
  const selected = fixtures.slice(0, maxFixtures);
  const output: MajorNumberFixture[] = [];

  for (const fixture of selected) {
    try {
      // last=8 coincide con el motor principal, por lo que normalmente reutiliza su misma caché.
      const [homeRecent, awayRecent] = await Promise.all([
        getRecentTeamFixtures(fixture.home.id, 8),
        getRecentTeamFixtures(fixture.away.id, 8),
      ]);
      const [home, away] = await Promise.all([
        teamMetricHistory(fixture.home.id, homeRecent, historyMatches),
        teamMetricHistory(fixture.away.id, awayRecent, historyMatches),
      ]);
      const markets = METRICS.map((metric) => makeMarket(metric, fixture.home.name, fixture.away.name, home[metric], away[metric])).filter(Boolean) as MajorNumberMarket[];
      const best = [...markets].sort((a, b) => b.intelligenceScore - a.intelligenceScore || b.score - a.score || b.probability - a.probability)[0] ?? null;
      output.push({
        fixtureId: fixture.id,
        fixtureLabel: `${fixture.home.name} – ${fixture.away.name}`,
        leagueName: fixture.league.name,
        category: competitionCategory(fixture.league.name),
        kickoff: fixture.date,
        home: fixture.home,
        away: fixture.away,
        markets,
        best,
      });
    } catch (error) {
      warnings.push(`${fixture.home.name} – ${fixture.away.name}: ${error instanceof Error ? error.message : "sin datos suficientes"}`);
    }
  }

  const comboCandidates: MajorNumberComboPick[] = output.flatMap((fixture) => fixture.best && fixture.best.probability >= .58 && fixture.best.score >= 7.2 && fixture.best.intelligenceScore >= 6.0 && fixture.best.edge >= .08 ? [{
    fixtureId: fixture.fixtureId,
    fixtureLabel: fixture.fixtureLabel,
    leagueName: fixture.leagueName,
    market: fixture.best.metric,
    marketLabel: `Mayor número de ${fixture.best.label.toLowerCase()}`,
    selection: fixture.best.predictionLabel,
    probability: fixture.best.probability,
    estimatedOdds: fixture.best.estimatedOdds,
    score: fixture.best.score,
    intelligenceScore: fixture.best.intelligenceScore,
    reasoning: fixture.best.reasoning,
    source: fixture.best.source,
    homeTotal: fixture.best.homeTotal,
    awayTotal: fixture.best.awayTotal,
  }] : []).sort((a, b) => b.intelligenceScore - a.intelligenceScore || b.score - a.score || b.probability - a.probability);
  const picks = comboCandidates.slice(0, 5);
  const totalOdds = picks.reduce((acc, p) => acc * p.estimatedOdds, 1);
  const globalProbability = picks.length ? Math.pow(picks.reduce((acc, p) => acc * p.probability, 1), 1 / picks.length) : 0;
  const score = picks.length ? picks.reduce((a, p) => a + p.score, 0) / picks.length : 0;

  return {
    date,
    generatedAt: new Date().toISOString(),
    fixtures: output,
    combo: { picks, totalOdds, globalProbability, score },
    note: "Módulo independiente del motor principal. Fuente estadística: API-Football. Si no hay al menos 2 partidos con estadísticas válidas por equipo, el mercado no se publica. La elección no se hace solo por la probabilidad: pondera ventaja frente a la segunda opción, tamaño de muestra, estabilidad de las estadísticas y score. Usa la infraestructura existente de API-Football, presupuesto y caché; no cambia la lógica de la Combinada del Día.",
    warnings,
  };
}

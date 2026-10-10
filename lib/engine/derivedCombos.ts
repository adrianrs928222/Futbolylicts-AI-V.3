import { compareIntelligentCandidates } from "@/lib/engine/scoring";
import type { Confidence, DerivedCombo, LeagueCombo, MarketCandidate } from "@/lib/engine/types";

const MIN_PROBABILITY = 0.70;
const MIN_SCORE = 8.0;
const MIN_ODDS = 1.25;
const MAX_ODDS = 1.90;
const MAX_BTTS_ODDS = 3.20;
const RISK_BTTS_MIN_PROBABILITY = 0.60;
const RISK_BTTS_MIN_SCORE = 7.5;

function round2(value: number) { return Math.round(value * 100) / 100; }
function round4(value: number) { return Math.round(value * 10000) / 10000; }

function confidence(score: number): Confidence {
  if (score >= 9) return "MUY_ALTA";
  if (score >= 8) return "ALTA";
  if (score >= 7.5) return "MEDIA_ALTA";
  if (score >= 7) return "MEDIA";
  return "BAJA";
}

function eligible(candidate: MarketCandidate) {
  return candidate.probability >= MIN_PROBABILITY &&
    candidate.score >= MIN_SCORE &&
    candidate.odds >= MIN_ODDS &&
    candidate.odds <= MAX_ODDS;
}

// La COMBINADA BTTS prioriza calidad estadística. No exige una cuota mínima BTTS,
// porque una probabilidad muy alta produce una cuota EST. más baja y antes eso
// expulsaba precisamente los BTTS más fiables. El filtro de cuota del motor
// principal se mantiene intacto para la Combinada del Día.
// Si el BTTS mantiene ALTA/MUY ALTA confianza, se admite una cuota de hasta @3.00.
function eligibleBtts(candidate: MarketCandidate) {
  if (candidate.market !== "BTTS_YES" || candidate.odds < 1.66 || candidate.odds > MAX_BTTS_ODDS) return false;
  // BTTS tiene dos niveles: núcleo fuerte y riesgo controlado. Una cuota @2.00
  // no se descarta por precio si el perfil de goles sigue siendo convincente.
  const strong = candidate.probability >= MIN_PROBABILITY && candidate.score >= MIN_SCORE;
  const controlledRisk = candidate.probability >= RISK_BTTS_MIN_PROBABILITY && candidate.score >= RISK_BTTS_MIN_SCORE;
  return strong || controlledRisk;
}

function bttsRiskTier(candidate: MarketCandidate) {
  return candidate.probability >= MIN_PROBABILITY && candidate.score >= MIN_SCORE ? 0 : 1;
}

function bestPerFixture(candidates: MarketCandidate[]) {
  const byFixture = new Map<number, MarketCandidate[]>();
  for (const candidate of candidates.filter(eligible)) {
    const list = byFixture.get(candidate.fixtureId) ?? [];
    list.push(candidate);
    byFixture.set(candidate.fixtureId, list);
  }
  return [...byFixture.values()]
    .map((list) => [...list].sort(compareIntelligentCandidates)[0])
    .filter((candidate): candidate is MarketCandidate => Boolean(candidate))
    .sort(compareIntelligentCandidates);
}

function summarize(picks: MarketCandidate[]) {
  const totalOdds = picks.reduce((acc, pick) => acc * pick.odds, 1);
  const globalProbability = picks.reduce((acc, pick) => acc * pick.probability, 1);
  const globalScore = picks.length
    ? picks.reduce((acc, pick) => acc + pick.score, 0) / picks.length
    : 0;
  return {
    totalOdds: round2(totalOdds),
    globalProbability: round4(globalProbability),
    globalScore: round2(globalScore),
    globalConfidence: confidence(globalScore),
  };
}

/**
 * COMBINADA BTTS derivada exclusivamente de candidatos ya calculados.
 * No hace fetch, no toca caché, no consulta Supabase y no modifica el análisis base.
 */
export function buildBttsCombo(candidates: MarketCandidate[]): DerivedCombo {
  const byFixture = new Map<number, MarketCandidate[]>();
  for (const candidate of candidates.filter(eligibleBtts)) {
    const list = byFixture.get(candidate.fixtureId) ?? [];
    list.push(candidate);
    byFixture.set(candidate.fixtureId, list);
  }

  const picks = [...byFixture.values()]
    .map((list) => [...list].sort(compareIntelligentCandidates)[0])
    .filter((candidate): candidate is MarketCandidate => Boolean(candidate))
    .sort((a, b) => bttsRiskTier(a) - bttsRiskTier(b) || compareIntelligentCandidates(a, b))
    .slice(0, 6)
    .map((candidate) => bttsRiskTier(candidate) === 0 ? candidate : ({
      ...candidate,
      reasoning: `${candidate.reasoning} RIESGO CONTROLADO: entra porque el perfil BTTS sigue cuadrando aunque no alcance el corte fuerte.`,
      riskNote: `RIESGO CONTROLADO · ${candidate.riskNote}`,
    }));

  const stats = summarize(picks);
  const available = picks.length >= 2;
  return {
    key: "btts",
    title: "COMBINADA BTTS",
    picks,
    ...stats,
    available,
    message: available
      ? `Agrupación BTTS con núcleo fuerte + riesgos controlados cuando el modelo los respalda. ${picks.length} partidos; una cuota alta por sí sola no descarta el BTTS.`
      : picks.length === 1
        ? "Hay 1 BTTS de alta confianza hoy. Se muestra como candidato, pero hacen falta 2 para formar una combinada."
        : "No existen escenarios BTTS de alta confianza para esta jornada.",
  };
}

/**
 * Construye una combinada independiente por liga reutilizando solo el pool de
 * candidatos existente. No hay llamadas a proveedores ni lecturas/escrituras de caché.
 */
export function buildLeagueCombos(candidates: MarketCandidate[]): LeagueCombo[] {
  const byLeague = new Map<string, MarketCandidate[]>();
  for (const candidate of candidates) {
    const leagueName = candidate.leagueName?.trim();
    if (!leagueName) continue;
    const list = byLeague.get(leagueName) ?? [];
    list.push(candidate);
    byLeague.set(leagueName, list);
  }

  return [...byLeague.entries()]
    .map(([leagueName, leagueCandidates]) => {
      const ranked = bestPerFixture(leagueCandidates);
      // Cada liga usa de 2 a 5 encuentros. Una sola selección por fixture.
      const picks = ranked.slice(0, 5);
      const usable = picks.length >= 2 ? picks : [];
      const stats = summarize(usable);
      return {
        key: `league:${leagueName}`,
        title: leagueName,
        leagueName,
        picks: usable,
        ...stats,
        available: usable.length >= 2,
        message: usable.length >= 2
          ? `${usable.length} selecciones ALTA/MUY ALTA obtenidas del análisis ya realizado.`
          : "No hay al menos dos selecciones de alta confianza en esta liga.",
      } satisfies LeagueCombo;
    })
    .filter((combo) => combo.available)
    .sort((a, b) => b.globalScore - a.globalScore || b.globalProbability - a.globalProbability || a.leagueName.localeCompare(b.leagueName));
}

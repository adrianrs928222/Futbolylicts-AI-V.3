import { FUTBOLYLICTS_RULES } from "@/lib/config/rules";
import type { DailyCombo, MarketCandidate } from "@/lib/engine/types";

interface State {
  picks: MarketCandidate[];
  totalOdds: number;
  borderlineCount: number;
  scoreSum: number;
  probabilitySum: number;
  combinedProbability: number;
}

function round2(v: number) {
  return Math.round(v * 100) / 100;
}

function round4(v: number) {
  return Math.round(v * 10000) / 10000;
}

function isUsefulOdds(odds: number) {
  return odds >= FUTBOLYLICTS_RULES.preferredOddsMin && odds <= FUTBOLYLICTS_RULES.preferredOddsMax;
}

function hasValueEdge(candidate: MarketCandidate) {
  const impliedProbability = 1 / Math.max(candidate.odds, 1.01);
  return candidate.probability >= impliedProbability + FUTBOLYLICTS_RULES.minValueEdge;
}

function isCore(candidate: MarketCandidate): boolean {
  return (
    candidate.score >= FUTBOLYLICTS_RULES.preferredCoreScoreMin &&
    candidate.probability >= FUTBOLYLICTS_RULES.preferredCoreProbabilityMin
  );
}

function isBorderline(candidate: MarketCandidate): boolean {
  return (
    candidate.score >= FUTBOLYLICTS_RULES.minScore &&
    candidate.probability >= FUTBOLYLICTS_RULES.minProbability &&
    !isCore(candidate)
  );
}

function borderlineHasExceptionalValue(candidate: MarketCandidate): boolean {
  return (
    candidate.probability >= FUTBOLYLICTS_RULES.borderlineMinProbability &&
    hasValueEdge(candidate)
  );
}

export function eligibleCandidates(candidates: MarketCandidate[]): MarketCandidate[] {
  return candidates.filter((candidate) => {
    if (candidate.score < FUTBOLYLICTS_RULES.minScore) return false;
    if (candidate.probability < FUTBOLYLICTS_RULES.minProbability) return false;
    if (!isUsefulOdds(candidate.odds)) return false;
    if (!hasValueEdge(candidate)) return false;
    if (candidate.market === "BTTS_YES" && candidate.odds < FUTBOLYLICTS_RULES.bttsMinOdds) return false;
    if (!candidate.realOdds && !FUTBOLYLICTS_RULES.allowEstimatedOddsInOfficialCombo) return false;
    return true;
  });
}

function oddsUsefulness(odds: number): number {
  if (
    odds >= FUTBOLYLICTS_RULES.preferredOddsSweetMin &&
    odds <= FUTBOLYLICTS_RULES.preferredOddsSweetMax
  ) {
    return 1;
  }

  const distance = odds < FUTBOLYLICTS_RULES.preferredOddsSweetMin
    ? FUTBOLYLICTS_RULES.preferredOddsSweetMin - odds
    : odds - FUTBOLYLICTS_RULES.preferredOddsSweetMax;
  return Math.max(0, 1 - distance / 0.25);
}

function candidateUtility(candidate: MarketCandidate): number {
  // La calidad manda claramente; la cuota solo resuelve empates cercanos.
  let utility = candidate.score * 14 + candidate.probability * 5;
  utility += oddsUsefulness(candidate.odds) * 0.9;
  utility += Math.log(candidate.odds) * 0.55;

  if (isCore(candidate)) utility += 1.15;
  if (isBorderline(candidate)) utility -= 1.5;

  // El 12 se considera de verdad cuando ya es ALTA; no se fuerza.
  if (candidate.market === "DOUBLE_CHANCE_12") utility += 0.12;

  // BTTS compite exactamente igual que el resto: puede repetirse si sigue siendo ALTA/MUY ALTA.
  if (candidate.market === "BTTS_YES") utility += 0.04;

  return utility;
}

function qualityUtility(state: State): number {
  if (state.picks.length === 0) return 0;
  const avgScore = state.scoreSum / state.picks.length;
  const avgProbability = state.probabilitySum / state.picks.length;
  return avgScore * 12 + avgProbability * 8 - state.borderlineCount * 1.8;
}

function selectionBurden(count: number): number {
  // Menos patas = menos puntos de fallo. 5 es el centro ideal; 6 se permite,
  // pero no se premia si 4–5 consiguen una cuota parecida con igual calidad.
  const distanceFromIdeal = Math.abs(count - FUTBOLYLICTS_RULES.idealSelections);
  const extraPastFive = Math.max(0, count - FUTBOLYLICTS_RULES.idealSelections);
  return distanceFromIdeal * 0.35 + extraPastFive * 0.55;
}

function beamUtility(state: State): number {
  if (state.picks.length === 0) return 0;

  const quality = qualityUtility(state);
  const target = FUTBOLYLICTS_RULES.targetAnchor;
  const distance = Math.abs(Math.log(Math.max(state.totalOdds, 1)) - Math.log(target));
  const burden = selectionBurden(state.picks.length);

  if (
    state.totalOdds >= FUTBOLYLICTS_RULES.targetTotalOddsMin &&
    state.totalOdds <= FUTBOLYLICTS_RULES.targetTotalOddsMax
  ) {
    return 1000 + quality - distance * 5 - burden;
  }

  if (
    state.totalOdds > FUTBOLYLICTS_RULES.targetTotalOddsMax &&
    state.totalOdds <= FUTBOLYLICTS_RULES.acceptableTotalOddsMax
  ) {
    return 850 + quality - distance * 6 - burden;
  }

  return quality - distance * 3.5 + Math.log(Math.max(state.totalOdds, 1)) * 0.7 - burden;
}

function finalUtility(state: State): number {
  if (state.picks.length === 0) return -Infinity;
  const avgScore = state.scoreSum / state.picks.length;
  const avgProbability = state.probabilitySum / state.picks.length;
  const distance = Math.abs(state.totalOdds - FUTBOLYLICTS_RULES.targetAnchor);

  return (
    avgScore * 25 +
    avgProbability * 20 +
    state.combinedProbability * 12 -
    distance * 1.8 -
    selectionBurden(state.picks.length) * 2.2 -
    state.borderlineCount * 2.5
  );
}

function stateKey(state: State): string {
  // Conserva estados en distintas zonas de cuota y número de patas.
  const oddsBucket = Math.floor(state.totalOdds * 4); // bloques de ~0.25
  return `${state.picks.length}:${state.borderlineCount}:${oddsBucket}`;
}

function pruneStates(states: State[]): State[] {
  const bestByBucket = new Map<string, State>();

  for (const state of states) {
    if (state.totalOdds > FUTBOLYLICTS_RULES.acceptableTotalOddsMax * 1.02) continue;
    const key = stateKey(state);
    const current = bestByBucket.get(key);
    if (!current || beamUtility(state) > beamUtility(current)) {
      bestByBucket.set(key, state);
    }
  }

  return [...bestByBucket.values()]
    .sort((a, b) => beamUtility(b) - beamUtility(a))
    .slice(0, FUTBOLYLICTS_RULES.comboBeamWidth);
}

function sortFixtureOptions(options: MarketCandidate[]): MarketCandidate[] {
  return [...options]
    .sort((a, b) => {
      const scoreGap = b.score - a.score;
      if (Math.abs(scoreGap) > FUTBOLYLICTS_RULES.scoreTieTolerance) return scoreGap;
      return candidateUtility(b) - candidateUtility(a);
    })
    .slice(0, FUTBOLYLICTS_RULES.maxMarketsPerFixtureForCombo);
}

export function buildBestCombo(
  date: string,
  allCandidates: MarketCandidate[],
): DailyCombo {
  const eligible = eligibleCandidates(allCandidates);

  const byFixture = new Map<number, MarketCandidate[]>();
  for (const candidate of eligible) {
    const arr = byFixture.get(candidate.fixtureId) ?? [];
    arr.push(candidate);
    byFixture.set(candidate.fixtureId, arr);
  }

  const fixtureOptions = [...byFixture.values()]
    .map(sortFixtureOptions)
    .filter((options) => options.length > 0)
    .sort((a, b) => candidateUtility(b[0]) - candidateUtility(a[0]))
    .slice(0, FUTBOLYLICTS_RULES.maxFixturesForCombo);

  let states: State[] = [{
    picks: [],
    totalOdds: 1,
    borderlineCount: 0,
    scoreSum: 0,
    probabilitySum: 0,
    combinedProbability: 1,
  }];

  for (const options of fixtureOptions) {
    const next: State[] = [...states];

    for (const state of states) {
      if (state.picks.length >= FUTBOLYLICTS_RULES.maxSelections) continue;

      for (const candidate of options) {
        const borderline = isBorderline(candidate);
        if (borderline && !borderlineHasExceptionalValue(candidate)) continue;

        const borderlineCount = state.borderlineCount + (borderline ? 1 : 0);
        if (borderlineCount > FUTBOLYLICTS_RULES.maxBorderlinePicks) continue;

        const totalOdds = state.totalOdds * candidate.odds;
        if (totalOdds > FUTBOLYLICTS_RULES.acceptableTotalOddsMax * 1.02) continue;

        next.push({
          picks: [...state.picks, candidate],
          totalOdds,
          borderlineCount,
          scoreSum: state.scoreSum + candidate.score,
          probabilitySum: state.probabilitySum + candidate.probability,
          // Aproximación de independencia entre partidos distintos. Se muestra como estimación,
          // no como garantía ni como etiqueta ALTA/MUY ALTA global.
          combinedProbability: state.combinedProbability * candidate.probability,
        });
      }
    }

    states = pruneStates(next);
  }

  const valid = states.filter(
    (state) =>
      state.picks.length >= FUTBOLYLICTS_RULES.minSelections &&
      state.picks.length <= FUTBOLYLICTS_RULES.maxSelections,
  );

  const inTarget = valid
    .filter(
      (state) =>
        state.totalOdds >= FUTBOLYLICTS_RULES.targetTotalOddsMin &&
        state.totalOdds <= FUTBOLYLICTS_RULES.targetTotalOddsMax,
    )
    .sort((a, b) => finalUtility(b) - finalUtility(a));

  const justAbove = valid
    .filter(
      (state) =>
        state.totalOdds > FUTBOLYLICTS_RULES.targetTotalOddsMax &&
        state.totalOdds <= FUTBOLYLICTS_RULES.acceptableTotalOddsMax,
    )
    .sort((a, b) => finalUtility(b) - finalUtility(a));

  const belowTarget = valid
    .filter((state) => state.totalOdds < FUTBOLYLICTS_RULES.targetTotalOddsMin)
    .sort((a, b) => finalUtility(b) - finalUtility(a));

  const chosen = inTarget[0] ?? justAbove[0] ?? belowTarget[0];

  if (!chosen) {
    // Si todavía no hay 4 partidos distintos que pasen todos los filtros, enseñamos
    // los picks válidos disponibles en vez de dejar la caja completamente vacía.
    const partial = states
      .filter((state) => state.picks.length > 0)
      .sort((a, b) => {
        if (b.picks.length !== a.picks.length) return b.picks.length - a.picks.length;
        return finalUtility(b) - finalUtility(a);
      })[0];

    if (partial) {
      const partialScore = partial.scoreSum / partial.picks.length;
      return {
        date,
        picks: partial.picks,
        totalOdds: round2(partial.totalOdds),
        globalScore: round2(partialScore),
        globalProbability: round4(partial.combinedProbability),
        globalConfidence: partialScore >= 9 ? "MUY_ALTA" : "ALTA",
        targetReached: false,
        official: false,
        message: `Hay ${partial.picks.length} pick${partial.picks.length === 1 ? "" : "s"} que pasan todos los filtros. Aún faltan partidos válidos para cerrar la combinada @8–@10.`,
      };
    }

    return {
      date,
      picks: [],
      totalOdds: 0,
      globalScore: 0,
      globalProbability: 0,
      globalConfidence: "ALTA",
      targetReached: false,
      official: false,
      message: "Todavía no hay un pick con cuota real que pase probabilidad, nota y valor. Revisa los partidos analizados para ver el motivo.",
    };
  }

  const globalScore = chosen.scoreSum / chosen.picks.length;
  const insideMainTarget =
    chosen.totalOdds >= FUTBOLYLICTS_RULES.targetTotalOddsMin &&
    chosen.totalOdds <= FUTBOLYLICTS_RULES.targetTotalOddsMax;

  return {
    date,
    picks: chosen.picks,
    totalOdds: round2(chosen.totalOdds),
    globalScore: round2(globalScore),
    globalProbability: round4(chosen.combinedProbability),
    // La confianza individual sigue siendo la relevante.
    globalConfidence: globalScore >= 9 ? "MUY_ALTA" : "ALTA",
    targetReached: insideMainTarget,
    official: true,
    message: insideMainTarget
      ? "¡Vamos con confianza! 🍀"
      : chosen.totalOdds < FUTBOLYLICTS_RULES.targetTotalOddsMin
        ? `Combinada válida por calidad (@${round2(chosen.totalOdds).toFixed(2)}), aunque hoy no alcanza el objetivo @8–@10 sin añadir riesgo.`
        : `Combinada válida @${round2(chosen.totalOdds).toFixed(2)}; supera ligeramente el objetivo principal @8–@10.`,
  };
}

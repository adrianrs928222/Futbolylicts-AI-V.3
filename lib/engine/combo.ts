import { FUTBOLYLICTS_RULES } from "@/lib/config/rules";
import { DAILY_COMBO_PREFERENCES, comboCategoryBonus, comboLeagueBonus, isEredivisieLeague, normalizedLeagueName } from "@/lib/config/comboPreferences";
import type { Confidence, DailyCombo, MarketCandidate } from "@/lib/engine/types";
import { candidateIntelligence, compareIntelligentCandidates } from "@/lib/engine/scoring";
import { isOfficialCandidateEligible } from "@/lib/engine/eligibility";

interface State {
  picks: MarketCandidate[];
  totalOdds: number;
  borderlineCount: number;
  scoreSum: number;
  probabilitySum: number;
  combinedProbability: number;
}

function round2(v: number) { return Math.round(v * 100) / 100; }
function round4(v: number) { return Math.round(v * 10000) / 10000; }
function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }


function hasValueEdge(candidate: MarketCandidate) {
  // Con cuota EST. no tiene sentido medir "edge" contra un precio creado por el
  // mismo modelo. Solo se conserva esta comprobación para una posible cuota real.
  if (!candidate.realOdds) return true;
  const impliedProbability = 1 / Math.max(candidate.odds, 1.01);
  return candidate.probability >= impliedProbability + 0.03;
}

function isCore(candidate: MarketCandidate): boolean {
  return candidate.score >= FUTBOLYLICTS_RULES.preferredCoreScoreMin &&
    candidate.probability >= FUTBOLYLICTS_RULES.preferredCoreProbabilityMin;
}

function isBorderline(candidate: MarketCandidate): boolean {
  return candidate.score >= FUTBOLYLICTS_RULES.minScore &&
    candidate.probability >= FUTBOLYLICTS_RULES.minProbability &&
    !isCore(candidate);
}

function borderlineHasExceptionalValue(candidate: MarketCandidate): boolean {
  return candidate.probability >= FUTBOLYLICTS_RULES.borderlineMinProbability && hasValueEdge(candidate);
}

export function eligibleCandidates(candidates: MarketCandidate[]): MarketCandidate[] {
  return candidates.filter((candidate) => isOfficialCandidateEligible(candidate) && hasValueEdge(candidate));
}

function oddsUsefulness(odds: number): number {
  if (odds >= FUTBOLYLICTS_RULES.preferredOddsSweetMin && odds <= FUTBOLYLICTS_RULES.preferredOddsSweetMax) return 1;
  const distance = odds < FUTBOLYLICTS_RULES.preferredOddsSweetMin
    ? FUTBOLYLICTS_RULES.preferredOddsSweetMin - odds
    : odds - FUTBOLYLICTS_RULES.preferredOddsSweetMax;
  return Math.max(0, 1 - distance / 0.25);
}

function candidateUtility(candidate: MarketCandidate): number {
  // Cada mercado gana por mérito propio. No hay bonus por ser BTTS, +2.5,
  // doble oportunidad o por repetir/no repetir un tipo de mercado.
  let utility = candidate.score * 14 + candidate.probability * 5;
  utility += oddsUsefulness(candidate.odds) * 0.9;
  utility += Math.log(candidate.odds) * 0.55;
  utility += candidateIntelligence(candidate) * 0.02;
  if (isCore(candidate)) utility += 1.15;
  if (isBorderline(candidate)) utility -= 1.5;
  if (candidate.confidence === "MUY_ALTA" && candidate.odds >= 1.25) utility += 0.15;
  // Preferencia del usuario: solo actúa después de que el motor haya validado
  // el candidato. No altera score, probabilidad ni cuota.
  utility += comboCategoryBonus(candidate.category);
  utility += comboLeagueBonus(candidate.leagueName);
  return utility;
}

function qualityUtility(state: State): number {
  if (state.picks.length === 0) return 0;
  const avgScore = state.scoreSum / state.picks.length;
  const avgProbability = state.probabilitySum / state.picks.length;
  return avgScore * 12 + avgProbability * 8 - state.borderlineCount * 1.8;
}

function selectionBurden(count: number): number {
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
  if (state.totalOdds >= FUTBOLYLICTS_RULES.targetTotalOddsMin && state.totalOdds <= FUTBOLYLICTS_RULES.targetTotalOddsMax) {
    return 1000 + quality - distance * 5 - burden;
  }
  if (state.totalOdds > FUTBOLYLICTS_RULES.targetTotalOddsMax && state.totalOdds <= FUTBOLYLICTS_RULES.acceptableTotalOddsMax) {
    return 850 + quality - distance * 6 - burden;
  }
  return quality - distance * 3.5 + Math.log(Math.max(state.totalOdds, 1)) * 0.7 - burden;
}

function finalUtility(state: State): number {
  if (state.picks.length === 0) return -Infinity;
  const avgScore = state.scoreSum / state.picks.length;
  const avgProbability = state.probabilitySum / state.picks.length;
  const distance = Math.abs(state.totalOdds - FUTBOLYLICTS_RULES.targetAnchor);
  const leagueDiversity = DAILY_COMBO_PREFERENCES.diversityAcrossMajorLeagues
    ? new Set(state.picks.map((pick) => normalizedLeagueName(pick.leagueName)).filter(Boolean)).size * 0.55
    : 0;
  return avgScore * 25 + avgProbability * 20 + state.combinedProbability * 12 + leagueDiversity -
    distance * 1.8 - selectionBurden(state.picks.length) * 2.2 - state.borderlineCount * 2.5;
}

function targetRescueUtility(state: State): number {
  if (state.picks.length === 0) return -Infinity;
  const targetDistance = Math.abs(Math.log(Math.max(state.totalOdds, 1.01)) - Math.log(FUTBOLYLICTS_RULES.targetAnchor));
  return reviewQuality(state) * 10 - targetDistance * 42 - selectionBurden(state.picks.length) * 1.2;
}

function stateKey(state: State): string {
  const oddsBucket = Math.floor(state.totalOdds * 4);
  return `${state.picks.length}:${state.borderlineCount}:${oddsBucket}`;
}

function pruneStates(states: State[]): State[] {
  const bestByBucket = new Map<string, State>();
  for (const state of states) {
    if (state.totalOdds > FUTBOLYLICTS_RULES.acceptableTotalOddsMax * 1.02) continue;
    const key = stateKey(state);
    const current = bestByBucket.get(key);
    if (!current || beamUtility(state) > beamUtility(current)) bestByBucket.set(key, state);
  }
  return [...bestByBucket.values()].sort((a, b) => beamUtility(b) - beamUtility(a)).slice(0, FUTBOLYLICTS_RULES.comboBeamWidth);
}

function compareFixtureCandidates(a: MarketCandidate, b: MarketCandidate) {
  // Orden humano/inteligente del mismo partido. Nunca se fuerza BTTS ni variedad.
  const scoreGap = b.score - a.score;
  if (Math.abs(scoreGap) > FUTBOLYLICTS_RULES.scoreTieTolerance) return scoreGap;
  return compareIntelligentCandidates(a, b) || candidateUtility(b) - candidateUtility(a);
}

function sortFixtureOptions(options: MarketCandidate[]): MarketCandidate[] {
  // v0.22: sobreanaliza el partido y conserva varias alternativas realmente
  // inteligentes. Esto permite que un 1X+1.5 / X2+1.5 / 12+2.5 compita contra
  // BTTS o +2.5 cuando sigue muy cerca del mejor mercado en calidad.
  const ranked = [...options].sort(compareFixtureCandidates);
  const best = ranked[0];
  if (!best) return [];
  return ranked
    .filter((candidate, index) => {
      if (index === 0) return true;
      if (candidate.score < FUTBOLYLICTS_RULES.minScore || candidate.probability < FUTBOLYLICTS_RULES.minProbability) return false;
      if (candidate.score < best.score - FUTBOLYLICTS_RULES.maxAlternativeScoreDrop) return false;
      if (candidate.probability < best.probability - FUTBOLYLICTS_RULES.maxAlternativeProbabilityDrop) return false;
      return true;
    })
    .slice(0, FUTBOLYLICTS_RULES.maxMarketsPerFixtureForCombo);
}

function makeState(picks: MarketCandidate[]): State {
  return picks.reduce<State>((state, pick) => ({
    picks: [...state.picks, pick],
    totalOdds: state.totalOdds * pick.odds,
    borderlineCount: state.borderlineCount + (isBorderline(pick) ? 1 : 0),
    scoreSum: state.scoreSum + pick.score,
    probabilitySum: state.probabilitySum + pick.probability,
    combinedProbability: state.combinedProbability * pick.probability,
  }), { picks: [], totalOdds: 1, borderlineCount: 0, scoreSum: 0, probabilitySum: 0, combinedProbability: 1 });
}

function averageScore(state: State) { return state.picks.length ? state.scoreSum / state.picks.length : 0; }
function averageProbability(state: State) { return state.picks.length ? state.probabilitySum / state.picks.length : 0; }

function reviewQuality(state: State): number {
  if (!state.picks.length) return -Infinity;
  const avgScore = averageScore(state);
  const avgProbability10 = averageProbability(state) * 10;
  const weakestScore = Math.min(...state.picks.map((pick) => pick.score));
  const weakestProbability10 = Math.min(...state.picks.map((pick) => pick.probability)) * 10;
  const preference = state.picks.reduce((sum, pick) => sum + comboCategoryBonus(pick.category) + comboLeagueBonus(pick.leagueName), 0) / state.picks.length;
  return avgScore * 0.55 + avgProbability10 * 0.27 + weakestScore * 0.12 + weakestProbability10 * 0.06 +
    preference * 0.035 - state.borderlineCount * 0.08 - selectionBurden(state.picks.length) * 0.05;
}

function reviewUtility(state: State): number {
  let utility = reviewQuality(state);
  if (state.totalOdds >= FUTBOLYLICTS_RULES.targetTotalOddsMin && state.totalOdds <= FUTBOLYLICTS_RULES.targetTotalOddsMax) utility += 0.08;
  else if (state.totalOdds >= FUTBOLYLICTS_RULES.finalReviewSoftOddsFloor) utility += 0.03;
  return utility;
}

function structurallyValidReviewState(state: State): boolean {
  if (state.picks.length < FUTBOLYLICTS_RULES.minSelections || state.picks.length > FUTBOLYLICTS_RULES.emergencyMaxSelections) return false;
  if (state.totalOdds > FUTBOLYLICTS_RULES.acceptableTotalOddsMax * 1.02) return false;
  if (state.borderlineCount > FUTBOLYLICTS_RULES.maxBorderlinePicks) return false;
  return new Set(state.picks.map((pick) => pick.fixtureId)).size === state.picks.length;
}

function reviewImproves(current: State, next: State): boolean {
  if (!structurallyValidReviewState(next)) return false;
  const qualityGain = reviewQuality(next) - reviewQuality(current);
  const currentInTarget = current.totalOdds >= FUTBOLYLICTS_RULES.targetTotalOddsMin && current.totalOdds <= FUTBOLYLICTS_RULES.targetTotalOddsMax;
  const nextInTarget = next.totalOdds >= FUTBOLYLICTS_RULES.targetTotalOddsMin && next.totalOdds <= FUTBOLYLICTS_RULES.targetTotalOddsMax;

  // v0.22: si ya conseguimos @8–@10, la revisión final NO puede desmontarlo
  // para volver a una combinación @3–@7. Sigue comparando mercados, pero dentro
  // de la zona objetivo.
  if (FUTBOLYLICTS_RULES.finalReviewKeepTarget && currentInTarget && !nextInTarget) return false;

  if (qualityGain < FUTBOLYLICTS_RULES.finalReviewMinQualityGain) return false;

  // Si todavía no estábamos en objetivo, alcanzar @8–@10 gana el desempate siempre
  // que el estado ya haya pasado los filtros ALTA/MUY ALTA.
  if (nextInTarget && !currentInTarget) return true;
  return reviewUtility(next) > reviewUtility(current);
}

function refineChosenState(initial: State, eligible: MarketCandidate[]): State {
  if (!FUTBOLYLICTS_RULES.finalReviewEnabled || initial.picks.length < FUTBOLYLICTS_RULES.minSelections) return initial;

  const byFixture = new Map<number, MarketCandidate[]>();
  for (const candidate of eligible) {
    const list = byFixture.get(candidate.fixtureId) ?? [];
    list.push(candidate);
    byFixture.set(candidate.fixtureId, list);
  }
  for (const [fixtureId, options] of byFixture) byFixture.set(fixtureId, sortFixtureOptions(options));

  let current = initial;
  for (let pass = 0; pass < FUTBOLYLICTS_RULES.finalReviewMaxPasses; pass += 1) {
    const neighbors: State[] = [];
    const selectedIds = new Set(current.picks.map((pick) => pick.fixtureId));

    // 1) Revisa cada pata contra TODOS los mercados válidos del mismo partido.
    current.picks.forEach((pick, index) => {
      for (const alternative of byFixture.get(pick.fixtureId) ?? []) {
        if (alternative.market === pick.market) continue;
        const nextPicks = [...current.picks];
        nextPicks[index] = alternative;
        neighbors.push(makeState(nextPicks));
      }
    });

    // 2) Revisa cada pata contra partidos que se quedaron fuera.
    const outside = [...eligible]
      .filter((candidate) => !selectedIds.has(candidate.fixtureId))
      .sort(compareFixtureCandidates)
      .slice(0, FUTBOLYLICTS_RULES.maxFixturesForCombo * 2);
    current.picks.forEach((_, index) => {
      for (const alternative of outside) {
        const nextPicks = [...current.picks];
        nextPicks[index] = alternative;
        neighbors.push(makeState(nextPicks));
      }
    });

    // 3) Si hay demasiadas patas, comprueba si quitar la más débil mejora de verdad.
    if (current.picks.length > FUTBOLYLICTS_RULES.minSelections) {
      current.picks.forEach((_, index) => neighbors.push(makeState(current.picks.filter((__, i) => i !== index))));
    }

    // 4) Si hay hueco, permite añadir otro pick solo si también mejora la calidad global.
    if (current.picks.length < FUTBOLYLICTS_RULES.maxSelections) {
      for (const alternative of outside.slice(0, 12)) neighbors.push(makeState([...current.picks, alternative]));
    }

    const best = neighbors
      .filter((state) => reviewImproves(current, state))
      .sort((a, b) => reviewUtility(b) - reviewUtility(a))[0];
    if (!best) break;
    current = best;
  }
  return current;
}

function confidenceScore(state: State): number {
  if (!state.picks.length) return 0;
  const avgScore = averageScore(state);
  const avgProbability10 = averageProbability(state) * 10;
  const weakestScore = Math.min(...state.picks.map((pick) => pick.score));
  // La nota global mide calidad de construcción, no la probabilidad matemática de
  // acertar todas las patas. Un rescate de 7–8 selecciones ya queda reflejado por la
  // pata más débil y la calidad media; evitamos hundir artificialmente la etiqueta
  // por contar patas que individualmente siguen siendo ALTA/MUY ALTA.
  const countPenalty = Math.max(0, state.picks.length - 4) * 0.04;
  return round2(clamp(avgScore * 0.65 + avgProbability10 * 0.15 + weakestScore * 0.20 - countPenalty, 0, 10));
}

function confidenceLevel(score: number): Confidence {
  if (score >= 9) return "MUY_ALTA";
  if (score >= 8) return "ALTA";
  if (score >= 7.5) return "MEDIA_ALTA";
  if (score >= 7) return "MEDIA";
  return "BAJA";
}

function toDailyCombo(date: string, chosen: State, official: boolean): DailyCombo {
  const score = confidenceScore(chosen);
  const targetReached = chosen.totalOdds >= FUTBOLYLICTS_RULES.targetTotalOddsMin && chosen.totalOdds <= FUTBOLYLICTS_RULES.targetTotalOddsMax;
  return {
    date,
    picks: chosen.picks,
    totalOdds: round2(chosen.totalOdds),
    globalScore: score,
    globalProbability: round4(chosen.combinedProbability),
    globalConfidence: confidenceLevel(score),
    targetReached,
    official,
    message: targetReached
      ? "Combinada del día cerrada en la zona @8–@10. El motor comparó mercados simples y combinados y revisó cada pata antes de publicarla."
      : chosen.totalOdds < FUTBOLYLICTS_RULES.targetTotalOddsMin
        ? `El motor ha construido la combinación más cercana posible al objetivo con los picks ALTA/MUY ALTA disponibles (@${round2(chosen.totalOdds).toFixed(2)} EST.).`
        : `La mejor combinación válida queda en @${round2(chosen.totalOdds).toFixed(2)} EST.; no existe una versión @8–@10 con los filtros actuales.`,
  };
}

function searchCombinationStates(
  fixtureOptions: MarketCandidate[][],
  maxSelections: number,
): State[] {
  let states: State[] = [{ picks: [], totalOdds: 1, borderlineCount: 0, scoreSum: 0, probabilitySum: 0, combinedProbability: 1 }];

  for (const options of fixtureOptions) {
    const next: State[] = [...states];
    for (const state of states) {
      if (state.picks.length >= maxSelections) continue;
      for (const candidate of options) {
        const borderline = isBorderline(candidate);
        if (borderline && !borderlineHasExceptionalValue(candidate)) continue;
        const borderlineCount = state.borderlineCount + (borderline ? 1 : 0);
        if (borderlineCount > FUTBOLYLICTS_RULES.maxBorderlinePicks) continue;
        const totalOdds = state.totalOdds * candidate.odds;
        if (totalOdds > FUTBOLYLICTS_RULES.acceptableTotalOddsMax * 1.02) continue;
        next.push({
          picks: [...state.picks, candidate], totalOdds, borderlineCount,
          scoreSum: state.scoreSum + candidate.score,
          probabilitySum: state.probabilitySum + candidate.probability,
          combinedProbability: state.combinedProbability * candidate.probability,
        });
      }
    }
    states = pruneStates(next);
  }
  return states;
}

function targetStates(states: State[], maxSelections: number): State[] {
  return states
    .filter((state) =>
      state.picks.length >= FUTBOLYLICTS_RULES.minSelections &&
      state.picks.length <= maxSelections &&
      state.totalOdds >= FUTBOLYLICTS_RULES.targetTotalOddsMin &&
      state.totalOdds <= FUTBOLYLICTS_RULES.targetTotalOddsMax,
    )
    .sort((a, b) => finalUtility(b) - finalUtility(a));
}


function acceptableStates(states: State[], maxSelections: number): State[] {
  return states
    .filter((state) =>
      state.picks.length >= FUTBOLYLICTS_RULES.minSelections &&
      state.picks.length <= maxSelections &&
      state.totalOdds >= FUTBOLYLICTS_RULES.acceptableTotalOddsMin &&
      state.totalOdds <= FUTBOLYLICTS_RULES.acceptableTotalOddsMax,
    )
    .sort((a, b) => finalUtility(b) - finalUtility(a));
}

function choosePreferredTarget(states: State[], maxSelections: number, preferEredivisie: boolean): State | undefined {
  const targets = targetStates(states, maxSelections);
  if (!targets.length) return undefined;
  if (preferEredivisie) {
    const dutch = targets.find((state) => state.picks.some((pick) => isEredivisieLeague(pick.leagueName)));
    if (dutch) return dutch;
  }
  return targets[0];
}

function allAltaFixtureOptions(grouped: Map<number, MarketCandidate[]>): MarketCandidate[][] {
  return [...grouped.values()]
    .map((options) => [...options]
      .sort(compareFixtureCandidates)
      .slice(0, FUTBOLYLICTS_RULES.hardTargetMaxMarketsPerFixture))
    .filter((options) => options.length > 0)
    .sort((a, b) => candidateUtility(b[0]) - candidateUtility(a[0]))
    .slice(0, FUTBOLYLICTS_RULES.maxFixturesForCombo);
}

export function buildBestCombo(date: string, allCandidates: MarketCandidate[]): DailyCombo {
  const eligibleRaw = eligibleCandidates(allCandidates);
  const groupedRaw = new Map<number, MarketCandidate[]>();
  for (const candidate of eligibleRaw) {
    const arr = groupedRaw.get(candidate.fixtureId) ?? [];
    arr.push(candidate);
    groupedRaw.set(candidate.fixtureId, arr);
  }

  if (!eligibleRaw.length) {
    return {
      date, picks: [], totalOdds: 0, globalScore: 0, globalProbability: 0,
      globalConfidence: "BAJA", targetReached: false, official: false,
      message: "No hay suficientes mercados ALTA/MUY ALTA para construir una combinada @8–@10 sin inventar picks.",
    };
  }

  // PREFERENCIA 0 — si Champions por sí sola puede construir una @8–@10 válida,
  // se elige antes que cualquier mezcla. Se usan exactamente los mismos filtros
  // ALTA/MUY ALTA y las mismas reglas de cuota del motor.
  if (DAILY_COMBO_PREFERENCES.preferAllChampionsWhenTargetPossible) {
    const championsRaw = eligibleRaw.filter((candidate) => candidate.category === "champions");
    const championsGrouped = new Map<number, MarketCandidate[]>();
    for (const candidate of championsRaw) {
      const arr = championsGrouped.get(candidate.fixtureId) ?? [];
      arr.push(candidate);
      championsGrouped.set(candidate.fixtureId, arr);
    }
    const championsOptions = [...championsGrouped.values()]
      .map(sortFixtureOptions)
      .filter((options) => options.length > 0)
      .sort((a, b) => candidateUtility(b[0]) - candidateUtility(a[0]))
      .slice(0, FUTBOLYLICTS_RULES.maxFixturesForCombo);
    if (championsOptions.length >= FUTBOLYLICTS_RULES.minSelections) {
      const championsStates = searchCombinationStates(championsOptions, FUTBOLYLICTS_RULES.emergencyMaxSelections);
      const championsTarget = targetStates(championsStates, FUTBOLYLICTS_RULES.emergencyMaxSelections)[0];
      if (championsTarget) {
        const refinedChampions = refineChosenState(championsTarget, championsRaw);
        const chosenChampions = refinedChampions.totalOdds >= FUTBOLYLICTS_RULES.targetTotalOddsMin && refinedChampions.totalOdds <= FUTBOLYLICTS_RULES.targetTotalOddsMax
          ? refinedChampions
          : championsTarget;
        const result = toDailyCombo(date, chosenChampions, true);
        result.message = `Combinada del día 100% Champions cerrada entre @8 y @10 con ${chosenChampions.picks.length} picks ALTA/MUY ALTA. Champions tiene prioridad cuando puede cumplir el objetivo sin rebajar los filtros del motor.`;
        return result;
      }
    }
  }

  const preferEredivisie = DAILY_COMBO_PREFERENCES.preferEredivisieWhenNoChampionsCombo &&
    eligibleRaw.some((candidate) => isEredivisieLeague(candidate.leagueName));

  // PASO 1 — modo humano/inteligente: conserva solo alternativas muy cercanas al
  // mejor mercado de cada partido y busca primero @8–@10 con 4–6 selecciones.
  const smartFixtureOptions = [...groupedRaw.values()]
    .map(sortFixtureOptions)
    .filter((options) => options.length > 0)
    .sort((a, b) => candidateUtility(b[0]) - candidateUtility(a[0]))
    .slice(0, FUTBOLYLICTS_RULES.maxFixturesForCombo);

  const smartStates = searchCombinationStates(smartFixtureOptions, FUTBOLYLICTS_RULES.maxSelections);
  let target = choosePreferredTarget(smartStates, FUTBOLYLICTS_RULES.maxSelections, preferEredivisie);

  // PASO 2 — rescate @8–@10: si el modo conservador no llega, revisa TODOS los
  // mercados que ya son ALTA/MUY ALTA de esos partidos. No baja de 8.0 ni del
  // mínimo de probabilidad; simplemente deja de exigir que cada pata sea casi
  // idéntica al mercado nº1 del encuentro.
  const hardFixtureOptions = allAltaFixtureOptions(groupedRaw);
  if (!target && FUTBOLYLICTS_RULES.hardTargetEnabled) {
    const rescueStates = searchCombinationStates(hardFixtureOptions, FUTBOLYLICTS_RULES.maxSelections);
    target = choosePreferredTarget(rescueStates, FUTBOLYLICTS_RULES.maxSelections, preferEredivisie);
  }

  // PASO 3 — último recurso: si con 4–6 no existe una @8–@10, puede usar 7 u 8
  // picks, siempre uno por partido y SIEMPRE ALTA/MUY ALTA. La cuota objetivo
  // manda más que la estética de quedarse en exactamente 4–6.
  if (!target && FUTBOLYLICTS_RULES.hardTargetEnabled) {
    const emergencyStates = searchCombinationStates(hardFixtureOptions, FUTBOLYLICTS_RULES.emergencyMaxSelections);
    target = choosePreferredTarget(emergencyStates, FUTBOLYLICTS_RULES.emergencyMaxSelections, preferEredivisie);
  }

  if (target) {
    // La revisión puede mejorar mercados/partidos, pero jamás desmontar @8–@10.
    const refined = refineChosenState(target, eligibleRaw);
    const chosen = refined.totalOdds >= FUTBOLYLICTS_RULES.targetTotalOddsMin && refined.totalOdds <= FUTBOLYLICTS_RULES.targetTotalOddsMax
      ? refined
      : target;
    const result = toDailyCombo(date, chosen, true);
    const includesEredivisie = chosen.picks.some((pick) => isEredivisieLeague(pick.leagueName));
    const dutchNote = preferEredivisie && includesEredivisie
      ? " Se dio presencia preferente a Eredivisie y se equilibró con otras ligas fuertes disponibles."
      : "";
    result.message = (chosen.picks.length <= FUTBOLYLICTS_RULES.maxSelections
      ? "Combinada del día cerrada obligatoriamente entre @8 y @10 con picks ALTA/MUY ALTA. El motor comparó mercados simples y combinados y volvió a revisar cada pata."
      : `Combinada del día cerrada entre @8 y @10 con ${chosen.picks.length} picks ALTA/MUY ALTA. Se usó el modo rescate porque con 4–6 selecciones no existía una versión válida en objetivo.`) + dutchNote;
    return result;
  }

  // Si no existe una @8–@10 exacta, aceptamos una desviación pequeña únicamente
  // cuando conserva picks ALTA/MUY ALTA. Calidad antes que cuadrar unas décimas.
  const flexibleStates = searchCombinationStates(hardFixtureOptions, FUTBOLYLICTS_RULES.emergencyMaxSelections);
  const flexible = acceptableStates(flexibleStates, FUTBOLYLICTS_RULES.emergencyMaxSelections)[0];
  if (flexible) {
    const result = toDailyCombo(date, flexible, true);
    result.message = `La mejor combinada de valor queda en @${result.totalOdds.toFixed(2)} EST. El objetivo es @8–@10, pero el motor acepta una pequeña desviación antes que empeorar una selección.`;
    return result;
  }

  // Si el universo elegido (por ejemplo Champions) no permite alcanzar @8–@10,
  // no dejamos la pantalla vacía si sí existen varias oportunidades de calidad.
  // Mostramos la mejor combinada disponible SIN rebajar cuota mínima, confianza ni reglas.
  const bestAvailable = flexibleStates
    .filter((state) => state.picks.length >= 2 && state.picks.length <= FUTBOLYLICTS_RULES.emergencyMaxSelections)
    .sort((a, b) => finalUtility(b) - finalUtility(a))[0];
  if (bestAvailable) {
    const result = toDailyCombo(date, bestAvailable, true);
    result.message = `No existe una @8–@10 limpia en este universo de partidos. El Maestro muestra la mejor combinada disponible (@${result.totalOdds.toFixed(2)}) sin bajar de @1.25 ni rebajar la confianza exigida.`;
    return result;
  }

  return {
    date, picks: [], totalOdds: 0, globalScore: 0, globalProbability: 0,
    globalConfidence: "BAJA", targetReached: false, official: false,
    message: "No hay al menos dos selecciones ALTA/MUY ALTA con cuota válida. El motor prefiere descartar antes que fabricar valor.",
  };
}

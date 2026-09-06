import { FUTBOLYLICTS_RULES } from "@/lib/config/rules";
import type { AnalyzedFixtureSummary } from "@/lib/engine/types";

function isVeryHigh(item: AnalyzedFixtureSummary) {
  return (item.score ?? 0) >= FUTBOLYLICTS_RULES.veryHighScore &&
    item.probability >= FUTBOLYLICTS_RULES.veryHighProbability;
}

function hasUsefulDisplayedOdds(item: AnalyzedFixtureSummary) {
  const odds = item.odds;
  if (odds === undefined) return false;
  if (odds < FUTBOLYLICTS_RULES.preferredOddsMin) return false;
  if (odds > FUTBOLYLICTS_RULES.preferredOddsMax) return false;
  if (item.bestMarketLabel.includes("Ambos marcan") && odds < FUTBOLYLICTS_RULES.bttsMinOdds) {
    return false;
  }
  return true;
}

type State = {
  picks: AnalyzedFixtureSummary[];
  totalOdds: number;
  scoreSum: number;
  probabilitySum: number;
};

function quality(state: State) {
  if (!state.picks.length) return 0;
  const avgScore = state.scoreSum / state.picks.length;
  const avgProbability = state.probabilitySum / state.picks.length;
  const countPenalty = Math.abs(state.picks.length - FUTBOLYLICTS_RULES.idealSelections) * 0.15;
  return avgScore * 12 + avgProbability * 8 - countPenalty;
}

function targetDistance(totalOdds: number) {
  return Math.abs(Math.log(Math.max(totalOdds, 1.01)) - Math.log(FUTBOLYLICTS_RULES.targetAnchor));
}

function stateUtility(state: State) {
  const inTarget =
    state.totalOdds >= FUTBOLYLICTS_RULES.targetTotalOddsMin &&
    state.totalOdds <= FUTBOLYLICTS_RULES.targetTotalOddsMax;

  // La calidad manda. Entrar en la zona @8–@10 EST. da prioridad, pero no permite
  // bajar de ALTA porque ese filtro ya se aplica antes de construir estados.
  return (inTarget ? 1000 : 0) + quality(state) - targetDistance(state.totalOdds) * 9;
}

function prune(states: State[]) {
  const bestByBucket = new Map<string, State>();

  for (const state of states) {
    if (state.totalOdds > FUTBOLYLICTS_RULES.acceptableTotalOddsMax * 1.03) continue;
    const bucket = Math.floor(state.totalOdds * 10); // zonas de ~0.10
    const key = `${state.picks.length}:${bucket}`;
    const current = bestByBucket.get(key);
    if (!current || stateUtility(state) > stateUtility(current)) {
      bestByBucket.set(key, state);
    }
  }

  return [...bestByBucket.values()]
    .sort((a, b) => stateUtility(b) - stateUtility(a))
    .slice(0, 5000);
}

/**
 * Combinada visual basada en los partidos analizados.
 *
 * v0.18:
 * - SOLO perfiles ALTA; MUY ALTA queda visible abajo pero fuera de la combinada.
 * - acepta cuota REAL o EST. útil, siempre etiquetada correctamente.
 * - con cuotas EST. intenta construir 4–6 patas y acercarse al centro de @8–@10 (ancla @9).
 * - si no puede llegar sin salir de ALTA, devuelve la mejor combinación disponible;
 *   nunca inventa una cuota REAL ni rebaja la confianza solo para alcanzar @10.
 */
export function selectAnalysisPicks(
  items: AnalyzedFixtureSummary[],
  limit = FUTBOLYLICTS_RULES.maxSelections,
): AnalyzedFixtureSummary[] {
  const maxSelections = Math.max(1, Math.min(limit, FUTBOLYLICTS_RULES.maxSelections));

  const eligible = [...items]
    .filter(
      (item) =>
        item.probability >= FUTBOLYLICTS_RULES.minProbability &&
        (item.score ?? 0) >= FUTBOLYLICTS_RULES.minScore &&
        (!FUTBOLYLICTS_RULES.comboOnlyHighConfidence || !isVeryHigh(item)) &&
        hasUsefulDisplayedOdds(item),
    )
    .sort((a, b) => {
      const scoreGap = (b.score ?? 0) - (a.score ?? 0);
      if (scoreGap !== 0) return scoreGap;
      return b.probability - a.probability;
    });

  if (!eligible.length) return [];
  if (eligible.length <= Math.min(FUTBOLYLICTS_RULES.minSelections, maxSelections)) {
    return eligible.slice(0, maxSelections);
  }

  let states: State[] = [{ picks: [], totalOdds: 1, scoreSum: 0, probabilitySum: 0 }];

  for (const item of eligible) {
    const next = [...states];
    for (const state of states) {
      if (state.picks.length >= maxSelections) continue;
      const odds = item.odds ?? 1;
      const totalOdds = state.totalOdds * odds;
      if (totalOdds > FUTBOLYLICTS_RULES.acceptableTotalOddsMax * 1.03) continue;

      next.push({
        picks: [...state.picks, item],
        totalOdds,
        scoreSum: state.scoreSum + (item.score ?? 0),
        probabilitySum: state.probabilitySum + item.probability,
      });
    }
    states = prune(next);
  }

  const minSelections = Math.min(FUTBOLYLICTS_RULES.minSelections, eligible.length, maxSelections);
  const valid = states.filter(
    (state) => state.picks.length >= minSelections && state.picks.length <= maxSelections,
  );

  const inTarget = valid
    .filter(
      (state) =>
        state.totalOdds >= FUTBOLYLICTS_RULES.targetTotalOddsMin &&
        state.totalOdds <= FUTBOLYLICTS_RULES.targetTotalOddsMax,
    )
    .sort((a, b) => stateUtility(b) - stateUtility(a));

  if (inTarget[0]) return inTarget[0].picks;

  // Si @8–@10 no es alcanzable con ALTA, elegimos lo más cercano posible sin
  // degradar el filtro. Se prioriza una combinación completa y luego la calidad.
  const fallback = valid.sort((a, b) => {
    const distanceGap = targetDistance(a.totalOdds) - targetDistance(b.totalOdds);
    if (Math.abs(distanceGap) > 0.015) return distanceGap;
    return stateUtility(b) - stateUtility(a);
  })[0];

  if (fallback) return fallback.picks;
  return eligible.slice(0, maxSelections);
}

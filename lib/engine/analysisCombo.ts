import { FUTBOLYLICTS_RULES } from "@/lib/config/rules";
import type { AnalyzedFixtureSummary } from "@/lib/engine/types";

function hasUsefulDisplayedOdds(item: AnalyzedFixtureSummary) {
  const odds = item.odds;
  if (odds === undefined) return false;
  if (odds < FUTBOLYLICTS_RULES.preferredOddsMin) return false;
  if (odds > FUTBOLYLICTS_RULES.eligibleOddsMax) return false;
  if (item.bestMarketLabel.includes("Ambos marcan") && odds < FUTBOLYLICTS_RULES.bttsMinOdds) return false;
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
  const weakest = Math.min(...state.picks.map((p) => p.score ?? 0));
  const countPenalty = Math.abs(state.picks.length - FUTBOLYLICTS_RULES.idealSelections) * 0.15;
  return avgScore * 12 + avgProbability * 8 + weakest * 1.8 - countPenalty;
}

function targetDistance(totalOdds: number) {
  return Math.abs(Math.log(Math.max(totalOdds, 1.01)) - Math.log(FUTBOLYLICTS_RULES.targetAnchor));
}

function stateUtility(state: State) {
  const inTarget = state.totalOdds >= FUTBOLYLICTS_RULES.targetTotalOddsMin && state.totalOdds <= FUTBOLYLICTS_RULES.targetTotalOddsMax;
  // v0.19: entrar en @8–@10 es un bonus pequeño. La calidad sigue mandando.
  return quality(state) + (inTarget ? 6 : 0) - targetDistance(state.totalOdds) * 2;
}

function prune(states: State[]) {
  const bestByBucket = new Map<string, State>();
  for (const state of states) {
    if (state.totalOdds > FUTBOLYLICTS_RULES.acceptableTotalOddsMax * 1.03) continue;
    const bucket = Math.floor(state.totalOdds * 10);
    const key = `${state.picks.length}:${bucket}`;
    const current = bestByBucket.get(key);
    if (!current || stateUtility(state) > stateUtility(current)) bestByBucket.set(key, state);
  }
  return [...bestByBucket.values()].sort((a, b) => stateUtility(b) - stateUtility(a)).slice(0, 5000);
}

/**
 * Shortlist visual basada en los partidos analizados.
 * v0.23: todas las cuotas mostradas son EST. calibradas; ALTA y MUY ALTA pueden
 * entrar y @8–@10 es un objetivo, nunca una excusa para empeorar un pick.
 */
export function selectAnalysisPicks(
  items: AnalyzedFixtureSummary[],
  limit = FUTBOLYLICTS_RULES.maxSelections,
): AnalyzedFixtureSummary[] {
  const maxSelections = Math.max(1, Math.min(limit, FUTBOLYLICTS_RULES.maxSelections));
  const eligible = [...items]
    .filter((item) => item.probability >= FUTBOLYLICTS_RULES.minProbability && (item.score ?? 0) >= FUTBOLYLICTS_RULES.minScore && hasUsefulDisplayedOdds(item))
    .sort((a, b) => {
      const scoreGap = (b.score ?? 0) - (a.score ?? 0);
      if (Math.abs(scoreGap) > FUTBOLYLICTS_RULES.scoreTieTolerance) return scoreGap;
      return b.probability - a.probability;
    });

  if (!eligible.length) return [];
  if (eligible.length <= Math.min(FUTBOLYLICTS_RULES.minSelections, maxSelections)) return eligible.slice(0, maxSelections);

  let states: State[] = [{ picks: [], totalOdds: 1, scoreSum: 0, probabilitySum: 0 }];
  for (const item of eligible) {
    const next = [...states];
    for (const state of states) {
      if (state.picks.length >= maxSelections) continue;
      const odds = item.odds ?? 1;
      const totalOdds = state.totalOdds * odds;
      if (totalOdds > FUTBOLYLICTS_RULES.acceptableTotalOddsMax * 1.03) continue;
      next.push({ picks: [...state.picks, item], totalOdds, scoreSum: state.scoreSum + (item.score ?? 0), probabilitySum: state.probabilitySum + item.probability });
    }
    states = prune(next);
  }

  const minSelections = Math.min(FUTBOLYLICTS_RULES.minSelections, eligible.length, maxSelections);
  const valid = states.filter((state) => state.picks.length >= minSelections && state.picks.length <= maxSelections);
  if (!valid.length) return eligible.slice(0, maxSelections);

  // Elegimos por utilidad de calidad global; @8–@10 ayuda, pero no domina.
  return valid.sort((a, b) => stateUtility(b) - stateUtility(a))[0].picks;
}

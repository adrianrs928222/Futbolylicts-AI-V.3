import { FUTBOLYLICTS_RULES } from "@/lib/config/rules";
import type { AnalyzedFixtureSummary } from "@/lib/engine/types";

function eligible(item: AnalyzedFixtureSummary) {
  const odds = item.odds;
  if (odds === undefined || odds < FUTBOLYLICTS_RULES.absoluteMinOdds) return false;
  const isBtts = item.bestMarketLabel.toLowerCase().includes("ambos marcan");
  const high = (item.score ?? 0) >= FUTBOLYLICTS_RULES.minScore && item.probability >= FUTBOLYLICTS_RULES.minProbability;
  const max = isBtts && high ? FUTBOLYLICTS_RULES.bttsHighConfidenceMaxOdds : FUTBOLYLICTS_RULES.standardMaxOdds;
  return odds <= max && item.probability >= FUTBOLYLICTS_RULES.minProbability && (item.score ?? 0) >= FUTBOLYLICTS_RULES.minScore;
}

function value(item: AnalyzedFixtureSummary) {
  const odds = item.odds ?? 1;
  const sweet = odds >= 1.30 && odds <= 1.75 ? 0.45 : odds >= 1.25 && odds <= 1.90 ? 0.20 : 0;
  return (item.score ?? 0) * 1.5 + item.probability * 8 + sweet + Math.log(odds) * 0.25;
}

export function selectAnalysisPicks(items: AnalyzedFixtureSummary[], limit = FUTBOLYLICTS_RULES.maxSelections) {
  return [...items].filter(eligible).sort((a,b) => value(b)-value(a)).slice(0, Math.max(1, Math.min(limit, FUTBOLYLICTS_RULES.maxSelections)));
}

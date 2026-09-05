import { FUTBOLYLICTS_RULES } from "@/lib/config/rules";
import type { AnalyzedFixtureSummary } from "@/lib/engine/types";

function isVeryHigh(item: AnalyzedFixtureSummary) {
  return (item.score ?? 0) >= FUTBOLYLICTS_RULES.veryHighScore &&
    item.probability >= FUTBOLYLICTS_RULES.veryHighProbability;
}

/**
 * Selección visual de la Combinada del día basada en el análisis del motor.
 * No exige cuota real: si el análisis estadístico es ALTA/MUY ALTA, el pick
 * puede mostrarse para que el usuario vea el mercado exacto. Nunca inventa cuota.
 */
export function selectAnalysisPicks(
  items: AnalyzedFixtureSummary[],
  limit = FUTBOLYLICTS_RULES.idealSelections,
): AnalyzedFixtureSummary[] {
  return [...items]
    .filter(
      (item) =>
        item.probability >= FUTBOLYLICTS_RULES.minProbability &&
        (item.score ?? 0) >= FUTBOLYLICTS_RULES.minScore,
    )
    .sort((a, b) => {
      const veryHighGap = Number(isVeryHigh(b)) - Number(isVeryHigh(a));
      if (veryHighGap !== 0) return veryHighGap;
      const scoreGap = (b.score ?? 0) - (a.score ?? 0);
      if (scoreGap !== 0) return scoreGap;
      return b.probability - a.probability;
    })
    .slice(0, Math.max(1, limit));
}

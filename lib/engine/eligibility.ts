import { FUTBOLYLICTS_RULES } from "@/lib/config/rules";
import type { MarketCandidate } from "@/lib/engine/types";

export function isHighConfidence(candidate: Pick<MarketCandidate, "confidence">) {
  return candidate.confidence === "ALTA" || candidate.confidence === "MUY_ALTA";
}

export function marketOddsCeiling(candidate: Pick<MarketCandidate, "market" | "confidence">) {
  if (candidate.market === "BTTS_YES" && isHighConfidence(candidate)) {
    return FUTBOLYLICTS_RULES.bttsHighConfidenceMaxOdds;
  }
  return FUTBOLYLICTS_RULES.standardMaxOdds;
}

export function isDisplayedOddsEligible(candidate: Pick<MarketCandidate, "market" | "odds" | "confidence">) {
  if (!Number.isFinite(candidate.odds)) return false;
  if (candidate.odds < FUTBOLYLICTS_RULES.absoluteMinOdds) return false;
  return candidate.odds <= marketOddsCeiling(candidate);
}

export function isOfficialCandidateEligible(candidate: MarketCandidate) {
  // Evita que el motor use 12 + Más de 1.5 como comodín automático
  // para transformar favoritos de cuota muy baja en picks oficiales.
  if (candidate.market === "COMBO_12_OVER_1_5") return false;

  if (candidate.score < FUTBOLYLICTS_RULES.minScore) return false;
  if (candidate.probability < FUTBOLYLICTS_RULES.minProbability) return false;
  if (!isHighConfidence(candidate)) return false;
  if (!isDisplayedOddsEligible(candidate)) return false;
  if (FUTBOLYLICTS_RULES.requireRealOddsInDailyCombo && !candidate.realOdds) return false;
  if (!candidate.realOdds && !FUTBOLYLICTS_RULES.allowEstimatedOddsInOfficialCombo) return false;
  return true;
}

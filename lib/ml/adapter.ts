import type { DailyAnalysis, MarketCandidate, MarketKey } from "@/lib/engine/types";
import { getTrainingRows } from "@/lib/ml/storage";
import { buildMarketCalibrations, calibrateCandidate } from "@/lib/ml/market-calibration";

/** Calibrate by market only when a chronological holdout demonstrates improvement. */
export async function applyMlCalibration(analysis: DailyAnalysis): Promise<DailyAnalysis> {
  if (analysis.mode !== "live" || process.env.ML_CALIBRATION_ENABLED === "false") return analysis;
  try {
    const rows = await getTrainingRows(Number(process.env.ML_MAX_TRAINING_ROWS ?? 10000));
    const markets = [...new Set(analysis.candidates.map(c => c.market))] as MarketKey[];
    const models = new Map(buildMarketCalibrations(rows, markets).map(m => [m.market, m]));
    const candidates = analysis.candidates.map((candidate: MarketCandidate) => calibrateCandidate(candidate, models.get(candidate.market)));
    return { ...analysis, candidates };
  } catch (error) {
    console.error("Calibración no disponible; se conservan las probabilidades originales", error);
    return analysis;
  }
}

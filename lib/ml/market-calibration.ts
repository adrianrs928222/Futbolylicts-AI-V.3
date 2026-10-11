import type { MarketCandidate, MarketKey } from "@/lib/engine/types";
import type { MlPredictionRow } from "@/lib/ml/types";

/** Calibration is trained only on resolved, pre-match forecasts; no invented history. */
export interface MarketCalibration {
  market: MarketKey;
  sampleCount: number;
  validationCount: number;
  rawBrier: number | null;
  calibratedBrier: number | null;
  bins: Array<{ n: number; successes: number; predicted: number }>;
  validated: boolean;
}
const clamp = (p: number) => Math.max(0.01, Math.min(0.99, p));
const brier = (p: number, y: boolean) => (p - Number(y)) ** 2;
const bin = (p: number) => Math.min(9, Math.floor(clamp(p) * 10));

function fit(rows: MlPredictionRow[], market: MarketKey): MarketCalibration {
  const ordered = rows.filter(r => r.market === market && r.target_correct !== null && Number.isFinite(r.engine_probability))
    .sort((a, b) => String(a.kickoff ?? a.prediction_date).localeCompare(String(b.kickoff ?? b.prediction_date)));
  const cut = Math.floor(ordered.length * 0.8);
  const train = ordered.slice(0, cut);
  const validation = ordered.slice(cut);
  const bins = Array.from({ length: 10 }, () => ({ n: 0, successes: 0, predicted: 0 }));
  for (const r of train) {
    const bucket = bins[bin(r.engine_probability)];
    bucket.n++;
    bucket.successes += Number(r.target_correct);
    bucket.predicted += r.engine_probability;
  }
  const adjust = (p: number) => {
    const b = bins[bin(p)];
    // Bayesian smoothing: small bins stay near original estimate.
    const priorStrength = 30;
    return clamp((b.successes + priorStrength * p) / (b.n + priorStrength));
  };
  const rawBrier = validation.length ? validation.reduce((s, r) => s + brier(clamp(r.engine_probability), Boolean(r.target_correct)), 0) / validation.length : null;
  const calibratedBrier = validation.length ? validation.reduce((s, r) => s + brier(adjust(r.engine_probability), Boolean(r.target_correct)), 0) / validation.length : null;
  return { market, sampleCount: train.length, validationCount: validation.length, rawBrier, calibratedBrier, bins,
    validated: train.length >= 100 && validation.length >= 30 && calibratedBrier !== null && rawBrier !== null && calibratedBrier < rawBrier };
}
export function buildMarketCalibrations(rows: MlPredictionRow[], markets: MarketKey[]): MarketCalibration[] {
  return markets.map(market => fit(rows, market));
}
export function calibrateCandidate(candidate: MarketCandidate, calibration?: MarketCalibration): MarketCandidate {
  if (!calibration?.validated) return candidate;
  const p = clamp(candidate.probability);
  const b = calibration.bins[bin(p)];
  const corrected = clamp((b.successes + 30 * p) / (b.n + 30));
  // Guardrail against large adjustments when conditions change.
  return { ...candidate, probability: Math.max(p - 0.08, Math.min(p + 0.08, corrected)) };
}

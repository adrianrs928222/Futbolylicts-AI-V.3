import type { DailyAnalysis, MarketCandidate } from "@/lib/engine/types";
import { buildFeatures } from "@/lib/ml/features";
import { predict } from "@/lib/ml/model";
import { getLatestModel } from "@/lib/ml/storage";

/**
 * Capa externa: no modifica lib/engine ni sus reglas.
 * Devuelve la misma estructura de DailyAnalysis y únicamente recalibra la
 * probabilidad de candidatos cuando existe un modelo entrenado suficiente.
 */
export async function applyMlCalibration(analysis: DailyAnalysis): Promise<DailyAnalysis> {
  if (analysis.mode !== "live") return analysis;
  const model = await getLatestModel();
  if (!model || model.sample_count < Number(process.env.ML_MIN_SAMPLES ?? 100)) return analysis;

  const kickoffByFixture = new Map(analysis.allFixtures.map((fixture) => [fixture.fixtureId, fixture.kickoff]));
  const scored = analysis.candidates.map((candidate: MarketCandidate) => {
    const ml = predict(model, buildFeatures(candidate, kickoffByFixture.get(candidate.fixtureId) ?? null));
    // El ML actúa como calibrador, no como sustituto del motor. Se limita la
    // corrección para evitar que un modelo pequeño desplace bruscamente al motor.
    const blended = Math.max(0.01, Math.min(0.99, candidate.probability * 0.70 + ml * 0.30));
    return { ...candidate, probability: blended } satisfies MarketCandidate;
  });
  return { ...analysis, candidates: scored };
}

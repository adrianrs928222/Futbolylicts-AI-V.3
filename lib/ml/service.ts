import type { DailyAnalysis, MarketCandidate } from "@/lib/engine/types";
import { buildFeatures } from "@/lib/ml/features";
import { marketWon } from "@/lib/ml/evaluator";
import { trainLogisticRegression, predict } from "@/lib/ml/model";
import { getFixtureResult } from "@/lib/ml/results";
import { getLatestModel, getMlStatus, getPendingPredictions, getStoredAnalysesSince, getTrainingRows, resolvePrediction, saveModel, savePredictions } from "@/lib/ml/storage";
import type { MlPredictionRow } from "@/lib/ml/types";

function predictionRows(analysis: DailyAnalysis): MlPredictionRow[] {
  const kickoffByFixture = new Map(analysis.allFixtures.map((fixture) => [fixture.fixtureId, fixture.kickoff]));
  return analysis.candidates.map((candidate: MarketCandidate) => ({
    fixture_id: candidate.fixtureId,
    prediction_date: analysis.date,
    kickoff: kickoffByFixture.get(candidate.fixtureId) ?? null,
    fixture_label: candidate.fixtureLabel,
    league_name: analysis.allFixtures.find((fixture) => fixture.fixtureId === candidate.fixtureId)?.leagueName ?? "",
    category: candidate.category,
    market: candidate.market,
    engine_probability: candidate.probability,
    engine_score: candidate.score,
    estimated_odds: candidate.odds,
    features: buildFeatures(candidate, kickoffByFixture.get(candidate.fixtureId) ?? null),
    target_correct: null,
    result_home_goals: null,
    result_away_goals: null,
  }));
}

export async function captureDailyAnalysis(analysis: DailyAnalysis) {
  if (analysis.mode !== "live") return 0;
  const rows = predictionRows(analysis);
  await savePredictions(rows);
  return rows.length;
}

export async function resolvePending(limit = Number(process.env.ML_MAX_FIXTURES_PER_RUN ?? 30)) {
  const pending = await getPendingPredictions(limit * 24);
  const unique = [...new Map(pending.map((row) => [row.fixture_id, row])).values()].slice(0, limit);
  let resolvedFixtures = 0;
  for (const row of unique) {
    const result = await getFixtureResult(row.fixture_id);
    if (!result || !["FT", "AET", "PEN"].includes(result.status)) continue;
    const sameFixture = pending.filter((item) => item.fixture_id === row.fixture_id);
    await resolvePrediction(row.fixture_id, result.homeGoals, result.awayGoals, sameFixture.map((item) => ({ market: item.market, correct: marketWon(item.market, result.homeGoals, result.awayGoals) })));
    resolvedFixtures += 1;
  }
  return { resolvedFixtures, pendingSeen: pending.length };
}

export async function trainModel() {
  const rows = await getTrainingRows(Number(process.env.ML_MAX_TRAINING_ROWS ?? 10000));
  if (rows.length < Number(process.env.ML_MIN_SAMPLES ?? 100)) return { trained: false, sampleCount: rows.length, model: await getLatestModel() };
  const model = trainLogisticRegression(rows.map((row) => row.features), rows.map((row) => Boolean(row.target_correct)));
  await saveModel(model);
  return { trained: true, sampleCount: rows.length, model };
}

export async function learn(analysis?: DailyAnalysis, bootstrapDays = Number(process.env.ML_BOOTSTRAP_DAYS ?? 14)) {
  let captured = analysis ? await captureDailyAnalysis(analysis) : 0;
  const stored = await getStoredAnalysesSince(bootstrapDays);
  for (const historical of stored) {
    if (analysis?.date === historical.date) continue;
    captured += await captureDailyAnalysis(historical);
  }
  const resolved = await resolvePending();
  const trained = await trainModel();
  return { captured, ...resolved, trained: trained.trained, sampleCount: trained.sampleCount, model: trained.model };
}

export async function mlPredictionForCandidate(candidate: MarketCandidate, kickoff?: string | null) {
  const model = await getLatestModel();
  if (!model || model.sample_count < Number(process.env.ML_MIN_SAMPLES ?? 100)) return null;
  return predict(model, buildFeatures(candidate, kickoff));
}

export async function status() {
  const result = await getMlStatus();
  return {
    enabled: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.API_FOOTBALL_KEY),
    trained: Boolean(result.model),
    modelVersion: result.model?.model_version ?? "ml-calibrator-v1",
    sampleCount: result.model?.sample_count ?? 0,
    accuracy: result.model?.accuracy ?? null,
    logLoss: result.model?.log_loss ?? null,
    trainedAt: result.model?.trained_at ?? null,
    pendingCount: result.pendingCount,
  };
}

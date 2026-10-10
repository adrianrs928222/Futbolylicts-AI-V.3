import { getSupabaseAdmin } from "@/lib/cache/supabase";
import type { DailyAnalysis } from "@/lib/engine/types";
import type { MlModel, MlPredictionRow } from "@/lib/ml/types";

export async function savePredictions(rows: MlPredictionRow[]) {
  const supabase = getSupabaseAdmin();
  if (!supabase || !rows.length) return;
  const payload = rows.map((row) => ({
    fixture_id: row.fixture_id,
    prediction_date: row.prediction_date,
    kickoff: row.kickoff,
    fixture_label: row.fixture_label,
    league_name: row.league_name,
    category: row.category,
    market: row.market,
    engine_probability: row.engine_probability,
    engine_score: row.engine_score,
    estimated_odds: row.estimated_odds,
    features: row.features,
  }));
  const { error } = await supabase.from("ml_predictions").upsert(payload, { onConflict: "fixture_id,market" });
  if (error) throw error;
}

export async function getStoredAnalysesSince(days: number) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [] as DailyAnalysis[];
  const since = new Date(Date.now() - Math.max(1, days) * 86400000).toISOString().slice(0, 10);
  const { data, error } = await supabase.from("daily_analysis").select("data").gte("analysis_date", since).order("analysis_date", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => row.data as DailyAnalysis);
}

export async function getPendingPredictions(limit: number) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [] as MlPredictionRow[];
  const { data, error } = await supabase.from("ml_predictions").select("*").is("target_correct", null).order("prediction_date", { ascending: true }).limit(limit);
  if (error) throw error;
  return (data ?? []) as MlPredictionRow[];
}

export async function resolvePrediction(fixtureId: number, homeGoals: number, awayGoals: number, targets: Array<{ market: MlPredictionRow["market"]; correct: boolean }>) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  for (const target of targets) {
    const { error } = await supabase.from("ml_predictions").update({ target_correct: target.correct, result_home_goals: homeGoals, result_away_goals: awayGoals, resolved_at: new Date().toISOString() }).eq("fixture_id", fixtureId).eq("market", target.market);
    if (error) throw error;
  }
}

export async function getTrainingRows(limit = 10000) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [] as MlPredictionRow[];
  const { data, error } = await supabase.from("ml_predictions").select("*").not("target_correct", "is", null).order("prediction_date", { ascending: true }).limit(limit);
  if (error) throw error;
  return (data ?? []) as MlPredictionRow[];
}

export async function saveModel(model: MlModel) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  const { error } = await supabase.from("ml_models").upsert({ model_version: model.model_version, feature_version: model.feature_version, weights: model.weights, mean: model.mean, std: model.std, bias: model.bias, sample_count: model.sample_count, accuracy: model.accuracy, log_loss: model.log_loss, trained_at: model.trained_at }, { onConflict: "model_version" });
  if (error) throw error;
}

export async function getLatestModel() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null as MlModel | null;
  const { data, error } = await supabase.from("ml_models").select("*").order("trained_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return (data ?? null) as MlModel | null;
}

export async function getMlStatus() {
  const [model, pending] = await Promise.all([getLatestModel(), getPendingPredictions(1)]);
  const supabase = getSupabaseAdmin();
  let pendingCount = pending.length;
  if (supabase) {
    const { count } = await supabase.from("ml_predictions").select("fixture_id", { count: "exact", head: true }).is("target_correct", null);
    pendingCount = count ?? pendingCount;
  }
  return { model, pendingCount };
}

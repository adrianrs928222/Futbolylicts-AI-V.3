import { getSupabaseAdmin } from "@/lib/cache/supabase";
import type { DailyCombo, MarketCandidate } from "@/lib/engine/types";
import type { MlPredictionRow } from "@/lib/ml/types";

export type ComboHistoryStatus = "ACERTADA" | "FALLIDA" | "PENDIENTE";

export interface ComboHistoryPick {
  fixtureId: number;
  fixtureLabel: string;
  leagueName?: string;
  market: string;
  marketLabel: string;
  odds: number;
  score: number;
  correct: boolean | null;
  resultHomeGoals: number | null;
  resultAwayGoals: number | null;
}

export interface VisibleComboHistoryRow {
  date: string;
  totalOdds: number;
  globalScore: number;
  globalConfidence: string;
  status: ComboHistoryStatus;
  correctPicks: number;
  failedPicks: number;
  pendingPicks: number;
  picks: ComboHistoryPick[];
}

function extractCombo(data: unknown): DailyCombo | null {
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;
  const maybeCombo = (obj.combo && typeof obj.combo === "object" ? obj.combo : obj) as Partial<DailyCombo>;
  if (!Array.isArray(maybeCombo.picks)) return null;
  return maybeCombo as DailyCombo;
}

export async function getVisibleHistory(limit = 180) {
  const supabase = getSupabaseAdmin();
  const empty = {
    rows: [] as VisibleComboHistoryRow[],
    summary: { total: 0, resolved: 0, correct: 0, incorrect: 0, pending: 0, hitRate: 0, averageOdds: 0 },
  };
  if (!supabase) return empty;

  const safeLimit = Math.max(1, Math.min(limit, 365));
  const [{ data: comboRows, error: comboError }, { data: analysisRows, error: analysisError }] = await Promise.all([
    supabase
      .from("combo_history")
      .select("combo_date,data,updated_at")
      .order("combo_date", { ascending: false })
      .limit(safeLimit),
    supabase
      .from("daily_analysis")
      .select("analysis_date,data,generated_at")
      .order("analysis_date", { ascending: false })
      .limit(safeLimit),
  ]);
  if (comboError) throw comboError;
  if (analysisError) throw analysisError;

  const byDate = new Map<string, DailyCombo>();
  const storedCombos = (comboRows ?? []) as Array<{ combo_date: string; data: unknown; updated_at?: string }>;
  for (const row of storedCombos) {
    const combo = extractCombo(row.data);
    if (combo?.picks?.length && combo.targetReached) byDate.set(String(row.combo_date), combo);
  }

  // Backfill visible history from existing daily_analysis rows so deployments that
  // already have past analyses do not start with an empty history after this update.
  const storedAnalyses = (analysisRows ?? []) as Array<{ analysis_date: string; data: unknown; generated_at?: string }>;
  for (const row of storedAnalyses) {
    if (byDate.has(String(row.analysis_date))) continue;
    const combo = extractCombo(row.data);
    if (combo?.picks?.length && combo.targetReached && combo.official !== false) byDate.set(String(row.analysis_date), combo);
  }

  const combos = [...byDate.entries()]
    .map(([date, combo]) => ({ date, combo }))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, safeLimit);

  if (!combos.length) return empty;

  const fixtureIds = [...new Set(combos.flatMap((row: { date: string; combo: DailyCombo }) => row.combo.picks.map((pick: MarketCandidate) => pick.fixtureId)))];
  let predictions: MlPredictionRow[] = [];
  if (fixtureIds.length) {
    const { data, error } = await supabase.from("ml_predictions").select("*").in("fixture_id", fixtureIds);
    if (error) throw error;
    predictions = (data ?? []) as MlPredictionRow[];
  }

  const resultByPick = new Map<string, MlPredictionRow>();
  for (const prediction of predictions) resultByPick.set(`${prediction.fixture_id}:${prediction.market}`, prediction);

  const rows: VisibleComboHistoryRow[] = combos.map(({ date, combo }: { date: string; combo: DailyCombo }) => {
    const picks = combo.picks.map((pick: MarketCandidate): ComboHistoryPick => {
      const result = resultByPick.get(`${pick.fixtureId}:${pick.market}`);
      return {
        fixtureId: pick.fixtureId,
        fixtureLabel: pick.fixtureLabel,
        leagueName: pick.leagueName,
        market: pick.market,
        marketLabel: pick.marketLabel,
        odds: pick.odds,
        score: pick.score,
        correct: result?.target_correct ?? null,
        resultHomeGoals: result?.result_home_goals ?? null,
        resultAwayGoals: result?.result_away_goals ?? null,
      };
    });

    const failedPicks = picks.filter((pick: ComboHistoryPick) => pick.correct === false).length;
    const correctPicks = picks.filter((pick: ComboHistoryPick) => pick.correct === true).length;
    const pendingPicks = picks.length - failedPicks - correctPicks;
    const status: ComboHistoryStatus = failedPicks > 0 ? "FALLIDA" : pendingPicks === 0 && picks.length > 0 ? "ACERTADA" : "PENDIENTE";

    return {
      date,
      totalOdds: combo.totalOdds,
      globalScore: combo.globalScore,
      globalConfidence: combo.globalConfidence,
      status,
      correctPicks,
      failedPicks,
      pendingPicks,
      picks,
    };
  });

  const resolvedRows = rows.filter((row) => row.status !== "PENDIENTE");
  const correct = resolvedRows.filter((row) => row.status === "ACERTADA").length;
  const averageOdds = rows.length ? rows.reduce((sum, row) => sum + row.totalOdds, 0) / rows.length : 0;

  return {
    rows,
    summary: {
      total: rows.length,
      resolved: resolvedRows.length,
      correct,
      incorrect: resolvedRows.length - correct,
      pending: rows.length - resolvedRows.length,
      hitRate: resolvedRows.length ? correct / resolvedRows.length : 0,
      averageOdds,
    },
  };
}

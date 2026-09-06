import { getSupabaseAdmin } from "@/lib/cache/supabase";
import type { DailyAnalysis } from "@/lib/engine/types";

export async function snapshotCombo(analysis: DailyAnalysis): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase || analysis.mode !== "live" || analysis.combo.picks.length === 0) return;

  await supabase.from("combo_history").insert({
    analysis_date: analysis.date,
    generated_at: analysis.generatedAt,
    total_odds: analysis.combo.totalOdds,
    global_score: analysis.combo.globalScore,
    picks_count: analysis.combo.picks.length,
    payload: JSON.parse(JSON.stringify(analysis.combo)),
  });
}

import { getSupabaseAdmin } from "@/lib/cache/supabase";
import type { DailyAnalysis } from "@/lib/engine/types";

export async function saveDailyAnalysis(analysis: DailyAnalysis): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase || analysis.mode !== "live") return;

  const payload = JSON.parse(JSON.stringify(analysis));

  const { error } = await supabase.from("daily_analysis").upsert({
    analysis_date: analysis.date,
    generated_at: analysis.generatedAt,
    total_odds: analysis.combo.totalOdds,
    global_score: analysis.combo.globalScore,
    picks_count: analysis.combo.picks.length,
    payload,
  });

  if (error) throw error;
}

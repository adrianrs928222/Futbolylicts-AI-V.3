import { getSupabaseAdmin } from "@/lib/cache/supabase";
import type { DailyAnalysis } from "@/lib/engine/types";
export async function saveDailyAnalysis(analysis: DailyAnalysis) {
  const supabase = getSupabaseAdmin(); if (!supabase) return;
  await supabase.from("daily_analysis").upsert({ analysis_date: analysis.date, generated_at: analysis.generatedAt, data: analysis }, { onConflict: "analysis_date" });
}

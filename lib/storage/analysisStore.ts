import { getSupabaseAdmin } from "@/lib/cache/supabase";
import type { DailyAnalysis } from "@/lib/engine/types";
export async function saveDailyAnalysis(analysis: DailyAnalysis) {
  const supabase = getSupabaseAdmin(); if (!supabase) return;
  await supabase.from("daily_analysis").upsert({ analysis_date: analysis.date, generated_at: analysis.generatedAt, data: analysis }, { onConflict: "analysis_date" });
}

export async function loadDailyAnalysis(date: string, maxAgeSeconds = 6 * 60 * 60): Promise<DailyAnalysis | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { data, error } = await supabase.from("daily_analysis").select("data,generated_at").eq("analysis_date", date).maybeSingle();
  if (error || !data?.data) return null;
  const generatedAt = new Date(data.generated_at ?? data.data.generatedAt ?? 0).getTime();
  if (!Number.isFinite(generatedAt) || Date.now() - generatedAt > maxAgeSeconds * 1000) return null;
  return data.data as DailyAnalysis;
}

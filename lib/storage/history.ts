import { getSupabaseAdmin } from "@/lib/cache/supabase";
export async function saveComboResult(date: string, data: unknown) {
  const supabase = getSupabaseAdmin(); if (!supabase) return;
  await supabase.from("combo_history").upsert({ combo_date: date, data, updated_at: new Date().toISOString() }, { onConflict: "combo_date" });
}

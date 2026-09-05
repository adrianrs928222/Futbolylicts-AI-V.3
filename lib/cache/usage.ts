import { API_POLICY } from "@/lib/config/rules";
import { getSupabaseAdmin } from "@/lib/cache/supabase";

const memoryUsage = new Map<string, number>();

function today() {
  return new Date().toISOString().slice(0, 10);
}

function todayKey(provider: string) {
  return `${today()}:${provider}`;
}

export async function getUsage(provider: string): Promise<number> {
  const key = todayKey(provider);
  const memoryCount = memoryUsage.get(key) ?? 0;
  const supabase = getSupabaseAdmin();
  if (!supabase) return memoryCount;

  const { data } = await supabase
    .from("api_usage_daily")
    .select("calls")
    .eq("usage_date", today())
    .eq("provider", provider)
    .maybeSingle();

  return Math.max(memoryCount, data?.calls ?? 0);
}

/**
 * Reserva créditos de forma conservadora ANTES de contactar al proveedor.
 * API-Football usa 1 crédito por llamada. The Odds API usa créditos por mercado/región.
 */
export async function reserveApiCredits(
  provider: string,
  credits: number,
  budget: number,
): Promise<boolean> {
  const safeCredits = Math.max(0, Math.floor(credits));
  if (safeCredits === 0) return true;

  const key = todayKey(provider);
  const supabase = getSupabaseAdmin();

  if (supabase) {
    const { data, error } = await supabase.rpc("reserve_api_credits", {
      p_usage_date: today(),
      p_provider: provider,
      p_budget: budget,
      p_credits: safeCredits,
    });

    if (!error) {
      const allowed = Boolean(data);
      if (allowed) memoryUsage.set(key, (memoryUsage.get(key) ?? 0) + safeCredits);
      return allowed;
    }
  }

  // Fallback local si todavía no se ejecutó la migración v0.7.
  const current = memoryUsage.get(key) ?? 0;
  if (current + safeCredits > budget) return false;
  memoryUsage.set(key, current + safeCredits);
  return true;
}

/** API-Football: compatibilidad con el contador antiguo, 1 llamada = 1 crédito. */
export async function spendApiCall(provider: string): Promise<boolean> {
  return reserveApiCredits(provider, 1, API_POLICY.dailyCallBudget);
}

export async function canSpendCall(provider: string): Promise<boolean> {
  return (await getUsage(provider)) < API_POLICY.dailyCallBudget;
}

export async function recordApiCall(provider: string): Promise<void> {
  const key = todayKey(provider);
  memoryUsage.set(key, (memoryUsage.get(key) ?? 0) + 1);
}

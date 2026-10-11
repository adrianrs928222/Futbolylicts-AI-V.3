import { NextResponse } from "next/server";
import { API_POLICY, ODDS_API_POLICY } from "@/lib/config/rules";
import { getMemoryCacheStats } from "@/lib/cache/cache";
import { supabaseConfigured } from "@/lib/cache/supabase";
import { getUsage } from "@/lib/cache/usage";

export const dynamic = "force-dynamic";

export async function GET() {
  const cache = getMemoryCacheStats();
  const footballUsed = await getUsage("api-football");
  const historicalOddsUsed = await getUsage("the-odds-api");
  return NextResponse.json({
    ok: true,
    version: "0.23.0",
    apiFootball: {
      role: "datos deportivos",
      used: footballUsed,
      budget: API_POLICY.dailyCallBudget,
      remaining: Math.max(0, API_POLICY.dailyCallBudget - footballUsed),
    },
    estimatedOddsEngine: {
      role: "cuotas EST. de la Combinada del día",
      enabled: true,
      bookmakerStyleCalibration: true,
      sameGameComboScorelineModel: true,
    },
    theOddsApi: {
      role: "opcional / compatibilidad; no necesaria para v0.23",
      usedCreditsToday: historicalOddsUsed,
      dailySafetyBudget: ODDS_API_POLICY.dailyCreditBudget,
      bookmaker: ODDS_API_POLICY.bookmaker,
    },
    cache: { persistent: supabaseConfigured(), ...cache },
  });
}

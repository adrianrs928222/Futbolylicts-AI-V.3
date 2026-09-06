import { NextResponse } from "next/server";
import { API_POLICY, ODDS_API_POLICY } from "@/lib/config/rules";
import { getMemoryCacheStats } from "@/lib/cache/cache";
import { supabaseConfigured } from "@/lib/cache/supabase";
import { getUsage } from "@/lib/cache/usage";

export const dynamic = "force-dynamic";

export async function GET() {
  const cache = getMemoryCacheStats();
  const footballUsed = await getUsage("api-football");
  const oddsUsed = await getUsage("the-odds-api");

  return NextResponse.json({
    ok: true,
    apiFootball: {
      role: "datos deportivos",
      used: footballUsed,
      budget: API_POLICY.dailyCallBudget,
      remaining: Math.max(0, API_POLICY.dailyCallBudget - footballUsed),
    },
    theOddsApi: {
      role: "cuotas exclusivamente",
      usedCreditsToday: oddsUsed,
      dailySafetyBudget: ODDS_API_POLICY.dailyCreditBudget,
      remainingSafetyCredits: Math.max(0, ODDS_API_POLICY.dailyCreditBudget - oddsUsed),
      bookmaker: ODDS_API_POLICY.bookmaker,
    },
    cache: {
      persistent: supabaseConfigured(),
      ...cache,
    },
  });
}

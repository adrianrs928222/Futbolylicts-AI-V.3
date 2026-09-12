import { NextRequest, NextResponse } from "next/server";
import { dateInMadrid } from "@/lib/date";
import { buildCurrentOrNextAnalysis, type AnalysisScope } from "@/lib/engine/analyze";
import { captureDailyAnalysis } from "@/lib/ml/service";
import { saveComboResult } from "@/lib/storage/history";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const date = typeof body?.date === "string" ? body.date : dateInMadrid();
  const scope = (["all", "champions"] as const).includes(body?.scope) ? body.scope as AnalysisScope : "all";
  const leagueNames = Array.isArray(body?.leagueNames) ? body.leagueNames.filter((v: unknown): v is string => typeof v === "string") : undefined;
  const analysis = await buildCurrentOrNextAnalysis(date, { scope, leagueNames });
  await captureDailyAnalysis(analysis);
  if (analysis.mode === "live" && analysis.combo.official && analysis.combo.picks.length > 0) {
    await saveComboResult(analysis.date, { combo: analysis.combo, generatedAt: analysis.generatedAt });
  }
  return NextResponse.json(analysis, { headers: { "Cache-Control": "no-store" } });
}

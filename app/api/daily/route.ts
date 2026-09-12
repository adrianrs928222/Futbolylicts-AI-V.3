import { NextRequest, NextResponse } from "next/server";
import { dateInMadrid } from "@/lib/date";
import { buildCurrentOrNextAnalysis, buildDailyAnalysis, type AnalysisScope } from "@/lib/engine/analyze";
import { captureDailyAnalysis } from "@/lib/ml/service";
import { saveComboResult } from "@/lib/storage/history";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const requestedDate = request.nextUrl.searchParams.get("date");
  const date = requestedDate ?? dateInMadrid();
  const rawScope = request.nextUrl.searchParams.get("scope");
  const scope: AnalysisScope = rawScope === "champions" ? rawScope : "all";
  const analysis = requestedDate ? await buildDailyAnalysis(date, { scope }) : await buildCurrentOrNextAnalysis(date, { scope });
  await captureDailyAnalysis(analysis);
  if (analysis.mode === "live" && analysis.combo.official && analysis.combo.picks.length > 0) {
    await saveComboResult(analysis.date, { combo: analysis.combo, generatedAt: analysis.generatedAt });
  }
  return NextResponse.json(analysis, { headers: { "Cache-Control": "no-store" } });
}

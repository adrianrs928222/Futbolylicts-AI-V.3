import { NextRequest, NextResponse } from "next/server";
import { dateInMadrid } from "@/lib/date";
import { buildCurrentOrNextAnalysis, buildDailyAnalysis } from "@/lib/engine/analyze";
import { captureDailyAnalysis } from "@/lib/ml/service";
import { saveComboResult } from "@/lib/storage/history";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const requestedDate = request.nextUrl.searchParams.get("date");
    const date = requestedDate ?? dateInMadrid();
    const analysis = requestedDate ? await buildDailyAnalysis(date) : await buildCurrentOrNextAnalysis(date);

    // ML e historial nunca deben impedir que la web muestre el análisis principal.
    try {
      await captureDailyAnalysis(analysis);
    } catch (error) {
      console.error("[daily] ML capture skipped:", error);
    }

    if (analysis.mode === "live" && analysis.combo.official && analysis.combo.targetReached && analysis.combo.picks.length > 0) {
      try {
        await saveComboResult(analysis.date, { combo: analysis.combo, generatedAt: analysis.generatedAt });
      } catch (error) {
        console.error("[daily] combo history save skipped:", error);
      }
    }

    return NextResponse.json(analysis, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[daily] analysis failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo generar el análisis diario" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { dateInMadrid } from "@/lib/date";
import { buildCurrentOrNextAnalysis, buildDailyAnalysis } from "@/lib/engine/analyze";
import { captureDailyAnalysis } from "@/lib/ml/service";
import { saveComboResult } from "@/lib/storage/history";
import { loadDailyAnalysis } from "@/lib/storage/analysisStore";
import { API_POLICY } from "@/lib/config/rules";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const requestedDate = request.nextUrl.searchParams.get("date");
    const date = requestedDate ?? dateInMadrid();
    const force = request.nextUrl.searchParams.get("force") === "1";
    const cached = force ? null : await loadDailyAnalysis(date, API_POLICY.analysisTtlSeconds);
    const analysis = cached ?? (requestedDate ? await buildDailyAnalysis(date) : await buildCurrentOrNextAnalysis(date));
    if (cached) analysis.warnings = [`Caché persistente: análisis reutilizado sin gastar nuevas llamadas a API-Football. Generado ${analysis.generatedAt}.`, ...analysis.warnings];

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

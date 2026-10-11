import { describe, expect, it } from "vitest";
import { selectAnalysisPicks } from "@/lib/engine/analysisCombo";
import type { AnalyzedFixtureSummary } from "@/lib/engine/types";

function item(id: number, probability: number, score: number, odds: number, bestMarketLabel = "Más de 2.5 goles"): AnalyzedFixtureSummary {
  return { fixtureId: id, fixtureLabel: `Equipo ${id} – Rival ${id}`, leagueName: "Liga", category: "top_league", bestMarketLabel, probability, score, odds, realOdds: false, status: "PASA", explanation: "test" };
}

describe("selectAnalysisPicks v0.21", () => {
  it("incluye ALTA", () => expect(selectAnalysisPicks([item(1, .74, 8.7, 1.42)])).toHaveLength(1));
  it("incluye MUY ALTA", () => expect(selectAnalysisPicks([item(1, .82, 9.2, 1.30)])).toHaveLength(1));
  it("no usa cuota basura", () => expect(selectAnalysisPicks([item(1, .94, 9.7, 1.06)])).toHaveLength(0));
  it("BTTS requiere @1.35", () => expect(selectAnalysisPicks([item(1, .74, 8.6, 1.32, "Ambos marcan: Sí"), item(2, .74, 8.4, 1.36, "Ambos marcan: Sí")]).map((p) => p.fixtureId)).toEqual([2]));
});

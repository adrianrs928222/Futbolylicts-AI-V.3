import { describe, expect, it } from "vitest";
import { selectAnalysisPicks } from "@/lib/engine/analysisCombo";
import type { AnalyzedFixtureSummary } from "@/lib/engine/types";

function item(id: number, probability: number, score: number, realOdds = false): AnalyzedFixtureSummary {
  return {
    fixtureId: id,
    fixtureLabel: `Equipo ${id} – Rival ${id}`,
    leagueName: "Liga",
    category: "top_league",
    bestMarketLabel: "Más de 1.5 goles",
    probability,
    score,
    odds: realOdds ? 1.45 : undefined,
    realOdds,
    status: realOdds ? "PASA" : "SIN_CUOTA",
    explanation: "test",
  };
}

describe("selectAnalysisPicks", () => {
  it("incluye perfiles ALTA aunque falte cuota real", () => {
    const picks = selectAnalysisPicks([item(1, 0.81, 9.1, false)]);
    expect(picks).toHaveLength(1);
    expect(picks[0].fixtureId).toBe(1);
  });

  it("excluye perfiles que no pasan probabilidad y nota a la vez", () => {
    const picks = selectAnalysisPicks([item(1, 0.69, 9.5), item(2, 0.90, 7.9)]);
    expect(picks).toHaveLength(0);
  });

  it("prioriza MUY ALTA y limita por defecto a cinco", () => {
    const picks = selectAnalysisPicks([
      item(1, 0.74, 8.4),
      item(2, 0.82, 9.2),
      item(3, 0.79, 9.0),
      item(4, 0.76, 8.8),
      item(5, 0.71, 8.1),
      item(6, 0.88, 9.5),
    ]);
    expect(picks).toHaveLength(5);
    expect(picks[0].fixtureId).toBe(6);
    expect(picks.map((pick) => pick.fixtureId)).not.toContain(5);
  });
});

import { describe, expect, it } from "vitest";
import { selectAnalysisPicks } from "@/lib/engine/analysisCombo";
import type { AnalyzedFixtureSummary } from "@/lib/engine/types";

function item(
  id: number,
  probability: number,
  score: number,
  odds: number,
  realOdds = false,
  bestMarketLabel = "Más de 2.5 goles",
): AnalyzedFixtureSummary {
  return {
    fixtureId: id,
    fixtureLabel: `Equipo ${id} – Rival ${id}`,
    leagueName: "Liga",
    category: "top_league",
    bestMarketLabel,
    probability,
    score,
    odds,
    realOdds,
    status: realOdds ? "PASA" : "SIN_CUOTA",
    explanation: "test",
  };
}

describe("selectAnalysisPicks v0.18", () => {
  it("incluye perfiles ALTA aunque la cuota sea EST. si es útil", () => {
    const picks = selectAnalysisPicks([item(1, 0.76, 8.7, 1.32, false)]);
    expect(picks).toHaveLength(1);
    expect(picks[0].fixtureId).toBe(1);
  });

  it("excluye MUY ALTA de la Combinada del día", () => {
    const picks = selectAnalysisPicks([
      item(1, 0.80, 9.2, 1.30, false),
      item(2, 0.76, 8.7, 1.32, false),
    ]);
    expect(picks.map((pick) => pick.fixtureId)).toEqual([2]);
  });

  it("no mete una pata de cuota demasiado baja aunque tenga mucha confianza", () => {
    const picks = selectAnalysisPicks([item(1, 0.94, 9.7, 1.06, false, "Más de 1.5 goles")]);
    expect(picks).toHaveLength(0);
  });

  it("excluye perfiles que no pasan probabilidad y nota a la vez", () => {
    const picks = selectAnalysisPicks([
      item(1, 0.69, 9.5, 1.45),
      item(2, 0.90, 7.9, 1.30),
    ]);
    expect(picks).toHaveLength(0);
  });

  it("con suficientes ALTA busca una cuota total entre @8 y @10", () => {
    const input = Array.from({ length: 6 }, (_, i) =>
      item(i + 1, 0.72 + (i % 3) * 0.01, 8.2 + (i % 4) * 0.1, 1.45, false),
    );
    const picks = selectAnalysisPicks(input);
    const total = picks.reduce((acc, pick) => acc * (pick.odds ?? 1), 1);
    expect(picks.length).toBeGreaterThanOrEqual(4);
    expect(picks.length).toBeLessThanOrEqual(6);
    expect(total).toBeGreaterThanOrEqual(8.0);
    expect(total).toBeLessThanOrEqual(10.0);
  });

  it("BTTS necesita al menos @1.35", () => {
    const picks = selectAnalysisPicks([
      item(1, 0.76, 8.6, 1.32, false, "Ambos marcan · Sí"),
      item(2, 0.74, 8.4, 1.36, false, "Ambos marcan · Sí"),
    ]);
    expect(picks.map((pick) => pick.fixtureId)).toEqual([2]);
  });
});

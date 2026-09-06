import { describe, expect, it } from "vitest";
import { buildBestCombo, eligibleCandidates } from "@/lib/engine/combo";
import type { MarketCandidate } from "@/lib/engine/types";

function pick(
  id: number,
  odds: number,
  score = 8.7,
  market: MarketCandidate["market"] = "OVER_1_5",
  probability = 0.79,
): MarketCandidate {
  return {
    fixtureId: id,
    fixtureLabel: `Equipo ${id} – Rival ${id}`,
    category: "top_league",
    market,
    marketLabel: market,
    odds,
    bookmaker: "Bet365",
    realOdds: true,
    probability,
    score,
    confidence:
      score >= 9 && probability >= 0.78
        ? "MUY_ALTA"
        : score >= 8 && probability >= 0.70
          ? "ALTA"
          : "MEDIA_ALTA",
    reasoning: "test",
    riskNote: "test",
  };
}

describe("filtro Futbolylicts v0.17", () => {
  it("ALTA empieza en 70% pero sigue exigiendo nota 8.0", () => {
    const eligible = eligibleCandidates([
      pick(1, 1.55, 8.8, "OVER_1_5", 0.69),
      pick(2, 1.55, 7.9, "OVER_1_5", 0.76),
      pick(3, 1.55, 8.2, "OVER_1_5", 0.72),
    ]);
    expect(eligible.map((p) => p.fixtureId)).toEqual([3]);
  });

  it("excluye MUY ALTA de la combinada aunque tenga cuota útil", () => {
    const eligible = eligibleCandidates([
      pick(1, 1.50, 9.2, "OVER_2_5", 0.82),
      pick(2, 1.50, 8.8, "OVER_2_5", 0.76),
    ]);
    expect(eligible.map((p) => p.fixtureId)).toEqual([2]);
  });

  it("no confunde probabilidad con nota", () => {
    const eligible = eligibleCandidates([
      pick(1, 1.55, 7.8, "DOUBLE_CHANCE_X2", 0.84),
      pick(2, 1.55, 8.1, "DOUBLE_CHANCE_X2", 0.72),
    ]);
    expect(eligible.map((p) => p.fixtureId)).toEqual([2]);
  });

  it("exige al menos 3 puntos de valor frente a la cuota", () => {
    const eligible = eligibleCandidates([
      // @1.40 implica ~71.4%; 73% no llega a +3 puntos.
      pick(1, 1.4, 8.5, "OVER_1_5", 0.73),
      // 75% sí supera el margen mínimo.
      pick(2, 1.4, 8.5, "OVER_1_5", 0.75),
    ]);
    expect(eligible.map((p) => p.fixtureId)).toEqual([2]);
  });

  it("descarta cuotas fuera de @1.25–@1.75", () => {
    const eligible = eligibleCandidates([
      pick(1, 1.2, 8.8, "OVER_1_5", 0.76),
      pick(2, 1.8, 8.8, "OVER_1_5", 0.76),
      pick(3, 1.5, 8.8, "OVER_1_5", 0.76),
    ]);
    expect(eligible.map((p) => p.fixtureId)).toEqual([3]);
  });

  it("exige al menos @1.35 para BTTS", () => {
    const eligible = eligibleCandidates([
      pick(1, 1.3, 8.8, "BTTS_YES", 0.82),
      pick(2, 1.4, 8.8, "BTTS_YES", 0.82),
    ]);
    expect(eligible.map((p) => p.fixtureId)).toEqual([2]);
  });

  it("construye una combinada 4–6 patas dentro de @8–@10 cuando existe", () => {
    const candidates = [
      pick(1, 1.52, 8.9, "OVER_1_5", 0.84),
      pick(2, 1.52, 8.9, "DOUBLE_CHANCE_X2", 0.82),
      pick(3, 1.52, 8.8, "OVER_2_5", 0.81),
      pick(4, 1.52, 8.7, "HOME_OVER_0_5", 0.80),
      pick(5, 1.52, 8.8, "DOUBLE_CHANCE_12", 0.80),
      pick(6, 1.4, 8.6, "AWAY_OVER_0_5", 0.82),
    ];
    const combo = buildBestCombo("2026-09-05", candidates);
    expect(combo.official).toBe(true);
    expect(combo.totalOdds).toBeGreaterThanOrEqual(8);
    expect(combo.totalOdds).toBeLessThanOrEqual(10.8);
    expect(combo.picks.length).toBeGreaterThanOrEqual(4);
    expect(combo.picks.length).toBeLessThanOrEqual(6);
  });

  it("si hay picks válidos pero no llega a @8, los enseña sin añadir riesgo artificial", () => {
    const candidates = [
      pick(1, 1.3, 8.9, "OVER_1_5", 0.86),
      pick(2, 1.3, 8.9, "DOUBLE_CHANCE_X2", 0.85),
      pick(3, 1.3, 8.9, "OVER_2_5", 0.84),
      pick(4, 1.3, 8.8, "HOME_OVER_0_5", 0.84),
      pick(5, 1.3, 8.7, "DOUBLE_CHANCE_12", 0.84),
    ];
    const combo = buildBestCombo("2026-09-05", candidates);
    expect(combo.official).toBe(true);
    expect(combo.targetReached).toBe(false);
    expect(combo.picks.length).toBeGreaterThanOrEqual(4);
    expect(combo.totalOdds).toBeLessThan(8);
  });

  it("si solo hay 1–3 picks válidos, los muestra como lista parcial", () => {
    const combo = buildBestCombo("2026-09-05", [
      pick(1, 1.5, 8.8, "OVER_1_5", 0.80),
      pick(2, 1.5, 8.6, "DOUBLE_CHANCE_X2", 0.79),
    ]);
    expect(combo.official).toBe(false);
    expect(combo.picks).toHaveLength(2);
    expect(combo.totalOdds).toBeGreaterThan(1);
  });

  it("permite repetir BTTS si son los mejores picks", () => {
    const candidates = [1, 2, 3, 4, 5, 6].map((id) =>
      pick(id, 1.55, 8.8, "BTTS_YES", 0.82),
    );
    const combo = buildBestCombo("2026-09-05", candidates);
    expect(combo.picks.length).toBeGreaterThanOrEqual(4);
    expect(combo.picks.every((p) => p.market === "BTTS_YES")).toBe(true);
  });

  it("nunca usa más de 6 patas", () => {
    const candidates = Array.from({ length: 8 }, (_, i) =>
      pick(i + 1, 1.5, 8.8, "OVER_1_5", 0.80),
    );
    const combo = buildBestCombo("2026-09-05", candidates);
    expect(combo.picks.length).toBeLessThanOrEqual(6);
  });
});

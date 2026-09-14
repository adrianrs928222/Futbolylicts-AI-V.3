import { describe, expect, it } from "vitest";
import { buildBttsCombo, buildLeagueCombos } from "@/lib/engine/derivedCombos";
import type { MarketCandidate } from "@/lib/engine/types";

function candidate(fixtureId: number, leagueName: string, market: MarketCandidate["market"], odds = 1.45): MarketCandidate {
  return {
    fixtureId,
    fixtureLabel: `Home ${fixtureId} – Away ${fixtureId}`,
    leagueName,
    category: "top_league",
    market,
    marketLabel: market === "BTTS_YES" ? "Ambos marcan: Sí" : "+1.5 goles",
    odds,
    bookmaker: "EST.",
    realOdds: false,
    probability: 0.76,
    score: 8.5,
    confidence: "ALTA",
    reasoning: "test",
    riskNote: "test",
  };
}

describe("derived combos", () => {
  it("builds league combos from existing candidates only", () => {
    const combos = buildLeagueCombos([
      candidate(1, "LaLiga", "OVER_1_5"),
      candidate(2, "LaLiga", "BTTS_YES"),
      candidate(3, "Premier League", "OVER_1_5"),
      candidate(4, "Premier League", "OVER_1_5"),
    ]);
    expect(combos).toHaveLength(2);
    expect(combos.every((combo) => combo.picks.length === 2)).toBe(true);
  });

  it("builds an independent BTTS combo without inventing candidates", () => {
    const combo = buildBttsCombo([
      candidate(1, "LaLiga", "BTTS_YES"),
      candidate(2, "Premier League", "BTTS_YES"),
      candidate(3, "Serie A", "OVER_1_5"),
    ]);
    expect(combo.available).toBe(true);
    expect(combo.picks).toHaveLength(2);
    expect(combo.picks.every((pick) => pick.market === "BTTS_YES")).toBe(true);
  });
  it("keeps very high-confidence BTTS even when estimated odds are below the old 1.35 floor", () => {
    const strongLowOdds = candidate(10, "LaLiga", "BTTS_YES", 1.24);
    strongLowOdds.probability = 0.85;
    strongLowOdds.score = 9.0;
    strongLowOdds.confidence = "MUY_ALTA";
    const second = candidate(11, "Premier League", "BTTS_YES", 1.31);
    second.probability = 0.80;
    second.score = 8.7;
    const combo = buildBttsCombo([strongLowOdds, second]);
    expect(combo.available).toBe(true);
    expect(combo.picks.map((p) => p.fixtureId)).toContain(10);
  });

  it("permite BTTS de alta confianza hasta cuota 3.00 y rechaza por encima", () => {
    const a = candidate(20, "LaLiga", "BTTS_YES", 2.85);
    const b = candidate(21, "Premier League", "BTTS_YES", 3.00);
    const c = candidate(22, "Serie A", "BTTS_YES", 3.01);
    const combo = buildBttsCombo([a, b, c]);
    expect(combo.picks.map((p) => p.fixtureId)).toEqual(expect.arrayContaining([20, 21]));
    expect(combo.picks.some((p) => p.fixtureId === 22)).toBe(false);
  });

});

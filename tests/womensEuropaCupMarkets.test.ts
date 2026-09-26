import { describe, expect, it } from "vitest";
import { scoreMarkets, rankMarketsForPricing } from "@/lib/engine/scoring";
import type { EnrichedFixture, TeamForm } from "@/lib/engine/types";

const form: TeamForm = {
  matches: 8, wins: 5, draws: 1, losses: 2, goalsForPerGame: 2.1, goalsAgainstPerGame: 1.2,
  scoringPct: .88, concededPct: .70, over15Pct: .84, over25Pct: .72, bttsPct: .62,
  cleanSheetPct: .25, pointsPerGame: 2.0,
};

function fixture(league: string): EnrichedFixture {
  return {
    fixture: { id: 77, date: "2026-09-23", timestamp: 1, status: "NS", league: { id: 88, name: league, country: "World", season: 2026 }, home: { id: 1, name: "Feyenoord W" }, away: { id: 2, name: "Valerenga W" } },
    category: "europa", homeForm: form, awayForm: form, odds: [],
  };
}

describe("UEFA Women's Europa Cup market scope", () => {
  it("analiza solo +2.5 y doble oportunidad, sin BTTS", () => {
    const markets = scoreMarkets(fixture("UEFA Women's Europa Cup")).map(x => x.market);
    expect(markets).toEqual(["DOUBLE_CHANCE_1X", "DOUBLE_CHANCE_X2", "DOUBLE_CHANCE_12", "OVER_2_5"]);
    expect(markets).not.toContain("BTTS_YES");
  });

  it("limita también la prioridad de pricing a esos mercados", () => {
    const markets = rankMarketsForPricing(fixture("UEFA Women's Europa Cup"));
    expect(markets.every(m => ["DOUBLE_CHANCE_1X", "DOUBLE_CHANCE_X2", "DOUBLE_CHANCE_12", "OVER_2_5"].includes(m))).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { isSameGameComboMarket, marketProbability } from "@/lib/engine/scoring";
import type { EnrichedFixture } from "@/lib/engine/types";

const form = {
  matches: 8,
  wins: 4,
  draws: 2,
  losses: 2,
  goalsForPerGame: 1.8,
  goalsAgainstPerGame: 1.2,
  scoringPct: .82,
  concededPct: .68,
  over15Pct: .80,
  over25Pct: .62,
  bttsPct: .58,
  cleanSheetPct: .32,
  pointsPerGame: 1.75,
};

const fixture: EnrichedFixture = {
  fixture: {
    id: 1,
    date: "2026-09-06T18:00:00Z",
    timestamp: 1,
    status: "NS",
    league: { id: 1, name: "La Liga", country: "Spain", season: 2026 },
    home: { id: 1, name: "Local" },
    away: { id: 2, name: "Visitante" },
  },
  category: "top_league",
  homeForm: form,
  awayForm: form,
  odds: [],
};

describe("combined markets v0.21", () => {
  it("detecta combinados incluidos 12 + goles", () => {
    expect(isSameGameComboMarket("COMBO_1X_OVER_1_5")).toBe(true);
    expect(isSameGameComboMarket("COMBO_12_OVER_2_5")).toBe(true);
    expect(isSameGameComboMarket("BTTS_YES")).toBe(false);
  });

  it("12 + 2.5 se calcula como probabilidad conjunta de marcadores", () => {
    const combo = marketProbability("COMBO_12_OVER_2_5", fixture);
    const over = marketProbability("OVER_2_5", fixture);
    const noDraw = marketProbability("DOUBLE_CHANCE_12", fixture);
    expect(combo).toBeLessThanOrEqual(over);
    expect(combo).toBeLessThanOrEqual(noDraw);
    expect(combo).toBeGreaterThan(0);
  });
});

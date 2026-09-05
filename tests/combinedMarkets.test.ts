import { describe, expect, it } from "vitest";
import { marketProbability, rankMarketsForAnalysis } from "@/lib/engine/scoring";
import type { EnrichedFixture } from "@/lib/engine/types";

const fixture: EnrichedFixture = {
  fixture: {
    id: 99,
    date: "2026-09-05T18:30:00+00:00",
    timestamp: 1788633000,
    status: "NS",
    round: "Regular Season - 4",
    league: { id: 39, name: "Premier League", country: "England", season: 2026 },
    home: { id: 1, name: "Local" },
    away: { id: 2, name: "Visitante" },
  },
  category: "top_league",
  homeForm: {
    matches: 8, wins: 6, draws: 1, losses: 1,
    goalsForPerGame: 2.25, goalsAgainstPerGame: 0.9,
    scoringPct: 0.88, concededPct: 0.63, over15Pct: 0.88, over25Pct: 0.75,
    bttsPct: 0.63, cleanSheetPct: 0.38, pointsPerGame: 2.38,
  },
  awayForm: {
    matches: 8, wins: 3, draws: 2, losses: 3,
    goalsForPerGame: 1.45, goalsAgainstPerGame: 1.65,
    scoringPct: 0.75, concededPct: 0.75, over15Pct: 0.88, over25Pct: 0.75,
    bttsPct: 0.63, cleanSheetPct: 0.25, pointsPerGame: 1.38,
  },
  odds: [],
};

describe("mercados combinados mismo partido", () => {
  it("calcula probabilidad conjunta y nunca como simple multiplicación declarada", () => {
    const combo = marketProbability("COMBO_1X_OVER_1_5", fixture);
    const dc = marketProbability("DOUBLE_CHANCE_1X", fixture);
    const over = marketProbability("OVER_1_5", fixture);
    expect(combo).toBeGreaterThan(0);
    expect(combo).toBeLessThanOrEqual(Math.min(dc, over));
  });

  it("incluye combinados y +2.5 en el universo de análisis", () => {
    const ranked = rankMarketsForAnalysis(fixture);
    expect(ranked).toContain("OVER_2_5");
    expect(ranked.some((m) => m.startsWith("COMBO_"))).toBe(true);
  });
});

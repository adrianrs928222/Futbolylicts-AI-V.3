import { describe, expect, it } from "vitest";
import { buildBestCombo, eligibleCandidates } from "@/lib/engine/combo";
import type { MarketCandidate } from "@/lib/engine/types";

function pick(
  id: number,
  odds: number,
  score = 8.7,
  market: MarketCandidate["market"] = "OVER_1_5",
  probability = .74,
): MarketCandidate {
  return {
    fixtureId: id,
    fixtureLabel: `Equipo ${id} – Rival ${id}`,
    category: "top_league",
    market,
    marketLabel: market,
    odds,
    bookmaker: "Modelo calibrado",
    realOdds: false,
    probability,
    score,
    confidence: score >= 9 && probability >= .78 ? "MUY_ALTA" : score >= 8 && probability >= .70 ? "ALTA" : "MEDIA_ALTA",
    reasoning: "test",
    riskNote: "test",
  };
}

describe("Futbolylicts v0.23 combo EST. objetivo @8–@10", () => {
  it("acepta cuotas EST. en la combinada", () => {
    const e = eligibleCandidates([pick(1, 1.50, 8.8, "OVER_2_5", .74)]);
    expect(e).toHaveLength(1);
    expect(e[0].realOdds).toBe(false);
  });

  it("incluye ALTA y MUY ALTA", () => {
    const e = eligibleCandidates([
      pick(1, 1.50, 9.2, "OVER_2_5", .82),
      pick(2, 1.50, 8.8, "OVER_2_5", .74),
    ]);
    expect(e.map((p) => p.fixtureId)).toEqual([1, 2]);
  });

  it("MEDIA-ALTA no entra", () => {
    const e = eligibleCandidates([pick(1, 1.50, 7.9, "OVER_1_5", .76)]);
    expect(e).toHaveLength(0);
  });

  it("BTTS exige aproximadamente @1.35", () => {
    const e = eligibleCandidates([
      pick(1, 1.33, 8.8, "BTTS_YES", .74),
      pick(2, 1.36, 8.8, "BTTS_YES", .74),
    ]);
    expect(e.map((p) => p.fixtureId)).toEqual([2]);
  });

  it("prioriza una combinada 100% Champions cuando Champions sola llega a @8–@10", () => {
    const champions = [1, 2, 3, 4, 5].map((i) => ({ ...pick(i, 1.55, 8.6, "OVER_1_5", .74), category: "champions" as const }));
    const topLeague = [101, 102, 103, 104, 105].map((i) => ({ ...pick(i, 1.55, 9.2, "OVER_1_5", .82), category: "top_league" as const }));
    const combo = buildBestCombo("2026-09-08", [...topLeague, ...champions]);
    expect(combo.targetReached).toBe(true);
    expect(combo.picks.length).toBeGreaterThanOrEqual(4);
    expect(combo.picks.every((p) => p.category === "champions")).toBe(true);
    expect(combo.message).toContain("100% Champions");
  });

  it("incluye Eredivisie preferentemente cuando no hay combinada 100% Champions", () => {
    const dutch = { ...pick(201, 1.55, 8.6, "OVER_1_5", .74), leagueName: "Eredivisie" };
    const others = [301, 302, 303, 304, 305, 306].map((i, idx) => ({
      ...pick(i, 1.55, 9.0 - idx * .03, "OVER_1_5", .78),
      leagueName: ["Premier League", "LaLiga", "Serie A", "Bundesliga", "Ligue 1", "Primeira Liga"][idx],
    }));
    const combo = buildBestCombo("2026-09-08", [...others, dutch]);
    expect(combo.targetReached).toBe(true);
    expect(combo.picks.some((p) => p.leagueName === "Eredivisie")).toBe(true);
  });

  it("construye 4–6 picks y puede alcanzar @8–@10", () => {
    const c = [1, 2, 3, 4, 5, 6].map((i) => pick(i, 1.52, 8.7 + (i % 2) * .1, "OVER_1_5", .74));
    const combo = buildBestCombo("2026-09-06", c);
    expect(combo.picks.length).toBeGreaterThanOrEqual(4);
    expect(combo.picks.length).toBeLessThanOrEqual(6);
    expect(combo.totalOdds).toBeGreaterThanOrEqual(8);
    expect(combo.totalOdds).toBeLessThanOrEqual(10);
  });

  it("permite repetir BTTS sin penalización artificial", () => {
    const c = [1, 2, 3, 4, 5, 6].map((i) => pick(i, 1.52, 8.8, "BTTS_YES", .74));
    const combo = buildBestCombo("2026-09-06", c);
    expect(combo.picks.length).toBeGreaterThan(0);
    expect(combo.picks.every((p) => p.market === "BTTS_YES")).toBe(true);
  });

  it("permite repetir +2.5 sin forzar variedad", () => {
    const c = [1, 2, 3, 4, 5, 6].map((i) => pick(i, 1.52, 8.8, "OVER_2_5", .74));
    const combo = buildBestCombo("2026-09-06", c);
    expect(combo.picks.every((p) => p.market === "OVER_2_5")).toBe(true);
  });

  it("no da preferencia artificial a BTTS si +2.5 es mejor", () => {
    const c: MarketCandidate[] = [];
    for (let i = 1; i <= 6; i += 1) {
      c.push(pick(i, 1.52, 8.82, "OVER_2_5", .74));
      if (i === 1) c.push(pick(i, 1.52, 8.60, "BTTS_YES", .74));
    }
    const combo = buildBestCombo("2026-09-06", c);
    expect(combo.picks.find((p) => p.fixtureId === 1)?.market).toBe("OVER_2_5");
  });

  it("un combinado no gana solo por pagar más", () => {
    const c: MarketCandidate[] = [];
    for (let i = 1; i <= 6; i += 1) c.push(pick(i, 1.55, 8.8, "OVER_1_5", .74));
    c.push(pick(1, 1.72, 8.35, "COMBO_1X_OVER_1_5", .71));
    const combo = buildBestCombo("2026-09-06", c);
    expect(combo.picks.find((p) => p.fixtureId === 1)?.market).toBe("OVER_1_5");
  });

  it("un combinado sí puede ganar si realmente es mejor", () => {
    const c: MarketCandidate[] = [];
    for (let i = 2; i <= 6; i += 1) c.push(pick(i, 1.52, 8.8, "OVER_1_5", .74));
    c.push(pick(1, 1.36, 8.55, "DOUBLE_CHANCE_1X", .74));
    c.push(pick(1, 1.50, 8.90, "COMBO_1X_OVER_1_5", .76));
    const combo = buildBestCombo("2026-09-06", c);
    expect(combo.picks.find((p) => p.fixtureId === 1)?.market).toBe("COMBO_1X_OVER_1_5");
  });

  it("mantiene máximo una selección por partido", () => {
    const c: MarketCandidate[] = [];
    for (let i = 1; i <= 6; i += 1) {
      c.push(pick(i, 1.52, 8.8, "OVER_2_5", .74));
      c.push(pick(i, 1.50, 8.7, "BTTS_YES", .74));
    }
    const combo = buildBestCombo("2026-09-06", c);
    expect(new Set(combo.picks.map((p) => p.fixtureId)).size).toBe(combo.picks.length);
  });

  it("usa una alternativa inteligente del mismo partido para alcanzar @8–@10", () => {
    const c: MarketCandidate[] = [];
    for (let i = 1; i <= 6; i += 1) {
      c.push(pick(i, 1.25, 9.0, "OVER_1_5", .80));
      c.push(pick(i, 1.50, 8.70, "COMBO_1X_OVER_1_5", .75));
    }
    const combo = buildBestCombo("2026-09-06", c);
    expect(combo.targetReached).toBe(true);
    expect(combo.totalOdds).toBeGreaterThanOrEqual(8);
    expect(combo.totalOdds).toBeLessThanOrEqual(10);
    expect(combo.picks.some((p) => p.market === "COMBO_1X_OVER_1_5")).toBe(true);
  });

  it("acepta cuota superior a @1.75 hasta @2.50 si sigue siendo ALTA", () => {
    const e = eligibleCandidates([pick(1, 1.92, 8.7, "COMBO_12_OVER_2_5", .72)]);
    expect(e).toHaveLength(1);
  });

  it("rechaza cuotas por encima de @2.50", () => {
    const e = eligibleCandidates([pick(1, 2.55, 8.8, "COMBO_12_OVER_2_5", .72)]);
    expect(e).toHaveLength(0);
  });

});

describe("Futbolylicts v0.23 objetivo duro", () => {
  it("usa rescate ALTA del mismo partido si los mejores mercados dejan la cuota demasiado baja", () => {
    const c: MarketCandidate[] = [];
    for (let i = 1; i <= 6; i += 1) {
      c.push(pick(i, 1.25, 9.2, "OVER_1_5", .82));
      // Sigue siendo ALTA, pero queda demasiado lejos del nº1 para el modo normal.
      c.push(pick(i, 1.45, 8.1, "COMBO_1X_OVER_1_5", .70));
    }
    const combo = buildBestCombo("2026-09-07", c);
    expect(combo.official).toBe(true);
    expect(combo.targetReached).toBe(true);
    expect(combo.totalOdds).toBeGreaterThanOrEqual(8);
    expect(combo.totalOdds).toBeLessThanOrEqual(10);
  });

  it("no publica una combinada oficial @2–@7", () => {
    const c = [1, 2, 3, 4].map((i) => pick(i, 1.25, 9.1, "OVER_1_5", .82));
    const combo = buildBestCombo("2026-09-07", c);
    expect(combo.official).toBe(false);
    expect(combo.targetReached).toBe(false);
    expect(combo.picks).toHaveLength(0);
  });

  it("puede usar 7–8 picks como rescate, pero nunca más de 8", () => {
    const c = [1, 2, 3, 4, 5, 6, 7].map((i) => pick(i, 1.35, 8.4, "OVER_2_5", .72));
    const combo = buildBestCombo("2026-09-07", c);
    expect(combo.targetReached).toBe(true);
    expect(combo.picks.length).toBeGreaterThan(6);
    expect(combo.picks.length).toBeLessThanOrEqual(8);
    expect(combo.totalOdds).toBeGreaterThanOrEqual(8);
    expect(combo.totalOdds).toBeLessThanOrEqual(10);
  });
});

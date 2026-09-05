import { describe, expect, it } from "vitest";
import { competitionCategory, fixturePriorityScore, isExcludedFixture } from "@/lib/config/competitions";
import type { Fixture } from "@/lib/engine/types";

function fixture(home: string, away: string, league: string, country = "ES"): Fixture {
  return {
    id: 1,
    date: "2026-09-02T18:00:00Z",
    timestamp: 1788372000,
    status: "NS",
    round: "Regular Season",
    league: { id: 1, name: league, country, season: 2026 },
    home: { id: 1, name: home },
    away: { id: 2, name: away },
  };
}

describe("competiciones", () => {
  it("clasifica competiciones importantes y Eerste Divisie", () => {
    expect(competitionCategory("UEFA Champions League")).toBe("champions");
    expect(competitionCategory("UEFA Europa League")).toBe("europa");
    expect(competitionCategory("UEFA Conference League")).toBe("conference");
    expect(competitionCategory("Copa del Rey")).toBe("national_cup");
    expect(competitionCategory("Premier League")).toBe("top_league");
    expect(competitionCategory("Eerste Divisie")).toBe("top_league");
  });

  it("excluye reservas, U23, femenino y amistosos fuera de la excepción", () => {
    expect(isExcludedFixture(fixture("Real Club B", "Rival", "Segunda"))).toBe(true);
    expect(isExcludedFixture(fixture("Jong Ajax", "Rival", "Copa Demo"))).toBe(true);
    expect(isExcludedFixture(fixture("Equipo U23", "Rival", "Premier League 2"))).toBe(true);
    expect(isExcludedFixture(fixture("Team Women", "Rival", "Liga"))).toBe(true);
    expect(isExcludedFixture(fixture("Equipo", "Rival", "Club Friendlies"))).toBe(true);
  });

  it("permite equipos Jong/reserva únicamente en Eerste Divisie de Países Bajos", () => {
    expect(isExcludedFixture(fixture("Almere City", "Jong Ajax", "Eerste Divisie", "Netherlands"))).toBe(false);
    expect(isExcludedFixture(fixture("Jong PSV", "FC Emmen", "Eerste Divisie", "Netherlands"))).toBe(false);
    expect(isExcludedFixture(fixture("Jong AZ", "Rival", "KNVB Cup", "Netherlands"))).toBe(true);
  });

  it("no confunde otras Champions con UEFA Champions", () => {
    expect(competitionCategory("AFC Champions League Elite")).not.toBe("champions");
    expect(competitionCategory("CAF Champions League")).not.toBe("champions");
    expect(competitionCategory("UEFA Champions League")).toBe("champions");
  });

  it("prioriza las grandes ligas por país", () => {
    expect(fixturePriorityScore(fixture("Arsenal", "Chelsea", "Premier League", "England"))).toBeGreaterThan(90);
    expect(fixturePriorityScore(fixture("A", "B", "Premier League", "Kenya"))).toBeLessThan(90);
  });

  it("mantiene primeros equipos", () => {
    expect(isExcludedFixture(fixture("Real Madrid", "Barcelona", "LaLiga"))).toBe(false);
  });
});

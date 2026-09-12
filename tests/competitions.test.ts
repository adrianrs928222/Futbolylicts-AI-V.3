import { describe, expect, it } from "vitest";
import { competitionCategory, isExcludedFixture, isPreferredOfficialCompetition } from "@/lib/config/competitions";
import type { Fixture } from "@/lib/engine/types";

function f(home: string, away: string, league = "Premier League", country = "England"): Fixture {
  return { id: 1, date: "2026-09-06", timestamp: 1, status: "NS", league: { id: 1, name: league, country, season: 2026 }, home: { id: 1, name: home }, away: { id: 2, name: away } };
}

describe("competitions v0.24 — solo ligas conocidas", () => {
  it("prioriza UEFA correctamente", () => expect(competitionCategory("UEFA Champions League")).toBe("champions"));
  it("incluye Segunda División española como preferida", () => expect(isPreferredOfficialCompetition(f("Cádiz", "Almería", "LaLiga Hypermotion", "Spain"))).toBe(true));
  it("excluye Chinese Super League de la combinada oficial", () => expect(isPreferredOfficialCompetition(f("Shanghai", "Beijing", "Chinese Super League", "China"))).toBe(false));
  it("incluye ligas grandes y fiables", () => expect(isPreferredOfficialCompetition(f("Arsenal", "Chelsea", "Premier League", "England"))).toBe(true));
  it("no mete una liga rara por defecto", () => expect(isPreferredOfficialCompetition(f("Club A", "Club B", "Regional League", "Unknown"))).toBe(false));
  it("excluye otras primeras divisiones no incluidas en la lista del usuario", () => expect(isPreferredOfficialCompetition(f("Club A", "Club B", "Super Lig", "Turkey"))).toBe(false));
  it("bloquea reservas fuera de Eerste Divisie", () => expect(isExcludedFixture(f("Club B", "Rival"))).toBe(true));
  it("permite Jong en Eerste Divisie de Países Bajos", () => expect(isExcludedFixture(f("Jong Ajax", "Rival", "Eerste Divisie", "Netherlands"))).toBe(false));
  it("sigue bloqueando Jong fuera de Eerste Divisie", () => expect(isExcludedFixture(f("Jong Ajax", "Rival", "KNVB Beker", "Netherlands"))).toBe(true));
  it("bloquea femenino/juvenil", () => expect(isExcludedFixture(f("Arsenal Women", "Chelsea Women"))).toBe(true));
});

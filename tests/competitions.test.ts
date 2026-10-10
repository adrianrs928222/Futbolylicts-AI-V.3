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


describe("competiciones femeninas permitidas", () => {
  const fixture = (league: string, country = "Spain") => ({
    id: 990001,
    date: "2026-09-23T18:00:00Z",
    timestamp: 1790186400,
    status: "NS",
    round: "Regular Season",
    league: { id: 999, name: league, country, season: 2026 },
    home: { id: 1, name: "Barcelona W" },
    away: { id: 2, name: "Real Madrid W" },
  });

  it("acepta UEFA Women's Champions League", () => {
    const f = fixture("UEFA Women's Champions League", "World");
    expect(isExcludedFixture(f)).toBe(false);
    expect(isPreferredOfficialCompetition(f)).toBe(true);
    expect(competitionCategory(f.league.name)).toBe("champions");
  });

  it("acepta UEFA Women's Europa Cup", () => {
    const f = fixture("UEFA Women's Europa Cup", "World");
    expect(isExcludedFixture(f)).toBe(false);
    expect(isPreferredOfficialCompetition(f)).toBe(true);
  });

  it("acepta Liga F española", () => {
    const f = fixture("Liga F", "Spain");
    expect(isExcludedFixture(f)).toBe(false);
    expect(isPreferredOfficialCompetition(f)).toBe(true);
  });

  it("mantiene fuera otras ligas femeninas", () => {
    const f = fixture("Women's Super League", "England");
    expect(isExcludedFixture(f)).toBe(true);
    expect(isPreferredOfficialCompetition(f)).toBe(false);
  });
});

describe("selecciones internacionales permitidas", () => {
  it("acepta Mundial absoluto", () => expect(isPreferredOfficialCompetition(f("Spain", "Brazil", "FIFA World Cup", "World"))).toBe(true));
  it("acepta Mundial Sub-20 aunque el filtro juvenil general siga activo", () => {
    const x = f("Spain U20", "Brazil U20", "FIFA U-20 World Cup", "World");
    expect(isExcludedFixture(x)).toBe(false);
    expect(isPreferredOfficialCompetition(x)).toBe(true);
  });
  it("acepta UEFA Nations League", () => expect(isPreferredOfficialCompetition(f("Spain", "Germany", "UEFA Nations League", "World"))).toBe(true));
  it("mantiene fuera torneos U20 menores", () => expect(isExcludedFixture(f("Team A U20", "Team B U20", "U20 Regional League", "World"))).toBe(true));
  it("mantiene fuera clasificación OFC", () => expect(isPreferredOfficialCompetition(f("Team A", "Team B", "World Cup Qualification OFC", "World"))).toBe(false));

  it("acepta Eurocopa Sub-21", () => expect(isPreferredOfficialCompetition(f("Spain U21", "Germany U21", "UEFA U21 Championship", "World"))).toBe(true));
  it("acepta clasificación UEFA Sub-21", () => expect(isPreferredOfficialCompetition(f("Spain U21", "Germany U21", "UEFA U21 Championship Qualification", "World"))).toBe(true));
  it("mantiene fuera ligas U21 regionales pequeñas", () => expect(isExcludedFixture(f("Team A U21", "Team B U21", "U21 Regional League", "World"))).toBe(true));
});

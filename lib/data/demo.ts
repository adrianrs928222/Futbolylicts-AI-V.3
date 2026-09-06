import type { EnrichedFixture, OddsQuote, TeamForm } from "@/lib/engine/types";

const form = (
  gf: number,
  ga: number,
  ppg: number,
  scoring: number,
  over15: number,
  over25: number,
  btts: number,
): TeamForm => ({
  matches: 8,
  wins: Math.round((ppg / 3) * 8),
  draws: 1,
  losses: 2,
  goalsForPerGame: gf,
  goalsAgainstPerGame: ga,
  scoringPct: scoring,
  concededPct: Math.min(0.9, ga / 2.1),
  over15Pct: over15,
  over25Pct: over25,
  bttsPct: btts,
  cleanSheetPct: Math.max(0.05, 1 - ga / 2.2),
  pointsPerGame: ppg,
});

const odds = (entries: Array<[OddsQuote["market"], string, number]>): OddsQuote[] =>
  entries.map(([market, label, decimal]) => ({
    market,
    label,
    decimal,
    bookmaker: "DEMO",
    real: true,
    updatedAt: new Date().toISOString(),
  }));

export function demoFixtures(date: string): EnrichedFixture[] {
  const base = new Date(`${date}T18:00:00Z`).getTime() / 1000;
  const fixture = (
    id: number,
    home: string,
    away: string,
    league: string,
    category: EnrichedFixture["category"],
    homeForm: TeamForm,
    awayForm: TeamForm,
    quotes: OddsQuote[],
  ): EnrichedFixture => ({
    fixture: {
      id,
      date: new Date((base + id * 600) * 1000).toISOString(),
      timestamp: base + id * 600,
      status: "NS",
      round: category === "national_cup" ? "Round of 32" : "Regular Season",
      league: { id: id + 100, name: league, country: "Demo", season: 2026 },
      home: { id: id * 2, name: home, logo: null },
      away: { id: id * 2 + 1, name: away, logo: null },
    },
    category,
    homeForm,
    awayForm,
    odds: quotes,
  });

  return [
    fixture(1, "Aurora FC", "Racing Norte", "Premier League Demo", "top_league", form(2.1, 1.2, 2.25, 0.88, 0.88, 0.75, 0.63), form(1.55, 1.4, 1.65, 0.8, 0.8, 0.62, 0.58), odds([["OVER_2_5", "Más de 2.5 goles", 1.42], ["DOUBLE_CHANCE_12", "Local o visitante (12)", 1.31]])),
    fixture(2, "Union Verde", "Ciudad Roja", "UEFA Champions League", "champions", form(1.9, 0.9, 2.15, 0.9, 0.82, 0.65, 0.48), form(1.5, 1.45, 1.5, 0.82, 0.78, 0.58, 0.56), odds([["DOUBLE_CHANCE_1X", "Local o empate (1X)", 1.3], ["OVER_1_5", "Más de 1.5 goles", 1.28]])),
    fixture(3, "Atlético Costa", "Sporting Valle", "LaLiga Demo", "top_league", form(1.65, 1.15, 1.95, 0.84, 0.82, 0.57, 0.52), form(1.7, 1.35, 1.85, 0.85, 0.84, 0.64, 0.61), odds([["BTTS_YES", "Ambos marcan: Sí", 1.55], ["DOUBLE_CHANCE_12", "Local o visitante (12)", 1.32]])),
    fixture(4, "Real Puerto", "Deportivo Sol", "Copa del Rey Demo", "national_cup", form(2.0, 0.95, 2.2, 0.91, 0.86, 0.68, 0.49), form(1.25, 1.7, 1.2, 0.69, 0.74, 0.49, 0.47), odds([["HOME_WIN", "Gana Real Puerto", 1.45], ["HOME_OVER_1_5", "Real Puerto marca +1.5", 1.58]])),
    fixture(5, "Stella", "Olympic", "Europa League", "europa", form(1.45, 1.15, 1.75, 0.8, 0.77, 0.52, 0.5), form(1.9, 1.1, 2.1, 0.88, 0.84, 0.65, 0.57), odds([["DOUBLE_CHANCE_X2", "Empate o Olympic (X2)", 1.34], ["AWAY_OVER_0_5", "Olympic marca +0.5", 1.29]])),
    fixture(6, "Montaña FC", "Lago United", "Bundesliga Demo", "top_league", form(1.75, 1.6, 1.65, 0.84, 0.85, 0.7, 0.65), form(1.85, 1.5, 1.8, 0.86, 0.87, 0.72, 0.66), odds([["OVER_2_5", "Más de 2.5 goles", 1.48], ["DOUBLE_CHANCE_12", "Local o visitante (12)", 1.3]])),
    fixture(7, "Capital", "Marítimo", "Serie A Demo", "top_league", form(1.6, 1.05, 1.95, 0.82, 0.78, 0.52, 0.46), form(1.3, 1.35, 1.4, 0.72, 0.71, 0.46, 0.48), odds([["DOUBLE_CHANCE_1X", "Capital o empate (1X)", 1.27], ["OVER_1_5", "Más de 1.5 goles", 1.33]])),
  ];
}

import type { Fixture, TeamForm } from "@/lib/engine/types";

export interface HistoricalFixture {
  fixture: Fixture;
  homeGoals: number;
  awayGoals: number;
}

export function buildTeamForm(teamId: number, matches: HistoricalFixture[]): TeamForm {
  const relevant = matches.slice(0, 10);
  if (relevant.length === 0) {
    return {
      matches: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsForPerGame: 1.2,
      goalsAgainstPerGame: 1.2,
      scoringPct: 0.65,
      concededPct: 0.65,
      over15Pct: 0.68,
      over25Pct: 0.5,
      bttsPct: 0.5,
      cleanSheetPct: 0.25,
      pointsPerGame: 1.35,
    };
  }

  let wins = 0;
  let draws = 0;
  let losses = 0;
  let gf = 0;
  let ga = 0;
  let scoring = 0;
  let conceded = 0;
  let over15 = 0;
  let over25 = 0;
  let btts = 0;
  let cleanSheets = 0;

  for (const item of relevant) {
    const home = item.fixture.home.id === teamId;
    const teamGoals = home ? item.homeGoals : item.awayGoals;
    const oppGoals = home ? item.awayGoals : item.homeGoals;
    gf += teamGoals;
    ga += oppGoals;
    if (teamGoals > oppGoals) wins += 1;
    else if (teamGoals === oppGoals) draws += 1;
    else losses += 1;
    if (teamGoals > 0) scoring += 1;
    if (oppGoals > 0) conceded += 1;
    if (teamGoals + oppGoals >= 2) over15 += 1;
    if (teamGoals + oppGoals >= 3) over25 += 1;
    if (teamGoals > 0 && oppGoals > 0) btts += 1;
    if (oppGoals === 0) cleanSheets += 1;
  }

  const n = relevant.length;
  return {
    matches: n,
    wins,
    draws,
    losses,
    goalsForPerGame: gf / n,
    goalsAgainstPerGame: ga / n,
    scoringPct: scoring / n,
    concededPct: conceded / n,
    over15Pct: over15 / n,
    over25Pct: over25 / n,
    bttsPct: btts / n,
    cleanSheetPct: cleanSheets / n,
    pointsPerGame: (wins * 3 + draws) / n,
  };
}

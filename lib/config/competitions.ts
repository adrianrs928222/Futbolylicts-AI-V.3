import type { CompetitionCategory, Fixture } from "@/lib/engine/types";

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const TOP_LEAGUES = [
  "premier league",
  "la liga",
  "laliga",
  "serie a",
  "bundesliga",
  "ligue 1",
  "eredivisie",
  "eerste divisie",
  "primeira liga",
  "pro league",
  "super league",
  "premiership",
  "championship",
];

const NATIONAL_CUPS = [
  "copa del rey",
  "fa cup",
  "efl cup",
  "league cup",
  "coppa italia",
  "dfb pokal",
  "dfb-pokal",
  "coupe de france",
  "taça de portugal",
  "taca de portugal",
  "copa",
  "cup",
  "pokal",
];

// ÚNICA excepción para equipos reserva/filiales: Eerste Divisie (Países Bajos).
// Ahí sí se permiten Jong Ajax, Jong PSV, Jong AZ, Jong FC Utrecht, etc.
const RESERVE_ALLOWED_LEAGUES = ["eerste divisie"];

const NON_RESERVE_EXCLUSION_PATTERNS = [
  /\bwomen\b/i,
  /\bwoman\b/i,
  /\bladies\b/i,
  /\bfemenin[oa]\b/i,
  /\bfemenino\b/i,
  /\bu-?1[6789]\b/i,
  /\bu-?2[013]\b/i,
  /\bu23\b/i,
  /\bu21\b/i,
  /\bu20\b/i,
  /\bu19\b/i,
  /\byouth\b/i,
  /\bjuvenil\b/i,
  /\bacademy\b/i,
  /\bamistos[oa]\b/i,
  /\bfriendly\b/i,
];

const RESERVE_PATTERNS = [
  /\breserves?\b/i,
  /\breserve\b/i,
  /\bb team\b/i,
  /\bteam b\b/i,
  /^jong\b/i,
  /\bii\b/i,
];

export function competitionCategory(leagueName: string): CompetitionCategory {
  const n = normalize(leagueName).trim();

  // v0.8: NO confundimos AFC/CAF/etc. con la UEFA Champions.
  if (/^(uefa )?champions league$/.test(n)) return "champions";
  if (/^(uefa )?europa league$/.test(n)) return "europa";
  if (/^(uefa )?(europa )?conference league$/.test(n)) return "conference";

  if (NATIONAL_CUPS.some((cup) => n.includes(cup))) return "national_cup";
  if (TOP_LEAGUES.some((league) => n.includes(league))) return "top_league";
  return "other";
}

const HIGH_PRIORITY_DOMESTIC: Array<{ league: RegExp; country: RegExp; score: number }> = [
  { league: /^(premier league)$/, country: /england|inglaterra/, score: 98 },
  { league: /^(la liga|laliga|primera division)$/, country: /spain|espana/, score: 98 },
  { league: /^serie a$/, country: /italy|italia/, score: 98 },
  { league: /^bundesliga$/, country: /germany|alemania/, score: 98 },
  { league: /^ligue 1$/, country: /france|francia/, score: 98 },
  { league: /^eredivisie$/, country: /netherlands|paises bajos/, score: 94 },
  { league: /^eerste divisie$/, country: /netherlands|paises bajos/, score: 92 },
  { league: /^primeira liga$/, country: /portugal/, score: 92 },
  { league: /^(super lig|superliga)$/, country: /turkey|turquia/, score: 90 },
  { league: /^premiership$/, country: /scotland|escocia/, score: 90 },
  { league: /^(pro league|first division a)$/, country: /belgium|belgica/, score: 90 },
  { league: /^super league$/, country: /switzerland|suiza/, score: 88 },
  { league: /^bundesliga$/, country: /austria/, score: 88 },
  { league: /^2\.? bundesliga$/, country: /germany|alemania/, score: 87 },
  { league: /^championship$/, country: /england|inglaterra/, score: 87 },
  { league: /major league soccer|^mls$/, country: /usa|united states|estados unidos/, score: 86 },
  { league: /liga mx/, country: /mexico/, score: 86 },
  { league: /^serie a$/, country: /brazil|brasil/, score: 86 },
  { league: /^primera division$/, country: /argentina/, score: 85 },
  { league: /pro league/, country: /saudi|arabia saud/, score: 84 },
];

export function fixturePriorityScore(fixture: Fixture): number {
  const league = normalize(fixture.league.name).trim();
  const country = normalize(fixture.league.country ?? "").trim();
  const category = competitionCategory(fixture.league.name);

  if (category === "champions") return 110;
  if (category === "europa") return 106;
  if (category === "conference") return 102;

  for (const item of HIGH_PRIORITY_DOMESTIC) {
    if (item.league.test(league) && item.country.test(country)) return item.score;
  }

  // Copas reconocidas sí tienen prioridad, pero nunca por encima de las grandes ligas
  // solo porque el nombre contenga la palabra genérica "Cup".
  if (category === "national_cup") {
    if (/copa del rey|fa cup|efl cup|league cup|coppa italia|dfb.?pokal|coupe de france|taca de portugal/.test(league)) return 89;
    return 58;
  }

  if (category === "top_league") return 74;
  return 40;
}

export function categoryPriority(category: CompetitionCategory): number {
  return {
    champions: 100,
    europa: 95,
    conference: 90,
    national_cup: 85,
    top_league: 80,
    other: 50,
  }[category];
}

export function reservesAllowedInCompetition(fixture: Fixture): boolean {
  const league = normalize(fixture.league.name);
  const country = normalize(fixture.league.country ?? "");
  return RESERVE_ALLOWED_LEAGUES.some((name) => league.includes(name)) &&
    (country.includes("netherlands") || country.includes("paises bajos") || country === "");
}

function isReserveTeamName(name: string): boolean {
  const clean = name.trim();
  return (
    /(?:\s|[-_])(ii|b|reserves?|u-?2[13]|u-?19)$/i.test(clean) ||
    /\b(b team|team b|reserve team)\b/i.test(clean) ||
    /^jong\b/i.test(clean) ||
    RESERVE_PATTERNS.some((pattern) => pattern.test(clean))
  );
}

export function isExcludedFixture(fixture: Fixture): boolean {
  const haystack = [
    fixture.league.name,
    fixture.home.name,
    fixture.away.name,
    fixture.league.country ?? "",
  ].join(" ");

  if (fixture.league.name.toLowerCase().includes("friendly")) return true;
  if (NON_RESERVE_EXCLUSION_PATTERNS.some((pattern) => pattern.test(haystack))) return true;

  const hasReserveTeam = isReserveTeamName(fixture.home.name) || isReserveTeamName(fixture.away.name);
  if (hasReserveTeam && !reservesAllowedInCompetition(fixture)) return true;

  return false;
}

export const CATEGORY_LABELS: Record<CompetitionCategory, string> = {
  champions: "Champions League",
  europa: "Europa League",
  conference: "Conference League",
  national_cup: "Copas nacionales",
  top_league: "Ligas principales",
  other: "Otras ligas",
};

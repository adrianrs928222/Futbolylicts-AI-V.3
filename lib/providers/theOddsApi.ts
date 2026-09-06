import { cacheKey, getCached, setCached } from "@/lib/cache/cache";
import { reserveApiCredits } from "@/lib/cache/usage";
import { ODDS_API_POLICY } from "@/lib/config/rules";
import { rankMarketsForPricing } from "@/lib/engine/scoring";
import type { EnrichedFixture, Fixture, MarketKey, OddsQuote } from "@/lib/engine/types";

const PROVIDER = "the-odds-api";
const BASE_URL = process.env.THE_ODDS_API_BASE_URL ?? "https://api.the-odds-api.com/v4";

interface OddsSport {
  key: string;
  group: string;
  title: string;
  description?: string;
  active: boolean;
}

interface OddsEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
}

type TheOddsMarketGroup =
  | "h2h"
  | "double_chance"
  | "totals"
  | "alternate_totals"
  | "btts"
  | "team_totals"
  | "alternate_team_totals";

const STATIC_SPORT_KEYS: Array<{
  league: RegExp;
  country?: RegExp;
  keys: string[];
}> = [
  { league: /^(uefa )?champions league$/i, keys: ["soccer_uefa_champs_league"] },
  { league: /^(uefa )?europa league$/i, keys: ["soccer_uefa_europa_league"] },
  { league: /^(uefa )?(europa )?conference league$/i, keys: ["soccer_uefa_europa_conference_league"] },

  { league: /premier league/i, country: /england|inglaterra/i, keys: ["soccer_epl"] },
  { league: /championship/i, country: /england|inglaterra/i, keys: ["soccer_efl_champ"] },
  { league: /league one/i, country: /england|inglaterra/i, keys: ["soccer_england_league1"] },
  { league: /league two/i, country: /england|inglaterra/i, keys: ["soccer_england_league2"] },
  { league: /fa cup/i, keys: ["soccer_fa_cup"] },
  { league: /efl cup|league cup/i, keys: ["soccer_england_efl_cup"] },

  { league: /la ?liga|primera division/i, country: /spain|espana/i, keys: ["soccer_spain_la_liga"] },
  { league: /copa del rey/i, keys: ["soccer_spain_copa_del_rey"] },

  { league: /serie a/i, country: /italy|italia/i, keys: ["soccer_italy_serie_a"] },
  { league: /coppa italia/i, keys: ["soccer_italy_coppa_italia"] },

  { league: /2\.?\s*bundesliga/i, country: /germany|alemania/i, keys: ["soccer_germany_bundesliga2"] },
  { league: /^bundesliga$|\bbundesliga\b/i, country: /germany|alemania/i, keys: ["soccer_germany_bundesliga"] },
  { league: /dfb.?pokal/i, keys: ["soccer_germany_dfb_pokal"] },

  { league: /ligue 1/i, country: /france|francia/i, keys: ["soccer_france_ligue_one"] },
  { league: /coupe de france/i, keys: ["soccer_france_coupe_de_france"] },

  { league: /eredivisie/i, keys: ["soccer_netherlands_eredivisie"] },
  { league: /eerste divisie/i, keys: ["soccer_netherlands_eerste_divisie"] },

  { league: /primeira liga/i, keys: ["soccer_portugal_primeira_liga"] },
  { league: /super lig|superliga/i, country: /turkey|turquia/i, keys: ["soccer_turkey_super_league"] },
  { league: /premiership/i, country: /scotland|escocia/i, keys: ["soccer_spl"] },
  { league: /pro league|first division/i, country: /belgium|belgica/i, keys: ["soccer_belgium_first_div"] },
  { league: /super league/i, country: /switzerland|suiza/i, keys: ["soccer_switzerland_superleague"] },
  { league: /bundesliga/i, country: /austria/i, keys: ["soccer_austria_bundesliga"] },

  { league: /major league soccer|mls/i, keys: ["soccer_usa_mls"] },
  { league: /liga mx/i, keys: ["soccer_mexico_ligamx"] },
  { league: /serie a/i, country: /brazil|brasil/i, keys: ["soccer_brazil_campeonato"] },
  { league: /primera division/i, country: /argentina/i, keys: ["soccer_argentina_primera_division"] },
];

function normalize(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(fc|cf|afc|sc|fk|sk|club|football|futbol|calcio)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compact(value: unknown) {
  return normalize(value).replace(/\s+/g, "");
}

function tokenSimilarity(a: string, b: string) {
  const aa = new Set(normalize(a).split(" ").filter(Boolean));
  const bb = new Set(normalize(b).split(" ").filter(Boolean));
  if (!aa.size || !bb.size) return 0;

  let common = 0;
  for (const token of aa) if (bb.has(token)) common += 1;
  return common / Math.max(aa.size, bb.size);
}

function teamSimilarity(a: string, b: string) {
  const ca = compact(a);
  const cb = compact(b);
  if (ca === cb) return 1;
  if (ca.length >= 5 && cb.length >= 5 && (ca.includes(cb) || cb.includes(ca))) return 0.9;
  return tokenSimilarity(a, b);
}

function hasKey() {
  return Boolean(process.env.THE_ODDS_API_KEY);
}

async function freeGet<T>(
  endpoint: string,
  params: Record<string, string | number | boolean>,
  ttlSeconds: number,
): Promise<T> {
  if (!hasKey()) throw new Error("THE_ODDS_API_KEY no configurada");
  const key = cacheKey(`${PROVIDER}:free:${endpoint}`, params);
  const cached = await getCached<T>(key);
  if (cached) return cached;

  const url = new URL(`${BASE_URL}${endpoint}`);
  url.searchParams.set("apiKey", process.env.THE_ODDS_API_KEY!);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));

  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`The Odds API ${response.status}: ${response.statusText}`);
    const body = (await response.json()) as T;
    await setCached(key, body, ttlSeconds, ODDS_API_POLICY.staleFallbackSeconds);
    return body;
  } catch (error) {
    const stale = await getCached<T>(key, true);
    if (stale) return stale;
    throw error;
  }
}

async function paidGet<T>(
  endpoint: string,
  params: Record<string, string | number | boolean>,
  ttlSeconds: number,
  predictedCredits: number,
): Promise<T> {
  if (!hasKey()) throw new Error("THE_ODDS_API_KEY no configurada");
  const key = cacheKey(`${PROVIDER}:paid:${endpoint}`, params);
  const cached = await getCached<T>(key);
  if (cached) return cached;

  if (
    !(await reserveApiCredits(
      PROVIDER,
      predictedCredits,
      ODDS_API_POLICY.dailyCreditBudget,
    ))
  ) {
    const stale = await getCached<T>(key, true);
    if (stale) return stale;
    throw new Error("Presupuesto diario de créditos de The Odds API agotado");
  }

  const url = new URL(`${BASE_URL}${endpoint}`);
  url.searchParams.set("apiKey", process.env.THE_ODDS_API_KEY!);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));

  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`The Odds API ${response.status}: ${response.statusText}`);
    const body = (await response.json()) as T;
    await setCached(key, body, ttlSeconds, ODDS_API_POLICY.staleFallbackSeconds);
    return body;
  } catch (error) {
    const stale = await getCached<T>(key, true);
    if (stale) return stale;
    throw error;
  }
}

export async function getActiveSoccerSports(): Promise<OddsSport[]> {
  const sports = await freeGet<OddsSport[]>("/sports", {}, ODDS_API_POLICY.sportsTtlSeconds);
  return sports.filter(
    (sport) =>
      sport.active &&
      /soccer|football/i.test(`${sport.group} ${sport.title} ${sport.description ?? ""}`),
  );
}

export function knownSportKeysForFixture(fixture: Fixture) {
  const league = normalize(fixture.league.name);
  const country = normalize(fixture.league.country ?? "");

  return STATIC_SPORT_KEYS
    .filter(
      (entry) =>
        entry.league.test(league) && (!entry.country || entry.country.test(country)),
    )
    .flatMap((entry) => entry.keys);
}

function sportTitleScore(fixture: Fixture, sport: OddsSport) {
  const league = normalize(fixture.league.name);
  const country = normalize(fixture.league.country ?? "");
  const title = normalize(`${sport.title} ${sport.description ?? ""}`);

  let score = tokenSimilarity(league, title) * 5;
  if (country && title.includes(country)) score += 1.5;

  if (league.includes("champions") && title.includes("champions")) score += 4;
  if (league.includes("europa") && title.includes("europa")) score += 4;
  if (league.includes("conference") && title.includes("conference")) score += 4;
  if (league.includes("eerste") && title.includes("eerste")) score += 4;
  if (league.includes("eredivisie") && title.includes("eredivisie")) score += 4;

  return score;
}

export async function resolveSportKey(fixture: Fixture): Promise<string | null> {
  const sports = await getActiveSoccerSports();
  const activeKeys = new Set(sports.map((sport) => sport.key));

  for (const key of knownSportKeysForFixture(fixture)) {
    if (activeKeys.has(key)) return key;
  }

  const ranked = sports
    .map((sport) => ({ sport, score: sportTitleScore(fixture, sport) }))
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.score >= 2.35 ? ranked[0].sport.key : null;
}

export async function getEventsForSport(sportKey: string): Promise<OddsEvent[]> {
  return freeGet<OddsEvent[]>(
    `/sports/${encodeURIComponent(sportKey)}/events`,
    { dateFormat: "iso" },
    ODDS_API_POLICY.eventsTtlSeconds,
  );
}

function findMatchingEvent(fixture: Fixture, events: OddsEvent[]): OddsEvent | null {
  const fixtureTime = fixture.timestamp * 1000;

  const ranked = events
    .map((event) => {
      const home = teamSimilarity(fixture.home.name, event.home_team);
      const away = teamSimilarity(fixture.away.name, event.away_team);
      const eventTime = new Date(event.commence_time).getTime();
      const hours = Math.abs(eventTime - fixtureTime) / 3_600_000;
      const timeScore = hours <= 2 ? 1 : hours <= 8 ? 0.85 : hours <= 18 ? 0.55 : 0;
      return {
        event,
        home,
        away,
        hours,
        score: home * 0.42 + away * 0.42 + timeScore * 0.16,
      };
    })
    .filter((item) => item.hours <= 18 && item.home >= 0.55 && item.away >= 0.55)
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.score >= 0.62 ? ranked[0].event : null;
}

function marketGroupFor(market: MarketKey): TheOddsMarketGroup | null {
  switch (market) {
    case "HOME_WIN":
    case "AWAY_WIN":
      return "h2h";
    case "DOUBLE_CHANCE_1X":
    case "DOUBLE_CHANCE_X2":
    case "DOUBLE_CHANCE_12":
      return "double_chance";
    case "OVER_2_5":
      return "totals";
    case "OVER_0_5":
    case "OVER_1_5":
      return "alternate_totals";
    case "BTTS_YES":
      return "btts";
    case "HOME_OVER_0_5":
    case "AWAY_OVER_0_5":
    case "HOME_OVER_1_5":
    case "AWAY_OVER_1_5":
      return "alternate_team_totals";
    case "COMBO_1X_OVER_1_5":
    case "COMBO_X2_OVER_1_5":
    case "COMBO_1X_OVER_2_5":
    case "COMBO_X2_OVER_2_5":
    case "COMBO_HOME_WIN_OVER_1_5":
    case "COMBO_AWAY_WIN_OVER_1_5":
    case "COMBO_HOME_WIN_OVER_2_5":
    case "COMBO_AWAY_WIN_OVER_2_5":
      // The Odds API v4 no ofrece una cuota SGP/combinada del mismo partido
      // con este endpoint. El proveedor no fabrica precios; si falta el real,
      // la capa de análisis puede mostrar una cuota justa EST. claramente marcada.
      return null;
  }
}

function groupsForFixture(
  fixture: EnrichedFixture,
  groupOffset = 0,
  maxGroups = ODDS_API_POLICY.maxMarketGroupsPerFixture,
): TheOddsMarketGroup[] {
  const rankedGroups: TheOddsMarketGroup[] = [];

  for (const market of rankMarketsForPricing(fixture)) {
    const group = marketGroupFor(market);
    if (group && !rankedGroups.includes(group)) rankedGroups.push(group);
  }

  return rankedGroups.slice(groupOffset, groupOffset + Math.max(1, maxGroups));
}

function quote(
  market: MarketKey,
  label: string,
  decimal: number,
  bookmaker: string,
  updatedAt?: string | null,
): OddsQuote | null {
  if (!Number.isFinite(decimal) || decimal <= 1) return null;
  return {
    market,
    label,
    decimal,
    bookmaker,
    real: true,
    updatedAt: updatedAt ?? null,
  };
}

function parseDoubleChance(
  value: string,
  fixture: Fixture,
): { market: MarketKey; label: string } | null {
  const n = normalize(value);
  const home = normalize(fixture.home.name);
  const away = normalize(fixture.away.name);

  const mentionsHome = n.includes("home") || n.includes(home);
  const mentionsAway = n.includes("away") || n.includes(away);
  const mentionsDraw = n.includes("draw") || n.includes("empate");

  if (mentionsHome && mentionsDraw && !mentionsAway) {
    return { market: "DOUBLE_CHANCE_1X", label: `${fixture.home.name} o empate (1X)` };
  }
  if (mentionsAway && mentionsDraw && !mentionsHome) {
    return { market: "DOUBLE_CHANCE_X2", label: `Empate o ${fixture.away.name} (X2)` };
  }
  if (mentionsHome && mentionsAway && !mentionsDraw) {
    return { market: "DOUBLE_CHANCE_12", label: `${fixture.home.name} o ${fixture.away.name} (12)` };
  }

  if (["1x", "home draw", "home or draw"].includes(n)) {
    return { market: "DOUBLE_CHANCE_1X", label: `${fixture.home.name} o empate (1X)` };
  }
  if (["x2", "draw away", "draw or away", "away or draw"].includes(n)) {
    return { market: "DOUBLE_CHANCE_X2", label: `Empate o ${fixture.away.name} (X2)` };
  }
  if (["12", "home away", "home or away"].includes(n)) {
    return { market: "DOUBLE_CHANCE_12", label: `${fixture.home.name} o ${fixture.away.name} (12)` };
  }

  return null;
}

function addBest(byMarket: Map<MarketKey, OddsQuote>, candidate: OddsQuote | null) {
  if (!candidate) return;
  const current = byMarket.get(candidate.market);
  if (!current || candidate.decimal > current.decimal) {
    byMarket.set(candidate.market, candidate);
  }
}

function parseEventOdds(body: any, fixture: Fixture): OddsQuote[] {
  const bookmaker =
    (body.bookmakers ?? []).find(
      (book: any) => normalize(book.key) === normalize(ODDS_API_POLICY.bookmaker),
    ) ?? body.bookmakers?.[0];

  if (!bookmaker) return [];

  const title = String(bookmaker.title ?? bookmaker.key ?? "The Odds API");
  const byMarket = new Map<MarketKey, OddsQuote>();

  for (const market of bookmaker.markets ?? []) {
    const key = String(market.key ?? "");
    const updatedAt = market.last_update ? String(market.last_update) : null;

    for (const outcome of market.outcomes ?? []) {
      const name = String(outcome.name ?? "");
      const description = String(outcome.description ?? "");
      const price = Number(outcome.price);
      const point = Number(outcome.point);

      if (key === "h2h") {
        if (teamSimilarity(name, fixture.home.name) >= 0.75) {
          addBest(byMarket, quote("HOME_WIN", `Gana ${fixture.home.name}`, price, title, updatedAt));
        } else if (teamSimilarity(name, fixture.away.name) >= 0.75) {
          addBest(byMarket, quote("AWAY_WIN", `Gana ${fixture.away.name}`, price, title, updatedAt));
        }
      }

      if (key === "double_chance") {
        const mapped = parseDoubleChance(name || description, fixture);
        if (mapped) addBest(byMarket, quote(mapped.market, mapped.label, price, title, updatedAt));
      }

      if (key === "totals" || key === "alternate_totals") {
        if (normalize(name) !== "over") continue;
        if (Math.abs(point - 0.5) < 0.01) {
          addBest(byMarket, quote("OVER_0_5", "Más de 0.5 goles", price, title, updatedAt));
        }
        if (Math.abs(point - 1.5) < 0.01) {
          addBest(byMarket, quote("OVER_1_5", "Más de 1.5 goles", price, title, updatedAt));
        }
        if (Math.abs(point - 2.5) < 0.01) {
          addBest(byMarket, quote("OVER_2_5", "Más de 2.5 goles", price, title, updatedAt));
        }
      }

      if (key === "btts" && normalize(name) === "yes") {
        addBest(byMarket, quote("BTTS_YES", "Ambos marcan: Sí", price, title, updatedAt));
      }

      if (key === "team_totals" || key === "alternate_team_totals") {
        if (normalize(name) !== "over") continue;
        const team = description || String(outcome.team ?? "");
        const isHome = teamSimilarity(team, fixture.home.name) >= 0.7;
        const isAway = teamSimilarity(team, fixture.away.name) >= 0.7;

        if (isHome && Math.abs(point - 0.5) < 0.01) {
          addBest(byMarket, quote("HOME_OVER_0_5", `${fixture.home.name} marca +0.5`, price, title, updatedAt));
        }
        if (isAway && Math.abs(point - 0.5) < 0.01) {
          addBest(byMarket, quote("AWAY_OVER_0_5", `${fixture.away.name} marca +0.5`, price, title, updatedAt));
        }
        if (isHome && Math.abs(point - 1.5) < 0.01) {
          addBest(byMarket, quote("HOME_OVER_1_5", `${fixture.home.name} marca +1.5`, price, title, updatedAt));
        }
        if (isAway && Math.abs(point - 1.5) < 0.01) {
          addBest(byMarket, quote("AWAY_OVER_1_5", `${fixture.away.name} marca +1.5`, price, title, updatedAt));
        }
      }
    }
  }

  return [...byMarket.values()];
}

export async function getTheOddsPreMatchOdds(
  enrichedFixture: EnrichedFixture,
  options: { groupOffset?: number; maxGroups?: number } = {},
): Promise<OddsQuote[]> {
  if (!hasKey()) return [];

  const sportKey = await resolveSportKey(enrichedFixture.fixture);
  if (!sportKey) return [];

  const events = await getEventsForSport(sportKey);
  const event = findMatchingEvent(enrichedFixture.fixture, events);
  if (!event) return [];

  const groups = groupsForFixture(
    enrichedFixture,
    options.groupOffset ?? 0,
    options.maxGroups ?? ODDS_API_POLICY.maxMarketGroupsPerFixture,
  );
  if (!groups.length) return [];

  const body = await paidGet<any>(
    `/sports/${encodeURIComponent(sportKey)}/events/${encodeURIComponent(event.id)}/odds`,
    {
      dateFormat: "iso",
      oddsFormat: "decimal",
      bookmakers: ODDS_API_POLICY.bookmaker,
      markets: groups.join(","),
    },
    ODDS_API_POLICY.oddsTtlSeconds,
    groups.length,
  );

  return parseEventOdds(body, enrichedFixture.fixture);
}

export function theOddsApiConfigured() {
  return hasKey();
}

export const THE_ODDS_PROVIDER = PROVIDER;

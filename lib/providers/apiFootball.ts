import { API_POLICY } from "@/lib/config/rules";
import { cacheKey, getCached, setCached } from "@/lib/cache/cache";
import { spendApiCall } from "@/lib/cache/usage";
import type { Fixture } from "@/lib/engine/types";
import type { HistoricalFixture } from "@/lib/engine/form";

const PROVIDER = "api-football";
const BASE_URL = process.env.API_FOOTBALL_BASE_URL ?? "https://v3.football.api-sports.io";

function hasApiKey() {
  return Boolean(process.env.API_FOOTBALL_KEY);
}

async function apiGet<T>(
  endpoint: string,
  params: Record<string, string | number | boolean>,
  ttlSeconds: number,
): Promise<T> {
  if (!hasApiKey()) throw new Error("API_FOOTBALL_KEY no configurada");
  const key = cacheKey(`${PROVIDER}:${endpoint}`, params);
  const cached = await getCached<T>(key);
  if (cached) return cached;

  if (!(await spendApiCall(PROVIDER))) {
    const stale = await getCached<T>(key, true);
    if (stale) return stale;
    throw new Error("Presupuesto diario de API-Football agotado y no hay caché disponible");
  }

  const url = new URL(`${BASE_URL}${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));

  try {
    const response = await fetch(url, {
      headers: { "x-apisports-key": process.env.API_FOOTBALL_KEY! },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`API-Football ${response.status}: ${response.statusText}`);
    const body = await response.json();
    if (body?.errors && Object.keys(body.errors).length > 0) {
      throw new Error(`API-Football: ${JSON.stringify(body.errors)}`);
    }

    await setCached(key, body, ttlSeconds, API_POLICY.staleFallbackSeconds);
    return body as T;
  } catch (error) {
    const stale = await getCached<T>(key, true);
    if (stale) return stale;
    throw error;
  }
}

function parseFixture(item: any): Fixture {
  return {
    id: Number(item.fixture.id),
    date: String(item.fixture.date),
    timestamp: Number(item.fixture.timestamp),
    status: String(item.fixture.status?.short ?? "NS"),
    round: item.league.round ? String(item.league.round) : null,
    league: {
      id: Number(item.league.id),
      name: String(item.league.name),
      country: item.league.country ? String(item.league.country) : null,
      season: Number(item.league.season),
    },
    home: {
      id: Number(item.teams.home.id),
      name: String(item.teams.home.name),
      logo: item.teams.home.logo ? String(item.teams.home.logo) : null,
    },
    away: {
      id: Number(item.teams.away.id),
      name: String(item.teams.away.name),
      logo: item.teams.away.logo ? String(item.teams.away.logo) : null,
    },
  };
}

export async function getFixturesByDate(date: string): Promise<Fixture[]> {
  const body = await apiGet<any>("/fixtures", { date }, API_POLICY.fixturesTtlSeconds);
  return (body.response ?? []).map(parseFixture);
}

export async function getRecentTeamFixtures(
  teamId: number,
  last = 8,
): Promise<HistoricalFixture[]> {
  const body = await apiGet<any>(
    "/fixtures",
    { team: teamId, last, status: "FT" },
    API_POLICY.teamFormTtlSeconds,
  );

  return (body.response ?? [])
    .map((item: any) => ({
      fixture: parseFixture(item),
      homeGoals: Number(item.goals?.home ?? 0),
      awayGoals: Number(item.goals?.away ?? 0),
    }))
    .sort((a: HistoricalFixture, b: HistoricalFixture) => b.fixture.timestamp - a.fixture.timestamp);
}

export interface LeagueStandingRow {
  teamId: number;
  rank: number;
}

export async function getStandings(leagueId: number, season: number): Promise<LeagueStandingRow[]> {
  if ((process.env.ENABLE_STANDINGS ?? "true") !== "true") return [];
  const body = await apiGet<any>(
    "/standings",
    { league: leagueId, season },
    API_POLICY.standingsTtlSeconds,
  );
  const groups = body.response?.[0]?.league?.standings ?? [];
  return groups.flatMap((group: any[]) =>
    group.map((row: any) => ({ teamId: Number(row.team.id), rank: Number(row.rank) })),
  );
}

export function apiFootballConfigured() {
  return hasApiKey();
}

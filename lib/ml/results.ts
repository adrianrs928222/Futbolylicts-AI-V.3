import { cacheKey, getCached, setCached } from "@/lib/cache/cache";
import { spendApiCall } from "@/lib/cache/usage";
import { API_POLICY } from "@/lib/config/rules";

const PROVIDER = "api-football";
const BASE_URL = process.env.API_FOOTBALL_BASE_URL ?? "https://v3.football.api-sports.io";

export async function getFixtureResult(fixtureId: number) {
  if (!process.env.API_FOOTBALL_KEY) throw new Error("API_FOOTBALL_KEY no configurada");
  const key = cacheKey(`${PROVIDER}:ml-result`, { id: fixtureId });
  const cached = await getCached<any>(key, true);
  if (cached) return cached as { status: string; homeGoals: number; awayGoals: number };
  if (!(await spendApiCall(PROVIDER))) return null;
  const url = new URL(`${BASE_URL}/fixtures`);
  url.searchParams.set("id", String(fixtureId));
  const response = await fetch(url, { headers: { "x-apisports-key": process.env.API_FOOTBALL_KEY }, cache: "no-store" });
  if (!response.ok) throw new Error(`API-Football ${response.status}: ${response.statusText}`);
  const body = await response.json();
  const item = body?.response?.[0];
  if (!item) return null;
  const result = { status: String(item.fixture?.status?.short ?? "NS"), homeGoals: Number(item.goals?.home ?? 0), awayGoals: Number(item.goals?.away ?? 0) };
  if (["FT", "AET", "PEN"].includes(result.status)) await setCached(key, result, API_POLICY.fixturesTtlSeconds, API_POLICY.staleFallbackSeconds);
  return result;
}

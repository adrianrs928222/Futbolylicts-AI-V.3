import {
  competitionCategory,
  fixturePriorityScore,
  isExcludedFixture,
} from "@/lib/config/competitions";
import { API_POLICY, FUTBOLYLICTS_RULES, ODDS_API_POLICY } from "@/lib/config/rules";
import { demoFixtures } from "@/lib/data/demo";
import { buildBestCombo, eligibleCandidates } from "@/lib/engine/combo";
import { selectAnalysisPicks } from "@/lib/engine/analysisCombo";
import { buildTeamForm } from "@/lib/engine/form";
import {
  fixturePricingPriority,
  marketProbability,
  rankMarketsForPricing,
  scoreMarkets,
  statisticalMarketScore,
} from "@/lib/engine/scoring";
import type {
  CompetitionCategory,
  DailyAnalysis,
  AnalyzedFixtureSummary,
  DailyFixtureSummary,
  EnrichedFixture,
  Fixture,
  MarketCandidate,
  StandingContext,
} from "@/lib/engine/types";
import { getUsage } from "@/lib/cache/usage";
import { getMemoryCacheStats } from "@/lib/cache/cache";
import { supabaseConfigured } from "@/lib/cache/supabase";
import { saveDailyAnalysis } from "@/lib/storage/analysisStore";
import {
  apiFootballConfigured,
  getFixturesByDate,
  getRecentTeamFixtures,
  getStandings,
} from "@/lib/providers/apiFootball";
import {
  getActiveSoccerSports,
  getTheOddsPreMatchOdds,
  knownSportKeysForFixture,
  theOddsApiConfigured,
  THE_ODDS_PROVIDER,
} from "@/lib/providers/theOddsApi";

const FOOTBALL_PROVIDER = "api-football";
const PREMATCH_STATUSES = new Set(["NS", "TBD"]);

const MARKET_LABELS: Record<string, string> = {
  HOME_WIN: "Gana local",
  AWAY_WIN: "Gana visitante",
  DOUBLE_CHANCE_1X: "Doble oportunidad 1X",
  DOUBLE_CHANCE_X2: "Doble oportunidad X2",
  DOUBLE_CHANCE_12: "12 · No hay empate",
  OVER_0_5: "Más de 0.5 goles",
  OVER_1_5: "Más de 1.5 goles",
  OVER_2_5: "Más de 2.5 goles",
  BTTS_YES: "Ambos marcan · Sí",
  HOME_OVER_0_5: "Local +0.5 goles",
  AWAY_OVER_0_5: "Visitante +0.5 goles",
  HOME_OVER_1_5: "Local +1.5 goles",
  AWAY_OVER_1_5: "Visitante +1.5 goles",
};

function buildAnalyzedFixtureSummaries(
  enriched: EnrichedFixture[],
  candidates: MarketCandidate[],
): AnalyzedFixtureSummary[] {
  const byFixture = new Map<number, typeof candidates>();
  for (const candidate of candidates) {
    const list = byFixture.get(candidate.fixtureId) ?? [];
    list.push(candidate);
    byFixture.set(candidate.fixtureId, list);
  }

  return enriched.map<AnalyzedFixtureSummary>((item) => {
    const pricedCandidates = (byFixture.get(item.fixture.id) ?? []).sort(
      (a, b) => b.score - a.score || b.probability - a.probability,
    );
    const best = pricedCandidates[0];

    if (best) {
      const failures: string[] = [];
      if (best.probability < FUTBOLYLICTS_RULES.minProbability) failures.push(`probabilidad ${Math.round(best.probability * 100)}% (<70%)`);
      if (best.score < FUTBOLYLICTS_RULES.minScore) failures.push(`nota ${best.score.toFixed(1)}/10 (<8.0)`);
      if (best.odds < FUTBOLYLICTS_RULES.preferredOddsMin || best.odds > FUTBOLYLICTS_RULES.preferredOddsMax) failures.push(`cuota @${best.odds.toFixed(2)} fuera de @1.25–@1.75`);
      const implied = 1 / Math.max(best.odds, 1.01);
      const edge = best.probability - implied;
      if (edge < FUTBOLYLICTS_RULES.minValueEdge) failures.push(`valor insuficiente frente a la cuota (${Math.round(edge * 100)} pts)`);
      if (!best.realOdds) failures.push("falta cuota real");

      const passes = failures.length === 0;
      const near = !passes && best.probability >= 0.67 && best.score >= 7.7;
      return {
        fixtureId: item.fixture.id,
        fixtureLabel: `${item.fixture.home.name} – ${item.fixture.away.name}`,
        leagueName: item.fixture.league.name,
        category: item.category,
        bestMarketLabel: best.marketLabel,
        probability: best.probability,
        score: best.score,
        odds: best.odds,
        realOdds: best.realOdds,
        status: passes ? "PASA" : near ? "CERCA" : "FUERA",
        explanation: passes
          ? "Pasa probabilidad, nota, rango de cuota y valor frente a la cuota."
          : `No entra por: ${failures.join(" · ")}.`,
      };
    }

    const theoreticalMarket = rankMarketsForPricing(item)[0];
    const probability = theoreticalMarket ? marketProbability(theoreticalMarket, item) : 0;
    const score = theoreticalMarket ? statisticalMarketScore(theoreticalMarket, item) : 0;
    return {
      fixtureId: item.fixture.id,
      fixtureLabel: `${item.fixture.home.name} – ${item.fixture.away.name}`,
      leagueName: item.fixture.league.name,
      category: item.category,
      bestMarketLabel: theoreticalMarket ? MARKET_LABELS[theoreticalMarket] ?? theoreticalMarket : "Sin mercado claro",
      probability,
      score,
      realOdds: false,
      status: "SIN_CUOTA",
      explanation: probability >= FUTBOLYLICTS_RULES.minProbability && score >= FUTBOLYLICTS_RULES.minScore
        ? `Perfil ALTA por datos (${Math.round(probability * 100)}% · ${score.toFixed(1)}/10), pero falta cuota real para comprobar también el valor y validarlo como pick oficial.`
        : "Analizado estadísticamente, pero no llegó cuota real o no supera a la vez probabilidad y nota.",
    };
  }).sort((a, b) => {
    const order = { PASA: 0, CERCA: 1, SIN_CUOTA: 2, FUERA: 3 } as const;
    return order[a.status] - order[b.status] || b.probability - a.probability;
  });
}

function countCategories(fixtures: EnrichedFixture[]) {
  return fixtures.reduce<Partial<Record<CompetitionCategory, number>>>((acc, item) => {
    acc[item.category] = (acc[item.category] ?? 0) + 1;
    return acc;
  }, {});
}

function countRawCategories(fixtures: Fixture[]) {
  return fixtures.reduce<Partial<Record<CompetitionCategory, number>>>((acc, fixture) => {
    const category = competitionCategory(fixture.league.name);
    acc[category] = (acc[category] ?? 0) + 1;
    return acc;
  }, {});
}

function summarizeDailyFixtures(fixtures: Fixture[], analyzedIds: Set<number>): DailyFixtureSummary[] {
  return [...fixtures]
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((fixture) => ({
      fixtureId: fixture.id,
      fixtureLabel: `${fixture.home.name} – ${fixture.away.name}`,
      leagueName: fixture.league.name,
      category: competitionCategory(fixture.league.name),
      kickoff: fixture.date,
      timestamp: fixture.timestamp,
      status: fixture.status,
      analyzed: analyzedIds.has(fixture.id),
    }));
}

function isFuturePrematch(fixture: Fixture) {
  if (!PREMATCH_STATUSES.has(fixture.status)) return false;
  return fixture.timestamp * 1000 > Date.now() - 2 * 60 * 1000;
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const result = new Array<R>(items.length);
  let cursor = 0;

  async function worker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      result[index] = await fn(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return result;
}

async function loadStandingContext(fixtures: Fixture[]) {
  const unique = new Map<string, { leagueId: number; season: number }>();
  for (const fixture of fixtures) {
    unique.set(`${fixture.league.id}:${fixture.league.season}`, {
      leagueId: fixture.league.id,
      season: fixture.league.season,
    });
  }

  const standingsMap = new Map<string, Awaited<ReturnType<typeof getStandings>>>();
  await mapLimit([...unique.entries()], 2, async ([key, value]) => {
    try {
      standingsMap.set(key, await getStandings(value.leagueId, value.season));
    } catch {
      standingsMap.set(key, []);
    }
  });
  return standingsMap;
}

function standingForFixture(
  fixture: Fixture,
  standingsMap: Map<string, Awaited<ReturnType<typeof getStandings>>>,
): StandingContext | undefined {
  const rows = standingsMap.get(`${fixture.league.id}:${fixture.league.season}`) ?? [];
  if (!rows.length) return undefined;
  return {
    homeRank: rows.find((row) => row.teamId === fixture.home.id)?.rank,
    awayRank: rows.find((row) => row.teamId === fixture.away.id)?.rank,
    teamsInLeague: rows.length,
  };
}

async function enrichRealFixtures(date: string): Promise<{
  rawFixtures: Fixture[];
  enriched: EnrichedFixture[];
  warnings: string[];
}> {
  const warnings: string[] = [];

  // API-Football hace UNA sola función: datos de fútbol.
  // Primero traemos todos los fixtures del día y filtramos localmente.
  const all = await getFixturesByDate(date);

  const visibleDayFixtures = all
    .filter((fixture) => !isExcludedFixture(fixture));

  const filtered = visibleDayFixtures
    .filter(isFuturePrematch);

  // v0.8: antes se cogían simplemente los 12 primeros por categoría y, en días
  // grandes, competiciones remotas con "Champions League" podían ocupar todo
  // el cupo. Ahora priorizamos ligas/torneos importantes Y que The Odds API
  // reconoce, antes de gastar llamadas de forma/standings.
  let selectionPool = [...filtered];

  if (theOddsApiConfigured()) {
    try {
      const activeSports = await getActiveSoccerSports();
      const activeKeys = new Set(activeSports.map((sport) => sport.key));
      const oddsSupported = filtered.filter((fixture) =>
        knownSportKeysForFixture(fixture).some((key) => activeKeys.has(key)),
      );

      if (oddsSupported.length >= Math.min(4, FUTBOLYLICTS_RULES.maxFixturesToEnrich)) {
        selectionPool = oddsSupported;
      }

      warnings.push(
        `Criba previa: ${oddsSupported.length} partidos del día tienen competición reconocida por The Odds API; se priorizan antes de gastar llamadas profundas.`,
      );
    } catch {
      warnings.push("No se pudo consultar el catálogo gratuito de The Odds API; se usa la prioridad local de competiciones.");
    }
  }

  const sorted = selectionPool.sort((a, b) => {
    const pa = fixturePriorityScore(a);
    const pb = fixturePriorityScore(b);
    return pb - pa || a.timestamp - b.timestamp;
  });

  // Evita que una sola categoría ocupe todos los slots. En una jornada normal
  // de sábado deja espacio a varias ligas grandes; en noches UEFA permite hasta 8.
  const caps: Record<CompetitionCategory, number> = {
    champions: 8,
    europa: 8,
    conference: 8,
    national_cup: 4,
    top_league: 10,
    other: 2,
  };
  const used = new Map<CompetitionCategory, number>();
  const shortlist: Fixture[] = [];

  for (const fixture of sorted) {
    const category = competitionCategory(fixture.league.name);
    if ((used.get(category) ?? 0) >= caps[category]) continue;
    shortlist.push(fixture);
    used.set(category, (used.get(category) ?? 0) + 1);
    if (shortlist.length >= FUTBOLYLICTS_RULES.maxFixturesToEnrich) break;
  }

  if (filtered.length > shortlist.length) {
    warnings.push(
      `Se muestran ${visibleDayFixtures.length} partidos elegibles del día; Futbolylicts profundiza en ${shortlist.length} candidatos prematch priorizados por competición + disponibilidad de cuotas.`,
    );
  }

  const standingsMap = await loadStandingContext(shortlist);

  // 1) Forma + clasificación, SIN pedir cuotas a API-Football.
  const statsEnriched = await mapLimit(shortlist, 3, async (fixture) => {
    let homeHistory = [] as Awaited<ReturnType<typeof getRecentTeamFixtures>>;
    let awayHistory = [] as Awaited<ReturnType<typeof getRecentTeamFixtures>>;

    try {
      [homeHistory, awayHistory] = await Promise.all([
        getRecentTeamFixtures(fixture.home.id, 8),
        getRecentTeamFixtures(fixture.away.id, 8),
      ]);
    } catch {
      warnings.push(`No se pudo completar toda la forma de ${fixture.home.name} – ${fixture.away.name}.`);
    }

    return {
      fixture,
      category: competitionCategory(fixture.league.name),
      homeForm: buildTeamForm(fixture.home.id, homeHistory),
      awayForm: buildTeamForm(fixture.away.id, awayHistory),
      standings: standingForFixture(fixture, standingsMap),
      odds: [],
    } satisfies EnrichedFixture;
  });

  if (!theOddsApiConfigured()) {
    warnings.push(
      "THE_ODDS_API_KEY no está configurada: se analizan estadísticas reales, pero no se publica combinada oficial sin cuotas reales.",
    );
    return { rawFixtures: visibleDayFixtures, enriched: statsEnriched, warnings };
  }

  // 2) El motor decide qué partidos merecen gastar créditos de cuotas.
  // Solo los mejores pasan a The Odds API.
  const toPrice = [...statsEnriched]
    .sort((a, b) => fixturePricingPriority(b) - fixturePricingPriority(a))
    .slice(0, ODDS_API_POLICY.maxFixturesToPrice);

  const priceIds = new Set(toPrice.map((item) => item.fixture.id));
  if (statsEnriched.length > toPrice.length) {
    warnings.push(
      `The Odds API pone precio a ${toPrice.length} de ${statsEnriched.length} partidos analizados en profundidad; el resto sigue visible y analizado estadísticamente sin gastar créditos de cuotas.`,
    );
  }

  let priced = await mapLimit(statsEnriched, 2, async (item) => {
    if (!priceIds.has(item.fixture.id)) return item;

    try {
      const odds = await getTheOddsPreMatchOdds(item, { groupOffset: 0, maxGroups: 1 });
      if (!odds.length) {
        warnings.push(
          `The Odds API/Bet365 no devolvió mercados útiles en la primera familia para ${item.fixture.home.name} – ${item.fixture.away.name}.`,
        );
      }
      return { ...item, odds };
    } catch (error) {
      warnings.push(
        `No se pudieron obtener cuotas de ${item.fixture.home.name} – ${item.fixture.away.name}: ${
          error instanceof Error ? error.message : "error desconocido"
        }.`,
      );
      return item;
    }
  });

  // v0.12: con los créditos que quedan, hacemos una segunda familia de mercado
  // solo en los partidos que todavía no producen ningún pick válido. Así se reparte
  // la búsqueda entre más partidos y se aprovecha el presupuesto 10 + 4.
  const secondPassIds = priced
    .filter((item) => priceIds.has(item.fixture.id))
    .filter((item) => eligibleCandidates(scoreMarkets(item)).length === 0)
    .sort((a, b) => fixturePricingPriority(b) - fixturePricingPriority(a))
    .slice(0, ODDS_API_POLICY.secondPassFixtures)
    .map((item) => item.fixture.id);

  if (secondPassIds.length) {
    const secondSet = new Set(secondPassIds);
    warnings.push(`Segunda pasada de cuotas: ${secondPassIds.length} partidos reciben una familia de mercado alternativa.`);

    priced = await mapLimit(priced, 2, async (item) => {
      if (!secondSet.has(item.fixture.id)) return item;
      try {
        const extraOdds = await getTheOddsPreMatchOdds(item, { groupOffset: 1, maxGroups: 1 });
        if (!extraOdds.length) return item;

        const merged = new Map(item.odds.map((quote) => [quote.market, quote]));
        for (const quote of extraOdds) {
          const current = merged.get(quote.market);
          if (!current || quote.decimal > current.decimal) merged.set(quote.market, quote);
        }
        return { ...item, odds: [...merged.values()] };
      } catch {
        return item;
      }
    });
  }

  return { rawFixtures: visibleDayFixtures, enriched: priced, warnings };
}

export async function buildDailyAnalysis(date: string): Promise<DailyAnalysis> {
  let mode: DailyAnalysis["mode"] = "live";
  let enriched: EnrichedFixture[] = [];
  let rawFixtures: Fixture[] = [];
  let fixturesCount = 0;
  const warnings: string[] = [];

  if (!apiFootballConfigured()) {
    mode = "demo";
    enriched = demoFixtures(date);
    rawFixtures = enriched.map((item) => item.fixture);
    fixturesCount = enriched.length;
    warnings.push("Modo demo: configura API_FOOTBALL_KEY para trabajar con partidos reales.");
  } else {
    try {
      const loaded = await enrichRealFixtures(date);
      enriched = loaded.enriched;
      rawFixtures = loaded.rawFixtures;
      fixturesCount = loaded.rawFixtures.length;
      warnings.push(...loaded.warnings);
    } catch (error) {
      if ((process.env.ENABLE_DEMO_FALLBACK ?? "true") === "true") {
        mode = "demo";
        enriched = demoFixtures(date);
        rawFixtures = enriched.map((item) => item.fixture);
        fixturesCount = enriched.length;
        warnings.push(
          `La fuente de datos no respondió; se muestra modo demo. ${
            error instanceof Error ? error.message : "Error desconocido"
          }`,
        );
      } else {
        throw error;
      }
    }
  }

  const candidates = enriched
    .flatMap(scoreMarkets)
    .sort((a, b) => b.score - a.score || b.probability - a.probability);

  const analyzedFixtures = buildAnalyzedFixtureSummaries(enriched, candidates);
  const analysisPicks = selectAnalysisPicks(analyzedFixtures);

  const combo = buildBestCombo(date, candidates);
  if (mode === "demo") combo.official = false;

  const footballUsed = mode === "live" ? await getUsage(FOOTBALL_PROVIDER) : 0;
  const oddsUsed = mode === "live" ? await getUsage(THE_ODDS_PROVIDER) : 0;
  const cache = getMemoryCacheStats();
  const analyzedIds = new Set(enriched.map((item) => item.fixture.id));
  const allFixtures = summarizeDailyFixtures(rawFixtures, analyzedIds);

  const analysis: DailyAnalysis = {
    date,
    mode,
    generatedAt: new Date().toISOString(),
    fixturesCount,
    allFixtures,
    analyzedFixturesCount: enriched.length,
    candidates,
    analyzedFixtures,
    analysisPicks,
    combo,
    categoryCounts: mode === "live" ? countRawCategories(rawFixtures) : countCategories(enriched),
    apiUsage: {
      provider: FOOTBALL_PROVIDER,
      used: footballUsed,
      budget: API_POLICY.dailyCallBudget,
      odds: {
        provider: THE_ODDS_PROVIDER,
        used: oddsUsed,
        budget: ODDS_API_POLICY.dailyCreditBudget,
      },
    },
    cacheStatus: {
      persistent: supabaseConfigured(),
      memoryEntries: cache.entries,
      hitRate: cache.hitRate,
      memoryHits: cache.memoryHits,
      supabaseHits: cache.supabaseHits,
      staleHits: cache.staleHits,
      misses: cache.misses,
    },
    warnings,
  };

  try {
    await saveDailyAnalysis(analysis);
  } catch {
    warnings.push("No se pudo guardar el análisis del día en Supabase, pero el pronóstico se ha generado.");
  }

  return analysis;
}

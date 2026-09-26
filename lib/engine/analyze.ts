import {
  competitionCategory,
  fixturePriorityScore,
  isExcludedFixture,
  isPreferredOfficialCompetition,
} from "@/lib/config/competitions";
import { API_POLICY, FUTBOLYLICTS_RULES, ODDS_API_POLICY } from "@/lib/config/rules";
import { demoFixtures } from "@/lib/data/demo";
import { buildBestCombo } from "@/lib/engine/combo";
import { buildBttsCombo, buildLeagueCombos } from "@/lib/engine/derivedCombos";
import { selectAnalysisPicks } from "@/lib/engine/analysisCombo";
import { buildTeamForm } from "@/lib/engine/form";
import {
  compareIntelligentCandidates,
  fixturePricingPriority,
  scoreMarkets,
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
import { addDaysToIsoDate } from "@/lib/date";
import {
  apiFootballConfigured,
  getFixturesByDate,
  getRecentTeamFixtures,
  getStandings,
} from "@/lib/providers/apiFootball";

const FOOTBALL_PROVIDER = "api-football";
const PREMATCH_STATUSES = new Set(["NS", "TBD"]);

function usefulCandidate(candidate: MarketCandidate) {
  return candidate.probability >= FUTBOLYLICTS_RULES.minProbability &&
    candidate.score >= FUTBOLYLICTS_RULES.minScore &&
    candidate.odds >= FUTBOLYLICTS_RULES.preferredOddsMin &&
    candidate.odds <= FUTBOLYLICTS_RULES.eligibleOddsMax &&
    (candidate.market !== "BTTS_YES" || candidate.odds >= FUTBOLYLICTS_RULES.bttsMinOdds);
}

function buildAnalyzedFixtureSummaries(
  enriched: EnrichedFixture[],
  candidates: MarketCandidate[],
): AnalyzedFixtureSummary[] {
  const byFixture = new Map<number, MarketCandidate[]>();
  for (const candidate of candidates) {
    const list = byFixture.get(candidate.fixtureId) ?? [];
    list.push(candidate);
    byFixture.set(candidate.fixtureId, list);
  }

  return enriched
    .map<AnalyzedFixtureSummary>((item) => {
      const ranked = [...(byFixture.get(item.fixture.id) ?? [])].sort(compareIntelligentCandidates);
      const selected = ranked.find(usefulCandidate) ?? ranked[0];

      if (!selected) {
        return {
          fixtureId: item.fixture.id,
          fixtureLabel: `${item.fixture.home.name} – ${item.fixture.away.name}`,
          leagueName: item.fixture.league.name,
          category: item.category,
          bestMarketLabel: "Sin mercado claro",
          probability: 0,
          score: 0,
          realOdds: false,
          status: "FUERA",
          explanation: "No aparece un mercado con señal suficiente para este partido.",
          alternatives: [],
        };
      }

      const alternatives = ranked
        .filter((candidate) => candidate.market !== selected.market)
        .slice(0, 5)
        .map((candidate) => ({
          marketLabel: candidate.marketLabel,
          probability: candidate.probability,
          score: candidate.score,
          odds: candidate.odds,
          realOdds: false,
        }))
        .filter((alt) => alt.probability >= 0.62 && alt.score >= 7.2);

      const passes = usefulCandidate(selected);
      const near = !passes && selected.probability >= 0.67 && selected.score >= 7.7;
      const failures: string[] = [];
      if (selected.probability < FUTBOLYLICTS_RULES.minProbability) failures.push("probabilidad por debajo del corte ALTA");
      if (selected.score < FUTBOLYLICTS_RULES.minScore) failures.push(`nota ${selected.score.toFixed(1)}/10`);
      if (selected.odds < FUTBOLYLICTS_RULES.preferredOddsMin) failures.push(`cuota EST. demasiado baja (@${selected.odds.toFixed(2)})`);
      if (selected.odds > FUTBOLYLICTS_RULES.eligibleOddsMax) failures.push(`cuota EST. demasiado alta (@${selected.odds.toFixed(2)})`);
      if (selected.market === "BTTS_YES" && selected.odds < FUTBOLYLICTS_RULES.bttsMinOdds) failures.push(`BTTS por debajo de @${FUTBOLYLICTS_RULES.bttsMinOdds.toFixed(2)}`);

      const explanation = passes
        ? `${selected.reasoning} ${selected.comparisonReason ?? ""}`.trim()
        : near
          ? `${selected.reasoning} Se queda cerca, pero no entra porque ${failures.join(" y ") || "no termina de compensar el riesgo"}.`
          : `No entra: ${failures.join(" · ") || "el perfil global no alcanza el nivel exigido"}.`;

      return {
        fixtureId: item.fixture.id,
        fixtureLabel: `${item.fixture.home.name} – ${item.fixture.away.name}`,
        leagueName: item.fixture.league.name,
        category: item.category,
        bestMarketLabel: selected.marketLabel,
        probability: selected.probability,
        score: selected.score,
        odds: selected.odds,
        realOdds: false,
        status: passes ? "PASA" : near ? "CERCA" : "FUERA",
        explanation,
        comparisonReason: selected.comparisonReason,
        alternatives,
      };
    })
    .sort((a, b) => {
      const order = { PASA: 0, CERCA: 1, SIN_CUOTA: 2, FUERA: 3 } as const;
      return order[a.status] - order[b.status] || (b.score ?? 0) - (a.score ?? 0) || b.probability - a.probability;
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
      preferred: isPreferredOfficialCompetition(fixture),
    }));
}

function isFuturePrematch(fixture: Fixture) {
  return PREMATCH_STATUSES.has(fixture.status) && fixture.timestamp * 1000 > Date.now() - 2 * 60 * 1000;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
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

function leagueKey(fixture: Fixture) {
  return `${fixture.league.country ?? ""}|${fixture.league.name}|${fixture.league.id}|${fixture.league.season}`;
}

/**
 * CRIBA GLOBAL DEL DÍA
 *
 * Todas las competiciones preferidas tienen oportunidad de entrar. No toma los
 * primeros N por hora: agrupa por liga y reparte el análisis profundo por rondas.
 * Las ligas raras siguen visibles en la jornada, pero no consumen análisis caro ni
 * pueden entrar en la Combinada oficial.
 */
function buildGlobalDeepShortlist(fixtures: Fixture[], maxFixtures: number): Fixture[] {
  if (fixtures.length <= maxFixtures) return [...fixtures].sort((a, b) => fixturePriorityScore(b) - fixturePriorityScore(a) || a.timestamp - b.timestamp);

  const byLeague = new Map<string, Fixture[]>();
  for (const fixture of fixtures) {
    const key = leagueKey(fixture);
    const list = byLeague.get(key) ?? [];
    list.push(fixture);
    byLeague.set(key, list);
  }

  const groups = [...byLeague.entries()]
    .map(([key, groupFixtures]) => ({
      key,
      fixtures: [...groupFixtures].sort((a, b) => a.timestamp - b.timestamp),
      priority: Math.max(...groupFixtures.map(fixturePriorityScore)),
    }))
    .sort((a, b) => b.priority - a.priority || a.fixtures[0].timestamp - b.fixtures[0].timestamp);

  const selected: Fixture[] = [];
  const selectedIds = new Set<number>();
  const maxPerLeague = Math.max(1, FUTBOLYLICTS_RULES.globalMaxPerLeague);

  for (let round = 0; round < maxPerLeague && selected.length < maxFixtures; round += 1) {
    for (const group of groups) {
      const fixture = group.fixtures[round];
      if (!fixture || selectedIds.has(fixture.id)) continue;
      selected.push(fixture);
      selectedIds.add(fixture.id);
      if (selected.length >= maxFixtures) break;
    }
  }

  // Si aún quedan huecos, rellena con los mejores partidos preferidos restantes.
  if (selected.length < maxFixtures) {
    const rest = fixtures
      .filter((fixture) => !selectedIds.has(fixture.id))
      .sort((a, b) => fixturePriorityScore(b) - fixturePriorityScore(a) || a.timestamp - b.timestamp);
    selected.push(...rest.slice(0, maxFixtures - selected.length));
  }

  return selected
    .slice(0, maxFixtures)
    .sort((a, b) => fixturePriorityScore(b) - fixturePriorityScore(a) || a.timestamp - b.timestamp);
}

async function loadStandingContextForTopLeagues(
  preliminarilyEnriched: EnrichedFixture[],
): Promise<Map<string, Awaited<ReturnType<typeof getStandings>>>> {
  const topFixtures = [...preliminarilyEnriched]
    .sort((a, b) => fixturePricingPriority(b) - fixturePricingPriority(a))
    .slice(0, Math.max(10, FUTBOLYLICTS_RULES.globalStandingLeagues * 2));

  const unique = new Map<string, { leagueId: number; season: number }>();
  for (const item of topFixtures) {
    const fixture = item.fixture;
    const key = `${fixture.league.id}:${fixture.league.season}`;
    if (!unique.has(key)) unique.set(key, { leagueId: fixture.league.id, season: fixture.league.season });
    if (unique.size >= FUTBOLYLICTS_RULES.globalStandingLeagues) break;
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
  dayFixturesCount: number;
  preferredFixturesCount: number;
  enriched: EnrichedFixture[];
  warnings: string[];
}> {
  const warnings: string[] = [];

  // 1) Una llamada: jornada completa.
  const all = await getFixturesByDate(date);
  const visibleDayFixtures = all.filter((fixture) => !isExcludedFixture(fixture));
  const prematch = visibleDayFixtures.filter(isFuturePrematch);

  // 2) Universo oficial: solo ligas/competiciones fiables elegidas por el usuario.
  const preferredPrematch = prematch.filter(isPreferredOfficialCompetition);
  warnings.push(
    `Criba global: ${prematch.length} partidos prematch revisados; ${preferredPrematch.length} pertenecen a ligas preferidas/fiables. Las ligas raras no entran en la combinada.`,
  );

  // 3) Análisis profundo sin un tope artificial de partidos.
  // Se intenta procesar TODA la jornada preferida. El único límite efectivo es el
  // presupuesto/cuota real del proveedor; la caché evita repetir llamadas ya resueltas.
  const shortlist = [...preferredPrematch]
    .sort((a, b) => fixturePriorityScore(b) - fixturePriorityScore(a) || a.timestamp - b.timestamp);
  warnings.push(
    `Análisis máximo: se intentan los ${shortlist.length} partidos prematch de ligas permitidas; no hay corte interno de 40. El límite real lo marca la cuota disponible de API-Football.`,
  );

  // 4) Forma reciente: hasta 2 llamadas por partido, con caché de 6 h.
  // Un partido solo cuenta como "analizado a fondo" si ambas consultas de forma
  // pudieron resolverse (desde API o caché). Así no fingimos un análisis completo.
  const failedDeepAnalysis: string[] = [];
  const preliminaryResults = await mapLimit(shortlist, 4, async (fixture): Promise<EnrichedFixture | null> => {
    const [homeResult, awayResult] = await Promise.allSettled([
      getRecentTeamFixtures(fixture.home.id, 8),
      getRecentTeamFixtures(fixture.away.id, 8),
    ]);

    if (homeResult.status !== "fulfilled" || awayResult.status !== "fulfilled") {
      failedDeepAnalysis.push(`${fixture.home.name} – ${fixture.away.name}`);
      return null;
    }

    return {
      fixture,
      category: competitionCategory(fixture.league.name),
      homeForm: buildTeamForm(fixture.home.id, homeResult.value),
      awayForm: buildTeamForm(fixture.away.id, awayResult.value),
      standings: undefined,
      odds: [],
    } satisfies EnrichedFixture;
  });
  const preliminary = preliminaryResults.filter((item): item is EnrichedFixture => item !== null);
  warnings.push(`Análisis profundo completado: ${preliminary.length}/${shortlist.length} partidos.`);
  if (failedDeepAnalysis.length) {
    warnings.push(`${failedDeepAnalysis.length} partidos no pudieron completarse por límite de API, falta de caché o error del proveedor. Se mantienen en la jornada, pero no se cuentan como analizados a fondo.`);
  }

  // 5) Clasificación solo para las ligas más prometedoras.
  const standingsMap = await loadStandingContextForTopLeagues(preliminary);
  const enriched = preliminary.map((item) => ({
    ...item,
    standings: standingForFixture(item.fixture, standingsMap),
  }));

  // 6) v0.24: no se gastan créditos de The Odds API. Todas las cuotas son EST.
  warnings.push(
    "Cuotas: el motor calcula cuotas JUSTAS EST. desde su probabilidad (con margen teórico mínimo). @8–@10 es un objetivo, nunca una cifra forzada. No usa The Odds API.",
  );

  // La UI también se centra exclusivamente en las competiciones permitidas: la jornada
  // completa se revisa para la criba, pero las ligas no permitidas no se muestran como opciones.
  return { rawFixtures: preferredPrematch, dayFixturesCount: visibleDayFixtures.length, preferredFixturesCount: preferredPrematch.length, enriched, warnings };
}

export async function buildDailyAnalysis(date: string): Promise<DailyAnalysis> {
  let mode: DailyAnalysis["mode"] = "live";
  let enriched: EnrichedFixture[] = [];
  let rawFixtures: Fixture[] = [];
  let fixturesCount = 0;
  let preferredFixturesCount = 0;
  const warnings: string[] = [];

  if (!apiFootballConfigured()) {
    mode = "demo";
    enriched = demoFixtures(date);
    rawFixtures = enriched.map((item) => item.fixture);
    fixturesCount = enriched.length;
    preferredFixturesCount = enriched.length;
    warnings.push("Modo demo: configura API_FOOTBALL_KEY para trabajar con partidos reales.");
  } else {
    try {
      const loaded = await enrichRealFixtures(date);
      enriched = loaded.enriched;
      rawFixtures = loaded.rawFixtures;
      fixturesCount = loaded.dayFixturesCount;
      preferredFixturesCount = loaded.preferredFixturesCount;
      warnings.push(...loaded.warnings);
    } catch (error) {
      if ((process.env.ENABLE_DEMO_FALLBACK ?? "false") === "true") {
        mode = "demo";
        enriched = demoFixtures(date);
        rawFixtures = enriched.map((item) => item.fixture);
        fixturesCount = enriched.length;
        preferredFixturesCount = enriched.length;
        warnings.push(
          `La fuente de datos no respondió; se muestra modo demo. ${error instanceof Error ? error.message : "Error desconocido"}`,
        );
      } else {
        throw error;
      }
    }
  }

  // Todos los mercados permitidos se generan como candidatos EST. y se comparan
  // antes de construir la combinada. No hay bonus por variedad ni por BTTS.
  const candidates = enriched
    .flatMap(scoreMarkets)
    .sort(compareIntelligentCandidates);

  const analyzedFixtures = buildAnalyzedFixtureSummaries(enriched, candidates);
  const analysisPicks = selectAnalysisPicks(analyzedFixtures);
  const combo = buildBestCombo(date, candidates);
  // Estas combinadas se derivan del mismo pool ya calculado. No ejecutan fetch,
  // no consumen API y no crean entradas de caché adicionales.
  const bttsCombo = buildBttsCombo(candidates);
  const leagueCombos = buildLeagueCombos(candidates);
  if (mode === "demo") combo.official = false;

  const footballUsed = mode === "live" ? await getUsage(FOOTBALL_PROVIDER) : 0;
  const cache = getMemoryCacheStats();
  const analyzedIds = new Set(enriched.map((item) => item.fixture.id));
  const allFixtures = summarizeDailyFixtures(rawFixtures, analyzedIds);

  const analysis: DailyAnalysis = {
    date,
    mode,
    generatedAt: new Date().toISOString(),
    fixturesCount,
    preferredFixturesCount,
    allFixtures,
    analyzedFixturesCount: enriched.length,
    candidates,
    analyzedFixtures,
    analysisPicks,
    combo,
    bttsCombo,
    leagueCombos,
    categoryCounts: mode === "live" ? countRawCategories(rawFixtures) : countCategories(enriched),
    apiUsage: {
      provider: FOOTBALL_PROVIDER,
      used: footballUsed,
      budget: API_POLICY.dailyCallBudget,
      odds: {
        provider: "the-odds-api (no usada en v0.24)",
        used: 0,
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


/**
 * Vista rodante de la Combinada del Día.
 *
 * Mantiene el análisis de hoy mientras todavía puede publicar una combinada oficial.
 * Cuando los partidos de hoy ya han empezado/terminado o no quedan suficientes picks
 * ALTA/MUY ALTA para cerrar @8–@10, prepara automáticamente la jornada de mañana.
 * No modifica el motor: únicamente decide qué fecha se muestra.
 */
export async function buildCurrentOrNextAnalysis(date: string): Promise<DailyAnalysis> {
  const today = await buildDailyAnalysis(date);

  // En demo no hacemos salto automático para no esconder el escenario de demostración.
  if (today.mode !== "live") return today;

  // Si hoy ya hay una combinada oficial válida, se mantiene hasta que sus partidos
  // dejen de ser prematch. Después, al regenerar, el análisis caerá en mañana.
  if (today.combo.official && today.combo.targetReached && today.combo.picks.length > 0) {
    return today;
  }

  const tomorrowDate = addDaysToIsoDate(date, 1);
  const tomorrow = await buildDailyAnalysis(tomorrowDate);

  // Solo cambiamos a mañana si realmente aporta partidos/picks útiles. Si mañana todavía
  // no está cargado por el proveedor, conservamos hoy y evitamos una pantalla vacía distinta.
  const tomorrowHasUsefulContent =
    tomorrow.preferredFixturesCount > 0 ||
    tomorrow.candidates.some(usefulCandidate) ||
    tomorrow.combo.picks.length > 0;

  if (!tomorrowHasUsefulContent) return today;

  tomorrow.warnings.unshift(
    `Ventana automática: hoy no queda una Combinada del Día oficial @8–@10 en prematch. Se muestra ${tomorrowDate} y se mantendrá mientras esos partidos sigan sin comenzar.`,
  );
  return tomorrow;
}

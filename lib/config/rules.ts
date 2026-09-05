export const FUTBOLYLICTS_RULES = {
  minScore: 8.0,
  minProbability: 0.70,
  veryHighScore: 9.0,
  veryHighProbability: 0.78,
  minValueEdge: 0.03,

  // La probabilidad y la nota son barreras distintas. Un 70% no convierte
  // automáticamente el pick en 8.5/10. ALTA empieza en 70% + 8.0/10;
  // MUY ALTA exige 78% + 9.0/10. Además se exige valor frente a la cuota.
  preferredCoreScoreMin: 8.5,
  preferredCoreProbabilityMin: 0.78,
  maxBorderlinePicks: 6,
  borderlineMinOdds: 1.35,
  borderlineMinProbability: 0.70,

  preferredOddsMin: 1.25,
  preferredOddsSweetMin: 1.3,
  preferredOddsSweetMax: 1.65,
  preferredOddsMax: 1.75,
  bttsMinOdds: 1.35,

  targetTotalOddsMin: 8.0,
  targetTotalOddsMax: 10.0,
  acceptableTotalOddsMax: 10.8,
  targetAnchor: 8.35,

  minSelections: 4,
  maxSelections: 6,
  idealSelections: 5,

  allowUnderMarkets: false,
  allowEstimatedOddsInOfficialCombo: false,

  maxMarketsPerFixtureForCombo: 5,
  maxFixturesForCombo: 22,
  comboBeamWidth: 9000,
  scoreTieTolerance: 0.25,

  // v0.12: se ven todos los partidos elegibles del día, pero el análisis profundo
  // se concentra por defecto en 18 candidatos para respetar el presupuesto API.
  maxFixturesToEnrich: Number(process.env.MAX_FIXTURES_TO_ENRICH ?? 18),
  excludedByDefault: {
    women: true,
    youth: true,
    reserves: true, // excepción: Eerste Divisie (Países Bajos)
    friendlies: true,
  },
} as const;

export const API_POLICY = {
  // Solo datos deportivos. Ya NO se consumen cuotas desde API-Football.
  dailyCallBudget: Number(process.env.API_CALL_BUDGET_DAILY ?? 90),
  fixturesTtlSeconds: Number(process.env.CACHE_FIXTURES_TTL_SECONDS ?? 10 * 60),
  teamFormTtlSeconds: Number(process.env.CACHE_TEAM_FORM_TTL_SECONDS ?? 6 * 60 * 60),
  standingsTtlSeconds: Number(process.env.CACHE_STANDINGS_TTL_SECONDS ?? 2 * 60 * 60),
  analysisTtlSeconds: Number(process.env.CACHE_ANALYSIS_TTL_SECONDS ?? 5 * 60),
  referenceDataTtlSeconds: 24 * 60 * 60,
  staleFallbackSeconds: Number(process.env.CACHE_STALE_FALLBACK_SECONDS ?? 24 * 60 * 60),
} as const;

export const ODDS_API_POLICY = {
  // 14 créditos/día deja un margen cómodo si el plan es de 500 créditos/mes.
  // Es un límite nuestro, no una promesa sobre el plan del proveedor.
  dailyCreditBudget: Number(process.env.THE_ODDS_API_DAILY_CREDIT_BUDGET ?? 14),
  maxFixturesToPrice: Number(process.env.THE_ODDS_MAX_FIXTURES_TO_PRICE ?? 10),
  maxMarketGroupsPerFixture: Number(process.env.THE_ODDS_MAX_MARKETS_PER_FIXTURE ?? 1),
  secondPassFixtures: Number(process.env.THE_ODDS_SECOND_PASS_FIXTURES ?? 4),
  sportsTtlSeconds: Number(process.env.THE_ODDS_SPORTS_TTL_SECONDS ?? 24 * 60 * 60),
  eventsTtlSeconds: Number(process.env.THE_ODDS_EVENTS_TTL_SECONDS ?? 30 * 60),
  oddsTtlSeconds: Number(process.env.CACHE_ODDS_TTL_SECONDS ?? 10 * 60),
  staleFallbackSeconds: Number(process.env.CACHE_STALE_FALLBACK_SECONDS ?? 24 * 60 * 60),
  bookmaker:
    process.env.THE_ODDS_BOOKMAKERS ??
    (process.env.PREFERRED_BOOKMAKER ?? "Bet365").toLowerCase().replace(/[^a-z0-9]+/g, ""),
} as const;

export const FUTBOLYLICTS_RULES = {
  minScore: 8.0,
  minProbability: 0.70,
  veryHighScore: 9.0,
  veryHighProbability: 0.78,

  // La combinada final usa la cuota EST. del modelo. No necesita una cuota real
  // del bookmaker para poder construir 4–6 patas y buscar @8–@10.
  comboOnlyHighConfidence: true,
  includeVeryHighInCombo: true,
  requireRealOddsInDailyCombo: false,
  allowEstimatedOddsInOfficialCombo: true,

  preferredCoreScoreMin: 8.5,
  preferredCoreProbabilityMin: 0.76,
  maxBorderlinePicks: 8,
  borderlineMinOdds: 1.25,
  borderlineMinProbability: 0.70,

  // Reglas maestras de cuota. La cuota filtra; nunca decide por sí sola el mercado.
  // Favoritos extremos: no convertir automáticamente @1.05 en una selección.
  extremeFavoriteOdds: 1.20,
  extremeFavoriteSearchEnabled: true,

  absoluteMinOdds: 1.25,
  standardMaxOdds: 1.90,
  bttsHighConfidenceMaxOdds: 3.00,
  preferredOddsMin: 1.25,
  preferredOddsSweetMin: 1.30,
  preferredOddsSweetMax: 1.75,
  preferredOddsMax: 1.90,
  eligibleOddsMax: 1.90,
  bttsMinOdds: 1.25,

  targetTotalOddsMin: 8.0,
  targetTotalOddsMax: 10.0,
  // Una pequeña desviación es aceptable si evita empeorar claramente los picks.
  acceptableTotalOddsMin: 7.60,
  acceptableTotalOddsMax: 11.50,
  targetAnchor: 9.0,

  minSelections: 4,
  maxSelections: 6,
  idealSelections: 5,

  allowUnderMarkets: false,
  allowHandicapMarkets: false,

  // Primero se decide cuál es la opción más inteligente de cada partido.
  // La combinada no cambia de mercado solo para cuadrar una cuota.
  // v0.23: el motor conserva varias alternativas inteligentes del mismo partido
  // para poder elegir 1X+1.5, X2+1.5, 12+2.5, BTTS, +2.5, etc. No se elige
  // una alternativa peor solo por cuota: debe mantenerse cerca del mejor mercado.
  maxMarketsPerFixtureForCombo: 5,
  maxAlternativeScoreDrop: 0.40,
  maxAlternativeProbabilityDrop: 0.08,
  maxFixturesForCombo: 40,
  comboBeamWidth: 24000,
  scoreTieTolerance: 0.18,

  // Revisión final: compara otra vez cada pata y también los mejores partidos
  // descartados. Solo sustituye cuando existe una mejora real de calidad.
  finalReviewEnabled: true,
  finalReviewMaxPasses: 5,
  finalReviewMinQualityGain: 0.06,
  finalReviewSoftOddsFloor: 7.5,
  // Si existe una combinación @8–@10 con picks ALTA/MUY ALTA, el objetivo pasa
  // a ser vinculante: la revisión final no puede desmontarla para quedarse en @3–@5.
  forceTargetWhenPossible: true,
  finalReviewKeepTarget: true,

  // v0.23: @8–@10 es un objetivo DURO para la Combinada del Día.
  // Primero intenta conseguirlo con 4–6 picks y los mercados más inteligentes.
  // Si no existe, activa un rescate que puede usar otras alternativas ALTA/MUY ALTA
  // del mismo partido y, como último recurso, hasta 8 picks. Nunca baja de ALTA.
  hardTargetEnabled: true,
  emergencyMaxSelections: 8,
  hardTargetMaxMarketsPerFixture: 10,
  hardTargetMaxAlternativeScoreDrop: 1.05,
  hardTargetMaxAlternativeProbabilityDrop: 0.14,

  // BTTS y +2.5 se comparan obligatoriamente, pero ninguno recibe bonus por nombre.
  bttsReviewPriority: false,
  bttsTieProbabilityTolerance: 0.015,
  bttsTieScoreTolerance: 0.12,

  // Cuotas EST. estilo bookmaker. La probabilidad del modelo se suaviza antes de
  // convertirla en precio y después se aplica un margen según el tipo de mercado.
  estimatedOdds: {
    winnerReliability: 0.78,
    doubleChanceReliability: 0.76,
    totalsReliability: 0.80,
    bttsReliability: 0.78,
    teamTotalsReliability: 0.78,
    comboReliability: 0.64,
    winnerOverround: 1.055,
    doubleChanceOverround: 1.060,
    totalsOverround: 1.050,
    bttsOverround: 1.055,
    teamTotalsOverround: 1.060,
    comboOverround: 1.055,
  },

  // CRIBA GLOBAL DEL DÍA: se revisa toda la jornada, pero el análisis profundo
  // y la Combinada del día solo se hacen sobre ligas fiables/preferidas.
  globalDayScanEnabled: true,
  strictPreferredCompetitions: true,
  globalDeepScanFixtures: Number(process.env.GLOBAL_DAY_DEEP_SCAN_FIXTURES ?? 40),
  globalMaxPerLeague: Number(process.env.GLOBAL_DAY_MAX_PER_LEAGUE ?? 8),
  globalStandingLeagues: Number(process.env.GLOBAL_DAY_STANDING_LEAGUES ?? 6),
  globalOtherLeagueSlots: 0,

  // Alias histórico para despliegues previos.
  maxFixturesToEnrich: Number(process.env.MAX_FIXTURES_TO_ENRICH ?? 40),

  excludedByDefault: {
    women: true,
    youth: true,
    reserves: true,
    friendlies: true,
  },
} as const;

export const API_POLICY = {
  dailyCallBudget: Number(process.env.API_CALL_BUDGET_DAILY ?? 90),
  fixturesTtlSeconds: Math.max(6 * 60 * 60, Number(process.env.CACHE_FIXTURES_TTL_SECONDS ?? 6 * 60 * 60)),
  teamFormTtlSeconds: Math.max(6 * 60 * 60, Number(process.env.CACHE_TEAM_FORM_TTL_SECONDS ?? 6 * 60 * 60)),
  standingsTtlSeconds: Math.max(6 * 60 * 60, Number(process.env.CACHE_STANDINGS_TTL_SECONDS ?? 6 * 60 * 60)),
  analysisTtlSeconds: Number(process.env.CACHE_ANALYSIS_TTL_SECONDS ?? 5 * 60),
  referenceDataTtlSeconds: 24 * 60 * 60,
  staleFallbackSeconds: Number(process.env.CACHE_STALE_FALLBACK_SECONDS ?? 24 * 60 * 60),
} as const;

// Se mantiene la integración existente con The Odds API por compatibilidad y
// para una futura calibración opcional, pero v0.23 NO la necesita para construir
// la Combinada del día: las cuotas mostradas son siempre EST.
export const ODDS_API_POLICY = {
  dailyCreditBudget: Number(process.env.THE_ODDS_API_DAILY_CREDIT_BUDGET ?? 14),
  maxFixturesToPrice: Number(process.env.THE_ODDS_MAX_FIXTURES_TO_PRICE ?? 12),
  maxMarketGroupsPerFixture: Number(process.env.THE_ODDS_MAX_MARKETS_PER_FIXTURE ?? 1),
  secondPassFixtures: Number(process.env.THE_ODDS_SECOND_PASS_FIXTURES ?? 2),
  sportsTtlSeconds: Number(process.env.THE_ODDS_SPORTS_TTL_SECONDS ?? 24 * 60 * 60),
  eventsTtlSeconds: Number(process.env.THE_ODDS_EVENTS_TTL_SECONDS ?? 60 * 60),
  oddsTtlSeconds: Number(process.env.CACHE_ODDS_TTL_SECONDS ?? 10 * 60),
  staleFallbackSeconds: Number(process.env.CACHE_STALE_FALLBACK_SECONDS ?? 24 * 60 * 60),
  bookmaker:
    process.env.THE_ODDS_BOOKMAKERS ??
    (process.env.PREFERRED_BOOKMAKER ?? "Bet365").toLowerCase().replace(/[^a-z0-9]+/g, ""),
} as const;

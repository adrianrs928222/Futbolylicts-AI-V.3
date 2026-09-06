export type CompetitionCategory =
  | "champions"
  | "europa"
  | "conference"
  | "national_cup"
  | "top_league"
  | "other";

export type MarketKey =
  | "HOME_WIN"
  | "AWAY_WIN"
  | "DOUBLE_CHANCE_1X"
  | "DOUBLE_CHANCE_X2"
  | "DOUBLE_CHANCE_12"
  | "OVER_0_5"
  | "OVER_1_5"
  | "OVER_2_5"
  | "BTTS_YES"
  | "HOME_OVER_0_5"
  | "AWAY_OVER_0_5"
  | "HOME_OVER_1_5"
  | "AWAY_OVER_1_5"
  | "COMBO_1X_OVER_1_5"
  | "COMBO_X2_OVER_1_5"
  | "COMBO_1X_OVER_2_5"
  | "COMBO_X2_OVER_2_5"
  | "COMBO_HOME_WIN_OVER_1_5"
  | "COMBO_AWAY_WIN_OVER_1_5"
  | "COMBO_HOME_WIN_OVER_2_5"
  | "COMBO_AWAY_WIN_OVER_2_5";

export type Confidence = "MUY_ALTA" | "ALTA" | "MEDIA_ALTA" | "MEDIA" | "BAJA";

export interface TeamRef {
  id: number;
  name: string;
  logo?: string | null;
}

export interface LeagueRef {
  id: number;
  name: string;
  country?: string | null;
  season: number;
}

export interface Fixture {
  id: number;
  date: string;
  timestamp: number;
  status: string;
  round?: string | null;
  league: LeagueRef;
  home: TeamRef;
  away: TeamRef;
}

export interface TeamForm {
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  goalsForPerGame: number;
  goalsAgainstPerGame: number;
  scoringPct: number;
  concededPct: number;
  over15Pct: number;
  over25Pct: number;
  bttsPct: number;
  cleanSheetPct: number;
  pointsPerGame: number;
}

export interface StandingContext {
  homeRank?: number;
  awayRank?: number;
  teamsInLeague?: number;
}

export interface OddsQuote {
  market: MarketKey;
  label: string;
  decimal: number;
  bookmaker: string;
  real: boolean;
  updatedAt?: string | null;
}

export interface EnrichedFixture {
  fixture: Fixture;
  category: CompetitionCategory;
  homeForm: TeamForm;
  awayForm: TeamForm;
  standings?: StandingContext;
  odds: OddsQuote[];
}

export interface OutcomeProbabilities {
  home: number;
  draw: number;
  away: number;
}

export interface MarketCandidate {
  fixtureId: number;
  fixtureLabel: string;
  category: CompetitionCategory;
  market: MarketKey;
  marketLabel: string;
  odds: number;
  bookmaker: string;
  realOdds: boolean;
  probability: number;
  score: number;
  confidence: Confidence;
  reasoning: string;
  riskNote: string;
  homeLogo?: string | null;
  awayLogo?: string | null;
}

export interface DailyCombo {
  date: string;
  picks: MarketCandidate[];
  totalOdds: number;
  globalScore: number;
  globalProbability: number;
  globalConfidence: Confidence;
  targetReached: boolean;
  official: boolean;
  message: string;
}


export interface AnalyzedFixtureSummary {
  fixtureId: number;
  fixtureLabel: string;
  leagueName: string;
  category: CompetitionCategory;
  bestMarketLabel: string;
  probability: number;
  score?: number;
  odds?: number;
  realOdds: boolean;
  status: "PASA" | "CERCA" | "FUERA" | "SIN_CUOTA";
  explanation: string;
  alternatives?: Array<{
    marketLabel: string;
    probability: number;
    score: number;
    odds?: number;
    realOdds?: boolean;
  }>;
}


export interface DailyFixtureSummary {
  fixtureId: number;
  fixtureLabel: string;
  leagueName: string;
  category: CompetitionCategory;
  kickoff: string;
  timestamp: number;
  status: string;
  analyzed: boolean;
}

export interface DailyAnalysis {
  date: string;
  mode: "live" | "demo";
  generatedAt: string;
  fixturesCount: number;
  allFixtures: DailyFixtureSummary[];
  analyzedFixturesCount: number;
  candidates: MarketCandidate[];
  analyzedFixtures: AnalyzedFixtureSummary[];
  analysisPicks: AnalyzedFixtureSummary[];
  combo: DailyCombo;
  categoryCounts: Partial<Record<CompetitionCategory, number>>;
  apiUsage: {
    provider: string;
    used: number;
    budget: number;
    odds?: {
      provider: string;
      used: number;
      budget: number;
    };
  };
  cacheStatus: {
    persistent: boolean;
    memoryEntries: number;
    hitRate: number;
    memoryHits: number;
    supabaseHits: number;
    staleHits: number;
    misses: number;
  };
  warnings: string[];
}

import type { MarketCandidate } from "@/lib/engine/types";

export const FEATURE_VERSION = "features-v1";

const MARKETS = [
  "HOME_WIN", "AWAY_WIN", "DOUBLE_CHANCE_1X", "DOUBLE_CHANCE_X2", "DOUBLE_CHANCE_12",
  "OVER_0_5", "OVER_1_5", "OVER_2_5", "OVER_3_5", "OVER_4_5", "BTTS_YES",
  "HOME_OVER_0_5", "AWAY_OVER_0_5", "HOME_OVER_1_5", "AWAY_OVER_1_5",
  "COMBO_1X_OVER_1_5", "COMBO_X2_OVER_1_5",
  "COMBO_1X_OVER_2_5", "COMBO_X2_OVER_2_5", "COMBO_12_OVER_2_5",
  "COMBO_HOME_WIN_OVER_1_5", "COMBO_AWAY_WIN_OVER_1_5",
  "COMBO_HOME_WIN_OVER_2_5", "COMBO_AWAY_WIN_OVER_2_5",
] as const;

const CATEGORIES = ["champions", "europa", "conference", "national_cup", "top_league", "other"] as const;

function oneHot(value: string, values: readonly string[]) {
  return values.map((item) => item === value ? 1 : 0);
}

function safeHour(iso: string) {
  const hour = new Date(iso).getUTCHours();
  return hour >= 0 && hour <= 23 ? hour : 12;
}

export function buildFeatures(candidate: MarketCandidate, kickoff?: string | null): number[] {
  const hour = kickoff ? safeHour(kickoff) : 12;
  const angle = (hour / 24) * Math.PI * 2;
  return [
    candidate.probability,
    candidate.score / 10,
    Math.min(candidate.odds, 3) / 3,
    Math.max(0, Math.min(1, (candidate.probability - 0.5) * 2)),
    Math.sin(angle),
    Math.cos(angle),
    ...oneHot(candidate.market, MARKETS),
    ...oneHot(candidate.category, CATEGORIES),
  ];
}

export function featureCount() {
  return 6 + MARKETS.length + CATEGORIES.length;
}

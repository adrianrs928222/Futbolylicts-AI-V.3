import type { CompetitionCategory, MarketKey } from "@/lib/engine/types";

export const ML_MODEL_VERSION = "ml-calibrator-v1";

export interface MlPredictionRow {
  fixture_id: number;
  prediction_date: string;
  kickoff: string | null;
  fixture_label: string;
  league_name: string;
  category: CompetitionCategory;
  market: MarketKey;
  engine_probability: number;
  engine_score: number;
  estimated_odds: number;
  features: number[];
  target_correct: boolean | null;
  result_home_goals: number | null;
  result_away_goals: number | null;
  created_at?: string;
  resolved_at?: string | null;
}

export interface MlModel {
  model_version: string;
  feature_version: string;
  weights: number[];
  mean: number[];
  std: number[];
  bias: number;
  sample_count: number;
  accuracy: number | null;
  log_loss: number | null;
  trained_at: string;
}

export interface MlStatus {
  enabled: boolean;
  trained: boolean;
  modelVersion: string;
  sampleCount: number;
  accuracy: number | null;
  logLoss: number | null;
  trainedAt: string | null;
  pendingCount: number;
}

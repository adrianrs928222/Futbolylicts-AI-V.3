create table if not exists public.ml_predictions (
  fixture_id bigint not null,
  prediction_date date not null,
  kickoff timestamptz,
  fixture_label text not null,
  league_name text not null,
  category text not null,
  market text not null,
  engine_probability double precision not null,
  engine_score double precision not null,
  estimated_odds double precision not null,
  features jsonb not null,
  target_correct boolean,
  result_home_goals integer,
  result_away_goals integer,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  primary key (fixture_id, market)
);

create index if not exists ml_predictions_pending_idx on public.ml_predictions(target_correct, prediction_date);
create index if not exists ml_predictions_date_idx on public.ml_predictions(prediction_date);

create table if not exists public.ml_models (
  model_version text primary key,
  feature_version text not null,
  weights jsonb not null,
  mean jsonb not null,
  std jsonb not null,
  bias double precision not null,
  sample_count integer not null,
  accuracy double precision,
  log_loss double precision,
  trained_at timestamptz not null default now()
);

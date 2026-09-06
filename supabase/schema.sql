-- Futbolylicts-AI · esquema base gratuito
-- Ejecutar una sola vez en Supabase > SQL Editor.

create table if not exists api_cache (
  cache_key text primary key,
  data jsonb not null,
  expires_at timestamptz not null,
  stale_until timestamptz not null,
  updated_at timestamptz not null default now()
);

create index if not exists api_cache_expires_idx on api_cache (expires_at);
create index if not exists api_cache_stale_idx on api_cache (stale_until);

create table if not exists api_usage_daily (
  usage_date date not null,
  provider text not null,
  calls integer not null default 0 check (calls >= 0),
  updated_at timestamptz not null default now(),
  primary key (usage_date, provider)
);

create table if not exists daily_analysis (
  analysis_date date primary key,
  generated_at timestamptz not null default now(),
  total_odds numeric(10,2) not null default 0,
  global_score numeric(4,2) not null default 0,
  picks_count integer not null default 0,
  payload jsonb not null
);

create table if not exists combo_history (
  id bigint generated always as identity primary key,
  analysis_date date not null,
  generated_at timestamptz not null default now(),
  total_odds numeric(10,2) not null,
  global_score numeric(4,2) not null,
  picks_count integer not null,
  payload jsonb not null
);

create index if not exists combo_history_date_idx on combo_history (analysis_date desc);


create or replace function reserve_api_call(p_usage_date date, p_provider text, p_budget integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  new_calls integer;
begin
  insert into api_usage_daily (usage_date, provider, calls, updated_at)
  values (p_usage_date, p_provider, 0, now())
  on conflict (usage_date, provider) do nothing;

  update api_usage_daily
     set calls = calls + 1, updated_at = now()
   where usage_date = p_usage_date
     and provider = p_provider
     and calls < p_budget
  returning calls into new_calls;

  return new_calls is not null;
end;
$$;

create or replace function increment_api_usage(p_usage_date date, p_provider text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into api_usage_daily (usage_date, provider, calls, updated_at)
  values (p_usage_date, p_provider, 1, now())
  on conflict (usage_date, provider)
  do update set calls = api_usage_daily.calls + 1, updated_at = now();
end;
$$;

create or replace function prune_expired_api_cache()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from api_cache where stale_until < now();
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

-- Todo se accede desde el servidor con SERVICE_ROLE. No exponemos tablas al navegador.
alter table api_cache enable row level security;
alter table api_usage_daily enable row level security;
alter table daily_analysis enable row level security;
alter table combo_history enable row level security;


-- v0.7 · reserva atómica de varios créditos.
-- Se usa para The Odds API, donde una petición puede costar más de 1 crédito
-- según el número de mercados solicitados.
create or replace function reserve_api_credits(
  p_usage_date date,
  p_provider text,
  p_budget integer,
  p_credits integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  new_calls integer;
begin
  if p_credits <= 0 then
    return true;
  end if;

  insert into api_usage_daily (usage_date, provider, calls, updated_at)
  values (p_usage_date, p_provider, 0, now())
  on conflict (usage_date, provider) do nothing;

  update api_usage_daily
     set calls = calls + p_credits, updated_at = now()
   where usage_date = p_usage_date
     and provider = p_provider
     and calls + p_credits <= p_budget
  returning calls into new_calls;

  return new_calls is not null;
end;
$$;

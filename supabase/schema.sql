create table if not exists public.api_cache (
  cache_key text primary key,
  data jsonb not null,
  expires_at timestamptz not null,
  stale_until timestamptz not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.api_usage_daily (
  usage_date date not null,
  provider text not null,
  calls integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (usage_date, provider)
);
create table if not exists public.daily_analysis (
  analysis_date date primary key,
  generated_at timestamptz not null,
  data jsonb not null
);
create table if not exists public.combo_history (
  combo_date date primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create or replace function public.reserve_api_credits(p_usage_date date,p_provider text,p_budget integer,p_credits integer)
returns boolean language plpgsql security definer as $$
declare current_calls integer;
begin
  insert into public.api_usage_daily(usage_date,provider,calls) values(p_usage_date,p_provider,0)
  on conflict (usage_date,provider) do nothing;
  select calls into current_calls from public.api_usage_daily where usage_date=p_usage_date and provider=p_provider for update;
  if current_calls + p_credits > p_budget then return false; end if;
  update public.api_usage_daily set calls=calls+p_credits,updated_at=now() where usage_date=p_usage_date and provider=p_provider;
  return true;
end;
$$;

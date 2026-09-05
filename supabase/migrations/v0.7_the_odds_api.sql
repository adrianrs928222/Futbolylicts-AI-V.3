-- Futbolylicts-AI v0.7
-- Ejecutar en Supabase > SQL Editor si ya habías aplicado el schema de v0.6.

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

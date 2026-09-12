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

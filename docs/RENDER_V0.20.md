# Render — v0.20

La v0.20 funciona con las mismas claves que ya usa el proyecto. No hay que mover secretos a GitHub.

Variables importantes:

```env
API_FOOTBALL_KEY=...
THE_ODDS_API_KEY=...
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
THE_ODDS_BOOKMAKERS=bet365
PREFERRED_BOOKMAKER=Bet365
API_CALL_BUDGET_DAILY=90
THE_ODDS_API_DAILY_CREDIT_BUDGET=14
GLOBAL_DAY_DEEP_SCAN_FIXTURES=32
GLOBAL_DAY_MAX_PER_LEAGUE=4
GLOBAL_DAY_STANDING_LEAGUES=6
GLOBAL_DAY_OTHER_SLOTS=6
THE_ODDS_MAX_FIXTURES_TO_PRICE=12
THE_ODDS_SECOND_PASS_FIXTURES=2
```

La caché de fixtures, forma y clasificación tiene un suelo operativo de 6 horas en código para evitar que el auto-refresh de 20 minutos queme el presupuesto diario.

# EMPIEZA AQUÍ — Futbolylicts-AI v0.12

Esta es la versión con el ajuste que pediste:

- ALTA = **70%+ y 8.0/10+**.
- MUY ALTA = **78%+ y 9.0/10+**.
- La probabilidad no infla automáticamente la nota.
- El pick necesita además **valor de al menos +3 puntos** frente a la cuota.
- Se ven **todos los partidos elegibles de hoy**.
- Se ven **todos los partidos analizados** y por qué entran o no.
- Se ven **todos los picks válidos**, no solo los primeros 18.
- La Combinada del día enseña los picks disponibles aunque no sea posible alcanzar @8 sin empeorar la calidad.

## Render

```text
API_CALL_BUDGET_DAILY = 90
MAX_FIXTURES_TO_ENRICH = 18
THE_ODDS_API_DAILY_CREDIT_BUDGET = 14
THE_ODDS_MAX_FIXTURES_TO_PRICE = 10
THE_ODDS_MAX_MARKETS_PER_FIXTURE = 1
THE_ODDS_SECOND_PASS_FIXTURES = 4
PREFERRED_BOOKMAKER = Bet365
```

Mantén también `API_FOOTBALL_KEY`, `THE_ODDS_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`.

Después de subir a GitHub: **Render → Manual Deploy → Clear build cache & deploy**.

No hay migración nueva de Supabase para v0.12. Si nunca hiciste la de The Odds API, ejecuta `supabase/migrations/v0.7_the_odds_api.sql`.

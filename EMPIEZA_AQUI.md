# EMPIEZA AQUÍ — Futbolylicts-AI v0.15

Esta es la versión con el ajuste que pediste:

- ALTA = **70%+ y 8.0/10+**.
- MUY ALTA = **78%+ y 9.0/10+**.
- La probabilidad no infla automáticamente la nota.
- El pick necesita además **valor de al menos +3 puntos** frente a la cuota.
- Se ven **todos los partidos elegibles de hoy**.
- Se ven **todos los partidos analizados** y por qué entran o no.
- Se ven **todos los picks válidos**, no solo los primeros 18.
- La Combinada del día enseña los picks disponibles aunque no sea posible alcanzar la zona de @10 sin empeorar la calidad.

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

No hay migración nueva de Supabase para v0.15. Si nunca hiciste la de The Odds API, ejecuta `supabase/migrations/v0.7_the_odds_api.sql`.


### NUEVO EN v0.15

- Si The Odds API trae precio: `@X.XX REAL`.
- Si no trae precio: `@X.XX EST.` calculado como cuota justa `1 / probabilidad del motor`.
- Las alternativas 1X/X2/BTTS/+1.5/+2.5/goles de equipo/combinados también muestran REAL o EST.
- La Combinada del día enseña un total `EST.` cuando alguna pata no tiene cuota real.
- Una cuota EST. nunca se hace pasar por Bet365 y no valida el filtro de valor de +3 puntos.

### HEREDADO DE v0.13
La Combinada del día ya no queda vacía si hay partidos analizados con confianza ALTA/MUY ALTA. Muestra hasta 5 mercados concretos aunque falte la cuota API. Si falta una cuota real, verás `@X.XX EST.` y el total se muestra como estimado.


## v0.14 — combinados del mismo partido

El motor incluye 1X/X2/Ganador + Más de 1.5 o Más de 2.5. La probabilidad se calcula de forma conjunta por marcadores; no se multiplican probabilidades independientes. +2.5 mantiene peso real cuando supera los filtros. Si The Odds API no ofrece cuota Bet Builder del combinado, se muestra una cuota justa `EST.` del modelo; nunca se presenta como precio real de Bet365.

## v0.17 — rotación continua y cuota útil

- La jornada se revisa automáticamente cada 20 minutos mientras la pestaña está visible.
- No espera 24 h: cuando los partidos dejan de estar prematch, entran los siguientes candidatos del día.
- Al cambiar de fecha en Madrid, pasa automáticamente a la nueva jornada.
- La Combinada del día solo usa ALTA/MUY ALTA con cuota útil desde @1.25 (BTTS desde @1.35).
- Si un mercado muy seguro tiene cuota demasiado baja, el motor intenta otro mercado fuerte del mismo partido, incluyendo +2.5 y combinados.
- Todos los partidos y todos los analizados siguen visibles para poder revisar qué ha hecho el motor.



## v0.17 — Combinada solo ALTA
La Combinada del día excluye perfiles MUY ALTA y usa únicamente ALTA con cuota útil. Los MUY ALTA siguen visibles en el análisis.

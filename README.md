# LA MENTE DEL GOL ⭐ — Futbolylicts-AI v0.12

Pronosticador web con motor propio.

Arquitectura:

- **API-Football = datos deportivos**
- **The Odds API = cuotas exclusivamente**
- **Supabase = caché, histórico y control de consumo**
- **Futbolylicts-AI = análisis, scoring y combinada**

No existe fallback automático de cuotas desde API-Football. Si no hay cuota real compatible, el partido puede seguir apareciendo y ser analizado, pero no entra como pick oficial.

## Motor v0.12

- **ALTA:** probabilidad >= **70%** y nota >= **8.0/10**.
- **MUY ALTA:** probabilidad >= **78%** y nota >= **9.0/10**.
- Probabilidad y nota son filtros independientes: **70% no equivale automáticamente a 8.5/10**.
- Núcleo preferido: **8.5+/10** y **78%+** cuando sea posible.
- Además, la probabilidad del motor debe superar la probabilidad implícita de la cuota en al menos **3 puntos porcentuales**.
- Cuota/pick automática: **@1.25–@1.75**.
- BTTS automático: mínimo **@1.35**.
- Objetivo de combinada: **@8–@10**.
- Preferencia: **4–6 patas**, máximo un pick por partido.
- Si hay 4–6 picks válidos pero no llegan a @8, se muestran igualmente; el motor no añade una pata peor solo para inflar la cuota.
- Si solo hay 1–3 picks válidos, también se muestran como picks disponibles, pero no se presentan como combinada completa.
- Sin Under.
- Sin hándicaps.
- Los mercados pueden repetirse libremente si son los mejores.

## Qué se ve en pantalla

La web ya no oculta la jornada:

1. **Combinada del día** con los picks que pasan todos los filtros.
2. **Confianza del motor** con ALTA/MUY ALTA calculada por probabilidad + nota.
3. **Todos los partidos elegibles de hoy**, incluidos iniciados y finalizados.
4. **Todos los picks que pasan el filtro**, sin recorte visual a 18.
5. **Todos los partidos analizados en profundidad**, incluso los que no entran, con el motivo.

Por defecto se muestran todos los partidos elegibles del día y se profundiza en **18** candidatos prematch. De ellos, hasta **10** reciben consulta de cuotas. Esto mantiene visibles todos los partidos sin intentar gastar llamadas profundas en cientos de encuentros irrelevantes.

## Flujo

```text
API-Football
    ↓
TODOS los fixtures elegibles del día
    ↓
prioridad por competición + disponibilidad de cuotas
    ↓
18 análisis profundos de forma/clasificación
    ↓
10 mejores candidatos → The Odds API
    ↓
1 familia de mercado prioritaria por partido
    ↓
cuotas reales
    ↓
probabilidad + nota + valor
    ↓
Combinada del día / picks disponibles
```

## Variables de Render

```env
API_FOOTBALL_KEY=...
THE_ODDS_API_KEY=...
PREFERRED_BOOKMAKER=Bet365
THE_ODDS_BOOKMAKERS=bet365

API_CALL_BUDGET_DAILY=90
MAX_FIXTURES_TO_ENRICH=18

THE_ODDS_API_DAILY_CREDIT_BUDGET=14
THE_ODDS_MAX_FIXTURES_TO_PRICE=10
THE_ODDS_MAX_MARKETS_PER_FIXTURE=1
THE_ODDS_SECOND_PASS_FIXTURES=4

NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
```

No metas claves reales en GitHub.

## Supabase

Si ya ejecutaste la migración de The Odds API de una versión anterior, no hace falta una migración nueva para v0.12.

Desde v0.6, ejecuta una vez:

```text
supabase/migrations/v0.7_the_odds_api.sql
```

Instalación desde cero:

```text
supabase/schema.sql
```

## Render

```text
Build Command: npm install && npm run build
Start Command: npm start
```

Tras subir esta versión a GitHub: **Manual Deploy → Clear build cache & deploy**.

## Aviso

Futbolylicts-AI genera estimaciones probabilísticas. Una etiqueta ALTA/MUY ALTA no garantiza el resultado. +18 · Juega con responsabilidad.

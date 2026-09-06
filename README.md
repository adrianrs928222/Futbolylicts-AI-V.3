# LA MENTE DEL GOL ⭐ — Futbolylicts-AI v0.15

Pronosticador web con motor propio.

Arquitectura:

- **API-Football = datos deportivos**
- **The Odds API = cuotas exclusivamente**
- **Supabase = caché, histórico y control de consumo**
- **Futbolylicts-AI = análisis, scoring y combinada**

No existe fallback automático de cuotas desde API-Football. Si no hay cuota real compatible, el partido sigue apareciendo y la web muestra una **cuota justa estimada por el modelo**, siempre marcada como `EST.`. Esa estimación no se usa como si fuese una cuota real de Bet365 ni convierte el pick en oficial.

## Motor v0.15

- **ALTA:** probabilidad >= **70%** y nota >= **8.0/10**.
- **MUY ALTA:** probabilidad >= **78%** y nota >= **9.0/10**.
- Probabilidad y nota son filtros independientes: **70% no equivale automáticamente a 8.5/10**.
- Núcleo preferido: **8.5+/10** y **78%+** cuando sea posible.
- Además, la probabilidad del motor debe superar la probabilidad implícita de la cuota en al menos **3 puntos porcentuales**.
- Cuota/pick automática: **@1.25–@1.75**.
- BTTS automático: mínimo **@1.35**.
- Objetivo de combinada: **@8–@10 (centro @9)**.
- Preferencia: **4–6 patas**, máximo un pick por partido.
- Si hay 4–6 picks válidos pero no llegan a la zona de @10, se muestran igualmente; el motor no añade una pata peor solo para inflar la cuota.
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
6. **Cuota REAL o EST.**: cuando The Odds API no devuelve precio, se muestra una cuota justa orientativa calculada como `1 / probabilidad del motor`.

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

Si ya ejecutaste la migración de The Odds API de una versión anterior, no hace falta una migración nueva para v0.15.

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


## v0.13 — Combinada desde el análisis
Si aún no hay combinación oficial por falta de cuotas, la caja principal muestra hasta 5 picks ALTA/MUY ALTA de los partidos analizados. Desde v0.15, si falta una cuota real se muestra una cuota justa del modelo marcada `EST.`; nunca se presenta como precio real.


## v0.14 — combinados del mismo partido

El motor incluye 1X/X2/Ganador + Más de 1.5 o Más de 2.5. La probabilidad se calcula de forma conjunta por marcadores; no se multiplican probabilidades independientes. +2.5 mantiene peso real cuando supera los filtros. Desde v0.15, si The Odds API no ofrece cuota Bet Builder, se muestra una cuota justa `EST.` del modelo; nunca se presenta como cuota real de Bet365.


## v0.15 — cuotas estimadas cuando falta la real

- Si existe cuota de The Odds API/Bet365, aparece `@X.XX REAL`.
- Si falta, aparece `@X.XX EST.`.
- `EST.` es una **cuota justa orientativa del modelo**: `1 / probabilidad estimada`, redondeada a dos decimales.
- También se muestran cuotas estimadas en las alternativas fuertes del mismo partido.
- La caja de Combinada del día calcula un **total EST.** cuando alguna pata no tiene cuota real.
- Las cuotas estimadas **no cuentan como cuota real** para validar valor (`+3 pts`) ni para declarar una combinada oficial.

## v0.17 — rotación continua y cuota útil

- La jornada se revisa automáticamente cada 20 minutos mientras la pestaña está visible.
- No espera 24 h: cuando los partidos dejan de estar prematch, entran los siguientes candidatos del día.
- Al cambiar de fecha en Madrid, pasa automáticamente a la nueva jornada.
- La Combinada del día solo usa ALTA/MUY ALTA con cuota útil desde @1.25 (BTTS desde @1.35).
- Si un mercado muy seguro tiene cuota demasiado baja, el motor intenta otro mercado fuerte del mismo partido, incluyendo +2.5 y combinados.
- Todos los partidos y todos los analizados siguen visibles para poder revisar qué ha hecho el motor.



## v0.17 — Combinada solo ALTA
La Combinada del día excluye perfiles MUY ALTA y usa únicamente ALTA con cuota útil. Los MUY ALTA siguen visibles en el análisis.


## v0.18 — objetivo @10 con cuotas estimadas

Cuando The Odds API no devuelve precios reales, la Combinada del día puede construirse con cuotas **EST.** (cuota justa del modelo). Busca una cuota total dentro de **@8–@10**, dentro de la zona **@8–@10**, usando **solo perfiles ALTA**. Puede usar entre **4 y 6 partidos** para que el objetivo sea matemáticamente alcanzable sin bajar el umbral del 70%. Si no existe una combinación ALTA que llegue a esa zona, muestra la mejor disponible y lo indica; nunca presenta EST. como REAL.

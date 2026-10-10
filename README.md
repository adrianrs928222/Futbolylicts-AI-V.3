# Futbolylicts-AI v0.24

Futbolylicts-AI construye una **Combinada del día** a partir de una criba global de la jornada, sobreanalizando cada partido y eligiendo siempre el mercado más inteligente antes de pensar en la cuota total.

## Qué cambia en v0.24

- La Combinada del Día y la lista visible se centran **solo en ligas conocidas permitidas**. La criba mira la jornada completa, pero descarta el resto antes del análisis profundo.
- Países Bajos mantiene **Eredivisie + Eerste Divisie**, y los equipos `Jong` solo se permiten dentro de Eerste Divisie.
- Se mantiene el objetivo duro **@8–@10 EST.** de v0.23.

- La Combinada del día trabaja con **cuotas EST. calibradas estilo bookmaker**.
- Ya no depende de tener una cuota REAL para cerrar la combinada.
- Las cuotas no se calculan como `1 / probabilidad` sin más: la probabilidad se suaviza y se aplica margen según el tipo de mercado.
- Los mercados combinados se calculan desde **marcadores conjuntos**, no multiplicando probabilidades independientes.
- Se añaden explícitamente `12 + Más de 1.5` y `12 + Más de 2.5`.
- Cada partido compara ganador, 1X, X2, 12, goles, BTTS, goles de equipo y combinados.
- **BTTS no tiene bonus artificial**. Se compara de forma obligatoria con +2.5 cuando corresponde y gana el mejor.
- **La variedad no suma puntos y la repetición no resta puntos**. Si los mejores cinco picks son BTTS, pueden ser cinco BTTS.
- Antes de construir la combinada identifica el **mejor mercado y varias alternativas ALTA/MUY ALTA por partido**. Primero usa las más inteligentes; si no llega a @8–@10, activa el rescate sin bajar de ALTA.
- La revisión final vuelve a comparar los picks seleccionados con los mejores partidos descartados.
- Objetivo de cuota: **@8–@10 obligatorio** para la Combinada del Día. Primero intenta 4–6 selecciones; si no existe una versión válida, puede usar 7–8 picks, siempre ALTA/MUY ALTA y máximo una selección por partido.
- Solo entran picks **ALTA o MUY ALTA**.
- Nunca Under. Nunca hándicap.

## Ligas preferidas / fiables

La combinada oficial prioriza y analiza a fondo competiciones fiables:

- UEFA Champions League, Europa League y Conference League
- LaLiga
- LaLiga Hypermotion / Segunda División española
- Premier League
- Championship
- Serie A
- Bundesliga
- 2. Bundesliga
- Ligue 1
- Eredivisie
- Eerste Divisie
- Primeira Liga
- 
- MLS
- Liga MX
- Brasil Serie A
- Argentina Primera
- Copas nacionales principales

Las ligas regionales, semiprofesionales o poco fiables pueden seguir apareciendo en la jornada completa, pero **no entran en la Combinada del día**.

### Excepción de reservas

Reservas, filiales, B teams, U23/U21/juveniles, femenino y amistosos quedan fuera por defecto.

Única excepción: los equipos `Jong` que compiten oficialmente en la **Eerste Divisie** de Países Bajos sí pueden analizarse.

## Cómo piensa el motor

1. Trae la jornada completa.
2. Elimina partidos y categorías excluidas.
3. Se queda para análisis profundo con ligas preferidas/fiables.
4. Reparte hasta 40 análisis profundos entre toda la jornada, no solo por horario.
5. Carga forma reciente y clasificación usando caché agresiva.
6. Genera todos los mercados permitidos.
7. Calcula la probabilidad de cada mercado.
8. Genera una cuota EST. estilo bookmaker.
9. Compara todos los mercados del mismo partido.
10. Decide cuál es la opción más inteligente del encuentro y conserva alternativas ALTA/MUY ALTA.
11. Compara esos mejores picks y, si hace falta para @8–@10, las alternativas válidas entre todos los partidos.
12. Construye primero una combinada de 4–6 picks dentro de @8–@10; si no existe, activa un rescate de objetivo con hasta 8 picks ALTA/MUY ALTA.
13. Hace una última revisión y sustituye solo si realmente mejora.

La regla central es:

> **Cada selección debe ganarse su sitio por mérito propio. La variedad no suma puntos y la repetición no resta puntos.**

## Cuotas estimadas

Las cuotas de la Combinada del día aparecen como:

`@1.46 EST.`

Para mercados simples, el motor suaviza la probabilidad interna hacia un precio de mercado más conservador y aplica margen de bookmaker.

Para mercados combinados como `1X + Más de 1.5`, calcula directamente qué marcadores cumplen las dos condiciones y aplica una calibración adicional tipo Bet Builder.

Estas cuotas son una estimación del modelo, no una promesa de que una casa concreta vaya a mostrar exactamente el mismo precio.

## APIs

- **API-Football**: fixtures, forma reciente y clasificación.
- **Supabase**: caché persistente, histórico y consumo.
- **The Odds API**: se mantiene integrada por compatibilidad/futura calibración, pero v0.24 **no la necesita para construir la combinada** y no gasta créditos de cuotas en el flujo normal.

## Stack

Next.js 15 · React 19 · TypeScript · API-Football · Supabase · The Odds API opcional · Render · Vitest.

## Desarrollo

```bash
npm install
cp .env.example .env.local
npm run typecheck
npm test
npm run build
npm run dev
```

No subas `.env`, `.env.local`, claves API ni `SUPABASE_SERVICE_ROLE_KEY` a GitHub.

## Combinadas derivadas sin llamadas extra

Esta edición incluye **COMBINADA BTTS** y **COMBINADAS POR LIGA**. Ambas se construyen en memoria reutilizando los candidatos ya calculados por el análisis diario; no hacen llamadas adicionales a API-Football/The Odds API y no generan caché adicional. Ver `docs/COMBINADAS_DERIVADAS.md`.

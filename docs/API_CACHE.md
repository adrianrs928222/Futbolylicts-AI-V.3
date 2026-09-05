# Caché y ahorro de llamadas — v0.14

Futbolylicts-AI no pregunta dos veces por un dato que todavía está fresco.

## API-Football

1. Descarga todos los fixtures del día.
2. Filtra categorías localmente.
3. Profundiza por defecto en 18 partidos.
4. Forma de equipos: caché 6 h.
5. Clasificación: caché 2 h.
6. Ya no solicita cuotas.

## The Odds API

1. Futbolylicts ordena los partidos según su potencial estadístico.
2. Solo los 10 mejores pasan a la capa de cuotas.
3. `/sports` se cachea 24 h.
4. `/events` se cachea 30 min.
5. Estos endpoints se usan para encontrar el evento sin gastar créditos de cuotas.
6. Por evento se pide por defecto 1 familia de mercado prioritaria.
7. Cuotas: caché 10 min.
8. Presupuesto de seguridad: 14 créditos al día.

```env
THE_ODDS_API_DAILY_CREDIT_BUDGET=14
THE_ODDS_MAX_FIXTURES_TO_PRICE=10
THE_ODDS_MAX_MARKETS_PER_FIXTURE=1
THE_ODDS_SECOND_PASS_FIXTURES=4
```

## Supabase

Supabase almacena tanto respuestas frescas como contadores. Si Render se reinicia, la web no necesita empezar desde cero.

Los usuarios que vienen de v0.6 deben ejecutar:

`supabase/migrations/v0.7_the_odds_api.sql`

## Importante

El contador de The Odds API es deliberadamente conservador: reserva el coste previsto antes de llamar. Esto evita que dos cargas simultáneas atraviesen el límite de seguridad.

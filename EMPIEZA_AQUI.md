# EMPIEZA AQUÍ — v0.24

1. Ejecuta `npm install`.
2. Copia `.env.example` a `.env.local`.
3. Rellena `API_FOOTBALL_KEY`.
4. Si usas Supabase, rellena `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`.
5. `THE_ODDS_API_KEY` es opcional en v0.24: la Combinada del día trabaja con cuotas EST. calibradas y no consume créditos de The Odds API.
6. Ejecuta `npm run typecheck && npm test && npm run build`.
7. Ejecuta `npm run dev`.

La lógica actual es:

**jornada completa → ligas preferidas → análisis profundo → todos los mercados → mejor mercado por partido → ranking global → combinada @8–@10 → revisión final**

No se fuerza variedad. No se fuerza BTTS. No se fuerza +2.5. No se cambia a un mercado peor únicamente para subir cuota.

Eerste Divisie mantiene la excepción de equipos Jong oficiales.

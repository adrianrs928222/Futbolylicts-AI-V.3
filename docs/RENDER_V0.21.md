# Render — Futbolylicts-AI v0.21

## Variables necesarias

```text
API_FOOTBALL_KEY=...
API_CALL_BUDGET_DAILY=90
MAX_FIXTURES_TO_ENRICH=32
GLOBAL_DAY_DEEP_SCAN_FIXTURES=32
GLOBAL_DAY_MAX_PER_LEAGUE=8
GLOBAL_DAY_STANDING_LEAGUES=6
```

Supabase es recomendable para caché persistente:

```text
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

`THE_ODDS_API_KEY` puede quedarse configurada, pero v0.21 no la necesita para la Combinada del día y no consume sus créditos en el flujo normal.

Build command:

```bash
npm install && npm run build
```

Start command:

```bash
npm start
```

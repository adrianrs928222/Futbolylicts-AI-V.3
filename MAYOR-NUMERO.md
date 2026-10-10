# Módulo MAYOR NÚMERO

Se añadió un módulo independiente del motor principal para pronosticar qué equipo tendrá mayor número de:

- Tarjetas
- Córners
- Remates a puerta
- Remates

## Cómo funciona

- No modifica `lib/engine/*` ni la lógica de la Combinada del Día.
- Reutiliza `getRecentTeamFixtures(..., 8)`, igual que el motor, para aprovechar la misma caché de forma reciente.
- Para cada partido histórico terminado consulta `/fixtures/statistics` de API-Football.
- Las estadísticas de partidos terminados se guardan 30 días en la caché existente; una vez cacheadas no vuelven a gastar llamada hasta expirar.
- El módulo es bajo demanda: solo se ejecuta cuando el usuario pulsa **Analizar Mayor Número**.
- Si se agota el presupuesto API o faltan estadísticas, omite ese partido/mercado y no rompe la web.

## Variables opcionales

```env
MAJOR_NUMBER_MAX_FIXTURES=12
MAJOR_NUMBER_HISTORY_MATCHES=3
```

Aumentarlas mejora cobertura pero puede consumir más llamadas API-Football la primera vez. Con el tiempo la caché reduce el consumo.

## Endpoint

`GET /api/major-number?date=YYYY-MM-DD`

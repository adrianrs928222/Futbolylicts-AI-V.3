# Combinadas derivadas sin llamadas extra

Esta versión añade dos bloques derivados del análisis diario ya existente:

- `COMBINADA BTTS`
- `COMBINADAS POR LIGA`

Ambos se calculan exclusivamente a partir del array `candidates` que el motor ya generó para la jornada.

## Garantía de coste de API

`lib/engine/derivedCombos.ts` no importa proveedores, Supabase ni módulos de caché y no realiza `fetch`.
Por tanto, crear estas combinadas no aumenta el número de llamadas de API-Football ni de The Odds API y no crea entradas de caché adicionales.

## Reglas

- Probabilidad mínima: 70%.
- Score mínimo: 8.0/10.
- Cuota EST. habitual: 1.25–1.90.
- La COMBINADA BTTS prioriza probabilidad y score; no excluye un BTTS fiable solo porque su cuota EST. baje al aumentar la probabilidad.
- Una sola selección por fixture.
- COMBINADA BTTS: entre 2 y 5 picks disponibles.
- Combinada por liga: entre 2 y 5 picks por competición.
- Si no hay dos candidatos válidos, la combinación no se fuerza.

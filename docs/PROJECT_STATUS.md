# Estado del proyecto — v0.12

## Implementado

- Web Next.js con identidad LA MENTE DEL GOL ⭐ / Futbolylicts-AI.
- **Combinada del dia** + `¡Vamos con confianza! 🍀`.
- Objetivo @8–@10.
- Solo picks ≥8.0/10 y prioridad 8.5+.
- Cuota individual @1.25–@1.75.
- Mercado 12 con peso real.
- BTTS sin límite de cantidad.
- Repetición de mercados permitida sin penalización.
- Under y hándicap desactivados.
- Reservas/filiales excluidos salvo en **Eerste Divisie (Países Bajos)**.
- U23, juveniles, femenino y amistosos excluidos.
- API-Football para fixtures, forma y clasificación.
- **The Odds API como única fuente de cuotas.**
- Bet365 como bookmaker objetivo.
- Caché memoria + Supabase persistente.
- Presupuestos separados: llamadas de fútbol y créditos de cuotas.
- Endpoint `/api/status`.
- Tests y CI de GitHub.

## Optimización v0.12

- Todos los partidos elegibles del día quedan visibles; se profundiza por defecto en 18 candidatos prematch.
- The Odds API pone precio por defecto a los mejores 10 candidatos.
- Una familia de mercado inicial por partido para repartir mejor los créditos.
- Segunda pasada de una familia alternativa para hasta 4 partidos que no hayan producido pick.
- Eventos y deportes de The Odds API se resuelven con endpoints sin coste de cuota y se cachean.
- Sin fallback automático de cuotas desde API-Football.

## Próximas mejoras

- Lesiones/alineaciones solo para candidatos finales.
- Histórico WIN/LOSS y calibración por mercado.
- Generación automática de imagen exacta del cupón.
- Más mapeos de ligas si The Odds API amplía cobertura.

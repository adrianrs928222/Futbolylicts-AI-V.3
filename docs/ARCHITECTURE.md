# Arquitectura de Futbolylicts-AI v0.15

```text
      API-Football                         The Odds API
    (datos deportivos)                    (solo cuotas)
          │                                     ▲
          ▼                                     │
 fixtures del día                               │
 forma / clasificación                          │
          │                                     │
          └─────────────► Supabase ◄────────────┘
                         caché
                           │
                           ▼
                 Motor Futbolylicts-AI
                           │
             preselección por estadísticas
                           │
                   solo mejores partidos
                           │
                           └──────► cuotas Bet365
                                      │
                                      ▼
                         probabilidad + nota final
                                      │
                                      ▼
                          ALTA/MUY ALTA + cuota útil
                                      │
                                      ▼
                          constructor @8–@10 (centro @9)
```

## Roles estrictos

**API-Football**
- fixtures
- forma reciente
- clasificación
- datos deportivos

**The Odds API**
- cuotas exclusivamente

**Supabase**
- caché persistente
- histórico
- contadores de consumo

**Futbolylicts-AI**
- probabilidades
- scoring
- selección de mercados
- combinada

## Dos niveles de caché

Memoria es la capa rápida. Supabase permite que la caché sobreviva reinicios de Render.

## TTL por defecto

- Fixtures: 10 min.
- Forma: 6 h.
- Clasificación: 2 h.
- Cuotas: 10 min.
- Lista de deportes The Odds API: 24 h.
- Eventos The Odds API: 30 min.
- Stale fallback: 24 h.

## Control de consumo

API-Football y The Odds API tienen presupuestos separados.

```text
API-Football: 90 llamadas/día de seguridad
The Odds API: 14 créditos/día de seguridad
```

The Odds API solo se consulta para los partidos que el motor prioriza. No se pregunta a varias APIs por la misma cuota.

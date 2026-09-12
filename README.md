# ⚽ Futbolylicts-AI

Motor de análisis de fútbol con selección inteligente de mercados, combinada diaria, historial y calibración ML.

## Reglas principales

- Ningún pick oficial por debajo de @1.25.
- Mercados estándar hasta @1.90.
- BTTS se trata como mercado individual y puede llegar hasta @3.00 con confianza ALTA/MUY ALTA.
- Se mantienen mercados combinados permitidos de ganador/doble oportunidad + goles.
- No Under. No hándicap. No BTTS + goles.
- La cuota es un filtro; el motor prioriza calidad, probabilidad, confianza y valor.
- Una sola selección por partido.
- El objetivo de la combinada es @8–@10, con pequeña flexibilidad si evita empeorar picks.

## Modos de análisis

La cabina principal permite analizar:

- Todas las ligas permitidas.
- Solo Champions League.
- Solo partidos de hoy, sin saltar automáticamente a mañana.

La preferencia se guarda en el navegador.

## Conexiones existentes

El proyecto mantiene la integración con API-Football, Supabase, caché y la capa ML existente. Las claves se configuran mediante variables de entorno; revisa `.env.example`.

## Desarrollo

```bash
npm install
npm run dev
```

Validación:

```bash
npm run typecheck
npm test
npm run build
```

## Interfaz

El dashboard se ha reconstruido con una estética neon/IA muy marcada: cerebro maestro animado, halos, orbes, paneles luminosos, radar de valor, navegación sticky y diseño responsive.

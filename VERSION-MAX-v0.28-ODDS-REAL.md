# Futbolylicts-AI MAX v0.28

- Mantiene la Combinada del Día y los combinados IA EST. como en v0.27.
- Integra The Odds API cuando `THE_ODDS_API_KEY` está configurada.
- Añade una **Combinada REAL** separada, formada exclusivamente por mercados con cuota real del bookmaker.
- 1X + +1.5 y otros Bet Builder sintéticos continúan marcados como EST.; nunca se presentan como REAL si la API no entrega el combinado exacto.
- Las respuestas de odds usan la caché existente (memoria + Supabase) y respetan el presupuesto diario configurado.
- Sin cobertura o sin clave, todo el sistema anterior sigue funcionando.

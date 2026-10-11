# V4 - Mercados de primera parte

Se añaden al comparador: HT +0.5, HT +1.5, 1/X/2 al descanso y 1X/X2 al descanso.

**Advertencia:** las probabilidades HT usan un proxy Poisson con 46% de los goles esperados en primera parte; NO están calibradas con estadísticas HT reales. Las cuotas calculadas son ESTIMACIONES y no precios comerciales verificados. Para uso profesional integrar datos HT históricos, validación temporal, cuotas reales HT y resultados HT de API-Football.

El evaluador exige marcador al descanso para liquidar HT; las predicciones HT se excluyen del entrenamiento ML hasta que se implemente captura de marcadores HT, evitando entrenar con resultados finales erróneos.

La selección de mercado continúa usando el comparador existente; ninguna predicción garantiza acierto. Se requiere ejecutar `npm ci && npm run typecheck && npm test && npm run build` antes de publicar en producción.

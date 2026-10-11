# Futbolylicts-AI V4: calibración histórica y despliegue

## Qué se ha implementado
- Calibración empírica **por mercado** (BTTS, descanso, segunda parte, combinados, etc.).
- División cronológica 80% entrenamiento / 20% validación, sin usar partidos futuros para validar los anteriores.
- Corrección por intervalos de probabilidad con suavizado bayesiano (30 observaciones equivalentes).
- Solo se aplica cuando hay al menos **100** pronósticos resueltos para entrenamiento, **30** para validación y mejora estrictamente el Brier score en validación. Corrección máxima ±8 puntos porcentuales.
- Cuando no existe histórico suficiente o falla Supabase, el motor conserva las probabilidades originales: **NO se presenta como calibrado**.
- Se capturan pronósticos de primera y segunda parte para entrenamiento y se liquidan solo con marcadores al descanso disponibles.
- Se excluyen del entrenamiento «gana cualquier mitad», ya que el marcador final no permite liquidar correctamente todos sus casos.

## Limitaciones
- No se han importado datos históricos reales ni se han entrenado modelos preexistentes: se entrenará con predicciones guardadas ANTES de los partidos y posteriormente resueltas.
- No se garantiza rentabilidad ni acierto. El filtro Brier es validación histórica, no una promesa futura.
- La selección/ranking original de la web puede no recalcularse por completo tras el ajuste de probabilidades; las cuotas combinadas siguen siendo estimaciones cuando no existe precio real.
- Los mercados por mitades necesitan datos reales del descanso. La estimación base por mitades requiere validación independiente.

## GitHub y Render
1. Sube **el contenido de la carpeta raíz del proyecto** a tu repositorio GitHub (package.json debe quedar en la raíz).
2. En Render: Web Service > repositorio GitHub > Runtime Node > Build `npm install && npm run build` > Start `npm run start`.
3. Configura las variables de `.env.example` en Render; nunca subas las claves reales a GitHub.
4. Ejecuta las migraciones SQL de `supabase/`, incluida `supabase/migrations/v0.25_machine_learning.sql`, en Supabase SQL Editor.
5. Programa un job externo o cron que llame al endpoint de aprendizaje existente según su autenticación; sin ejecuciones de aprendizaje, no se acumularán resultados calibrados.
6. Comprueba `/api/health` y `/api/ml/status`, y el registro de Render.

Variables opcionales: `ML_CALIBRATION_ENABLED=true`, `ML_MAX_TRAINING_ROWS=10000`.

**Estado:** código preparado; despliegue, compilación en Render y precisión real aún pendientes de verificación.

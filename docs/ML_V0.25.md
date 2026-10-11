# ML v0.25 — capa de aprendizaje sin tocar el motor

Esta versión añade una capa independiente de Machine Learning. Los archivos de `lib/engine` no se modifican.

## Qué aprende

El modelo aprende a calibrar la probabilidad de que cada candidato generado por el motor haya sido correcto. Utiliza como entrada la probabilidad, score, cuota estimada, mercado, categoría y hora del partido.

No sustituye las reglas ni altera `lib/engine/*`.

## Flujo

1. Se guarda cada candidato de una jornada en `ml_predictions`.
2. Cuando el partido termina, se consulta su resultado y se marca `target_correct`.
3. Con suficientes muestras se entrena una regresión logística con regularización L2.
4. El modelo queda guardado en `ml_models`.
5. Las versiones futuras pueden consultar el modelo para obtener una probabilidad calibrada.

## Activación

Ejecuta la migración `supabase/migrations/v0.25_machine_learning.sql`.

Variables recomendadas en Render:

- `API_FOOTBALL_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ML_CRON_SECRET` (opcional pero recomendado)
- `ML_MIN_SAMPLES=100`
- `ML_MAX_FIXTURES_PER_RUN=30`
- `ML_MAX_TRAINING_ROWS=10000`

## Endpoint

`POST /api/ml/learn`

Header opcional si `ML_CRON_SECRET` está configurado:

`x-ml-secret: <secreto>`

El endpoint genera/guarda el análisis del día usando exactamente el motor existente, resuelve resultados pendientes y reentrena la capa ML.

`GET /api/ml/status` muestra si existe un modelo entrenado, número de muestras, accuracy, log loss y pendientes.

## Importante

La capa ML está diseñada como calibrador independiente. No se deben modificar los archivos de `lib/engine` para hacerla funcionar.

## Capa de uso del modelo

`GET /api/ml/analyze?date=YYYY-MM-DD` ejecuta el motor existente y, si existe un modelo entrenado, aplica una calibración limitada 70/30 entre la probabilidad original y la aprendida. El archivo `lib/engine/*` permanece intacto.

El dashboard actual no se cambia automáticamente en esta entrega: puedes probar esta ruta de forma aislada antes de decidir si quieres conectarla a la interfaz.

## Render Cron

Crea un Cron Job en Render con:

```text
node scripts/ml-learn.mjs
```

Variables del Cron Job:

```text
APP_BASE_URL=https://TU-SERVICIO.onrender.com
ML_CRON_SECRET=el-mismo-secreto-del-Web-Service
```

Una ejecución diaria después de la medianoche puede capturar la jornada anterior y actualizar el modelo. Para resolver partidos pendientes durante el día puedes programar una frecuencia mayor, teniendo en cuenta el presupuesto de API-Football.

## Capa de uso del modelo

`GET /api/ml/analyze?date=YYYY-MM-DD` ejecuta el motor existente y, si existe un modelo entrenado, aplica una calibración limitada 70/30 entre la probabilidad original y la aprendida. El archivo `lib/engine/*` permanece intacto.

El dashboard actual no se cambia automáticamente en esta entrega: puedes probar esta ruta de forma aislada antes de decidir si quieres conectarla a la interfaz.

## Render Cron

Crea un Cron Job en Render con:

```text
node scripts/ml-learn.mjs
```

Variables del Cron Job:

```text
APP_BASE_URL=https://TU-SERVICIO.onrender.com
ML_CRON_SECRET=el-mismo-secreto-del-Web-Service
```

Una ejecución diaria después de la medianoche puede capturar la jornada anterior y actualizar el modelo. Para resolver partidos pendientes durante el día puedes programar una frecuencia mayor, teniendo en cuenta el presupuesto de API-Football.

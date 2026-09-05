# Configurar Supabase gratis

Supabase es la parte que hace que la caché no desaparezca cuando Vercel reinicia o duerme el servidor.

## 1. Crear el proyecto

Crea un proyecto gratuito en Supabase.

## 2. Crear las tablas

Abre **SQL Editor**, pega todo el contenido de `supabase/schema.sql` y ejecútalo una sola vez.

## 3. Poner las dos variables

En local, copia `.env.example` a `.env.local` y rellena:

```env
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=TU_SERVICE_ROLE
```

En Vercel se ponen esas mismas variables en **Project > Settings > Environment Variables**.

## Qué se guarda

- respuestas de API reutilizables (`api_cache`)
- contador diario de llamadas (`api_usage_daily`)
- último análisis de cada día (`daily_analysis`)
- estructura preparada para histórico de combinadas (`combo_history`)

## Seguridad

La `SUPABASE_SERVICE_ROLE_KEY` no debe aparecer nunca en componentes React cliente, capturas, commits ni variables `NEXT_PUBLIC_*`.

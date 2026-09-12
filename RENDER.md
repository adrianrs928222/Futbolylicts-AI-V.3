# Render

Configuración recomendada para este proyecto:

- Build Command: `npm install && npm run build`
- Start Command: `npm start`
- Health Check Path: `/healthz`

No fijes manualmente `PORT` ni `HOSTNAME` en Render. El servidor usa `process.env.PORT` y escucha siempre en `0.0.0.0`.

En los logs del despliegue correcto debe aparecer una línea similar a:

`[server] listening on http://0.0.0.0:10000`

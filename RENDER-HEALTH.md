# Render health check

Configure Render with:

- Health Check Path: `/api/health`
- Build Command: `npm install && npm run build`
- Start Command: `npm start -- -H 0.0.0.0 -p $PORT`

The `/api/health` endpoint does not call API-Football, The Odds API, Supabase, ML, or any application cache. It only returns an HTTP 200 JSON response so Render can verify the Next.js server is alive.

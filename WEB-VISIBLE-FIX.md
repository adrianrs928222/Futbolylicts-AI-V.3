# Fix de pantalla en blanco

Este ajuste no cambia el motor estadístico ni las combinadas.

- La página principal se pinta inmediatamente y carga `/api/daily` desde el cliente.
- Si el análisis tarda, el usuario ve una pantalla de carga en vez de una página blanca.
- Las llamadas a API-Football tienen timeout de 15 s para evitar esperas indefinidas.
- Un fallo de ML o del guardado del historial no bloquea la respuesta principal.
- `/api/health` se mantiene intacto.

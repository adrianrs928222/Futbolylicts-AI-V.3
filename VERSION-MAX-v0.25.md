# Futbolylicts-AI v0.25 MAX

- Analisis profundo de todos los partidos prematch de competiciones permitidas (limitado solo por cuota/API disponible).
- Cache persistente diaria en Supabase: /api/daily reutiliza hasta 6h el analisis guardado y evita repetir llamadas al entrar.
- /api/refresh sigue forzando una regeneracion manual.
- Combinada del Dia: objetivo @8-@10, nunca forzado. Si no existe, publica la mejor combinacion ALTA/MUY ALTA con su cuota estimada matematica real.
- Cuota total = producto exacto de las cuotas estimadas de las patas.
- Cuotas EST. recalibradas desde la probabilidad del modelo; ya no se inflan hacia cuotas medias para alcanzar @8-@10.
- The Odds API no es necesaria. Toda cuota sin proveedor real queda tratada como ESTIMADA.
- Hasta 150 partidos candidatos en el optimizador y mayor amplitud de busqueda.

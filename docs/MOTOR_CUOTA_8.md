# Motor cuota 8+

Esta versión hace más fácil que Futbolylicts encuentre la **Combinada del dia** alrededor de cuota 8 sin bajar el filtro de calidad.

La idea es sencilla: el motor ya tiene varios mercados ALTA/MUY ALTA por cada partido. Antes se quedaba con muy pocas opciones demasiado pronto. Ahora conserva más alternativas del mismo análisis y prueba muchas más combinaciones entre ellas, sin volver a llamar a las APIs.

Reglas principales:

- La combinada pública nunca sale por debajo de **@8.00**.
- Busca primero entre **@8.00 y @10.00**.
- Si no existe una opción en ese rango, puede subir ligeramente hasta **@10.80**, pero no bajar de @8.
- Cada pata continúa necesitando **8.0/10 o más**.
- Cada cuota individual continúa entre **@1.25 y @1.75**.
- Se favorece la zona **@1.30–@1.65** cuando la calidad es parecida.
- BTTS Sí: sin límite de cantidad; mínimo automático **@1.35**.
- El mercado 12 tiene presencia real cuando ya es ALTA/MUY ALTA.
- Nunca se sube la nota de un pick solo porque pague más.
- No añade llamadas API: la búsqueda extra se hace sobre datos que ya están en caché/memoria.

El objetivo no es hacer apuestas más agresivas. Es aprovechar mejor los mercados buenos que el motor ya había encontrado para construir la cuota total de forma más eficiente.

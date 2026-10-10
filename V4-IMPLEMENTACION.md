# Futbolylicts V4 — Cambios aplicados sobre V3

- Se amplía la búsqueda de mercados de protección de empate con goles: 1X/X2 +0.5, -3.5 y entre 2 y 4 goles. La probabilidad conjunta se calcula sobre marcadores Poisson, no multiplicando probabilidades.
- Se priorizan levemente los mercados protegidos solo en desempates de calidad; no se falsea la probabilidad.
- BTTS VALUE: cuota mínima preferida 1.66, probabilidad mínima 60% y puntuación mínima 7.5 en el perfil de riesgo controlado.
- La cuota objetivo de combinada pasa a aproximadamente 7 y deja de forzarse cuando no hay calidad suficiente.
- Analizados sigue seleccionando el mejor candidato disponible por partido y Combinada utiliza el pool de candidatos.

## Limitaciones importantes

Las cuotas sintéticas de mercados combinados NO son cotizaciones reales de casas de apuestas. No se ha incorporado un proveedor de Bet Builder en vivo ni se han validado probabilidades con un backtest histórico. Las claves de API deben configurarse en .env.local siguiendo .env.example. La ejecución en producción requiere instalar dependencias y pruebas en un entorno con Node y acceso a paquetes.

# Contrato de producto — Futbolylicts-AI v0.14

## Objetivo

Construir la **Combinada del dia** buscando normalmente @8–@10 sin degradar la calidad.

Prioridad: probabilidad/solidez → nota contextual → cobertura/valor → cuota total.

## Reglas de publicación

- ALTA: >=70% + >=8.0/10.
- MUY ALTA: >=78% + >=9.0/10.
- La probabilidad y la nota se calculan por separado.
- Prioridad clara a 8.5+ y 78%+.
- Cuota por pata @1.25–@1.75.
- Valor mínimo: +3 puntos porcentuales frente a la probabilidad implícita de la cuota.
- Máximo una selección por partido.
- Preferencia 4–6 selecciones.
- Ningún Under.
- Ningún hándicap.

## Mercados

Ganador, 1X, X2, 12, +0.5/+1.5/+2.5, BTTS Sí, goles de equipo +0.5/+1.5 y combinados del mismo partido: 1X+O1.5, X2+O1.5, 1X+O2.5, X2+O2.5, ganador+O1.5 y ganador+O2.5. No se fuerza variedad y se permite repetición si la calidad lo justifica. BTTS automático necesita @1.35+. +2.5 debe tener espacio real cuando sigue siendo ALTA/MUY ALTA y no debe degradarse automáticamente a +1.5. La probabilidad de un combinado se calcula conjuntamente por marcadores; si no existe cuota real Bet Builder en la API, se muestra sin cuota y no se inventa.

## Combinada

El motor no debe añadir una selección peor solo para alcanzar @8. Si existen 4–6 picks válidos y la cuota queda por debajo, debe mostrarlos con la cuota real. Si solo existen 1–3 picks válidos, debe mostrarlos como picks disponibles y dejar claro que todavía no hay combinada completa.

## Jornada visible

Mostrar todos los partidos elegibles de hoy, incluidos iniciados/finalizados. Marcar cuáles se analizaron en profundidad. Mostrar también todos los analizados aunque no entren y todos los picks que pasen el filtro.

## Reservas / filiales

Excluir reservas/B/II/Jong, U23/juveniles, femenino y amistosos, salvo reservas en Eerste Divisie de Países Bajos.

## Lenguaje

Usar **“Qué puede hacer fallar el pick”** y explicaciones naturales.

# Reglas canónicas de Futbolylicts-AI — v0.12

## Prioridad

1. Probabilidad / solidez.
2. Nota final contextual.
3. Cobertura y relación cuota-riesgo.
4. Cuota total.

La cuota objetivo nunca justifica degradar el pick.

## Confianza

- 🟢 **ALTA:** probabilidad >=70% **y** nota >=8.0/10.
- 🔥🟢 **MUY ALTA:** probabilidad >=78% **y** nota >=9.0/10.
- Probabilidad y nota son independientes: 70% no convierte automáticamente un pick en 8.5/10.
- Núcleo preferido: nota 8.5+ y probabilidad 78%+ cuando sea posible.

## Valor de cuota

Para un pick oficial:

`probabilidad motor >= probabilidad implícita de la cuota + 3 puntos porcentuales`

Ejemplo: @1.50 implica aproximadamente 66.7%; el motor necesita al menos ~69.7%, además de superar los demás filtros.

## Cuotas

- Rango automático: @1.25–@1.75.
- BTTS: mínimo @1.35.
- Se rechazan cuotas diminutas fuera del rango automático.

## Mercados permitidos

- gana local / visitante
- 1X / X2
- 12
- +0.5 / +1.5 / +2.5 goles
- BTTS Sí
- local/visitante +0.5 o +1.5 goles

Prohibidos:

- cualquier Under
- cualquier hándicap

## Repetición

No existe límite artificial por tipo de mercado. Si los mejores son varios BTTS, +2.5, X2, 12, etc., pueden repetirse.

## Combinada diaria

- Nombre: **Combinada del dia**.
- Objetivo: @8–@10.
- Preferencia: 4–6 selecciones.
- Máximo una selección por partido.
- Solo cuotas reales en picks oficiales.
- Si 4–6 picks válidos quedan por debajo de @8, se muestran igualmente sin añadir riesgo artificial.
- Si solo existen 1–3 picks válidos, se muestran como picks disponibles y no como combinada completa.

## Competiciones y exclusiones

Se excluyen por defecto femenino, juveniles/U23, amistosos y reservas/filiales/B/II/Jong.

**Excepción única:** reservas permitidas en **Eerste Divisie (Países Bajos)**.

## Visibilidad

- Todos los partidos elegibles del día permanecen visibles.
- Los partidos analizados en profundidad se identifican.
- Los analizados que no pasan siguen apareciendo con el motivo.
- Los picks que pasan el filtro se muestran todos, sin recorte visual.

## Explicación natural

Cada pick muestra **“Qué puede hacer fallar el pick”**.

# Arquitectura v0.24

## Flujo

1. API-Football trae la jornada completa.
2. Filtro de femenino, juvenil, amistosos y reservas (excepto Jong en Eerste Divisie).
3. Gate de competiciones preferidas/fiables para análisis profundo.
4. Shortlist global repartida por ligas, hasta 40 partidos por defecto.
5. Forma reciente + standings con caché memoria/Supabase.
6. Motor Poisson + evidencia reciente genera probabilidad y nota de todos los mercados permitidos.
7. Motor de cuota EST. suaviza la probabilidad y aplica margen tipo bookmaker.
8. Los combinados se calculan por probabilidad conjunta de marcadores.
9. Sobreanálisis por fixture ordena el mejor mercado y conserva alternativas ALTA/MUY ALTA.
10. Beam search intenta primero @8–@10 con 4–6 picks.
11. Si no existe, rescate duro revisa todas las alternativas ALTA/MUY ALTA; como último recurso permite hasta 8 picks.
12. La revisión final puede mejorar mercados/partidos, pero no puede desmontar una combinación que ya esté en @8–@10.
13. Dashboard explica el porqué y las alternativas.

## APIs

API-Football está en el camino crítico. The Odds API sigue en el repositorio por compatibilidad, pero no forma parte del camino crítico de v0.24. Supabase mantiene caché/persistencia.

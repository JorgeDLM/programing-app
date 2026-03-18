# Recuperación Iterativa

## Rol
Patrón para resolver el problema de contexto en workflows multi-agente.

## Qué hace
- Refina progresivamente qué contexto necesita un subagente
- Resuelve el problema de que un agente no sabe qué necesita hasta que empieza
- Estrategia iterativa: pedir → evaluar → refinar → pedir más

## Cuándo usarlo
- En workflows multi-agente donde el contexto es incierto
- Cuando un agente necesita información que no sabe que necesita
- Al diseñar pipelines de agentes con handoffs

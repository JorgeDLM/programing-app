# Compactación Estratégica

## Rol
Gestor de contexto para sesiones largas de agentes.

## Qué hace
- Sugiere puntos óptimos para compactar el contexto
- Preserva información crítica entre fases de trabajo
- Evita auto-compactación arbitraria que pierde contexto
- Mantiene la coherencia en sesiones de trabajo largas

## Cuándo usarlo
- En sesiones largas donde el contexto se está llenando
- Al cambiar de fase en un proyecto (plan → implementación → review)
- Al notar que el agente empieza a "olvidar" decisiones previas

## Capacidades
- Detección de puntos lógicos de compactación
- Resumen estratégico que preserva decisiones clave
- Workflow: fase completa → compact → siguiente fase

# Ciclo de Verificación

## Rol
Verificador integral del estado del código antes de entregar.

## Qué hace
- Ejecuta build, tipos, lint, tests y seguridad en secuencia
- Verifica que todo pasa antes de commit o deploy
- Detecta regresiones y problemas introducidos por cambios recientes
- Genera reporte de estado del codebase

## Cuándo usarlo
- Antes de cada commit importante
- Antes de hacer deploy a producción
- Después de un refactor grande
- Al auditar el estado general de un proyecto

## Capacidades
- Pipeline: build → tipos → lint → tests → seguridad → git status
- Detección de regresiones automática
- Reporte con pass/fail por cada paso
- Compatible con cualquier stack JS/TS/Python

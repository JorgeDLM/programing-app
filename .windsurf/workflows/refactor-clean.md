---
description: Identificar y eliminar codigo muerto de forma segura con verificacion de tests en cada paso.
---

# Refactor Clean

Cuando el usuario invoque /refactor-clean:

1. **Detectar Codigo Muerto** - Segun el tipo de proyecto:
   - JS/TS: `npx knip` o `npx depcheck`
   - Python: `vulture src/`
   - Go: `deadcode ./...`
   - Si no hay tool, usar Grep para encontrar exports sin imports

2. **Categorizar Hallazgos**:
   - **SAFE**: Utilidades sin uso, helpers internos -> Eliminar con confianza
   - **CAUTION**: Componentes, rutas API -> Verificar imports dinamicos
   - **DANGER**: Configs, entry points, tipos -> Investigar antes de tocar

3. **Loop de Eliminacion Segura** (para cada item SAFE):
// turbo
   - Ejecutar suite de tests completa (baseline)
   - Eliminar el codigo muerto
// turbo
   - Re-ejecutar tests
   - Si tests fallan -> revertir inmediatamente con `git checkout -- <file>`
   - Si tests pasan -> siguiente item

4. **Consolidar Duplicados**:
   - Funciones casi-duplicadas (>80% similares) -> merge
   - Definiciones de tipos redundantes -> consolidar
   - Wrappers sin valor -> inline
   - Re-exports sin proposito -> eliminar

5. **Resumen**: Reportar archivos eliminados, lineas removidas, items saltados.

Reglas:
- Nunca eliminar sin ejecutar tests primero
- Una eliminacion a la vez
- Si hay duda, saltar el item

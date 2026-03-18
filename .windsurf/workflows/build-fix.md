---
description: Arreglar errores de build y tipos incrementalmente con cambios minimos y seguros.
---

# Build Fix

Cuando el usuario invoque /build-fix:

1. **Detectar Build System** - Identificar herramienta de build del proyecto:
   - package.json con script build -> `npm run build` o `pnpm build`
   - tsconfig.json -> `npx tsc --noEmit`
   - Cargo.toml -> `cargo build 2>&1`
   - go.mod -> `go build ./...`

// turbo
2. **Ejecutar Build** - Correr el comando de build y capturar errores

3. **Parsear y Agrupar Errores** - Agrupar por archivo, ordenar por dependencia

4. **Fix Loop (un error a la vez)**:
   - Leer el archivo con contexto alrededor del error
   - Diagnosticar causa raiz
   - Aplicar fix minimo
// turbo
   - Re-ejecutar build para verificar
   - Continuar con siguiente error

5. **Guardrails - PARAR y preguntar si**:
   - Un fix introduce MAS errores de los que resuelve
   - El mismo error persiste despues de 3 intentos
   - El fix requiere cambios arquitecturales
   - Errores por dependencias faltantes

6. **Resumen**:
   - Errores arreglados (con rutas)
   - Errores restantes
   - Errores nuevos introducidos (debe ser cero)
   - Siguientes pasos sugeridos

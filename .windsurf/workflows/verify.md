---
description: Verificacion completa del estado del codebase. Build, tipos, lint, tests, seguridad y git status.
---

# Verify

Cuando el usuario invoque /verify:

Ejecutar verificacion en este orden exacto:

// turbo
1. **Build Check** - Ejecutar el comando de build del proyecto. Si falla, reportar errores y PARAR.

// turbo
2. **Type Check** - Ejecutar TypeScript/type checker. Reportar errores con archivo:linea.

// turbo
3. **Lint Check** - Ejecutar linter. Reportar warnings y errores.

// turbo
4. **Test Suite** - Ejecutar todos los tests. Reportar pass/fail y porcentaje de cobertura.

5. **Console.log Audit** - Buscar console.log en archivos fuente. Reportar ubicaciones.

// turbo
6. **Git Status** - Mostrar cambios uncommitted y archivos modificados.

7. **Reporte Final**:

```
VERIFICACION: [PASS/FAIL]

Build:    [OK/FAIL]
Types:    [OK/X errores]
Lint:     [OK/X issues]
Tests:    [X/Y passed, Z% cobertura]
Logs:     [OK/X console.logs]

Listo para PR: [SI/NO]
```

Si hay issues criticos, listarlos con sugerencias de fix.

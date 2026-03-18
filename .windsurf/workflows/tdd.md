---
description: Workflow de Test-Driven Development. Escribe tests primero, implementa codigo minimo, refactoriza. Cobertura 80%+.
---

# TDD

Cuando el usuario invoque /tdd:

1. **Definir Interfaces** - Crear types/interfaces para inputs y outputs
2. **Escribir Tests (RED)** - Crear tests que FALLEN porque el codigo no existe aun
   - Happy path
   - Edge cases (empty, null, max values)
   - Condiciones de error
   - Boundary values
// turbo
3. **Ejecutar Tests** - Verificar que fallan por la razon correcta
4. **Implementar Codigo Minimo (GREEN)** - Solo lo necesario para que los tests pasen
// turbo
5. **Ejecutar Tests** - Verificar que pasan
6. **Refactorizar (IMPROVE)** - Mejorar codigo manteniendo tests verdes
   - Extraer constantes
   - Mejorar nombres
   - Reducir duplicacion
// turbo
7. **Ejecutar Tests** - Verificar que siguen pasando
8. **Verificar Cobertura** - Debe ser 80%+ (100% para logica critica)

Ciclo: RED -> GREEN -> REFACTOR -> REPEAT

Reglas:
- NUNCA escribir implementacion antes de tests
- NUNCA saltar la fase RED
- Un cambio a la vez
- Si tests fallan despues de refactor, revertir inmediatamente

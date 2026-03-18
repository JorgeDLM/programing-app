---
description: Review de calidad y seguridad del codigo. Revisa cambios uncommitted buscando vulnerabilidades y problemas de calidad.
---

# Code Review

Cuando el usuario invoque /code-review:

// turbo
1. **Obtener archivos cambiados** - Ejecutar `git diff --name-only HEAD`
// turbo
2. **Leer cada archivo cambiado** - Leer el diff completo con `git diff`

3. **Revisar Seguridad (CRITICAL)**:
   - Credenciales hardcodeadas (API keys, passwords, tokens)
   - Vulnerabilidades SQL injection
   - Vulnerabilidades XSS
   - Input validation faltante
   - Dependencias inseguras
   - Riesgos de path traversal

4. **Revisar Calidad (HIGH)**:
   - Funciones > 50 lineas
   - Archivos > 800 lineas
   - Nesting > 4 niveles
   - Manejo de errores faltante
   - console.log statements
   - TODO/FIXME comments

5. **Revisar Best Practices (MEDIUM)**:
   - Patrones de mutacion (usar inmutable)
   - Tests faltantes para codigo nuevo
   - Problemas de accesibilidad

6. **Generar Reporte** con:
   - Severidad: CRITICAL, HIGH, MEDIUM, LOW
   - Ubicacion (archivo y linea)
   - Descripcion del issue
   - Fix sugerido

7. **Bloquear commit** si hay issues CRITICAL o HIGH

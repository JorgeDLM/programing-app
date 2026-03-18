---
description: Crear plan de implementacion antes de escribir codigo. Analiza requisitos, identifica riesgos, y desglosa en fases.
---

# Plan

Cuando el usuario invoque /plan:

1. **Restablecer Requisitos** - Reformular lo que se necesita construir en terminos claros
2. **Analizar Codebase** - Leer archivos relevantes para entender la estructura actual
3. **Identificar Dependencias** - Listar que componentes seran afectados
4. **Evaluar Riesgos** - Clasificar como HIGH/MEDIUM/LOW
5. **Desglosar en Fases** - Crear pasos especificos y accionables con:
   - Acciones claras
   - Rutas de archivos
   - Dependencias entre pasos
   - Complejidad estimada
6. **Estimar Complejidad** - Total del esfuerzo (HIGH/MEDIUM/LOW)
7. **ESPERAR CONFIRMACION** - NO escribir codigo hasta que el usuario confirme con "si", "proceed", o similar

Si el usuario quiere cambios, ajustar el plan segun su feedback.

Despues del plan aprobado, sugerir usar /tdd para implementar.

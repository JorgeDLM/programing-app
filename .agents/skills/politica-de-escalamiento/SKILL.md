---
name: politica-de-escalamiento
description: Política obligatoria de consulta al cliente. Define cuándo, cómo y por qué el equipo debe preguntar antes de actuar. Aplica a TODOS los agentes en TODOS los proyectos.
origin: custom
---

# Política de Escalamiento al Cliente

Esta política es OBLIGATORIA para todos los agentes del sistema. Define cuándo se debe pausar la ejecución y consultar al cliente antes de continuar.

## Principio Fundamental

**Trabaja como una empresa real con un cliente real.**

Antes de desarrollar, cotizar, diseñar o cambiar algo importante:
1. Entiende qué quiere el cliente
2. Confirma que entiendes bien
3. Si hay dudas, PREGUNTA
4. Si hay riesgo, INFORMA
5. Si hay decisión que tomar, PRESENTA OPCIONES

NUNCA asumas. NUNCA inventes alcance. NUNCA tomes decisiones sensibles sin consultar.

## Cuándo SIEMPRE se debe consultar al cliente

### Alcance y Requisitos
- El cliente pide algo ambiguo → PREGUNTA qué quiere exactamente
- Se necesita un módulo que no estaba en el alcance → PREGUNTA si lo quiere y si lo paga
- Hay múltiples interpretaciones válidas de un requisito → PRESENTA OPCIONES
- Falta información crítica para avanzar (objetivos, audiencia, presupuesto) → PREGUNTA
- El proyecto necesita más tiempo o recursos de lo cotizado → INFORMA

### Arquitectura y Estructura
- Crear tablas nuevas o cambiar schema de base de datos → APROBACIÓN
- Cambiar arquitectura del sistema → APROBACIÓN
- Migrar de una tecnología a otra → APROBACIÓN
- Agregar dependencias importantes → INFORMAR
- Cambiar flujo de autenticación o permisos → APROBACIÓN

### Negocio y Dinero
- Reglas de negocio no claras → PREGUNTA antes de implementar
- Precios, descuentos, comisiones → CONFIRMA con el cliente
- Alcance de cotización vs lo que realmente se necesita → ALERTA
- Costo adicional no previsto → INFORMA antes de ejecutar
- Decisión que impacta ingresos del cliente → SIEMPRE CONSULTA

### Diseño y UX
- Flujo de usuario con múltiples caminos posibles → PRESENTA OPCIONES
- Diseño que cambia significativamente lo que el usuario ve → APROBACIÓN
- Eliminación de funcionalidad existente → APROBACIÓN
- Cambio de marca o identidad visual → APROBACIÓN

### Seguridad y Legal
- Manejo de datos sensibles del usuario → INFORMA cómo se protegen
- Cambios en políticas de privacidad → APROBACIÓN
- Claims publicitarios que puedan ser problemáticos → ALERTA
- Integración con servicios de pago → CONFIRMA proveedor y condiciones

## Cómo consultar al cliente

### Formato de consulta
```
[REQUIERE_APROBACION]
Tipo: {clarificacion | aprobacion | decision | riesgo | alcance}
Contexto: {explicación breve de la situación}
Pregunta: {pregunta clara y específica}
Opciones: {si aplica, opciones con pros/cons}
Impacto: {qué pasa si se decide A vs B}
Urgencia: {baja | media | alta | bloqueante}
```

### Tipos de consulta

| Tipo | Cuándo | Ejemplo |
|---|---|---|
| **Clarificación** | No entiendes qué quiere | "¿El carrito debe permitir guest checkout o solo usuarios registrados?" |
| **Aprobación** | Vas a hacer algo importante | "Necesito crear 3 tablas nuevas para el módulo de pedidos. ¿Apruebas?" |
| **Decisión** | Hay opciones con trade-offs | "Podemos usar Stripe ($2.9%) o MercadoPago ($3.5%). ¿Cuál prefieres?" |
| **Riesgo** | Detectas algo peligroso | "El diseño actual no tiene validación de stock. Puede vender productos agotados." |
| **Alcance** | Lo que piden excede lo cotizado | "Esta funcionalidad no estaba en el alcance original. ¿La incluimos como extra?" |

## Lo que NUNCA debes hacer sin consultar

1. **No inventes módulos** que el cliente no pidió
2. **No cambies el schema** de la base de datos sin aprobación
3. **No elimines funcionalidad** existente sin confirmación
4. **No asumas reglas de negocio** — pregunta
5. **No cotices** sin tener toda la información
6. **No implementes** features fuera del alcance sin avisar
7. **No tomes decisiones** de branding sin el cliente
8. **No hagas cambios** que afecten ingresos sin consultar

## Lo que SÍ puedes hacer sin consultar

1. Fix de bugs menores o typos
2. Refactor interno sin cambio de API o UI
3. Mejoras de performance sin cambio funcional
4. Actualización de documentación
5. Corrección de errores de lint o tipos
6. Optimización de queries sin cambio de resultados

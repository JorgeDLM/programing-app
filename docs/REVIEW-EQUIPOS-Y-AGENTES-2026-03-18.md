# REVIEW DE EQUIPOS Y AGENTES — Reorganizacion Final

**Fecha:** 18 de Marzo de 2026

---

## NUEVA ESTRUCTURA DE EQUIPOS PROPUESTA

| # | Equipo | Proposito | Agentes |
|---|---|---|---|
| 1 | **equipo-direccion** | Liderazgo, coordinacion, proteccion del cliente y control de calidad final | 4 |
| 2 | **equipo-analisis** | Discovery, estrategia, requerimientos, arquitectura general y analisis previo | 7 |
| 3 | **equipo-desarrollo** | Construccion real: arquitectos tecnicos, developers, DB, infra, integraciones | 12 |
| 4 | **equipo-diseno** | Diseno visual, marca, contenido grafico, UX writing, fotografia | 8 |
| 5 | **equipo-calidad** | QA, testing, seguridad, code review, simulacion de usuarios | 11 |
| 6 | **equipo-ventas** | Marketing, growth, ads, conversion, seguimiento, SEO | 15 |
| 7 | **equipo-finanzas** | Costos, precios, contabilidad, viabilidad financiera | 4 |
| 8 | **equipo-legal** | Legal, cumplimiento, riesgo | 2 |
| 9 | **equipo-especialistas** | Expertos de industria: ecommerce, marketplaces, joyeria, logistica | 7 |
| 10 | **equipo-research** | Investigacion de mercado, analisis de datos, conversion, producto | 5 |
| 11 | **archivo** | Agentes legacy, esqueleto o sin uso actual claro | 3 |

### Cambios vs estructura anterior:
- **QA + seguridad + code review** salen de equipo-tecnico y van a equipo-calidad
- **planificador** sale de legacy y va a equipo-analisis (es util, hace planes tecnicos)
- **documentador** sale de legacy y va a equipo-desarrollo (docs son parte del dev)
- **jefe-de-personal, optimizador-de-ia, supervisor-de-procesos** van a archivo (sin uso real)
- Nombres de carpetas: `equipo-X` consistente en todo

---

## REVIEW INDIVIDUAL DE CADA AGENTE (78)

### EQUIPO DIRECCION (4)

| Agente | Review | Estado |
|---|---|---|
| **director-de-operaciones** | Bien definido. Rol claro como cerebro operativo. Opus justified. | OK |
| **defensor-del-cliente** | Bien definido. Rol unico — protege vision del cliente. | OK |
| **project-manager** | Bien definido. Estructura tareas, fases, prioridades. | OK |
| **validador-de-salida** | Bien definido. Ultimo filtro antes de entregar. | OK |

### EQUIPO ANALISIS (7)

| Agente | Review | Estado |
|---|---|---|
| **analista-de-negocio** | Bien definido. Traduce ideas a requerimientos formales. | OK |
| **estratega-de-producto** | Bien definido. Prioriza por valor real. | OK |
| **disenador-de-experiencia** | Bien definido. UX flows y reduccion de friccion. | OK |
| **arquitecto** | Bien definido (8.1KB). Diseno de sistemas general. | OK |
| **validador-de-arquitectura** | Bien definido. Audita propuestas antes de construir. | OK |
| **experto-en-analisis-estrategico** | Bien definido. Escenarios, riesgos, consecuencias. | OK |
| **planificador** | Bien definido (7.2KB). Crea planes de implementacion detallados. Sale de legacy. | OK — mover aqui |

### EQUIPO DESARROLLO (12)

| Agente | Review | Estado |
|---|---|---|
| **arquitecto-backend** | Bien definido. Especialista Node.js/Next.js/Prisma/PostgreSQL. Opus justified. | OK |
| **arquitecto-frontend** | Bien definido. React/Next.js/TailwindCSS patterns. | OK |
| **desarrollador-backend** | Bien definido. Construye endpoints, servicios, queries. | OK |
| **desarrollador-frontend** | Bien definido. Construye UI real con React/Tailwind. | OK |
| **implementador** | REDUNDANTE con desarrollador-backend + desarrollador-frontend. Hace lo mismo: construir codigo. | REDUNDANTE — evaluar fusion |
| **disenador-de-base-de-datos** | Bien definido (4.3KB). Schema design, queries, RLS. | OK |
| **especialista-en-integraciones** | Bien definido. APIs externas, OAuth, pagos, webhooks. | OK |
| **responsable-de-infraestructura** | Bien definido. Deploys, CI/CD, secrets, monitoreo. | OK |
| **consultor-tecnico** | Bien definido (3.6KB). Busca docs via Context7 MCP. | OK |
| **doctor-de-errores** | Bien definido (3.8KB). Fix rapido de build/tipos. | OK |
| **optimizador-de-codigo** | Bien definido (2.7KB). Limpia dead code, refactoring. | OK |
| **documentador** | Definicion OK (3.4KB). Genera codemaps, READMEs. Sale de legacy. | OK — mover aqui |

### EQUIPO DISENO (8)

| Agente | Review | Estado |
|---|---|---|
| **disenador-visual** | Bien definido. UI aesthetic con TailwindCSS. | OK |
| **responsable-sistema-visual** | Bien definido. Guardian del design system. | OK |
| **disenador-de-marca** | Bien definido. Identidad visual, tono, coherencia. | OK |
| **disenador-imagenes-comerciales** | Bien definido. Banners, ads, landings visuales. | OK |
| **disenador-contenido-redes** | Bien definido. Piezas nativas por red social. | OK |
| **editor-visual** | Bien definido. Retoque, composicion, formatos. | OK |
| **redactor-de-producto** | Bien definido. Microcopy, mensajes UI, UX writing. | OK |
| **experto-fotografia-producto** | Bien definido. Direccion de arte fotografica. | OK |

### EQUIPO CALIDAD (11)

| Agente | Review | Estado |
|---|---|---|
| **lider-de-calidad** | Definicion basica (generada por batch). Necesita mas profundidad en criterios y checklists. | MEJORAR |
| **inspector-de-codigo** | Bien definido (8.8KB). Code review senior con severidades. | OK |
| **inspector-python** | Bien definido (3.4KB). PEP 8, seguridad, types. | OK |
| **validador-tecnico** | Bien definido. Audita deuda tecnica y fragilidad. | OK |
| **guardian-de-seguridad** | Bien definido (4.5KB). OWASP, secrets, auth. | OK |
| **maestro-de-pruebas** | Bien definido (2.9KB). TDD, cobertura 80%+. | OK |
| **tester-de-flujos** | Bien definido (4.1KB). E2E Playwright, anti-flaky. | OK |
| **probador-de-escenarios** | Definicion basica (batch). Necesita escenarios concretos y metodologia. | MEJORAR |
| **mr-shopper** | Definicion basica (batch). Necesita personalidades de comprador definidas. | MEJORAR |
| **simulador-cliente-dificil** | Definicion basica (batch). Necesita escenarios de conflicto definidos. | MEJORAR |
| **simulador-usuario-nuevo** | Definicion basica (batch). Necesita checklist de onboarding. | MEJORAR |

### EQUIPO VENTAS (15)

| Agente | Review | Estado |
|---|---|---|
| **experto-en-ventas** | Definicion basica (batch). Necesita frameworks de venta y cierre. | MEJORAR |
| **mercadologo** | Definicion basica (batch). Necesita frameworks de posicionamiento. | MEJORAR |
| **estratega-de-crecimiento** | Definicion basica (batch). Necesita AARRR framework. | MEJORAR |
| **estratega-de-marca** | Definicion basica (batch). Necesita brand positioning framework. | MEJORAR |
| **especialista-en-conversion** | Definicion basica (batch). Necesita CRO methodology. | MEJORAR |
| **especialista-seguimiento-cliente** | Definicion basica (batch). Necesita CRM/retention flows. | MEJORAR |
| **especialista-seo** | Definicion basica (batch). Necesita SEO checklist y technical SEO. | MEJORAR |
| **estratega-medios-pagados** | Definicion basica (batch). Necesita media planning framework. | MEJORAR |
| **especialista-google-ads** | Definicion basica (batch). Necesita campaign structures. | MEJORAR |
| **especialista-meta-ads** | Definicion basica (batch). Necesita creative frameworks. | MEJORAR |
| **especialista-tiktok-ads** | Definicion basica (batch). | MEJORAR |
| **especialista-youtube-ads** | Definicion basica (batch). | MEJORAR |
| **especialista-amazon-ads** | Definicion basica (batch). | MEJORAR |
| **especialista-mercadolibre-ads** | Definicion basica (batch). | MEJORAR |
| **especialista-catalogos-feeds** | Definicion basica (batch). | MEJORAR |

### EQUIPO FINANZAS (4)

| Agente | Review | Estado |
|---|---|---|
| **especialista-financiero** | Definicion basica (batch). Necesita KPIs financieros y frameworks. | MEJORAR |
| **contador** | Definicion basica (batch). Necesita compliance checklist. | MEJORAR |
| **especialista-precios-margenes** | Definicion basica (batch). Necesita pricing frameworks. | MEJORAR |
| **analista-de-costos** | Definicion basica (batch). Necesita cost breakdown structures. | MEJORAR |

### EQUIPO LEGAL (2)

| Agente | Review | Estado |
|---|---|---|
| **revisor-legal** | Definicion basica (batch). Necesita legal compliance frameworks. | MEJORAR |
| **evaluador-de-riesgos** | Definicion basica (batch). Necesita risk matrix methodology. | MEJORAR |

### EQUIPO ESPECIALISTAS (7)

| Agente | Review | Estado |
|---|---|---|
| **especialista-ecommerce** | Definicion basica (batch). Necesita e-commerce best practices. | MEJORAR |
| **especialista-marketplaces** | Definicion basica (batch). | MEJORAR |
| **especialista-amazon** | Definicion basica (batch). Necesita Amazon listing optimization. | MEJORAR |
| **especialista-mercadolibre** | Definicion basica (batch). Necesita ML listing optimization. | MEJORAR |
| **especialista-google-ads-catalogos** | Definicion basica (batch). Necesita Merchant Center specifics. | MEJORAR |
| **especialista-joyeria** | Definicion basica (batch). Necesita jewelry-specific expertise. | MEJORAR |
| **especialista-logistica** | Definicion basica (batch). Necesita fulfillment frameworks. | MEJORAR |

### EQUIPO RESEARCH (5)

| Agente | Review | Estado |
|---|---|---|
| **investigador-de-mercado** | Definicion basica (batch). Necesita research methodology. | MEJORAR |
| **analista-de-datos** | Definicion basica (batch). Necesita analytics frameworks. | MEJORAR |
| **analista-de-conversion** | Definicion basica (batch). Necesita funnel analysis methodology. | MEJORAR |
| **analista-de-producto** | Definicion basica (batch). Necesita product analytics framework. | MEJORAR |
| **analista-comercial** | Definicion basica (batch). Necesita business analysis methodology. | MEJORAR |

### ARCHIVO (3)

| Agente | Review | Estado |
|---|---|---|
| **jefe-de-personal** | No aplica al flujo actual del dashboard. Gestiona email/Slack/LINE. | ARCHIVAR |
| **optimizador-de-ia** | Esqueleto (0.9KB). Sin contenido operativo real. | ARCHIVAR |
| **supervisor-de-procesos** | Esqueleto (0.9KB). Sin contenido operativo real. | ARCHIVAR |

---

## RESUMEN DEL REVIEW

| Categoria | Cantidad |
|---|---|
| Agentes OK (bien definidos, listos) | 35 |
| Agentes MEJORAR (definicion basica, necesitan mas profundidad) | 40 |
| Agentes REDUNDANTES (evaluar fusion) | 1 (implementador) |
| Agentes ARCHIVAR (sin uso actual) | 3 |
| **TOTAL** | 78 + 1 observacion |

### Sobre el implementador
El `implementador` hace exactamente lo mismo que `desarrollador-backend` + `desarrollador-frontend`. Fue creado antes de que existieran los desarrolladores especializados. Opciones:
1. **Eliminar** implementador y usar solo los desarrolladores especializados
2. **Mantener** como agente generico para tareas que no son claramente frontend ni backend
3. **Renombrar** a algo mas especifico

Recomendacion: Mantenerlo como "comodin" de desarrollo para tareas genericas. Los templates deben preferir los especializados.

### Agentes faltantes detectados
No detecto agentes faltantes criticos. Los 66 que pediste mas los 16 que ya existian cubren bien las 10 areas. Los que necesitan mejora son los 40 que se crearon via batch script con definiciones genericas — esos necesitan profundizarse en una fase posterior.

---

*Review generado el 18 de Marzo de 2026.*

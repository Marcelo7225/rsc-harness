# ARHIAX Governance DNA v0.1

**ID:** `ARH-GOV-DNA-001`  
**Estado:** FOUNDATION DESIGN BASELINE CANDIDATE

## Propósito

Definir invariantes de gobernanza que ningún agente, skill, modelo, workflow o herramienta puede eliminar.

## Invariantes

- **GOV-001 Objective Identity.** Toda modificación material debe asociarse con un objetivo identificable.
- **GOV-002 Actor Identity.** Toda acción material debe tener actor identificable.
- **GOV-003 Limited Authority.** Todo actor posee autoridad limitada. Capacidad técnica no implica autoridad.
- **GOV-004 Generation Does Not Create Authority.** Contenido generado por IA nace sin autoridad salvo regla explícita.
- **GOV-005 Proposal Separation.** `PROPOSAL != DECISION`.
- **GOV-006 Decision Separation.** `DECISION != RATIFIED_DECISION`.
- **GOV-007 Implementation Separation.** Implementar una propuesta no la convierte en autoridad.
- **GOV-008 Evidence Separation.** Una afirmación del agente no constituye evidencia de que una acción ocurrió.
- **GOV-009 Knowledge Humility.** `UNKNOWN` es un estado legítimo.
- **GOV-010 Conflict Preservation.** `CONFLICT` es un estado legítimo y no debe resolverse silenciosamente.
- **GOV-011 Source Authority.** Información material conserva procedencia y autoridad de fuente.
- **GOV-012 Human Authority.** Decisiones reservadas a humanos no se delegan implícitamente a modelos.
- **GOV-013 Proportional Governance.** La fricción de gobierno debe ser proporcional al riesgo.
- **GOV-014 Reversibility Awareness.** La reversibilidad modifica el régimen de autorización.
- **GOV-015 Material Actions Produce Evidence.** Operaciones materiales producen evidencia verificable cuando corresponda.
- **GOV-016 Release Is Distinct.** Construir, verificar y autorizar release son eventos distintos.
- **GOV-017 Canon Changes Are Governed.** Modificar canon exige operación explícita de gobierno.
- **GOV-018 Model Independence.** Ningún proveedor o modelo es autoridad por sí mismo.
- **GOV-019 Tool Independence.** Disponibilidad de una herramienta no implica autorización para usarla.
- **GOV-020 Product Governance Inheritance.** Los productos construidos bajo ARHIAX incorporan el Governance DNA requerido por su Governance Profile.

## Regla de precedencia

`ARHIAX Governance > Execution Contract > Workflow > Agent > Skill > Model Suggestion`

## Alcance

El DNA gobierna dos dimensiones:

1. **Governance of Build:** cómo agentes y herramientas construyen.
2. **Governance in the Build:** qué invariantes quedan incorporados en el producto construido.

El nivel de expresión del DNA será proporcional al Governance Profile del proyecto.

# ARHIAX Canonical Registry v0.1

**ID:** `ARH-CANON-REGISTRY-001`  
**Estado:** FOUNDATION DESIGN BASELINE CANDIDATE

## Propósito

Convertir el corpus en estado computable y evitar que el canon dependa únicamente de documentos Markdown.

## Dual Representation

ARHIAX mantiene:

`Human Representation + Machine Registry`

La representación humana puede ser Markdown u otro formato legible. La representación de máquina usa registros estructurados sujetos a schema.

## Clases iniciales

- artifacts
- objectives
- sources
- requirements
- decisions
- controls
- operations
- policies
- evidence
- contracts
- unknowns
- conflicts

## Identidad

Todo elemento material posee un ID estable. Ejemplos:

- `OBJ-*`
- `REQ-*`
- `CTRL-*`
- `DEC-*`
- `SRC-*`
- `ART-*`
- `OP-*`
- `EVID-*`

## Reglas

- **CAN-001:** el archivo no es la identidad.
- **CAN-002:** renombrar un archivo no crea una entidad nueva.
- **CAN-003:** dos artefactos no pueden reclamar simultáneamente el mismo ID canónico activo.
- **CAN-004:** el registro conserva versión, estado, autoridad, provenance, relaciones y hash cuando proceda.
- **CAN-005:** representación humana y registry no pueden divergir silenciosamente.
- **CAN-006:** drift detectable produce un finding.
- **CAN-007:** drift material puede bloquear release o cambio de canon.
- **CAN-008:** artefactos superseded permanecen históricamente disponibles.
- **CAN-009:** un agente no puede resolver ambigüedad de canon por conveniencia operativa.
- **CAN-010:** toda activación canónica debe ser trazable a una autoridad y decisión.

## Resultado requerido

El sistema debe poder responder programáticamente cuál es el artefacto canónico activo para una materia sin pedir al LLM que lo deduzca explorando carpetas.

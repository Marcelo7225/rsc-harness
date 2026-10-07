# ARHIAX Execution Contract v0.1

**ID:** `ARH-EXEC-CONTRACT-001`  
**Estado:** FOUNDATION DESIGN BASELINE CANDIDATE

## Propósito

Transformar un Governed Objective autorizado en instrucciones operativas vinculantes para el harness.

## Compiler

Entrada:

`Governed Objective + Governance Profile + Canonical Context + Authority + Risk + Available Capabilities`

Salida:

`Execution Contract`

## El Execution Contract debe resolver

### Agents
Qué agentes pueden participar.

### Models
Qué clase o modelo puede utilizarse en cada función cuando exista routing.

### Capabilities
Qué skills o capabilities pueden cargarse.

### Tools
Qué herramientas están permitidas.

### Context
Qué conocimiento autorizado puede consumirse.

### Writable Scope
Qué artefactos o rutas pueden modificarse.

### Forbidden Scope
Qué queda fuera de autoridad.

### Operations
Qué operaciones están autorizadas.

### Human Gates
Qué decisiones requieren intervención humana.

### Deterministic Gates
Qué comprobaciones deben ejecutarse necesariamente.

### Evidence Obligations
Qué evidencia debe producir cada operación material.

### Release Authority
Quién o qué puede autorizar merge, publicación o deployment.

## Ejemplo conceptual

```yaml
execution_contract:
  objective: OBJ-000057

  strategy:
    lane: GOVERNED_SDD

  context:
    baseline: CORPUS-v3
    allow_only_active_sources: true

  agents:
    planner: allowed
    implementer: allowed
    reviewer: required

  capabilities:
    - fastapi
    - postgresdb
    - testing

  writable:
    - src/
    - tests/

  forbidden:
    - governance/canonical/
    - corpus/ratified/

  operations:
    CODE_WRITE: ALLOW
    TEST_EXECUTION: ALLOW
    CANON_CHANGE: DENY
    PRODUCTION_RELEASE: HUMAN_REQUIRED

  gates:
    - authority
    - contract-impact
    - tests
    - review
    - evidence-closure

  evidence:
    - source-resolution
    - policy-decision
    - change-receipt
    - test-result
    - review-result
```

## Regla superior

El agente no decide unilateralmente su Execution Contract. El contrato es resultado del Governance Core.

## Relación con RSC

RSC puede ejecutar internamente FTD, SDD, skills, agents, hooks, worktrees, verify, review, ship y otras capacidades, pero únicamente dentro de los límites del Execution Contract.

## Flujo fundacional

`ARHIAX GOVERNANCE DNA`
→ `CORPUS GENESIS`
→ `CANONICAL REGISTRY`
→ `GOVERNED OBJECTIVE`
→ `EXECUTION CONTRACT`
→ `RSC RUNTIME`
→ `EXECUTION`
→ `EVIDENCE`

## Condición fundacional

Antes de implementar el core ARHIAX, estos contratos deberán convertirse en schemas mínimos verificables y criterios de conformidad ejecutables.

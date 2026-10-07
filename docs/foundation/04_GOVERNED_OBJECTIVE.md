# ARHIAX Governed Objective v0.1

**ID:** `ARH-GOV-OBJECTIVE-001`  
**Estado:** FOUNDATION DESIGN BASELINE CANDIDATE

## Propósito

Convertir la intención humana en la unidad primaria de gobierno y ejecución.

ARHIAX no comienza con un prompt. Comienza con un objetivo.

## Estructura mínima

Un objetivo debe poder expresar:

- `objective_id`;
- requester;
- purpose;
- desired outcome;
- scope;
- exclusions;
- target artifacts;
- constraints;
- known sources;
- expected acceptance criteria;
- urgency;
- reversibility;
- external effects.

## Evaluación

Antes de ejecutar, el sistema calcula al menos cuatro dimensiones:

### Risk
¿Qué ocurre si nos equivocamos?

### Authority
¿Quién está autorizado a decidir y ejecutar?

### Complexity
¿Cuánta coordinación técnica exige?

### Uncertainty
¿Cuánto desconocemos o está en conflicto?

## Regla

`ExecutionStrategy = f(Risk, Authority, Complexity, Uncertainty)`

`complexity != risk`

Un cambio técnicamente pequeño puede requerir alta gobernanza. Un cambio complejo puede ser reversible y de bajo impacto.

## Estados mínimos

- `PROPOSED`
- `AUTHORIZED`
- `IN_PROGRESS`
- `BLOCKED`
- `VERIFIED`
- `ASSURED`
- `RELEASED`
- `CANCELLED`

## Relaciones

Un objetivo debe relacionarse con decisiones, operaciones, artifacts, requirements, controls, executions, evidence y release.

## Genesis Objective

En un proyecto nuevo, el primer objetivo gobernado debe ser la creación y ratificación del baseline inicial. La construcción del producto no debe preceder silenciosamente al establecimiento de ese baseline cuando el Governance Profile lo exija.

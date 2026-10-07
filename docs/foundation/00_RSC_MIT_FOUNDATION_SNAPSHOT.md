# ARHIAX Harness — RSC MIT Foundation Snapshot v0.1

**Estado:** FOUNDATION BASELINE CANDIDATE  
**Fecha de corte:** 2026-10-07  
**Propósito:** fijar de forma inmutable la base RSC utilizada para construir ARHIAX Harness sin dependencia operativa del upstream.

## 1. Fuente congelada

- Repositorio de trabajo: `Marcelo7225/rsc-harness`
- Base original: `ericrisco/rsc-harness`
- Versión: `3.0.10`
- Commit: `d36527d3c6c7699627eb58a100de6d94e20cd0dc`

ARHIAX no se define contra `latest`. Este commit es la referencia fundacional exacta.

## 2. Licencia

RSC 3.0.10 se distribuye bajo licencia MIT. El copyright original debe conservarse junto con el permiso MIT en copias o porciones sustanciales del software heredado.

Antes de redistribución comercial deberá completarse un `THIRD_PARTY_PROVENANCE_AUDIT` del catálogo y producirse `THIRD_PARTY_NOTICES.md`.

## 3. Principio de independencia

ARHIAX Harness no dependerá operativamente de:

- `@ericrisco/rsc@latest`;
- actualizaciones automáticas desde `ericrisco/rsc-harness`;
- releases, documentación o activos remotos del upstream para operar;
- decisiones futuras del upstream.

El upstream podrá estudiarse manualmente. Ningún cambio upstream entra automáticamente a ARHIAX.

## 4. Mecanismo RSC heredado

RSC distingue la versión del CLI de la versión materializada dentro del proyecto. Skills, hooks y otros artefactos se instalan localmente y `.rsc/.version` registra la versión utilizada.

El mecanismo de actualización original usa `@ericrisco/rsc@latest` y `rsc sync`. ARHIAX sustituirá ese canal por una distribución propia.

## 5. Capacidades que se preservan inicialmente

### Distribución e instalación
- CLI por proyecto.
- onboarding.
- detección de proyecto.
- instalación idempotente.
- manifest y estado local.
- backup, repair, sync, doctor, uninstall y purge.

### Multi-target
Se preserva el patrón de adaptadores para asistentes. El proveedor o modelo es reemplazable y no constituye autoridad.

### Skills
Se conserva `skills/<id>/` como patrón de fuente única de una capacidad y la instalación selectiva por proyecto.

### Routing y contexto
Se conservan selección de skills, routing audit, catálogo progresivo y carga selectiva de contexto.

### Workflow
Se preservan inicialmente Answer, FTD, SDD, worktrees, verify, review, ship, debug y parallel, subordinados a ARHIAX Governance.

### Observabilidad
Se conserva el principio de doctor, drift checks, routing audit, manifest validation, knowledge doctor, repair y version diagnostics.

## 6. Lo que RSC no autoriza

Ninguna skill, prompt, clasificación, workflow, memoria, recomendación o decisión de un agente adquiere autoridad ARHIAX por provenir de RSC.

## 7. Sustituciones obligatorias

Se sustituirán progresivamente:

- branding `rsc`;
- package ownership `@ericrisco/rsc`;
- update authority upstream;
- supuestos de autoría específicos de Eric;
- URLs operativas del upstream;
- update notifications y comandos que dependan del paquete original.

## 8. Frontera de propiedad intelectual

### Zona A — HEREDADA
Código RSC existente en este snapshot. Conserva sus obligaciones MIT.

### Zona B — DERIVADA
Código RSC modificado para ARHIAX. Conserva las obligaciones aplicables sobre el material heredado.

### Zona C — ARHIAX ORIGINAL
Incluye, entre otros: Governance Core, Governance DNA, Corpus Genesis, Corpus Blueprint Engine, Canonical Registry, Authority Engine, Governed Objective, Objective Compiler, Execution Contract, Evidence Runtime, Evidence Graph, Governance Profiles, Project Genome, Ratification Engine y extensiones ARHIAX Doctor.

## 9. Gate previo a redistribución

`THIRD_PARTY_PROVENANCE_AUDIT` es obligatorio antes de una distribución comercial o pública de ARHIAX Harness.

## 10. Decisión fundacional

RSC 3.0.10 / commit `d36527d3c6c7699627eb58a100de6d94e20cd0dc` se adopta como **FOUNDATION SNAPSHOT CANDIDATE**.

Se adopta su maquinaria como punto de partida técnico. No se adoptan su autoridad, identidad, roadmap ni actualizaciones futuras.

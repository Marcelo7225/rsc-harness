# ARHIAX Corpus Genesis v0.1

**ID:** `ARH-CORPUS-GENESIS-001`  
**Estado:** FOUNDATION DESIGN BASELINE CANDIDATE

## Propósito

Convertir una intención humana y cualquier evidencia disponible —incluida ninguna— en un primer sistema de conocimiento gobernado, sin permitir que un agente invente autoridad.

## 1. Genesis no requiere documento previo

ARHIAX debe admitir al menos cuatro modos de arranque:

1. **Zero Start:** solo existe una idea o pregunta humana.
2. **Brief Start:** existe una conversación, nota o brief corto.
3. **Source Start:** existen uno o varios documentos o archivos.
4. **Existing System Start:** existe un repo, código, documentación, datos o una combinación.

## 2. Entrada general

`GenesisInput = HumanIntent + AvailableSources + ExistingSystemState + InitialAuthority`

Solo `HumanIntent` e `InitialAuthority` son obligatorios.

`AvailableSources` puede estar vacío.

## 3. Human Intent

Debe capturar lo mínimo necesario para entender:

- qué se quiere construir o resolver;
- para quién;
- qué resultado se desea;
- qué límites conocidos existen.

No se exige que el usuario conozca arquitectura, stacks, artefactos o metodología.

## 4. Initial Authority

Debe existir una autoridad inicial explícita capaz de ratificar el primer baseline.

La autoridad inicial no nace del corpus. El corpus nace de una autoridad inicial explícita.

## 5. Genesis Interview Engine

Cuando falte información, el sistema usa una entrevista adaptativa. No debe imponer un formulario fijo extenso.

Pregunta solo lo necesario para desbloquear el siguiente nivel de decisión.

La entrevista clasifica cada elemento como:

- `KNOWN`
- `UNKNOWN`
- `ASSUMPTION`
- `PROPOSAL`
- `DECISION_REQUIRED`
- `CONFLICT`

El sistema no rellena silenciosamente vacíos.

## 6. Pipeline

`INTENT`
→ `INTERVIEW`
→ `DISCOVERY`
→ `INGEST`
→ `CLASSIFY`
→ `DECOMPOSE`
→ `EXTRACT`
→ `BUILD BLUEPRINT`
→ `BUILD ARTIFACT GRAPH`
→ `IDENTIFY GAPS`
→ `IDENTIFY UNKNOWNS`
→ `IDENTIFY CONFLICTS`
→ `GENERATE DRAFTS`
→ `PREPARE RATIFICATION`
→ `ACTIVATE BASELINE`

Discovery e ingest se adaptan al modo de arranque. En Zero Start pueden comenzar sin fuentes externas.

## 7. Qué puede crear Genesis

Genesis puede crear:

- estructura;
- propuestas;
- requisitos candidatos;
- controles candidatos;
- decisiones candidatas;
- arquitectura candidata;
- registries candidatos;
- planes de investigación;
- preguntas de ratificación.

Genesis no puede por sí solo convertirlos en canon.

## 8. Estados mínimos

- `DISCOVERED`
- `DRAFT`
- `PROPOSED`
- `PENDING_RATIFICATION`
- `ACTIVE`
- `SUPERSEDED`
- `RETIRED`
- `BLOCKED`

## 9. Resultado mínimo

Genesis debe producir:

- Project Genome;
- Governance Profile;
- Corpus Blueprint;
- Source Registry;
- Artifact Registry;
- Objective Registry;
- Decision Registry;
- Unknown Registry;
- Conflict Registry;
- Ratification Packet.

## 10. Bootstrap

Antes del primer baseline, la IA puede proponer pero no auto-ratificar.

Después de activar el primer baseline, el corpus gobierna su propia evolución bajo ARHIAX Governance.

# Implementation Plan: Sketch Stability And Plane Selection

**Branch**: `001-sketch-stability` | **Date**: 2026-04-09 | **Spec**: [/app/specs/001-sketch-stability/spec.md](/app/specs/001-sketch-stability/spec.md)
**Input**: Feature specification from `/app/specs/001-sketch-stability/spec.md`

**Note**: This plan was generated with `SPECIFY_FEATURE=001-sketch-stability` because the repository is currently on detached `HEAD`.

## Summary

Stabilize sketch authoring by making construction planes actually selectable from the viewport and by carrying an explicit sketch-plane definition through session open, pointer projection, preview rendering, and commit generation. Verification will combine contract tests with browser checks driven by `playwright-cli`, including a dedicated Playwright regression test for sketch plane selection and preview stability.

## Technical Context

**Language/Version**: TypeScript strict mode on React 19  
**Primary Dependencies**: React 19, Vite 8, Bun, Three.js, Radix UI, Tailwind CSS v4, OpenCascade.js  
**Storage**: In-memory document snapshot state via modeling service adapters  
**Testing**: `bun x vite-node` contract/spec tests plus a Playwright regression test and interactive browser verification with `playwright-cli`  
**Target Platform**: Modern evergreen browsers  
**Project Type**: Single-project frontend web application  
**Performance Goals**: Maintain interactive viewport behavior during sketch selection and drawing at normal workbench frame rates  
**Constraints**: Keep contract-first boundaries intact, avoid presentation-layer geometry inference, and preserve typed editor event flows  
**Scale/Scope**: Stabilize sketch start and primary-plane drawing flows across the current toolbar, feature tree, editor state machine, and viewport

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Contract-First Domain Modeling**: Pass. The plan adds or refines sketch-plane and viewport interaction contracts before implementation details.
- **Strict Layer Separation**: Pass. Plane-selection and sketch-projection logic stay in contracts/domain/render helpers, not in presentational layout components.
- **Kernel Portability**: Pass. Viewport picking continues to consume renderer-neutral snapshot exports rather than kernel-specific scene code.
- **Typed Event Dispatch**: Pass. Existing editor events remain the entry point for sketch activation, selection, pointer movement, and commit.
- **Durable Identity and Explicit References**: Pass. Datum plane selection remains bound to structured `construction` durable refs.
- **Minimal React Side Effects**: Pass. Fixes stay focused on explicit event flow and deterministic render helpers.
- **Incremental CAD Behavior**: Pass. The fix improves typed interaction scaffolding without expanding beyond current UI-plus-contract scope.
- **No Automated Git Operations**: Pass. No automated git commands are part of this plan.

## Project Structure

### Documentation (this feature)

```text
specs/001-sketch-stability/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── sketch-interaction-contract.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── app/
│   └── cad-workbench.tsx
├── components/
│   ├── cad/
│   │   └── three-cad-viewport.tsx
│   └── layout/
│       └── feature-sidebar.tsx
├── contracts/
│   ├── editor/
│   │   ├── state-machine.ts
│   │   └── state-machine.spec.ts
│   ├── modeling/
│   │   └── schema.ts
│   └── shared/
│       └── sketch-plane.ts
├── domain/
│   ├── editor/
│   │   ├── sketch-session-controller.ts
│   │   └── sketch-session.ts
│   ├── modeling/
│   │   ├── mock-kernel-adapter.ts
│   │   └── occ/
│   │       ├── planes.ts
│   │       ├── snapshot.ts
│   │       └── snapshot.spec.ts
│   └── workspace/
│       ├── render-picking.ts
│       └── scene-factory.ts
└── hooks/
    └── editor-provider.tsx
```

**Structure Decision**: Keep the existing single-project frontend layout. Contract changes live in `src/contracts/`, editor session and projection logic live in `src/domain/editor/`, viewport picking stays in `src/components/cad/` plus `src/domain/workspace/`, and snapshot/render export updates stay in `src/domain/modeling/`.

## Phase 0: Outline & Research

Research is complete in [/app/specs/001-sketch-stability/research.md](/app/specs/001-sketch-stability/research.md). The major decisions are:

- construction planes need filled render surfaces, not just wire outlines, to be reliably selectable in the viewport
- sketch sessions need an explicit plane definition so pointer projection and preview rendering share one source of truth
- browser verification should exercise both viewport plane selection and plane-aligned sketch previews
- the implementation should add a repeatable Playwright regression test so the repaired sketch flow is covered by automation

## Phase 1: Design & Contracts

Design artifacts are captured in:

- [/app/specs/001-sketch-stability/data-model.md](/app/specs/001-sketch-stability/data-model.md)
- [/app/specs/001-sketch-stability/contracts/sketch-interaction-contract.md](/app/specs/001-sketch-stability/contracts/sketch-interaction-contract.md)
- [/app/specs/001-sketch-stability/quickstart.md](/app/specs/001-sketch-stability/quickstart.md)

Planned contract and implementation updates:

- extend sketch-session state to carry the active `SketchPlaneDefinition`
- update sketch display and pointer projection helpers to use explicit plane transforms rather than `planeKey`-only branching
- enrich construction render exports so origin planes are easy to pick from the viewport
- align snapshot/runtime tests with the new construction-plane render and sketch-plane session behavior
- add a Playwright regression test that asserts plane selection opens the correct sketch session and keeps preview behavior stable on non-XY planes
- verify the repaired flows with `playwright-cli` against the running browser app

## Post-Design Constitution Check

- **Contract-First Domain Modeling**: Pass after design. `SketchPlaneDefinition` remains the shared contract that drives authoring and rendering behavior.
- **Strict Layer Separation**: Pass after design. No presentational component becomes responsible for CAD plane math or contract mutation.
- **Kernel Portability**: Pass after design. Filled construction renderables are still exported through renderer-neutral records.
- **Typed Event Dispatch**: Pass after design. No ad hoc selection or sketch events are introduced.
- **Durable Identity and Explicit References**: Pass after design. Plane selection remains keyed by durable `constructionId`.
- **Minimal React Side Effects**: Pass after design. The viewport reads explicit session state and applies deterministic projection helpers.
- **Incremental CAD Behavior**: Pass after design. This remains a stabilization step for existing UI and typed domain scaffolding.
- **No Automated Git Operations**: Pass after design.

## Complexity Tracking

No constitution violations require justification.

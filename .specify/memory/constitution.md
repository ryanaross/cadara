<!--
Sync Impact Report
==================
Version change: N/A → 1.1.0 (initial ratification + minor: two new principles added)
Modified principles: N/A (new constitution)
Added sections:
  - Core Principles (7 principles)
  - Technology Constraints
  - Development Workflow
  - Governance
Removed sections: N/A
Templates requiring updates:
  ✅ .specify/templates/plan-template.md — no changes needed (generic Constitution Check section)
  ✅ .specify/templates/spec-template.md — no changes needed (generic requirements structure)
  ✅ .specify/templates/tasks-template.md — no changes needed (generic task categories)
Follow-up TODOs: None
-->

# CADvisor Constitution

## Core Principles

### I. Contract-First Domain Modeling

All CAD domain logic MUST be defined through typed contracts before implementation. Contracts live in `src/contracts/` and specify schemas, adapter interfaces, and event protocols. Implementations in `src/domain/` fulfill these contracts; they MUST NOT define new public shapes or widen interfaces without a corresponding contract change.

Rationale: CAD systems carry deep coupling between geometric kernels, sketch solvers, and the feature tree. A contract layer prevents implementation details from leaking across subsystem boundaries and makes kernel swaps (e.g., mock → OpenCascade) safe.

### II. Strict Layer Separation

The codebase enforces three layers with unidirectional dependencies:

- **Presentation** (`src/components/`, `src/hooks/`): React UI, user interactions, event dispatch.
- **Domain** (`src/domain/`, `src/contracts/`): Business logic, tool definitions, feature tree, kernel adapters.
- **Rendering** (`src/components/cad/`, Three.js): Scene graph, camera, viewport interaction.

Presentation MAY depend on Domain. Rendering MAY depend on Domain. Presentation MUST NOT import Rendering internals directly (go through Domain abstractions). Domain MUST NOT import from Presentation or Rendering.

The editor, solver, and kernel MUST remain separate systems. The editor owns tools, interaction state, and command phases. The solver owns constraint solving and diagnostics. The kernel owns durable document state, topology, and regeneration. No single monolithic interface MAY absorb cross-boundary concerns.

Rationale: Mixing scene logic, solver semantics, or kernel contracts into presentational components creates tightly coupled, untestable code. This separation enables independent testing of CAD logic without a browser, and UI work without a 3D context.

### III. Kernel Portability

All geometric operations MUST be accessed through adapter interfaces defined in `src/contracts/modeling/`. Concrete kernel implementations (mock, OpenCascade/WASM, future native) are swappable dependencies injected at the domain layer. No component outside `src/domain/modeling/` MAY reference a specific kernel directly.

Rationale: OpenCascade.js provides WASM-based CAD but may be replaced or supplemented. The adapter pattern ensures the rest of the application is kernel-agnostic.

### IV. Typed Event Dispatch

All tool and mode actions MUST flow through the `ToolActionBus` with strongly typed payloads defined alongside tool definitions in `src/domain/tools/`. Ad-hoc event strings or untyped `dispatch` calls are prohibited. Every event MUST have a corresponding TypeScript type.

Editor state transitions MUST be explicit, event-driven, and guard-gated. Transitions MUST NOT be inferred from `useEffect` chains that observe ambient state. Every side-effect request (async solver/kernel call) MUST use explicit request IDs, correlated result events, and deterministic stale-response handling.

Rationale: CAD workflows are event-heavy (tool selection, mode transitions, feature tree mutations). Untyped events silently break workflows and make debugging costly.

### V. Durable Identity and Explicit References

Every durable reference MUST be a typed, structured record (e.g., `{ kind: 'face', bodyId, faceId }`). No contract MAY rely on array position, row order, string parsing, or positional labels ("first face", "second edge") as primary meaning for durable targets.

When topology changes destroy a durable target, the kernel or solver MUST report invalidation explicitly through structured diagnostic payloads. Silent remapping to "closest surviving geometry" is forbidden.

Rationale: Implicit identity conventions create fragile coupling between the UI, kernel, and solver. Typed durable references make selection, feature editing, and reference resolution deterministic across rebuilds.

### VI. Minimal React Side Effects

`useEffect` MUST be used only when there is no reasonable alternative. Prefer driving behavior through:

- explicit event dispatch (commands and domain events)
- derived state from props and context
- pure reducer/state-machine transitions
- synchronous initialization during component render

`useEffect` is acceptable for:
- subscribing to external event sources (e.g., browser ResizeObserver, WebAssembly init callbacks)
- imperative DOM operations that cannot be expressed declaratively

`useEffect` MUST NOT be used for:
- inferring domain state transitions from ambient React state
- triggering CAD kernel or solver calls based on prop observation
- synchronizing state between components that should communicate through shared domain state

Rationale: Effect-driven inference chains are the primary source of hidden coupling and nondeterministic behavior in React CAD applications. Explicit event flows are traceable, testable, and debuggable.

### VII. Incremental CAD Behavior

CAD operations are introduced incrementally: UI scaffolding first, typed event dispatch next, then contract definitions, and finally kernel-backed execution. Each layer MUST be independently demonstrable. A tool action that only logs to the console is acceptable so long as its event type and contract slot exist.

Mock implementations of solver and kernel adapters MUST be spec-faithful: they MUST obey revision correlation, reject invalid requests, and emit realistic diagnostics. Mocks that accept anything validate nothing and MUST NOT be used.

Rationale: A CAD application is too large to build top-down. Incremental delivery ensures the UI remains responsive and testable while geometric capabilities are phased in.

### VIII. No Automated Git Operations

Agents and tooling MUST NOT perform any automated Git operations including commit, push, pull, squash, rebase, branch creation, or stash. All Git operations are the explicit responsibility of the developer.

Rationale: Prevents unintended commits, branch pollution, and history manipulation by automated tooling operating without full context.

## Technology Constraints

- Runtime and package management: Bun (MUST use Bun scripts, not npm/yarn)
- Language: TypeScript strict mode; no `any` types in contracts or domain code
- UI framework: React 19 with function components and hooks only
- 3D rendering: Three.js for viewport; all scene helpers encapsulated in `src/components/cad/`
- Styling: Tailwind CSS v4 with project CSS variables; no inline styles
- Build tooling: Vite on port 3000
- Geometric kernel: OpenCascade.js (WASM); accessed exclusively through kernel adapter
- Browser target: Modern evergreen browsers; no IE or legacy support

## Development Workflow

- All features begin with a Spec Kit workflow: specify → clarify → plan → tasks → implement
- Contract types and schemas are authored before implementation code
- Test files for contracts use `.spec.ts` suffix and run via `bun x vite-node`
- Each tool or feature addition MUST include the corresponding domain definition in `src/domain/tools/`
- Feature branches follow the naming convention `###-feature-name` per Spec Kit Git extension
- Review standards enforce contract fidelity, strict typing, and architecture alignment (see ADAPTER.md and .codex/adapter-reviewer.md)

## Governance

This constitution is the authoritative source for architectural decisions in this project. It supersedes undocumented conventions. When guidance docs (ADAPTER.md, INTERFACE.md, OCC.md, docs/adapter-protocol-overview.md) provide more specific implementation direction on a topic already covered by a principle, those docs expand but MUST NOT contradict the principle.

- **Amendments**: Any change to principles, constraints, or workflow rules MUST be documented in this file with a version bump.
- **Versioning**: Semantic versioning (MAJOR.MINOR.PATCH)
  - MAJOR: Principle removal, redefinition, or backward-incompatible governance change
  - MINOR: New principle, new constraint, or materially expanded guidance
  - PATCH: Clarifications, wording fixes, non-semantic refinements
- **Compliance**: All pull requests and feature specs MUST be checked against the current constitution. Violations MUST be explicitly justified in the spec or PR description.
- **Review**: The AGENTS.md file at the repository root provides runtime development guidance and MUST stay consistent with this constitution. Phase reviews per ADAPTER.md MUST verify constitutional compliance as part of each gate.

**Version**: 1.1.0 | **Ratified**: 2026-04-09 | **Last Amended**: 2026-04-09

# Adapter Plan

This document defines the implementation plan required to reach a state where:

- the editor state machine is deterministic, strongly typed, and free of random side-effects
- the 2D solver boundary is explicit enough for a solver implementer to build against blindly
- the CAD kernel boundary is explicit enough for a kernel implementer to build against blindly
- the rest of the application is ready to integrate a real kernel and solver without reshaping the UI

This document is intentionally strict.

The acceptance bar is:

- An OCC or similar CAD kernel expert can implement the kernel adapter from the exposed interfaces alone.
- A sketch solver expert can implement the 2D solver from the exposed interfaces alone.
- No interface relies on implied behavior, incidental array order, or UI-specific conventions.
- Every request and response type is strongly typed, commented, versioned, and explicit about ownership, lifetime, and failure modes.

## Primary References

This plan is aligned with the practical capabilities and expectations exposed by mature B-rep systems and browser CAD runtimes, especially:

- Open CASCADE Technology documentation and user guides around topology, geometry, naming/selection, shape healing, and meshing
- `truck` / `truck-js` concepts around topological shape ownership, edges/faces/solids, tessellation, and selection-capable render exports

The goal is not to copy either API.

The goal is to expose the minimum boring interface that a kernel backed by OCC, `truck`, or equivalent can implement directly and confidently.

## Non-Negotiable Design Rules

### 1. The editor, solver, and kernel must be separate systems

There must be three distinct boundaries:

- Editor interaction system
- Sketch solving system
- Modeling kernel system

The editor owns:

- tools
- interaction state
- command state
- pointer handling
- local previews
- staging of command inputs
- presentation-only validation

The sketch solver owns:

- sketch graph solving
- geometric constraints
- dimensions
- under/fully/over constrained status
- solved positions and parameter updates
- solver diagnostics

The CAD kernel owns:

- durable document state
- feature graph
- topology
- body/face/edge/vertex ownership
- regeneration
- reference resolution
- invalidation reporting
- feature preview evaluation
- tessellated export metadata

### 2. No giant catch-all interface

Do not create a single `CADKernel` or `GeometryEngine` interface that absorbs:

- document queries
- sketch solving
- feature authoring
- reference resolution
- rendering export
- selection utilities
- UI workflows

Instead define narrow contract families with comments and versioning.

### 3. Every durable reference must be typed

No contract may rely on:

- indices
- string parsing as primary meaning
- “the first loop”
- “the second face”
- “selected item 0”

Every durable target must be a typed reference record.

### 4. Every state transition must be event-driven and explicit

Editor transitions must not happen from random `useEffect` chains that infer intent from ambient state.

The editor must move through explicit:

- commands
- events
- guards
- transitions
- side-effect requests
- side-effect results

### 5. Side-effects must be isolated from pure transitions

Reducer/state machine logic must be pure.

Async calls to solver/kernel must be modeled as:

- emitted effect requests
- request IDs
- correlated result events
- explicit stale-response handling

No mutation may depend on “current closure state happened to still match.”

### 6. Contracts must be versioned and commented from the start

At minimum:

- protocol version
- snapshot schema version
- feature schema version
- sketch schema version
- render export schema version

Every exported type must carry doc comments explaining:

- what the field means
- who owns it
- whether it is durable or transient
- whether it is required
- allowed failure modes
- invariants implementers must preserve

## Target End State

At the end of this plan, the application should have:

1. A typed editor state machine package.
2. A typed sketch domain package.
3. A typed solver contract package.
4. A typed modeling contract package.
5. A typed render export contract package.
6. A typed adapter layer that converts between editor intents and solver/kernel requests.
7. Mock implementations that obey the real contracts exactly.
8. Tests that prove the contracts are deterministic and unambiguous.

The UI should only depend on:

- editor view state
- editor commands
- editor events
- view models derived from snapshots

The UI must not depend on:

- kernel implementation details
- solver implementation details
- topology traversal logic
- implicit geometric conventions

## What Is Wrong Today

The current code already has a useful split between UI and modeling service, but it is not yet sufficient.

Current gaps:

- sketch persistence is not a real solver contract
- constraints and dimensions do not exist in the interface
- features are represented as generic bags instead of typed operations
- preview contracts are under-specified
- render export is too mock-renderer-shaped
- some transitions are inferred by `useEffect` rather than driven by explicit domain events
- the kernel-facing boundary still uses runtime-normalized `unknown` in a place that should be statically authoritative

## Required Contract Packages

The repository should be reorganized around explicit contract packages.

Suggested package layout:

- `src/contracts/editor/`
- `src/contracts/sketch/`
- `src/contracts/solver/`
- `src/contracts/modeling/`
- `src/contracts/render/`
- `src/contracts/shared/`

These should be framework-independent TypeScript modules with no React imports.

## Canonical Shared Vocabulary

Phase 0 is to freeze the canonical nouns.

Required durable IDs:

- `DocumentId`
- `RevisionId`
- `FeatureId`
- `FeatureInstanceId`
- `SketchId`
- `BodyId`
- `FaceId`
- `EdgeId`
- `VertexId`
- `LoopId`
- `CoedgeId` if exposed
- `SketchEntityId`
- `SketchPointId`
- `ConstraintId`
- `DimensionId`
- `ReferenceId`
- `PreviewId`
- `RequestId`
- `CommandSessionId`

Required typed references:

- `BodyRef`
- `FaceRef`
- `EdgeRef`
- `VertexRef`
- `SketchRef`
- `SketchEntityRef`
- `SketchPointRef`
- `FeatureRef`
- `ConstructionRef`
- `RegionRef` for solver/kernel-derived sketch regions or profiles

Important rule:

- A `RegionRef` must be kernel/solver-derived, never authored directly by the editor.

## Identity Policy

This must be written down in code comments and docs.

### Durable identity guarantees

- Document, feature, sketch, body, face, edge, vertex, sketch entity, constraint, dimension, and region IDs are durable within the documented limits of the backend.
- Non-topology-changing edits preserve unaffected IDs.
- Topology-changing edits preserve unaffected IDs whenever the backend can guarantee it.
- Destroyed or replaced references are reported explicitly as invalidated.

### Invalidity rules

- No silent remapping to “closest surviving primitive”
- No fallback from one face to another face
- No fallback from one sketch entity to another entity
- Invalid references must return machine-readable invalidation reasons

### Ownership rules

Each reference must be resolvable to:

- owner document
- owner revision
- owning feature if any
- owning sketch if any
- owning body if any

## Editor State Machine Requirements

The editor state machine is a first-class subsystem.

### State machine shape

The editor must expose a discriminated union, not a loose bag of nullable fields.

Suggested top-level shape:

```ts
type EditorState =
  | { kind: 'idle'; ... }
  | { kind: 'commandArmed'; command: ActiveCommandState; ... }
  | { kind: 'collectingSelections'; command: SelectionCommandState; ... }
  | { kind: 'editingSketch'; session: SketchEditorSessionState; ... }
  | { kind: 'editingFeature'; session: FeatureEditorSessionState; ... }
  | { kind: 'awaitingEffect'; pending: PendingEffectState; returnState: EditorStableState }
```

The exact names may differ, but the result must be:

- exhaustive
- discriminated
- impossible to represent contradictory state combinations

Examples of contradictions that must be impossible at the type level:

- sketch mode with no sketch session and an active sketch draw tool
- feature editing with no feature schema
- preview ready for a feature that has no pending preview request
- selection collection phase for a command that does not accept selection

### Event model

All state transitions must be driven by typed domain events.

Required event families:

- tool activation events
- viewport pointer events
- viewport pick events
- form edit events
- command lifecycle events
- effect result events
- effect failure events
- snapshot refresh events
- reference invalidation events

Example event shape:

```ts
type EditorEvent =
  | { type: 'tool.activated'; toolId: ToolId }
  | { type: 'viewport.pickSucceeded'; target: SelectableRef; worldPoint: WorldPoint3 }
  | { type: 'viewport.pickMissed' }
  | { type: 'sketch.pointerMoved'; point: SketchPlanePoint }
  | { type: 'command.cancelled'; commandSessionId: CommandSessionId }
  | { type: 'effect.previewCompleted'; requestId: RequestId; result: FeaturePreviewResult }
  | { type: 'effect.previewFailed'; requestId: RequestId; error: EffectError }
```

### Effect isolation

The state machine must emit side-effect requests rather than performing side-effects.

Suggested pattern:

```ts
interface TransitionResult<S, E> {
  state: S
  effects: E[]
}
```

Effects should include:

- fetch snapshot
- resolve reference
- solve sketch
- preview feature
- commit sketch
- create feature
- update feature
- delete feature

### Correlation rules

Every effect request must include:

- `requestId`
- base `documentId`
- base `revisionId` if relevant
- originating `commandSessionId` if relevant

Every result event must echo:

- `requestId`
- `documentId`
- `revisionId`
- stale/freshness info when relevant

### Transition acceptance criteria

- Reducers are pure.
- All transitions are exhaustively checked.
- No `useEffect` infers domain transitions from ambient React state.
- Async responses are ignored unless their `requestId` and base revision are still valid.
- The editor can be replayed from an event log and reach the same state.

## Sketch Domain Plan

The sketch subsystem must stop pretending that accepted drawing geometry is the same thing as solved sketch state.

### Distinguish three sketch representations

There must be three separate representations:

1. `SketchEditorDraft`
   - editor-local
   - transient
   - includes pointer previews and uncommitted handles

2. `SketchDefinition`
   - durable authoring payload
   - contains entities, constraints, dimensions, references, metadata
   - consumed by the solver and persisted by the kernel

3. `SolvedSketchSnapshot`
   - returned by solver/kernel
   - includes solved geometry, status, regions, diagnostics, and explicit mappings

The editor may own `SketchEditorDraft`.

The solver must own `SolvedSketchSnapshot`.

### Required sketch entities

At minimum:

- point
- line segment
- circle
- arc
- construction variants where applicable

Each entity must have:

- `entityId`
- `kind`
- authoring parameters
- construction flag
- style/visibility metadata only if clearly separated from solving semantics

### Required sketch references

The sketch contract must support references to:

- sketch-local entities
- sketch-local points
- external construction planes
- external model references projected into sketch context

These references must be explicit and typed.

### Constraints and dimensions

The solver contract must include first-class:

- coincidence
- horizontal
- vertical
- parallel
- perpendicular
- tangent
- concentric
- equal
- midpoint
- fixed
- distance dimension
- angle dimension
- radius/diameter dimension

Each constraint/dimension must define:

- ID
- kind
- target refs
- parameters
- driving vs driven behavior if applicable

### Regions and profiles

Closed profiles and regions must not be authored directly by the editor.

Instead:

- editor submits sketch definition
- solver/kernel returns detected regions
- feature commands consume `RegionRef` or equivalent derived references

This aligns with what a real kernel-backed feature authoring flow needs.

### Sketch solve statuses

Every solved sketch must include machine-readable status:

- unsolved
- solved
- underConstrained
- fullyConstrained
- overConstrained
- inconsistent
- partiallySolved

Per-entity and per-constraint diagnostics must also be supported.

## Solver Contract Plan

Introduce a dedicated `SketchSolverAdapter`.

Suggested contract families:

- `solveSketch`
- `validateSketch`
- `deriveSketchRegions`
- `projectExternalReferences`
- `resolveSketchReference`

### Required solver requests

`SolveSketchRequest` must include:

- protocol version
- document ID
- revision ID or sketch edit base revision
- sketch ID
- sketch plane/reference frame
- sketch definition
- external references resolved into solver coordinates
- optional incremental edit description

### Required solver responses

`SolveSketchResponse` must include:

- request ID
- sketch ID
- solve status
- solved entity geometry
- solved point coordinates
- constraint statuses
- dimension statuses
- derived regions
- diagnostics

### Solver implementation notes

A solver expert should be able to see:

- exact coordinate system conventions
- unit conventions
- tolerance conventions
- which fields are input guesses vs authoritative solved outputs
- whether partial solve is allowed
- how failed constraints are reported

## Kernel Contract Plan

Introduce a dedicated `ModelingKernelAdapter` that is fully typed at the interface boundary.

The kernel contract families should be:

- document queries
- feature authoring
- sketch persistence
- regeneration
- reference resolution
- preview evaluation
- render export

### Document queries

Must return a full typed `DocumentSnapshot`.

No `unknown` at the kernel-facing interface.

Runtime validation is acceptable, but the interface itself must already be explicit.

### Feature authoring

Replace generic bag requests with typed operation families.

Bad:

```ts
createFeature({
  featureType: string,
  parameterPayload: Record<string, unknown>,
  consumedTargets: PrimitiveRef[],
})
```

Good:

```ts
type CreateFeatureRequest =
  | CreateExtrudeFeatureRequest
  | CreateRevolveFeatureRequest
  | CreateFilletFeatureRequest
  | CreatePlaneFeatureRequest
```

Each feature request must define:

- exact feature kind
- exact schema version
- exact parameter types
- exact reference slots
- optional vs required fields
- expected produced entity classes

### Example extrude contract requirements

The extrude contract should state clearly:

- accepted seed types
- whether it consumes `RegionRef`, `SketchRef`, or `FaceRef`
- whether multiple regions/faces are allowed
- direction specification
- extent specification
- boolean operation
- merge/split semantics
- expected diagnostics if target is invalid or open

There must be one source of truth for the consumed profile reference.

Do not duplicate it in both `parameterPayload` and `consumedTargets`.

### Sketch persistence

The kernel should persist sketch definitions and solved sketch snapshots explicitly.

Required operations:

- create sketch
- update sketch definition
- solve sketch or request solve through solver boundary
- commit solved sketch state
- fetch sketch snapshot

Whether solving is embedded in kernel or delegated to a separate adapter is an implementation detail.

The interface must remain explicit either way.

### Regeneration and invalidation

All feature mutations must return:

- resulting revision
- accepted/conflict outcome
- changed durable refs
- invalidated refs
- rebuild diagnostics

### Reference resolution

`resolveReference` must explain:

- whether a ref is valid
- what it resolves to
- ownership path
- invalidation reason if dead

### Preview evaluation

Preview must be a first-class contract, not a UI convenience.

Required semantics:

- preview request does not mutate committed state
- request is correlated by `requestId` and `previewId`
- response indicates freshness against base revision
- response returns preview geometry plus diagnostics
- stale responses are safely discardable

## Render Export Contract Plan

The render contract must be kernel-neutral and viewer-friendly.

### Separate semantics from rendering

The render export must not define semantic meaning by render primitive kind.

For example:

- planar-face selectability must not depend on a `planarFace` render shortcut
- body/face/edge/vertex meaning must come from semantic refs

### Required render families

The kernel should export:

- mesh batches for faces
- polyline batches for edges
- point markers when needed
- semantic bindings from render primitives back to durable refs

### Required metadata

Each exported render unit must declare:

- durable target ref
- owner body
- owner feature if known
- topology class
- material/display hints if needed
- selection binding metadata

If triangle-level or submesh-level selection is supported, the contract must say exactly how that mapping works.

This should be informed by real kernel export expectations such as:

- tessellated faces
- polyline edge approximations
- shape/face/edge ownership tracking

### Viewer acceptance criteria

- A pick hit can be converted to a typed durable ref with no guessing.
- A selected durable ref can be highlighted with no topology traversal in UI code.
- A kernel implementer can return arbitrary tessellation without changing viewer semantics.

## Commenting Standard for Interfaces

Every exported contract type must use TSDoc comments.

Mandatory comment coverage:

- all public interfaces
- all union variants
- all request fields
- all response fields
- all enums/string literal unions where interpretation matters

Mandatory comment content:

- semantic meaning
- units
- coordinate frame
- ownership
- lifetime
- invariants
- failure mode

Example:

```ts
/**
 * Base document revision against which this request must be evaluated.
 * If the current committed document revision differs, the backend must not
 * silently apply the operation and must instead return a conflict result.
 */
baseRevisionId: RevisionId
```

## Testing Plan

This effort is incomplete without contract-level tests.

### Phase-specific test suites

1. Type-level tests
   - discriminated unions are exhaustive
   - impossible states are unrepresentable
   - feature requests cannot omit required fields

2. Reducer/state-machine tests
   - event traces are deterministic
   - invalid events are rejected or ignored explicitly
   - stale responses do not corrupt state

3. Contract round-trip tests
   - mock kernel and solver obey real interfaces
   - snapshots preserve durable refs
   - reference invalidation is explicit

4. Render binding tests
   - pick result round-trips to durable refs
   - highlight is driven from refs, not geometry heuristics

5. Documentation tests
   - all exported contract symbols have TSDoc
   - all request/response unions have schema version tags

## Phased Execution Plan

## Phase 0: Freeze Vocabulary and Rules

Goal:

- define the canonical nouns and identity policy once

Deliverables:

- `src/contracts/shared/ids.ts`
- `src/contracts/shared/references.ts`
- `src/contracts/shared/diagnostics.ts`
- `src/contracts/shared/versioning.ts`
- written identity/invalidation policy

Exit criteria:

- no remaining ambiguous `id: string` in durable contracts unless it is explicitly presentational
- all durable refs are typed unions

## Phase 1: Rebuild the Editor as a Typed State Machine

Goal:

- replace inference-driven transitions with explicit domain events and effects

Deliverables:

- `EditorState` discriminated union
- `EditorEvent` union
- `EditorEffect` union
- pure transition function returning `{ state, effects }`
- event replay tests

Required refactors:

- remove domain transitions from incidental React `useEffect` inference
- move command opening, sketch session opening, preview triggering, and commit triggering behind explicit events

Exit criteria:

- every state transition is traceable to an event
- every side-effect request is explicit and correlated
- impossible state combinations are eliminated

## Phase 2: Introduce a Real Sketch Definition Contract

Goal:

- separate sketch drafting from durable sketch authoring

Deliverables:

- `SketchDefinition`
- `SketchEntityDefinition`
- `ConstraintDefinition`
- `DimensionDefinition`
- `SolvedSketchSnapshot`
- `RegionRecord`

Required refactors:

- remove editor-authored region/profile invention as a durable concept
- persist rectangle as primitive entities plus optional constraints, not as a UI-authored profile hack

Exit criteria:

- solver-relevant semantics are fully represented in types
- the editor no longer manufactures durable region semantics

## Phase 3: Introduce the Solver Adapter

Goal:

- make 2D solving an explicit subsystem

Deliverables:

- `SketchSolverAdapter`
- solve/validate/project/derive-region request-response types
- mock solver that obeys the contract
- solver diagnostics mapping

Exit criteria:

- a solver implementer can identify exact inputs and outputs with no guesswork
- derived regions and solve statuses come from solver/kernel results, not editor assumptions

## Phase 4: Replace Generic Feature Bags with Typed Feature Contracts

Goal:

- make feature authoring strict and unambiguous

Deliverables:

- typed create/update/delete/reorder feature request families
- typed feature schemas for at least:
  - extrude
  - fillet
  - plane
  - revolve placeholder if planned soon

Required refactors:

- remove `featureType: string`
- remove `parameterPayload: Record<string, unknown>` from public kernel-facing contract
- remove duplicated reference meaning

Exit criteria:

- each feature’s required references and parameters are statically enforced
- comments describe exact behavior and failure modes

## Phase 5: Make the Kernel Adapter Statistically Authoritative

Goal:

- turn the kernel-facing adapter into the canonical typed contract

Deliverables:

- `ModelingKernelAdapter` with typed request/response payloads only
- optional runtime validators around those payloads
- typed `DocumentSnapshot`
- typed invalidation and rebuild result types

Required refactors:

- remove `snapshot: unknown` from the kernel-facing interface

Exit criteria:

- a kernel implementer can code against interface files directly
- no part of the public boundary depends on runtime-normalized unknown structure

## Phase 6: Redesign Render Export Around Semantic Bindings

Goal:

- support real kernel tessellation and precise selection without UI guesswork

Deliverables:

- render mesh export contract
- edge polyline export contract
- point/marker export contract
- semantic pick binding contract

Required refactors:

- stop inferring semantic classes from renderer-specific geometry shortcuts

Exit criteria:

- any kernel tessellation backend can plug in without changing editor behavior
- selection/highlight remains durable-ref-driven

## Phase 7: Document Every Public Contract

Goal:

- make the interfaces self-explanatory to external experts

Deliverables:

- TSDoc on all public contract types
- field-level comments
- protocol overview markdown
- worked examples for:
  - solve sketch
  - create extrude
  - preview extrude
  - resolve dead reference
  - export render mesh with bindings

Exit criteria:

- a kernel or solver implementer has zero unanswered semantic questions

## Phase 8: Replace Mocks With Spec-Faithful Test Doubles

Goal:

- ensure local development uses doubles that behave like the real contract

Deliverables:

- spec-faithful mock solver
- spec-faithful mock kernel
- fixture snapshots and feature results

Required rules:

- mocks must obey all revision, invalidation, and request-correlation semantics
- mocks must not “accept everything” if the real contract would reject it

Exit criteria:

- integration tests meaningfully validate the interface design

## Phase 9: Final Readiness Gate

Goal:

- prove external implementability

Deliverables:

- interface review checklist
- contract examples
- readiness review against OCC/truck-like capabilities

Final acceptance criteria:

- An OCC expert can implement body creation, feature rebuilds, topology identity, reference invalidation, and tessellation from the written kernel contracts alone.
- A solver expert can implement sketch solving, constraint resolution, and region derivation from the written solver contracts alone.
- The editor can consume all results without hidden conventions.
- No React component contains kernel/solver assumptions beyond consuming typed view models and dispatching typed events.

## Immediate Next Implementation Order

The highest-value implementation order is:

1. Freeze shared IDs, refs, diagnostics, and version types.
2. Replace the current editor reducer with a typed event/effect state machine.
3. Introduce durable sketch definition and solved sketch snapshot types.
4. Add the solver adapter contract.
5. Replace generic feature bag requests with typed feature unions.
6. Make the kernel adapter fully typed.
7. Replace render export with semantic binding-aware mesh contracts.
8. Add TSDoc and worked examples.

## Definition of Done

This effort is done only when all of the following are true:

- The public solver and kernel interfaces are strongly typed and exhaustively documented.
- The editor state machine is pure, deterministic, event-driven, and exhaustively typed.
- Preview, commit, solve, and refresh flows are correlated by typed request IDs.
- Durable references, ownership, invalidation, and revisions are explicit everywhere.
- Derived sketch regions come from solver/kernel outputs, not editor invention.
- Render export is semantic-binding-driven and kernel-neutral.
- Mock implementations are spec-faithful.
- A domain expert can implement the backend from the interface files and docs alone, with zero clarifying questions.

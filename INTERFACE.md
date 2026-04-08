# Interface Plan

This document defines the implementation plan for the frontend/editor-to-kernel boundary of this CAD application.

It is written for another agent or engineer who will implement the system incrementally.

The priority is not feature count. The priority is establishing a strict, durable interface shape early enough that later work does not force repeated contract rewrites.

## Core Position

There must not be a single giant `CADKernel` interface that absorbs all concerns.

The system must be split into three layers:

1. Editor layer
   - Owns tool activation, command phases, pointer interaction, hover, local previews, selection UX, and forms.
   - Must not depend on kernel-specific implementation details in random components.

2. Modeling service / adapter layer
   - The only frontend-facing boundary for durable modeling actions.
   - Converts editor intents into strict kernel requests.
   - Converts kernel responses into editor-readable document state, diagnostics, and renderable geometry metadata.

3. Kernel contract layer
   - Owns committed model state, topology, regeneration, feature evaluation, durable references, and diagnostics.
   - Must not own mouse interaction, toolbar semantics, or per-frame sketch drawing.

This separation is non-negotiable. If interaction code leaks into the kernel contract, the API will become unstable. If kernel semantics leak directly into the UI tree and toolbar, the UI will become polluted and rigid.

## Non-Negotiable Constraints

### 1. Primitive identity must be explicit and stable

Primitive references like "first face" are invalid for the interface.

The contract must always address CAD primitives by explicit structured IDs, for example:

- `solid0`
- `solid0.face0`
- `solid0.edge3`
- `sketch2.curve5`
- `feature4.profile1.loop0`

The kernel and the modeling adapter must never expose selection or edit APIs that rely on array order without a durable, named path.

The interface must support:

- Body IDs
- Face IDs
- Edge IDs
- Vertex IDs
- Sketch IDs
- Sketch primitive IDs
- Feature IDs
- Construction/reference IDs
- Composite paths across ownership boundaries

If topology changes and an ID cannot be preserved, the kernel must say so explicitly through diagnostics or invalid-reference reporting. Silent remapping is not acceptable.

### 2. The kernel contract must be strict and boring

The kernel contract is not the place for convenience methods tailored to current UI features.

Bad direction:

- `startRectangleDraw`
- `hoverFace`
- `openExtrudeDialog`
- `selectForFillet`

Good direction:

- `createFeature`
- `updateFeature`
- `deleteFeature`
- `evaluatePreview`
- `resolveReference`
- `getDocumentSnapshot`

### 3. Local interaction preview is an editor concern

The editor must handle:

- Realtime rectangle preview
- Live line dragging
- Cursor-following circle radius updates
- Hover highlight
- Marquee interaction
- Selection overlays

The kernel may support preview evaluation for committed modeling operations such as extrude/revolve/fillet parameter changes, but not raw pointer-move geometry drafting.

### 4. Contract evolution must be versioned

The interface shape must be versioned from the start.

At minimum:

- request/response payloads must carry a contract version
- document snapshots must carry a schema version
- feature definitions must carry a feature type version

This is needed because the whole point of this effort is to avoid casual breaking changes later.

## Target Architecture

The intended shape is:

`UI components -> editor state + command system -> modeling service -> kernel adapter -> strict kernel contract`

The components should never call the kernel directly.

The viewport should never invent its own durable data model.

The toolbar should never encode feature semantics beyond command activation.

The feature tree should never own feature parameter logic.

## Boundary Design

### Editor layer responsibilities

The editor layer owns:

- active workspace mode
- active command
- command phase/substate
- current selection set
- current selection filter
- hover target
- transient preview geometry
- command parameter draft state
- currently edited feature
- UI validation state before commit

The editor layer should operate in terms of editor-friendly types such as:

- `SelectionTarget`
- `SelectionFilter`
- `ActiveCommand`
- `CommandPreview`
- `FeatureEditSession`
- `DocumentViewModel`

### Modeling service responsibilities

This is the frontend-facing durable modeling boundary.

It should expose methods in terms of user-intent-level document changes:

- create sketch
- commit sketch entities
- create feature
- update feature parameters
- delete/suppress/reorder feature
- request preview evaluation
- fetch document snapshot
- resolve references

This layer must:

- validate request completeness before calling the kernel
- normalize kernel responses into stable editor-side shapes
- map kernel diagnostics into UI diagnostics
- protect the rest of the app from kernel-specific semantics

### Kernel contract responsibilities

The kernel contract should own:

- document creation/open/save-level state
- feature graph
- sketch persistence
- durable reference resolution
- topology ownership
- rebuild/regeneration
- preview evaluation for parametric features
- tessellated/renderable geometry generation
- diagnostics and invalid reference reporting

It should not own:

- pointer interaction
- toolbars
- command modes
- hover state
- per-frame sketch drag preview
- form rendering

## Required Contract Families

The kernel contract should be split into narrow service families, whether or not they are implemented as separate interfaces internally.

The important part is the shape, not the exact file layout.

### 1. Document queries

Purpose:

- get a stable snapshot of committed model state
- read feature tree, bodies, sketches, references, and render metadata

Required outputs:

- document ID
- revision number
- feature graph summary
- object tree summary
- reference inventory
- diagnostics
- renderable entity records

Validation:

- fetching the same unchanged document twice returns the same stable IDs
- snapshot objects must include explicit typed IDs, never positional-only references

### 2. Feature operations

Purpose:

- create, edit, suppress, unsuppress, delete, and reorder features

Required inputs:

- document ID
- base revision
- feature type
- parameter payload
- explicit references to consumed primitives

Required outputs:

- new document revision
- created/updated feature ID
- changed entity IDs
- diagnostics

Validation:

- editing one feature must not renumber unrelated durable IDs without explicit invalidation reporting
- rejected operations must return machine-readable diagnostics

### 3. Sketch operations

Purpose:

- persist sketch entities and constraints after local editor interaction is accepted

Required inputs:

- sketch ID
- sketch plane/reference ID
- explicit sketch primitive IDs
- curves/points/constraints dimensions payload

Important:

The editor owns live preview during drawing. The kernel only receives accepted sketch state or accepted sketch deltas.

Validation:

- repeated load/save cycles preserve sketch primitive IDs
- constraints reference explicit sketch primitive IDs, not array positions

### 4. Reference resolution

Purpose:

- turn durable IDs into semantic records
- report invalid, stale, or orphaned references

Required behavior:

- resolve body/face/edge/vertex/sketch/feature IDs
- explain ownership path
- report invalidation reason when a reference is no longer resolvable

Validation:

- an edit that destroys a face referenced by another feature must produce explicit invalid-reference diagnostics
- no hidden fallback to "closest surviving face"

### 5. Preview evaluation

Purpose:

- evaluate temporary parametric feature results without committing them

Examples:

- extrude distance preview
- fillet radius preview
- shell thickness preview

This is not for raw sketch dragging.

Required behavior:

- cancellable requests
- request correlation IDs
- responses tied to base document revision
- preview geometry and diagnostics

Validation:

- stale preview responses must be safely discardable by revision/request ID
- preview must not mutate committed document state

### 6. Render geometry export

Purpose:

- provide renderable geometry and mappings back to durable IDs

Required behavior:

- every renderable primitive must map back to a durable semantic ID
- tessellation output must preserve enough metadata for selection/highlight

Validation:

- clicking a triangle in the viewport can be traced back to a typed primitive like `solid0.face3`
- highlight and selection can round-trip from render mesh to durable ID and back

## ID Design Requirements

This is the most important part of the contract.

### Rules

1. IDs must be typed.
2. IDs must be explicit.
3. IDs must be stable across non-destructive updates whenever possible.
4. IDs must encode ownership or be resolvable to ownership.
5. IDs must never rely on incidental presentation order.

### Minimum ID families

- `DocumentId`
- `RevisionId`
- `FeatureId`
- `SketchId`
- `BodyId`
- `FaceId`
- `EdgeId`
- `VertexId`
- `SketchPrimitiveId`
- `ConstraintId`
- `DimensionId`
- `ReferenceId`
- `PreviewId`

### Recommended structure

Use structured IDs or structured ID records, not opaque display strings leaking everywhere.

The application may render human-readable forms like `solid0.face2`, but internally the contract should preserve typed fields, for example:

```ts
type PrimitiveRef =
  | { kind: 'body'; bodyId: BodyId }
  | { kind: 'face'; bodyId: BodyId; faceId: FaceId }
  | { kind: 'edge'; bodyId: BodyId; edgeId: EdgeId }
  | { kind: 'vertex'; bodyId: BodyId; vertexId: VertexId }
  | { kind: 'sketchCurve'; sketchId: SketchId; primitiveId: SketchPrimitiveId }
```

This avoids string parsing as the core protocol mechanism.

### Stability policy

The kernel contract must document exactly when IDs are preserved and when they are invalidated.

At minimum:

- parameter edits that do not change topology should preserve IDs
- topology-changing edits should preserve unaffected IDs
- destroyed primitives must be reported as invalid, not silently rebound

If the kernel cannot guarantee identity preservation for a class of operations, that limitation must be documented immediately, not discovered later by UI breakage.

## Phased Implementation Plan

Each phase has a goal, scope, exit criteria, and validation strategy.

Do not skip phases.

### Phase 0: Freeze the contract vocabulary

Goal:

- define the canonical nouns used across editor, adapter, and kernel layers

Scope:

- document IDs
- revision IDs
- primitive reference types
- feature identifiers
- sketch identifiers
- diagnostics shape
- preview request/response shape

Deliverables:

- shared type definitions for all contract nouns
- explicit written identity policy
- explicit written invalidation policy

Validation:

- no API payload uses ambiguous names like `target`, `item`, or `index` without typed structure
- all referenced primitives in example payloads are explicit and typed

### Phase 1: Introduce editor state as a real subsystem

Goal:

- create a clean separation between UI interaction state and durable model state

Scope:

- active command
- command phase
- selection set
- selection filter
- hover target
- preview state
- active edit session

Deliverables:

- editor state model
- command lifecycle model
- selection model that stores typed primitive refs

Validation:

- the toolbar only activates commands
- the viewport only reports typed interaction events
- feature forms read/write editor draft state, not kernel objects directly

### Phase 2: Introduce the modeling service boundary

Goal:

- prevent components from depending directly on kernel APIs

Scope:

- define a `ModelingService` or equivalent adapter-facing boundary
- normalize all durable operations through this service

Deliverables:

- request/response types for durable document actions
- adapter contract for snapshot, create, update, delete, preview, resolve

Validation:

- no UI component talks directly to kernel implementation
- no kernel-specific response shape leaks into presentation components

### Phase 3: Implement strict document snapshots

Goal:

- make committed state queryable in a durable, reference-rich way

Scope:

- feature tree snapshot
- object/body snapshot
- sketch snapshot
- diagnostics snapshot
- render metadata snapshot

Deliverables:

- snapshot schema with typed IDs everywhere
- ownership relationships between features, sketches, and primitives

Validation:

- a snapshot is sufficient to render tree, object lists, and selection details without guessing
- face/edge/body ownership is explicit
- no renderer selection logic depends on array positions alone

### Phase 4: Implement render-ID round trip

Goal:

- ensure viewport selection/highlight can map to durable primitive IDs

Scope:

- render geometry metadata
- pick result mapping
- highlight mapping

Deliverables:

- renderable mesh records with durable ID bindings
- pick result type that returns typed primitive refs

Validation:

- selecting a rendered face returns a typed face reference
- highlighting a selected primitive can be driven from the same reference
- body/face/edge filtering works without UI-side guesswork

### Phase 5: Implement local sketch interaction without kernel dependence

Goal:

- prove that near-realtime drafting is owned by the editor

Scope:

- sketch session state
- local preview entities
- acceptance/commit boundary

Deliverables:

- local sketch entity model
- sketch command lifecycle for line/rectangle/circle
- commit-to-kernel request shape for accepted sketch changes

Validation:

- rectangle preview updates every pointer move without kernel calls
- accepted sketch geometry is committed with explicit sketch primitive IDs
- reopening the sketch yields the same primitive IDs

### Phase 6: Implement parametric feature creation and editing

Goal:

- establish the durable feature interface and feature edit flow

Scope:

- create feature
- update feature parameters
- preview feature evaluation
- commit/cancel edit session

Deliverables:

- feature parameter schemas
- preview request shape
- update request shape
- diagnostics mapping

Validation:

- extrude can preview without mutating committed state
- editing an existing extrude uses the same contract family as create/update, not a separate special-case path
- affected references are explicit and stable

### Phase 7: Implement reference invalidation and diagnostics

Goal:

- make failures explicit instead of hidden

Scope:

- invalid reference reporting
- rebuild diagnostics
- stale preview rejection
- revision mismatch handling

Deliverables:

- machine-readable diagnostic model
- invalid reference detail payloads
- revision conflict behavior

Validation:

- deleting or changing upstream topology reports which downstream references broke
- stale preview responses are ignored deterministically
- the editor can present actionable error state without parsing free text

### Phase 8: Implement generalized selection filtering

Goal:

- make command-driven picking predictable and reusable

Scope:

- filter by points/edges/faces/bodies/planes/sketch entities
- command-specific accepted target sets
- preselection and hover behavior

Deliverables:

- filter model
- command target requirement model
- picker integration with typed references

Validation:

- fillet accepts edges only
- extrude accepts valid profile or planar targets only
- plane creation accepts only supported reference combinations

### Phase 9: Implement feature-inspector architecture

Goal:

- stop complex feature editing from polluting the tree and toolbar

Scope:

- dedicated inspector panel
- command/property schema rendering
- active selection detail rendering

Deliverables:

- inspector state model
- schema-driven feature edit forms
- mapping from selected feature to edit session

Validation:

- selecting a feature opens its editable parameter session in the inspector
- tree rows remain structural/navigation-oriented
- complex forms do not get embedded in arbitrary list items or modal sprawl

### Phase 10: Freeze and document compatibility guarantees

Goal:

- make the interface stable enough for ongoing kernel/frontend parallel work

Scope:

- schema versioning
- compatibility rules
- migration rules for request/response evolution

Deliverables:

- explicit compatibility policy
- contract examples
- known limitations list

Validation:

- a new agent can implement against the document without reverse-engineering the UI
- adding a new feature type does not require redefining primitive identity fundamentals

## Validation Matrix

Every phase should be validated using the following categories.

### Contract validation

- all payloads use typed IDs
- no payload depends on visible UI ordering
- ownership relations are explicit
- revisioning is present where mutation or preview is involved

### Behavioral validation

- local interaction remains responsive without kernel round-trips
- committed operations return deterministic durable results
- stale or invalid inputs fail explicitly

### Integration validation

- viewport picking maps to durable refs
- tree and inspector render from snapshots, not guessed local state
- commands use the modeling service, not kernel internals

### Regression validation

- editing a feature preserves unrelated IDs
- topology-breaking operations report invalid references
- preview results do not corrupt committed state

## Recommended Vertical Slice Order

Do not start with the whole product.

Implement this slice end-to-end first:

1. select plane by typed reference
2. create sketch session
3. draw rectangle locally with no kernel dependency during drag
4. commit sketch with stable sketch primitive IDs
5. create extrude from explicit sketch/profile reference
6. preview extrude edits through preview evaluation
7. commit extrude edit while preserving stable affected IDs where valid

If this slice feels awkward, the contract is wrong and should be corrected before more features are added.

## Anti-Patterns To Reject

- a single monolithic `CADKernel` interface with dozens of unrelated methods
- direct kernel calls from React components
- selection modeled as array indices
- topology references modeled as "first face", "second edge", or UI row order
- feature edit logic embedded inside tree item components
- per-frame sketch interaction delegated to the kernel
- preview APIs that mutate document state
- diagnostics returned only as human-readable strings
- silent primitive remapping after topology change

## Final Standard

By the time the first real modeling features ship, the system should satisfy this test:

An engineer can inspect a selection, feature edit, or preview request and determine exactly which durable primitive it refers to, which document revision it is based on, which contract family it uses, and whether the result is committed or transient.

If that is not true, the interface is not ready and should not be treated as stable.

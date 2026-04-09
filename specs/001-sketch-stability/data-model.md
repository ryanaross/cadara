# Data Model: Sketch Stability And Plane Selection

## Sketch Session State

**Purpose**: Represents the active authored sketch draft inside the editor.

**Fields**:

- `sketchId`: Existing durable sketch ID or `null` for a new sketch
- `sketchLabel`: User-facing label for the session
- `plane`: Full `SketchPlaneDefinition` used as the session source of truth
- `planeTarget`: Durable support ref for the plane
- `planeKey`: Named primary plane key when available
- `entities`: Accepted and preview draft entities
- `definition`: Authored `SketchDefinition`
- `activeTool`: Current sketch tool
- `status`: `idle` or `drawing`
- `pointerDownPoint`: First sketch-space point of the in-progress draw
- `livePoint`: Latest sketch-space pointer point
- `sequence`: Monotonic authored entity counter
- `solvedRegions`: Solver-derived sketch regions
- `commitRequest`: Derived commit payload for the current draft
- `validationMessage`: Current validation message, if any

**Validation rules**:

- `plane` must be a valid right-handed plane frame
- `planeTarget` must match `plane.support`
- `planeKey` may be `null` for non-primary planes in future extensions

## Construction Plane Renderable

**Purpose**: Provides reliable viewport selection and highlighting for datum planes.

**Fields**:

- `binding.target`: Durable `construction` ref
- `binding.semanticClass`: `construction`
- `binding.topology`: `null`
- `geometry`: Filled mesh for plane interior and optional outline polyline for edges
- `pickPriority`: Higher selection priority than body faces that overlap the same plane start area

**Validation rules**:

- all render records for the same construction plane must resolve to the same durable target
- filled surfaces must remain renderer-neutral export data, not scene-only helper meshes

## Sketch Interaction Projection

**Purpose**: Converts viewport pointer hits into sketch-space points and converts sketch-space geometry back into world-space preview geometry.

**Inputs**:

- active `SketchPlaneDefinition`
- viewport ray intersection point in world space
- sketch-space draft point tuples

**Outputs**:

- sketch-space pointer coordinates used by `sketch.pointerMoved` and `sketch.pointerReleased`
- world-space preview renderables aligned to the active sketch plane

**State transitions**:

1. sketch session opens from a construction plane or existing sketch
2. session stores explicit `plane`
3. viewport projects pointer into sketch space using `plane`
4. preview entities render back into world space using the same `plane`
5. commit request serializes the same `plane` definition

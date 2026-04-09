# Research: Sketch Stability And Plane Selection

## Decision: Export Filled Construction Plane Surfaces For Picking

**Rationale**: The current viewport can only pick render-export records, and construction planes are exported as thin polyline outlines. That makes plane selection unreliable in practice even though the feature tree can target the same durable refs. Adding filled construction surfaces keeps selection inside the existing render-export contract instead of introducing scene-only picking meshes.

**Alternatives considered**:

- Make the static scene-factory planes selectable. Rejected because those planes are presentation-only and are not backed by durable refs or snapshot-owned render bindings.
- Increase line width on construction outlines. Rejected because WebGL line width support is inconsistent and still leaves plane interiors unpickable.

## Decision: Carry Explicit Sketch Plane Definitions Through Sketch Sessions

**Rationale**: Sketch sessions currently preserve only a `planeKey` and reconstruct plane behavior with hard-coded XY/YZ/XZ branches. The viewport also projects pointer input against a fixed XY `THREE.Plane`. Storing the active `SketchPlaneDefinition` in the sketch session lets session open, pointer projection, preview rendering, and commit payload generation all use the same contract-owned frame.

**Alternatives considered**:

- Keep using `planeKey` branches and patch the viewport only. Rejected because preview rendering and commit generation would still duplicate orientation logic and drift over time.
- Infer the plane from camera orientation during drawing. Rejected because sketch placement must be contract-driven, not view-driven.

## Decision: Use Existing OCC Plane Math Helpers For Projection And Preview Mapping

**Rationale**: `src/domain/modeling/occ/planes.ts` already validates sketch-plane frames and converts between sketch and world coordinates. Reusing those helpers avoids duplicating fragile axis math in the viewport and sketch-session display logic.

**Alternatives considered**:

- Keep bespoke mapping helpers in `sketch-session.ts`. Rejected because they only support named primary planes and already diverge from the shared plane contract.
- Add new Three.js-only math helpers. Rejected because the project already has contract-aligned plane math in the domain layer.

## Decision: Verify The Fix With Browser Automation And Contract Tests

**Rationale**: The failure is user-visible and interaction-heavy, so browser verification is required. Contract/spec tests still matter because the bug spans render export, sketch-session state, and editor transitions.

**Alternatives considered**:

- Rely on browser verification only. Rejected because render export and state-machine regressions are easier to catch in deterministic tests.
- Rely on unit tests only. Rejected because the reported defect is rooted in the actual viewport interaction path.

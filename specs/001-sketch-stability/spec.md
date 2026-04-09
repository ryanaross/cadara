# Feature Specification: Sketch Stability And Plane Selection

**Feature Branch**: `001-sketch-stability`  
**Created**: 2026-04-09  
**Status**: Draft  
**Input**: User description: "fix the sketch issues and use the playwright-cli to make sure that the fix was correct. when i create a sketch, I can't select any of the origin planes from the viewport even when i select a plane from the feature tree the sketch preview flickers and it only appears on 1 axis in general there are many issues in the the sketch logic"

## Clarifications

### Session 2026-04-09

- Q: Which selectable surfaces must be valid sketch start targets in this feature? → A: Origin planes, planar solid faces, and other sketches.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Start A Sketch From The Viewport (Priority: P1)

A user can start a sketch by selecting a valid planar sketch target directly in the 3D viewport instead of being forced to use the feature tree.

**Why this priority**: Sketch creation is blocked if datum planes in the viewport cannot be selected.

**Independent Test**: Can be fully tested by activating `Sketch`, clicking each supported planar target type in the viewport, and confirming that sketch mode opens on the selected surface.

**Acceptance Scenarios**:

1. **Given** the workbench is in part mode, **When** the user activates `Sketch` and clicks the XY plane in the viewport, **Then** a sketch session opens on the XY plane.
2. **Given** the workbench is in part mode, **When** the user activates `Sketch` and clicks the YZ or XZ plane in the viewport, **Then** a sketch session opens on the clicked plane.
3. **Given** the workbench is in part mode, **When** the user activates `Sketch` and clicks a planar solid face or a planar face from another sketch, **Then** a sketch session opens on that selected planar surface.

---

### User Story 2 - Stable Sketch Preview On Any Primary Plane (Priority: P1)

A user can draw sketch geometry on XY, YZ, or XZ without the preview flickering or collapsing onto the wrong axes.

**Why this priority**: The current pointer-to-plane mapping is incorrect, so sketch authoring is visually unreliable even when the session opens.

**Independent Test**: Can be fully tested by opening sketches on XY, YZ, and XZ and drawing line and rectangle previews that remain stable and coplanar with the selected plane.

**Acceptance Scenarios**:

1. **Given** an active sketch on YZ, **When** the user moves the pointer and places a line, **Then** the preview and accepted geometry stay on the YZ plane.
2. **Given** an active sketch on XZ, **When** the user draws a rectangle, **Then** the preview and accepted geometry stay on the XZ plane without flicker.

---

### User Story 3 - Consistent Sketch Session Behavior Across Entry Points (Priority: P2)

A user gets the same sketch behavior whether the sketch was opened from the feature tree or from the viewport.

**Why this priority**: Different entry points currently produce different and unreliable sketch behavior, which makes the editor hard to trust.

**Independent Test**: Can be fully tested by opening the same primary plane from the feature tree and the viewport and confirming that the active sketch plane, preview placement, and committed geometry match.

**Acceptance Scenarios**:

1. **Given** the user starts a sketch from the feature tree, **When** they draw on the selected plane, **Then** the same plane-aligned behavior is observed as when starting from the viewport.
2. **Given** the user reopens an existing sketch, **When** they author additional geometry, **Then** the editor continues to use the sketch’s stored plane definition.

### Edge Cases

- What happens when the user clicks near the border of overlapping datum planes, planar faces, and body geometry while `Sketch` is armed?
- How does the editor behave when a sketch is reopened from a stored sketch record whose plane is not XY?
- What happens when no document snapshot has loaded yet and the user activates `Sketch`?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST expose selectable viewport render geometry for each supported planar sketch target used to start a sketch, including origin planes, planar solid faces, and planar faces from other sketches.
- **FR-002**: The system MUST preserve a sketch session’s explicit plane definition for the full lifetime of the session instead of inferring authoring axes from ambient viewport state.
- **FR-003**: The system MUST project viewport pointer input into sketch coordinates using the active sketch plane definition.
- **FR-004**: The system MUST render sketch previews and accepted sketch geometry on the active sketch plane for XY, YZ, and XZ sessions.
- **FR-005**: The system MUST keep sketch behavior consistent whether the session was opened from a construction-plane selection, an existing sketch selection, or the feature tree.
- **FR-006**: The system MUST keep datum plane selection and sketch preview behavior verifiable through browser automation using `playwright-cli`.

### Key Entities *(include if feature involves data)*

- **Sketch Session Plane**: The active sketch-plane definition used for pointer projection, preview rendering, and commit payload generation.
- **Sketch Surface Renderable**: The viewport-visible geometry and picking binding that makes a supported planar sketch target selectable in the scene.
- **Sketch Interaction Contract**: The event flow that starts a sketch, projects pointer movement, and converts accepted geometry back into committed sketch definitions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can open a sketch from each supported planar sketch target type in the viewport in one click after activating `Sketch`.
- **SC-002**: On XY, YZ, and XZ sketches, line and rectangle previews remain visually coplanar with the selected plane throughout pointer movement.
- **SC-003**: Starting a sketch from the feature tree and from the viewport produces the same active plane and the same authored geometry orientation.
- **SC-004**: Browser verification with `playwright-cli` confirms the corrected plane-selection and sketch-preview behavior on the running app.

## Assumptions

- The current scope includes primary datum planes, planar solid faces, and planar faces from other sketches, plus existing sketch reopen flows already represented in the editor state machine.
- The viewport will continue to consume renderer-neutral records from the modeling snapshot instead of introducing ad hoc scene-only picking meshes.
- OpenCascade-backed snapshots remain the runtime source of truth for the browser app, but supporting mock snapshot parity is still valuable for contract coverage.

# sketch-plane-alignment Specification

## Purpose

Define the plane-owned sketch session behavior that keeps pointer projection, preview rendering, and committed geometry aligned to the active sketch plane.

## Requirements

### Requirement: Sketch sessions preserve an explicit plane definition
The system MUST preserve a sketch session's full `SketchPlaneDefinition` for the entire session lifetime instead of inferring sketch axes from ambient viewport state.

#### Scenario: Open sketch on a construction plane
- **WHEN** a sketch session opens from a construction-plane selection
- **THEN** the session stores the selected durable target, `planeTarget`, `planeKey`, and full `plane: SketchPlaneDefinition`

#### Scenario: Reopen an existing sketch
- **WHEN** a sketch session opens from an existing sketch record
- **THEN** the session reuses the stored sketch plane definition from that sketch

### Requirement: Pointer input is projected through the active sketch plane
The system MUST convert viewport pointer input into sketch-space coordinates using the active sketch plane definition.

#### Scenario: Move pointer during an XY sketch
- **WHEN** the user moves the pointer while an XY sketch session is active
- **THEN** the resulting `sketch.pointerMoved` coordinates are derived from the active XY plane definition

#### Scenario: Move pointer during a non-XY sketch
- **WHEN** the user moves the pointer while a `YZ` or `XZ` sketch session is active
- **THEN** the resulting sketch coordinates are derived from that active non-XY plane definition without switching axes

### Requirement: Sketch preview and accepted geometry remain coplanar with the active session plane
The system MUST render sketch previews and accepted sketch geometry on the active sketch plane for `XY`, `YZ`, and `XZ` sessions.

#### Scenario: Draw a line on the YZ plane
- **WHEN** the user previews and places a line in an active `YZ` sketch
- **THEN** the preview and accepted geometry remain on the `YZ` plane without flicker

#### Scenario: Draw a rectangle on the XZ plane
- **WHEN** the user previews and places a rectangle in an active `XZ` sketch
- **THEN** the preview and accepted geometry remain on the `XZ` plane without collapsing onto the wrong axes

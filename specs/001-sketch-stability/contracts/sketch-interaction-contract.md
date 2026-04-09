# Contract: Sketch Interaction

## Sketch Start

When the editor receives `tool.activated` for `sketch`, it enters a selection command that accepts:

- `construction` targets with `constructionPlane` semantics
- `sketch` targets with `existingSketch` semantics

If the user selects a valid target, the editor emits `sketch.openSession`.

## Sketch Session Open

`sketch.openSession` must resolve a `SketchSessionState` that contains:

- the selected durable target
- the session `planeTarget`
- the session `planeKey`
- the full session `plane: SketchPlaneDefinition`

For existing sketches, the session `plane` comes from the stored sketch snapshot.

For construction planes, the session `plane` must resolve from the selected construction plane definition rather than from viewport state.

## Pointer Projection

While a sketch session is active:

- viewport pointer movement is intersected against the active session plane in world space
- the resulting world-space point is converted into sketch coordinates with the shared plane transform
- `sketch.pointerMoved` and `sketch.pointerReleased` receive sketch-space coordinates only

## Preview Rendering

Sketch preview and accepted geometry must be rendered by mapping sketch-space points back into world space with the same session plane definition used for pointer projection.

This contract must hold for:

- XY sketches
- YZ sketches
- XZ sketches
- reopened existing sketches

## Viewport Plane Selection

Construction planes exposed in the viewport must provide render-export bindings that:

- target the durable `construction` ref
- use semantic class `construction`
- provide a filled selectable area, not only an outline

This ensures plane selection remains contract-owned and highlightable.

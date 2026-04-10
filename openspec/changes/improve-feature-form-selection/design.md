## Context

Feature-session editing is already registry-driven: feature authoring definitions expose a generic form schema, the inspector renders that schema, and the editor state machine owns durable selection. Reference picker fields currently display selected references as passive cards, while diagnostics are shown as general preview messages. That leaves no field-level visual error state, no clear indication of which reference picker is actively collecting input, and no direct form action to clear a selected reference.

The change should strengthen the generic feature inspector and form schema/event boundary without moving feature-specific logic into React components. Feature definitions remain responsible for field composition, draft patch semantics, and reference selection filters. The inspector remains responsible for rendering state and dispatching generic form actions.

## Goals / Non-Goals

**Goals:**
- Surface invalid feature form fields with red border and red text treatment.
- Visually mark the active reference picker with the primary color while it is collecting selections.
- Let `Escape` cancel the active reference-picking interaction and clear that field's active selection state.
- Add explicit delete/clear controls for reference picker and reference collection fields, including one clear control per selected reference in collection fields.
- Preserve the split between feature-owned form schema, editor state transitions, and presentational inspector rendering.

**Non-Goals:**
- Redesign the entire feature inspector layout.
- Change modeling service, kernel adapter, or durable reference contracts.
- Add feature-specific React branches for individual feature kinds.
- Change viewport picking rules beyond routing picker activation/cancellation through the existing editor selection system.

## Decisions

Track active picker intent in the editor/form interaction layer instead of inferring it from the global feature type alone. A feature session can expose multiple reference fields, such as revolve profile and axis, and those fields need independent active styling and clearing behavior. Using an explicit active picker id avoids ambiguous UI state and keeps feature definitions free to define multiple pickers with the same selection filter.

Represent clear/delete as generic form patches derived from the field schema. For single-reference fields, clearing sets the bound draft value to `null`. For collection fields, clearing removes only the selected reference item from the bound draft array and leaves the other selected references intact. This keeps clearing aligned with the existing `createFeatureEditorFieldPatch` path and avoids adding feature-specific reducer cases.

Apply error styling from field-level validation metadata and diagnostics that can be associated with a form field. Feature definitions should be able to mark fields invalid when required references are missing, while preview diagnostics can continue to render in the diagnostics section. The inspector should render invalid fields with red border/text and preserve helper text for non-error guidance.

Handle `Escape` with a scoped keyboard listener active only while a feature reference picker is collecting. Pressing `Escape` cancels that picker state and clears its pending selection highlight/filter, but it must not commit/cancel the whole feature session unless no picker-specific cancellation is active.

Use existing theme tokens where possible: primary/accent treatment for active picker controls, and destructive/error tokens or local CSS variables for invalid states. This keeps the UI consistent with the Tailwind v4 variable-driven styling already used by the app.

## Risks / Trade-offs

- [Global selection state may not map one-to-one to form field values] -> Mitigate by tracking the active picker field id separately and applying selected targets through the field's schema-defined patch behavior.
- [A generic error API could become too broad] -> Mitigate by supporting only field-level invalid text/state and leaving complex diagnostic grouping in the existing diagnostics field.
- [Escape handling could conflict with session cancellation] -> Mitigate by handling picker cancellation first and allowing broader command cancellation only when no active picker is present.
- [Per-reference clear buttons could remove the wrong item if labels are ambiguous] -> Mitigate by deriving removal from the durable reference value, not the displayed label, and routing clears through the existing draft patch/preview flow so diagnostics and preview state update immediately before commit.

## Migration Plan

1. Extend the feature editor form schema with optional field error metadata and active picker identity support.
2. Add generic form events/helpers for activating a reference picker, applying selections to the active field, cancelling picker state, and clearing individual reference values.
3. Update the feature inspector reference controls to render active/error states, per-reference clear/delete buttons, and `Escape` cancellation.
4. Update feature definitions where needed to emit field-level required-reference errors for incomplete drafts.
5. Add tests around form schema error state, reference clearing, active picker styling/state, and `Escape` cancellation.

## Open Questions

- Whether preview diagnostics should later include structured field ids so kernel-returned diagnostics can attach directly to form controls.

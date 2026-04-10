## Why

Feature-session forms can currently show incomplete references and diagnostics, but they do not make invalid fields or active pick targets obvious enough while the user is building a feature. Selection cancellation and clearing also need explicit form-level affordances so users can recover without guessing which field is active.

## What Changes

- Add visual error treatment for feature form fields and diagnostics, including red border and red text states when a field has an actionable error.
- Add active selection styling for reference picker controls so the field currently collecting viewport/sidebar selections is denoted with the primary color.
- Allow `Escape` to cancel the active reference-picking interaction and clear the active selection target for that form field.
- Add delete/clear controls to reference picker and reference collection fields so users can explicitly remove individual selected references from the draft.
- Keep feature-specific selection policy in feature authoring definitions and keep presentational rendering in the generic feature inspector.

## Capabilities

### New Capabilities
- `feature-form-selection-feedback`: Defines feature-session form feedback for invalid fields, active reference-picking state, keyboard cancellation, and explicit selection clearing.

### Modified Capabilities

## Impact

- Affected areas include `src/components/layout/feature-inspector.tsx`, feature editor form schema/types, form events, feature editing hooks/state dispatch, and feature authoring definitions that expose reference picker fields.
- Adds UI behavior for form error state, active picker state, `Escape` cancellation, and explicit clear/delete actions without changing the modeling service or kernel adapter contracts.

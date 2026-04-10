## 1. Form Schema and Events

- [ ] 1.1 Extend feature editor form field types with optional field-level error metadata for invalid state text and styling
- [ ] 1.2 Add an explicit reference picker schema option for whether the field accepts multiple selected instances
- [ ] 1.3 Add generic form event helpers for clearing single-reference values, clearing all multi-instance values, and removing individual multi-instance reference items through existing patch bindings
- [ ] 1.4 Add active reference picker identity/state plumbing so picker activation can be tracked per form field rather than only per feature type

## 2. Editor Interaction Behavior

- [ ] 2.1 Wire reference picker activation to update the active picker field and the current selection filter without hardcoding feature-specific picker ids
- [ ] 2.2 Apply viewport/sidebar selections to the active picker field according to the field's single-instance or multi-instance setting and its `replace` or `appendUnique` picker behavior
- [ ] 2.3 Handle `Escape` while a picker is active by cancelling the picker and clearing picker-specific pending selection state without committing or cancelling the whole feature session
- [ ] 2.4 Clear active picker state when the feature session is committed, cancelled, or switched to another feature/session

## 3. Inspector UI

- [ ] 3.1 Update reference picker and collection renderers to act as interactive controls with primary-color active styling
- [ ] 3.2 Render field-level errors with red border and red error text while preserving normal helper text for valid fields
- [ ] 3.3 Render every selected instance for multi-instance reference fields, using stable durable reference identity and schema-provided labels
- [ ] 3.4 Add clear selection buttons for selected single-reference and multi-instance fields, disabling or hiding them when no reference exists
- [ ] 3.5 Add a remove button for each selected instance when a field allows multiple instances
- [ ] 3.6 Keep the inspector generic by consuming form schema/events only, without adding feature-kind branches

## 4. Feature Definitions

- [ ] 4.1 Update feature authoring definitions to emit field-level required-reference errors for incomplete reference inputs
- [ ] 4.2 Update numeric feature fields that can be invalid to emit field-level error metadata where draft validation can determine the issue
- [ ] 4.3 Update feature authoring definitions to mark multi-instance fields where feature semantics allow them, including extrude profile regions, fillet edges, and shell removable faces
- [ ] 4.4 Confirm revolve fields can independently distinguish profile and axis picker active/error states while remaining single-instance fields

## 5. Verification

- [ ] 5.1 Add or update unit tests for generic clear-field patch helpers for single-reference values, all multi-instance values, and individual multi-instance reference items
- [ ] 5.2 Add or update editor state tests for active picker switching, single-instance and multi-instance selection application, `Escape` cancellation, and session cleanup
- [ ] 5.3 Add or update feature inspector tests for red invalid styling, primary active picker styling, selected-instance list rendering, clear button behavior, and per-instance remove button behavior
- [ ] 5.4 Run the project test suite and typecheck with the repo's Bun scripts

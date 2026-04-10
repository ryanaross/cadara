## 1. Document Cursor Contract

- [ ] 1.1 Add a typed document `cursor` field to the modeling snapshot contract with an explicit empty-document representation and a last-applied-feature reference representation.
- [ ] 1.2 Update snapshot factories, mock kernel adapter state, OCC snapshot assembly, fixtures, and contract exports so every document snapshot includes a valid cursor.
- [ ] 1.3 Add cursor validation that reports an explicit diagnostic or restore failure when a non-empty cursor references a missing feature.
- [ ] 1.4 Update operation-history persistence and replay fixtures/tests so cursor state survives refresh and invalid cursor payloads fail explicitly.

## 2. Cursor-Aware Modeling Behavior

- [ ] 2.1 Implement default tail cursor behavior for unrolled documents and after normal feature append.
- [ ] 2.2 Implement rollback behavior that moves the cursor without deleting follow-up feature records.
- [ ] 2.3 Make rebuild, render export, and applied model state use only features through the cursor while preserving later stored feature records.
- [ ] 2.4 Insert new feature commits immediately after the current cursor and advance the cursor to the new feature, including the `a-b-c-d` with cursor at `b` plus new `e` case producing `a-b-e-c-d`.
- [ ] 2.5 Add modeling service and adapter tests for empty documents, tail cursor, rollback preservation, applied-feature slicing, invalid cursor references, and insertion after rollback.

## 3. Bottom Feature Timeline UI

- [ ] 3.1 Add a `FeatureTimelineBar` layout component that renders committed document features in document order as compact icon-only controls.
- [ ] 3.2 Reuse the existing toolbar tooltip primitives and delay behavior for timeline feature hover/focus details.
- [ ] 3.3 Render a visible cursor in the timeline at the current document cursor position, including tail and rolled-back positions.
- [ ] 3.4 Preserve feature target selection and hidden-state behavior when interacting with timeline feature icons.
- [ ] 3.5 Add accessible labels and keyboard focus behavior for feature icons and cursor interactions.

## 4. Workbench Layout Integration

- [ ] 4.1 Remove the feature tree section from `FeatureSidebar` while preserving parts and objects, snapshot references, and document diagnostics.
- [ ] 4.2 Mount the bottom feature timeline from `CadWorkbench` and wire it to existing snapshot, selection, visibility, and dispatch callbacks.
- [ ] 4.3 Adjust workbench layout sizing so the viewport and inspector remain stable with the new bottom bar.
- [ ] 4.4 Add focused component tests or e2e assertions covering sidebar relocation, icon-only timeline rendering, tooltip content, cursor rendering, selection, hidden state, and rollback insertion behavior.

## 5. Verification

- [ ] 5.1 Run the relevant Bun test suites for modeling contracts/adapters and layout components.
- [ ] 5.2 Run TypeScript and lint checks used by the project.
- [ ] 5.3 Manually verify the workbench in the Vite dev server at port 3000, including compact timeline layout and rollback insertion behavior.

## 1. Add thicken contract and validation

- [ ] 1.1 Add or confirm thicken contract examples using explicit topology participants, positive thickness options, and any supported operation intent or target-body participants
- [ ] 1.2 Add thicken-specific validation coverage for required participants, accepted target kinds, positive thickness validation, and target-body requirements for any supported boolean modes
- [ ] 1.3 Update operation-history validation and fixtures so thicken create/update entries preserve participants, options, and operation intent
- [ ] 1.4 Update modeling service normalization and snapshot hydration coverage for thicken advanced-solid definitions

## 2. Add thicken authoring and tool integration

- [ ] 2.1 Add the thicken tool metadata and part-mode registration in the existing tool/feature registry path
- [ ] 2.2 Add `src/domain/feature-authoring/features/thicken.ts` with draft defaults, hydration, selection handling, option patching, preview labels, diagnostics, and draft-to-definition construction
- [ ] 2.3 Add thicken form schema fields for target selection, thickness and side options, diagnostics, and any supported operation intent fields
- [ ] 2.4 Register the thicken authoring definition and update registry tests so thicken is discoverable without feature-specific inspector branching

## 3. Implement modeling adapter behavior

- [ ] 3.1 Add mock adapter handling so thicken preview/commit responses can be exercised by editor and service tests
- [ ] 3.2 Add OCC adapter handling for the initial supported thicken shape
- [ ] 3.3 Add explicit unsupported-case diagnostics for unsupported target topology, unsupported boolean composition, unresolved topology, or other valid-but-unimplemented thicken combinations
- [ ] 3.4 Update render export, consumed-target tracking, and invalid-reference reporting so thicken results bind back to durable feature and participant targets consistently

## 4. Add focused automated coverage

- [ ] 4.1 Add contract tests for thicken payload validation, operation-history persistence, and snapshot/edit hydration
- [ ] 4.2 Add feature-authoring tests for thicken selection, option patching, diagnostics, form schema participant descriptors, and draft-to-definition construction
- [ ] 4.3 Add adapter tests for supported thicken preview/commit and unsupported thicken diagnostics without committed document mutation
- [ ] 4.4 Add boundary tests or update existing boundary assertions to ensure thicken authoring and inspector code do not import OCC or kernel-specific modules

## 5. Add e2e feature-flow coverage

- [ ] 5.1 Extend the shared feature workbench harness to build a thicken-ready fixture and activate thicken with valid target selection
- [ ] 5.2 Add a Playwright e2e test that creates or reuses a suitable thicken-ready fixture, activates thicken, selects the required targets, sets thickness options, verifies preview readiness or expected diagnostics, commits thicken, and verifies the resulting document/timeline/geometry state
- [ ] 5.3 Run the targeted unit/integration tests and the thicken e2e flow, then update this task list with completed verification results

## 1. Define advanced feature contracts

- [ ] 1.1 Add shared participant role types for profiles, paths, guide curves, faces, edges, bodies, tool bodies, target bodies, planes, axes, transform references, and enclosing-region seeds
- [ ] 1.2 Add shared operation-intent types for `create`, `add`, `subtract`, and `intersect`, with feature-declared support rather than global enablement
- [ ] 1.3 Add validation helpers that reject missing required participants, invalid cardinality, invalid target kinds, and unsupported operation modes with role-specific diagnostics
- [ ] 1.4 Add contract examples or fixtures that demonstrate role-specific payloads for one profile/path feature, one topology modifier, and one body operation

## 2. Extend feature authoring substrate

- [ ] 2.1 Extend feature authoring definitions with machine-readable advanced participant selection descriptors
- [ ] 2.2 Update draft selection handling so selected durable targets are applied by participant role instead of generic reference order
- [ ] 2.3 Update generic form schema bindings so advanced participant fields can display required/optional status, cardinality, selected references, and role-specific diagnostics
- [ ] 2.4 Ensure the generic inspector consumes the new descriptors without feature-specific UI branching or kernel-specific imports

## 3. Preserve snapshot, history, and preview behavior

- [ ] 3.1 Update operation-history validation and fixtures to preserve advanced participant roles and operation intent
- [ ] 3.2 Update snapshot hydration helpers so advanced feature drafts round-trip role-specific participants and operation intent
- [ ] 3.3 Update preview and commit request construction to carry the advanced participant payloads through the modeling service boundary
- [ ] 3.4 Add adapter-level unsupported-case diagnostics for contract-valid advanced feature payloads that the current kernel implementation cannot build yet

## 4. Prove the substrate with representative coverage

- [ ] 4.1 Add unit tests for participant role validation, operation-intent validation, and diagnostic formatting
- [ ] 4.2 Add authoring tests that prove a representative profile/path participant, topology modifier participant, and body-operation participant can be selected and hydrated
- [ ] 4.3 Add boundary tests that verify advanced feature authoring and inspector code do not import OCC or kernel-specific modules
- [ ] 4.4 Add preview/request tests that prove unsupported advanced feature combinations return structured diagnostics without mutating committed document state

## 5. Prepare follow-up feature slices

- [ ] 5.1 Create or document follow-up proposal candidates for sweep/loft/wrap, thicken/enclose/split/delete-solid, face blend/chamfer/hole/external-thread, and mirror/transform
- [ ] 5.2 Identify one recommended first proving feature from each family and record any substrate gaps discovered before broad rollout
- [ ] 5.3 Explicitly document the unresolved `enclose`, `wrap`, `transform`, and `external thread` semantics that must be decided in their follow-up proposals
- [ ] 5.4 Record milestone-level e2e acceptance criteria requiring every implemented advanced feature to have an extrude-like user-flow test before the milestone is considered complete

# Tasks: Sketch Stability And Plane Selection

**Input**: Design documents from `/app/specs/001-sketch-stability/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/sketch-interaction-contract.md`, `quickstart.md`

**Tests**: This feature requires targeted contract/spec coverage plus browser verification because the specification makes testing mandatory and explicitly requires `playwright-cli` validation.

**Organization**: Tasks are grouped by user story so each story can be implemented and verified independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel when the tasks touch different files and do not depend on incomplete work
- **[Story]**: Which user story this task belongs to (`US1`, `US2`, `US3`)
- Every task includes the exact file path that should be changed or created

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare the repository for targeted regression coverage and feature delivery.

- [X] T001 Add Playwright regression commands and supporting devDependencies in `/app/package.json`
- [X] T002 Create browser regression configuration in `/app/playwright.config.ts`
- [X] T003 [P] Create a reusable viewport regression harness in `/app/e2e/helpers/sketch-workbench.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the shared sketch-plane and selectable-surface contracts required by all user stories.

**⚠️ CRITICAL**: No user story work should begin until these tasks are complete.

- [X] T004 Extend sketch session and plane contracts to carry explicit plane definitions in `/app/src/contracts/shared/sketch-plane.ts`, `/app/src/contracts/sketch/schema.ts`, and `/app/src/domain/editor/schema.ts`
- [ ] T005 [P] Update editor state-machine effects and catalog semantics for construction planes and reopened sketches in `/app/src/contracts/editor/state-machine.ts` and `/app/src/contracts/editor/state-machine.spec.ts`
- [X] T006 [P] Enrich modeling snapshot render exports with selectable filled construction-plane surfaces in `/app/src/domain/modeling/occ/snapshot.ts`, `/app/src/contracts/render/schema.ts`, and `/app/src/domain/modeling/document-snapshot-view.ts`
- [ ] T007 Align workspace picking helpers with construction-plane priority and durable bindings in `/app/src/domain/workspace/render-picking.ts` and `/app/src/domain/workspace/scene-factory.ts`

**Checkpoint**: Explicit sketch-plane state and selectable construction-plane renderables are ready for story work.

---

## Phase 3: User Story 1 - Start A Sketch From The Viewport (Priority: P1) 🎯 MVP

**Goal**: Allow sketch creation directly from selectable planar targets in the viewport.

**Independent Test**: Activate `Sketch`, click XY/YZ/XZ and other supported planar targets in the viewport, and confirm a sketch session opens on the selected surface.

### Tests for User Story 1

- [ ] T008 [P] [US1] Add viewport selection contract coverage for sketch-open semantics in `/app/src/contracts/editor/state-machine.spec.ts`
- [X] T009 [P] [US1] Add construction-plane and planar-target snapshot coverage in `/app/src/domain/modeling/occ/snapshot.spec.ts`
- [X] T010 [P] [US1] Add Playwright viewport sketch-start regression coverage in `/app/e2e/sketch-plane-selection.spec.ts`

### Implementation for User Story 1

- [ ] T011 [P] [US1] Export reliable selectable construction-plane surface geometry from snapshot builders in `/app/src/domain/modeling/occ/snapshot.ts`
- [ ] T012 [P] [US1] Surface planar sketch targets through the modeling service selection catalog in `/app/src/domain/modeling/modeling-service.ts`
- [ ] T013 [US1] Open sketch sessions from viewport plane picks in `/app/src/components/cad/three-cad-viewport.tsx` and `/app/src/app/cad-workbench.tsx`
- [ ] T014 [US1] Keep feature-tree and viewport sketch target dispatch aligned in `/app/src/components/layout/feature-sidebar.tsx` and `/app/src/domain/editor/feature-editing.ts`

**Checkpoint**: Sketch sessions can be started from viewport plane picks and remain wired through the typed editor flow.

---

## Phase 4: User Story 2 - Stable Sketch Preview On Any Primary Plane (Priority: P1)

**Goal**: Keep sketch projection, preview rendering, and committed geometry coplanar on XY, YZ, and XZ.

**Independent Test**: Open sketches on XY, YZ, and XZ, draw line and rectangle previews, and confirm the preview and accepted geometry stay on the selected plane without flicker.

### Tests for User Story 2

- [ ] T015 [P] [US2] Add explicit plane-projection regression coverage in `/app/src/domain/editor/sketch-session-controller.ts` and `/app/src/contracts/editor/state-machine.spec.ts`
- [X] T016 [P] [US2] Add plane-math and preview-alignment coverage in `/app/src/domain/modeling/occ/planes.spec.ts` and `/app/src/domain/modeling/mock-kernel-adapter.spec.ts`
- [X] T017 [P] [US2] Extend browser regression coverage for YZ and XZ preview stability in `/app/e2e/sketch-preview-stability.spec.ts`

### Implementation for User Story 2

- [ ] T018 [P] [US2] Store the active `SketchPlaneDefinition` throughout sketch session lifecycle in `/app/src/domain/editor/sketch-session.ts` and `/app/src/domain/editor/sketch-session-controller.ts`
- [ ] T019 [P] [US2] Rework pointer projection and preview world-mapping to use shared plane math in `/app/src/domain/modeling/occ/planes.ts` and `/app/src/components/cad/three-cad-viewport.tsx`
- [ ] T020 [US2] Render live sketch previews and committed geometry from the active session plane in `/app/src/components/cad/three-cad-viewport.tsx` and `/app/src/hooks/editor-provider.tsx`

**Checkpoint**: Authoring on XY, YZ, and XZ uses one explicit plane definition for projection, preview, and commit.

---

## Phase 5: User Story 3 - Consistent Sketch Session Behavior Across Entry Points (Priority: P2)

**Goal**: Ensure feature-tree entry, viewport entry, and reopened sketches all preserve the same plane-aligned behavior.

**Independent Test**: Open the same plane from the feature tree and the viewport, then reopen an existing sketch and verify the active plane and resulting geometry orientation stay consistent.

### Tests for User Story 3

- [ ] T021 [P] [US3] Add reopened-sketch and mixed-entry contract coverage in `/app/src/contracts/editor/state-machine.spec.ts`
- [ ] T022 [P] [US3] Add stored-plane snapshot parity coverage in `/app/src/domain/modeling/mock-kernel-adapter.spec.ts` and `/app/src/domain/modeling/occ/snapshot.spec.ts`
- [X] T023 [P] [US3] Add Playwright regression coverage for feature-tree, viewport, and reopen parity in `/app/e2e/sketch-entry-parity.spec.ts`

### Implementation for User Story 3

- [ ] T024 [P] [US3] Resolve sketch-session plane state from stored sketch and construction targets in `/app/src/domain/editor/sketch-session-controller.ts` and `/app/src/domain/modeling/modeling-service.ts`
- [ ] T025 [P] [US3] Preserve sketch plane identity and orientation when reopening sketches in `/app/src/domain/modeling/mock-kernel-adapter.ts` and `/app/src/domain/modeling/occ/snapshot.ts`
- [ ] T026 [US3] Normalize sketch-entry behavior across feature-tree and viewport workflows in `/app/src/app/cad-workbench.tsx`, `/app/src/components/layout/feature-sidebar.tsx`, and `/app/src/components/cad/three-cad-viewport.tsx`

**Checkpoint**: Sketch sessions behave the same regardless of whether they begin from the tree, viewport, or an existing sketch reopen flow.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, cleanup, and feature-level verification.

- [ ] T027 [P] Run targeted regression commands for sketch stability in `/app/package.json`
- [ ] T028 [P] Validate quickstart and Playwright CLI instructions against the delivered flow in `/app/specs/001-sketch-stability/quickstart.md`
- [ ] T029 Document any required viewport interaction diagnostics and cleanup notes in `/app/specs/001-sketch-stability/plan.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup and blocks all story work
- **User Story 1 (Phase 3)**: Depends on Foundational
- **User Story 2 (Phase 4)**: Depends on Foundational and should build on the sketch-start flow from US1
- **User Story 3 (Phase 5)**: Depends on Foundational and should follow the explicit-plane session work from US1 and US2
- **Polish (Phase 6)**: Depends on all implemented stories

### User Story Dependencies

- **US1**: MVP. First deliverable after foundational work.
- **US2**: Requires the explicit plane-selection/session flow established by US1.
- **US3**: Requires the explicit plane persistence and preview mapping established by US1 and US2.

### Within Each User Story

- Write the listed tests first and confirm they fail before implementation
- Complete modeling/render export changes before viewport wiring
- Complete session-plane persistence before preview and reopen parity fixes

### Parallel Opportunities

- `T002` and `T003` can run in parallel after `T001`
- `T005`, `T006`, and `T007` can run in parallel after `T004`
- In each story phase, the listed test tasks marked `[P]` can run together
- In each story phase, data/modeling tasks marked `[P]` can run in parallel before the integration task

---

## Parallel Example: User Story 1

```bash
# Launch the User Story 1 verification tasks together:
Task: "Add viewport selection contract coverage in /app/src/contracts/editor/state-machine.spec.ts"
Task: "Add construction-plane and planar-target snapshot coverage in /app/src/domain/modeling/occ/snapshot.spec.ts"
Task: "Add Playwright viewport sketch-start regression coverage in /app/e2e/sketch-plane-selection.spec.ts"

# Then launch the independent implementation tasks together:
Task: "Export reliable selectable construction-plane surface geometry from snapshot builders in /app/src/domain/modeling/occ/snapshot.ts"
Task: "Surface planar sketch targets through the modeling service selection catalog in /app/src/domain/modeling/modeling-service.ts"
```

---

## Parallel Example: User Story 2

```bash
# Launch the User Story 2 regression tasks together:
Task: "Add explicit plane-projection regression coverage in /app/src/domain/editor/sketch-session-controller.ts and /app/src/contracts/editor/state-machine.spec.ts"
Task: "Add plane-math and preview-alignment coverage in /app/src/domain/modeling/occ/planes.spec.ts and /app/src/domain/modeling/mock-kernel-adapter.spec.ts"
Task: "Extend browser regression coverage for YZ and XZ preview stability in /app/e2e/sketch-preview-stability.spec.ts"

# Then launch the independent implementation tasks together:
Task: "Store the active SketchPlaneDefinition throughout sketch session lifecycle in /app/src/domain/editor/sketch-session.ts and /app/src/domain/editor/sketch-session-controller.ts"
Task: "Rework pointer projection and preview world-mapping to use shared plane math in /app/src/domain/modeling/occ/planes.ts and /app/src/components/cad/three-cad-viewport.tsx"
```

---

## Parallel Example: User Story 3

```bash
# Launch the User Story 3 regression tasks together:
Task: "Add reopened-sketch and mixed-entry contract coverage in /app/src/contracts/editor/state-machine.spec.ts"
Task: "Add stored-plane snapshot parity coverage in /app/src/domain/modeling/mock-kernel-adapter.spec.ts and /app/src/domain/modeling/occ/snapshot.spec.ts"
Task: "Add Playwright regression coverage for feature-tree, viewport, and reopen parity in /app/e2e/sketch-entry-parity.spec.ts"

# Then launch the independent implementation tasks together:
Task: "Resolve sketch-session plane state from stored sketch and construction targets in /app/src/domain/editor/sketch-session-controller.ts and /app/src/domain/modeling/modeling-service.ts"
Task: "Preserve sketch plane identity and orientation when reopening sketches in /app/src/domain/modeling/mock-kernel-adapter.ts and /app/src/domain/modeling/occ/snapshot.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. Validate viewport-based sketch start on XY, YZ, XZ, planar faces, and existing sketches

### Incremental Delivery

1. Deliver US1 to restore sketch start from the viewport
2. Deliver US2 to stabilize preview and commit behavior on all primary planes
3. Deliver US3 to unify feature-tree, viewport, and reopen entry flows
4. Finish with targeted tests plus Playwright CLI verification from `quickstart.md`

### Suggested MVP Scope

- Phase 1
- Phase 2
- Phase 3 (US1 only)

---

## Notes

- All tasks follow the required checkbox, ID, optional `[P]`, optional story label, and file-path format
- Browser automation is included because `spec.md` requires `playwright-cli` verifiability
- The first fully valuable increment is restoring viewport plane selection for sketch start

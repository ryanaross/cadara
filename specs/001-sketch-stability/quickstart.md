# Quickstart: Sketch Stability And Plane Selection

## Local Verification

1. Start the app with `bun run dev`.
2. Open the workbench in a browser.
3. Activate `Sketch`.
4. Click `Top Plane`, `Right Plane`, and `Front Plane` directly in the viewport and confirm that each opens a sketch session.
5. On each plane, activate `Line` or `Rectangle` and confirm the preview remains coplanar with the selected plane while moving the pointer.
6. Repeat the same drawing flow after opening a plane from the feature tree and confirm the orientation matches the viewport-started flow.

## Browser Verification With Playwright CLI

Recommended commands once the dev server is running:

```bash
playwright-cli open http://127.0.0.1:3000
playwright-cli snapshot
playwright-cli click "Sketch"
playwright-cli click "Top Plane"
playwright-cli click "Line"
```

Use `playwright-cli eval` and `playwright-cli screenshot` to confirm that sketch-session status, selected plane labels, and viewport output change as expected while drawing.

Add a dedicated Playwright regression test for this feature so plane selection and sketch preview stability are checked by automation, not only by ad hoc CLI inspection.

## Targeted Tests

Run the targeted specs that cover the edited surface:

```bash
bun run test:editor-state-machine
bun x vite-node src/domain/modeling/mock-kernel-adapter.spec.ts
bun x vite-node src/domain/modeling/occ/snapshot.spec.ts
```

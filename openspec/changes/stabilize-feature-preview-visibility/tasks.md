## 1. Layer preview renderables over the committed scene

- [ ] 1.1 Update the workbench viewport renderable composition to keep snapshot document renderables present while feature preview renderables are active.
- [ ] 1.2 Preserve existing hidden-target filtering and sketch-renderable merging after switching to layered preview composition.
- [ ] 1.3 Verify preview clear paths fall back to committed snapshot renderables without leaving the viewport empty.

## 2. Add preview-specific viewport styling

- [ ] 2.1 Thread preview-origin context into viewport render-object assembly so transient preview records can be styled separately from committed renderables.
- [ ] 2.2 Apply transparent overlay styling and stable render-order handling for preview meshes, lines, and markers while keeping committed geometry at its normal appearance.
- [ ] 2.3 Confirm stale-preview and preview-update flows replace only the transient overlay set instead of hiding unrelated committed geometry.

## 3. Add regression coverage

- [ ] 3.1 Add unit coverage for layered viewport composition so preview renderables no longer replace committed document renderables.
- [ ] 3.2 Add render-style tests that verify preview geometry uses transient transparency while committed geometry retains normal styling.
- [ ] 3.3 Add an interaction-level regression that exercises preview start and clear behavior on a populated scene without blanking the viewport.

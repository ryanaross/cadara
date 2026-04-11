import { expect, test } from '@playwright/test'

import { FeatureWorkbenchHarness } from './helpers/feature-workbench'

test.setTimeout(90_000)

test('viewport hover and selection resolve durable face, edge, and vertex targets on a solid body', async ({ page }) => {
  const workbench = new FeatureWorkbenchHarness(page)

  await workbench.open()
  await workbench.createBaseExtrudeFixture()

  const hoveredFace = await workbench.hoverViewportTargetNear(/^body_feature_extrude-1\.face_.+$/, [
    { x: 620, y: 220 },
    { x: 620, y: 260 },
    { x: 600, y: 200 },
  ])
  await expect.poll(() => workbench.currentHoverTarget(), { timeout: 10_000 }).toBe(hoveredFace.targetId)
  await workbench.clickViewportAtReal(hoveredFace.point)
  await expect.poll(() => workbench.currentEditorSelection(), { timeout: 10_000 }).toBe(hoveredFace.targetId)
  await expect.poll(() => workbench.currentMachineSelectionCount(), { timeout: 10_000 }).toBe(1)

  const hoveredEdge = await workbench.hoverViewportTargetNear(/^body_feature_extrude-1\.edge_.+$/, [
    { x: 540, y: 140 },
    { x: 700, y: 300 },
    { x: 500, y: 300 },
  ])
  await expect.poll(() => workbench.currentHoverTarget(), { timeout: 10_000 }).toBe(hoveredEdge.targetId)
  await workbench.clickViewportAtReal(hoveredEdge.point)
  await expect.poll(() => workbench.currentEditorSelection(), { timeout: 10_000 }).toBe(hoveredEdge.targetId)
  await expect.poll(() => workbench.currentMachineSelectionCount(), { timeout: 10_000 }).toBe(1)

  const hoveredVertex = await workbench.hoverViewportTargetNear(/^body_feature_extrude-1\.vertex_.+$/, [
    { x: 680, y: 440 },
    { x: 720, y: 420 },
    { x: 520, y: 320 },
  ])
  await expect.poll(() => workbench.currentHoverTarget(), { timeout: 10_000 }).toBe(hoveredVertex.targetId)
  await workbench.clickViewportAtReal(hoveredVertex.point)
  await expect.poll(() => workbench.currentEditorSelection(), { timeout: 10_000 }).toBe(hoveredVertex.targetId)
  await expect.poll(() => workbench.currentMachineSelectionCount(), { timeout: 10_000 }).toBe(1)
})

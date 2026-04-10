import { expect, test } from '@playwright/test'

import { FeatureWorkbenchHarness, FEATURE_FIXTURE, meanPixelDelta } from './helpers/feature-workbench'

test.setTimeout(90_000)

test('extrude previews and commits from the shared feature harness', async ({ page }) => {
  const workbench = new FeatureWorkbenchHarness(page)

  await workbench.open()
  await workbench.createRectangleProfileFixture()
  await workbench.selectReference(FEATURE_FIXTURE.profile)
  await workbench.activateFeature('extrude')

  await workbench.expectFeaturePreviewReady('extrude')
  await workbench.commitFeature('feature_extrude-1')
})

test('revolve previews and commits with a region profile and durable edge axis', async ({ page }) => {
  const workbench = new FeatureWorkbenchHarness(page)

  await workbench.open()
  await workbench.createBaseExtrudeFixture()
  await workbench.selectReference(FEATURE_FIXTURE.profile)
  await workbench.activateFeature('revolve')
  await workbench.selectFirstReferenceMatching(/^Select .* body_feature_extrude-1\.edge_body_feature_extrude-1_t0001_10$/)

  await workbench.expectFeaturePreviewReady('revolve')
  await workbench.commitFeature('feature_revolve-1')
})

test.fixme('fillet previews and commits from a durable body edge', async ({ page }) => {
  const workbench = new FeatureWorkbenchHarness(page)

  await workbench.open()
  await workbench.createBaseExtrudeFixture()
  await workbench.activateFeature('fillet')
  await workbench.selectFirstReferenceMatching(/^Select .* body_feature_extrude-1\.edge_body_feature_extrude-1_t0001_10$/)
  await workbench.setNumericField('Radius', 0.5)

  await workbench.expectFeaturePreviewReady('fillet')
  await workbench.commitFeature('feature_fillet-1')
})

test('shell previews, commits, and keeps consecutive canvas frames stable', async ({ page }) => {
  const workbench = new FeatureWorkbenchHarness(page)

  await workbench.open()
  await workbench.createBaseExtrudeFixture()
  await workbench.activateFeature('shell')
  await workbench.selectFirstReferenceMatching(/^Select .* body_feature_extrude-1$/)
  await workbench.selectFirstReferenceMatching(/^Select .* body_feature_extrude-1\.face_/)

  await workbench.expectFeaturePreviewReady('shell')
  await workbench.commitFeature('feature_shell-1')

  const firstFrame = await workbench.canvasBytes()
  await page.waitForTimeout(250)
  const secondFrame = await workbench.canvasBytes()
  expect(meanPixelDelta(firstFrame, secondFrame)).toBeLessThan(2)
})

test('plane previews and commits from a planar face reference', async ({ page }) => {
  const workbench = new FeatureWorkbenchHarness(page)

  await workbench.open()
  await workbench.createBaseExtrudeFixture()
  await workbench.activateFeature('plane')
  await workbench.selectFirstReferenceMatching(/^Select .* body_feature_extrude-1\.face_/)

  await workbench.expectFeaturePreviewReady('plane')
  await workbench.commitFeature('feature_plane-1')
})

test('extrude boolean scope previews and commits with an explicit target body', async ({ page }) => {
  const workbench = new FeatureWorkbenchHarness(page)

  await workbench.open()
  await workbench.createBaseExtrudeFixture()
  await workbench.selectReference(FEATURE_FIXTURE.profile)
  await workbench.activateFeature('extrude')
  await workbench.setOperation('join')
  await workbench.selectFirstReferenceMatching(/^Select .* body_feature_extrude-1$/)

  await workbench.expectFeaturePreviewReady('extrude')
  await workbench.commitFeature('feature_extrude-2')
})

test.fixme('feature chain carries durable context across feature steps', async ({ page }) => {
  const workbench = new FeatureWorkbenchHarness(page)

  await workbench.open()
  const chain = await workbench.createFeatureChain()

  await chain.addFilletFromFirstEdge()
  await chain.addPlaneFromFirstPlanarFace()
})

import { expect, test } from '@playwright/test'

import { FeatureWorkbenchHarness } from './helpers/feature-workbench'

test.setTimeout(90_000)

test('solid bodies render with visible shaded contrast in the viewport', async ({ page }) => {
  const workbench = new FeatureWorkbenchHarness(page)

  await workbench.open()
  await workbench.createBaseExtrudeFixture()

  await expect(workbench.viewportSurface()).toHaveScreenshot('viewport-solid-shading.png')
})

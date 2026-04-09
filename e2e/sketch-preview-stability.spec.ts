import { expect, test } from '@playwright/test'
import { SketchWorkbenchHarness } from './helpers/sketch-workbench'

test('keeps sketch preview interactions active after starting a sketch', async ({ page }) => {
  const workbench = new SketchWorkbenchHarness(page)

  await workbench.open()
  await workbench.activateTool('Start a new sketch.')
  await workbench.clickViewportTarget('construction_plane-xy')
  await workbench.activateTool('Create line geometry.')
  await workbench.clickViewportAt({ x: 360, y: 260 })
  await workbench.clickViewportAt({ x: 420, y: 320 })

  await expect(page.getByText('Sketch session:')).toContainText('1 entities staged')
})

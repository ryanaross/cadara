import { test } from '@playwright/test'
import { SketchWorkbenchHarness } from './helpers/sketch-workbench'

test('starts a sketch from the viewport on the primary top plane', async ({ page }) => {
  const workbench = new SketchWorkbenchHarness(page)

  await workbench.open()
  await workbench.activateTool('Start a new sketch.')
  await workbench.clickViewportTarget('construction_plane-xy')

  await workbench.expectMachine('editingSketch')
  await workbench.expectSketchSessionActive()
  await workbench.expectSketchPlane('XY')
})

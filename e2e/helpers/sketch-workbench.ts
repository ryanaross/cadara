import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'

export class SketchWorkbenchHarness {
  constructor(readonly page: Page) {}

  async open() {
    await this.page.goto('/')
    await expect(this.page.getByText('Machine:')).toBeVisible()
  }

  toolbarButton(name: string): Locator {
    return this.page.getByRole('button', { name })
  }

  viewport(): Locator {
    return this.page.locator('main canvas').first()
  }

  async activateTool(name: string) {
    await this.toolbarButton(name).click()
  }

  async clickViewportAt(point: { x: number; y: number }) {
    await this.viewport().click({ position: point })
  }

  async expectSketchPlane(label: string) {
    await expect(this.page.getByText('Sketch plane:')).toContainText(label)
  }

  async expectSketchSessionActive() {
    await expect(this.page.getByText('Sketch session:')).not.toContainText('none')
  }

  async expectMachine(kind: string) {
    await expect(this.page.getByText('Machine:')).toContainText(kind)
  }
}

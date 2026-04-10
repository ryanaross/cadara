import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'

export class SketchWorkbenchHarness {
  constructor(readonly page: Page) {}

  async open() {
    await this.page.addInitScript(() => window.localStorage.clear())
    await this.page.goto('/')
    await expect(this.page.getByText('Machine:')).toBeVisible()
  }

  toolbarButton(name: string): Locator {
    return this.page.getByRole('button', { name })
  }

  viewport(): Locator {
    return this.page.locator('main canvas').first()
  }

  viewportSurface(): Locator {
    return this.page.getByTestId('cad-viewport')
  }

  async activateTool(name: string) {
    await this.toolbarButton(name).click()
  }

  async clickViewportAt(point: { x: number; y: number }) {
    await this.viewport().evaluate((canvas, targetPoint) => {
      const rect = canvas.getBoundingClientRect()
      const clientX = rect.left + targetPoint.x
      const clientY = rect.top + targetPoint.y
      const pointerEventInit: PointerEventInit = {
        bubbles: true,
        cancelable: true,
        composed: true,
        pointerId: 1,
        pointerType: 'mouse',
        isPrimary: true,
        button: 0,
        buttons: 1,
        clientX,
        clientY,
      }

      canvas.dispatchEvent(new PointerEvent('pointerdown', pointerEventInit))
      canvas.dispatchEvent(new PointerEvent('pointerup', { ...pointerEventInit, buttons: 0 }))
      canvas.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        composed: true,
        button: 0,
        buttons: 0,
        clientX,
        clientY,
      }))
    }, point)
  }

  async hoverViewportAt(point: { x: number; y: number }) {
    const box = await this.viewport().boundingBox()

    if (!box) {
      throw new Error('Viewport canvas is not visible.')
    }

    await this.page.mouse.move(box.x + point.x, box.y + point.y)
  }

  async hoverViewportAtReal(point: { x: number; y: number }) {
    const box = await this.viewportSurface().boundingBox()

    if (!box) {
      throw new Error('Viewport surface is not visible.')
    }

    await this.page.mouse.move(box.x + point.x, box.y + point.y)
  }

  async clickViewportAtReal(point: { x: number; y: number }) {
    const box = await this.viewportSurface().boundingBox()

    if (!box) {
      throw new Error('Viewport surface is not visible.')
    }

    await this.page.mouse.click(box.x + point.x, box.y + point.y)
  }

  async currentHoverTarget() {
    const diagnostics = await this.page.locator('text=Target:').first().textContent()
    return diagnostics?.replace(/^Target:\s*/, '').trim() ?? 'none'
  }

  async currentEditorSelection() {
    const bodyText = await this.page.locator('body').textContent()
    const match = bodyText?.match(/Edit status:\s*[^\n]*Selection:\s*(.*?)Target rule:/s)
    return match?.[1]?.trim() ?? ''
  }

  async currentMachineSelectionCount() {
    const bodyText = await this.page.locator('body').textContent()
    const match = bodyText?.match(/Machine:\s*[^\n]*Command:\s*[^\n]*Phase:\s*[^\n]*Selection:\s*(\d+)/s)
    return match ? Number(match[1]) : NaN
  }

  async clickViewportTarget(targetId: string) {
    const viewport = this.viewport()
    const box = await viewport.boundingBox()

    if (!box) {
      throw new Error('Viewport canvas is not visible.')
    }

    const xSteps = 9
    const ySteps = 7

    for (let row = 1; row <= ySteps; row += 1) {
      for (let column = 1; column <= xSteps; column += 1) {
        const point = {
          x: Math.round((box.width * column) / (xSteps + 1)),
          y: Math.round((box.height * row) / (ySteps + 1)),
        }

        await this.hoverViewportAt(point)

        if ((await this.currentHoverTarget()) === targetId) {
          await this.clickViewportAt(point)
          return
        }
      }
    }

    throw new Error(`Viewport target ${targetId} was not found in the current camera framing.`)
  }

  async clickViewportTargetReal(targetId: string) {
    const viewport = this.viewportSurface()
    const box = await viewport.boundingBox()

    if (!box) {
      throw new Error('Viewport surface is not visible.')
    }

    const xSteps = 9
    const ySteps = 7

    for (let row = 1; row <= ySteps; row += 1) {
      for (let column = 1; column <= xSteps; column += 1) {
        const point = {
          x: Math.round((box.width * column) / (xSteps + 1)),
          y: Math.round((box.height * row) / (ySteps + 1)),
        }

        await this.hoverViewportAtReal(point)
        await this.page.waitForTimeout(100)

        if ((await this.currentHoverTarget()) === targetId) {
          await this.clickViewportAtReal(point)
          return
        }
      }
    }

    throw new Error(`Viewport target ${targetId} was not found in the current camera framing.`)
  }

  async expectSketchPlane(label: string) {
    await expect(this.page.getByText('Sketch plane:')).toContainText(label)
  }

  async expectSketchSessionActive() {
    await this.expectMachine('editingSketch')
    await expect(this.page.getByText('Sketch plane:')).not.toContainText('none')
  }

  async expectMachine(kind: string) {
    await expect(this.page.getByText('Machine:')).toContainText(kind)
  }
}

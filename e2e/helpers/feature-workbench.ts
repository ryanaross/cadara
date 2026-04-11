import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { SketchWorkbenchHarness } from './sketch-workbench'

export const FEATURE_FIXTURE = {
  profile: 'sketch_primary.region_primary-outer',
  body: 'body_feature_extrude-1',
} as const

type FeatureKind = 'extrude' | 'revolve' | 'sweep' | 'loft' | 'fillet' | 'chamfer' | 'thicken' | 'shell' | 'plane'

export class FeatureWorkbenchHarness extends SketchWorkbenchHarness {
  constructor(page: Page) {
    super(page)
  }

  override async open() {
    await super.open()
    await expect.poll(() => this.revisionLabel(), { timeout: 30_000 }).not.toBe('loading')
  }

  async createRectangleProfileFixture() {
    await this.activateTool('Start a new sketch.')
    await this.page.getByRole('button', { name: /Top Plane/ }).first().click()
    await this.expectMachine('editingSketch')
    await this.activateTool('Create rectangle geometry.')
    await this.clickViewportAt({ x: 520, y: 320 })
    await this.clickViewportAt({ x: 680, y: 440 })
    await this.activateTool('Exit the active sketch.')
    await this.referenceButton(FEATURE_FIXTURE.profile).waitFor({ state: 'visible', timeout: 30_000 })
    await expect.poll(() => this.referenceDisabled(FEATURE_FIXTURE.profile), { timeout: 30_000 }).toBe(false)

    return { profileTarget: FEATURE_FIXTURE.profile }
  }

  async createBaseExtrudeFixture() {
    await this.createRectangleProfileFixture()
    await this.selectReference(FEATURE_FIXTURE.profile)
    await this.activateFeature('extrude')
    await this.expectFeaturePreviewReady('extrude')
    await this.commitFeature('feature_extrude-1')

    return {
      profileTarget: FEATURE_FIXTURE.profile,
      bodyTarget: FEATURE_FIXTURE.body,
    }
  }

  async createFeatureChain() {
    const base = await this.createBaseExtrudeFixture()
    return new FeatureChainHarness(this, base)
  }

  async activateFeature(kind: FeatureKind) {
    const toolNames: Record<FeatureKind, string> = {
      extrude: 'Create an extruded solid or surface.',
      revolve: 'Create a revolved solid or surface.',
      sweep: 'Create a swept solid or surface.',
      loft: 'Create a lofted solid from ordered profiles.',
      fillet: 'Round selected edges.',
      chamfer: 'Bevel selected edges.',
      thicken: 'Offset selected faces into a solid.',
      shell: 'Hollow a solid body.',
      plane: 'Create a construction plane.',
    }
    await this.activateTool(toolNames[kind])
  }

  async selectReference(targetId: string) {
    const button = this.referenceButton(targetId)
    await button.click()
    await expect.poll(() => this.currentEditorSelection(), { timeout: 10_000 }).toContain(targetId)
  }

  async selectFirstReferenceMatching(pattern: RegExp) {
    const ariaLabel = await this.getFirstReferenceLabelMatching(pattern)

    if (!ariaLabel) {
      throw new Error(`No selectable reference matched ${pattern}.`)
    }

    await this.page.getByRole('button', { name: ariaLabel }).click()
    return ariaLabel
  }

  async selectSupportedLoftFaceProfile(profileTarget: string) {
    const faceLabels = await this.getReferenceLabelsMatching(/^Select .* body_feature_extrude-1\.face_/)

    for (const faceLabel of faceLabels) {
      await this.selectReference(profileTarget)
      await this.activateFeature('loft')
      await this.page.getByRole('button', { name: faceLabel }).click()
      await this.page.waitForTimeout(300)

      try {
        if (await this.hasVisibleFeatureErrorDiagnostics()) {
          throw new Error('Loft candidate emitted error diagnostics.')
        }
        await expect.poll(() => this.featureSessionLabel(), { timeout: 10_000 }).toContain('create:loft:previewReady')
        await expect.poll(() => this.hasVisibleFeatureErrorDiagnostics(), { timeout: 2_000 }).toBe(false)
        return faceLabel
      } catch {
        await this.page.getByRole('button', { name: 'Cancel' }).click()
        await expect.poll(() => this.machineLabel(), { timeout: 10_000 }).toContain('idle')
      }
    }

    throw new Error('No loft face reference produced a preview-ready loft session.')
  }

  async selectFirstViewportTargetMatching(pattern: RegExp) {
    const targetId = await this.clickFirstViewportTargetMatching(pattern)
    return targetId
  }

  async clickFirstViewportTargetMatching(pattern: RegExp) {
    const viewport = this.viewportSurface()
    const box = await viewport.boundingBox()

    if (!box) {
      throw new Error('Viewport surface is not visible.')
    }

    const xSteps = 13
    const ySteps = 9

    for (let row = 1; row <= ySteps; row += 1) {
      for (let column = 1; column <= xSteps; column += 1) {
        const point = {
          x: Math.round((box.width * column) / (xSteps + 1)),
          y: Math.round((box.height * row) / (ySteps + 1)),
        }

        await this.clickViewportAtReal(point)
        await this.page.waitForTimeout(30)

        const selection = await this.currentEditorSelection()
        const targetId = selection.match(pattern)?.[0]

        if (targetId) {
          return targetId
        }
      }
    }

    throw new Error(`Viewport target matching ${pattern} was not found in the current camera framing.`)
  }

  private async getFirstReferenceLabelMatching(pattern: RegExp) {
    const matches = await this.getReferenceLabelsMatching(pattern)
    return matches[0] ?? null
  }

  private async getReferenceLabelsMatching(pattern: RegExp) {
    return this.page.getByRole('button').evaluateAll((buttons, source) => {
      const regex = new RegExp(source)
      return buttons.flatMap((button) => {
        const label = button.getAttribute('aria-label')
        return label && regex.test(label) ? [label] : []
      })
    }, pattern.source)
  }

  async setNumericField(label: string, value: number) {
    await this.page.getByLabel(label).fill(String(value))
  }

  async setOperation(operation: 'newBody' | 'join' | 'cut' | 'intersect') {
    await this.page.getByRole('button', { name: operation }).click()
  }

  async expectFeaturePreviewReady(kind: FeatureKind) {
    await expect.poll(() => this.featureSessionLabel(), { timeout: 30_000 }).toContain(`create:${kind}:previewReady`)
    await expect.poll(() => this.currentPreviewDiagnosticsText(), { timeout: 10_000 }).not.toMatch(/\berror\b/i)
  }

  async commitFeature(expectedFeatureId?: string) {
    await this.page.getByRole('button', { name: 'Commit' }).click()
    await expect.poll(() => this.machineLabel(), { timeout: 75_000 }).toContain('idle')

    if (expectedFeatureId) {
      await expect(this.page.getByText(expectedFeatureId).first()).toBeVisible({ timeout: 30_000 })
    }
  }

  async canvasBytes() {
    return this.viewport().screenshot()
  }

  private referenceButton(targetId: string): Locator {
    return this.page.getByRole('button', { name: new RegExp(`^Select .*${escapeRegExp(targetId)}$`) })
  }

  private async referenceDisabled(targetId: string) {
    return (await this.referenceButton(targetId).getAttribute('aria-disabled')) === 'true'
  }

  private async revisionLabel() {
    const bodyText = await this.page.locator('body').textContent()
    return bodyText?.match(/Revision:\s*([^\s]+)/)?.[1] ?? 'loading'
  }

  private async machineLabel() {
    const bodyText = await this.page.locator('body').textContent()
    return bodyText?.match(/Machine:\s*([^\s]+)/)?.[1] ?? ''
  }

  private async featureSessionLabel() {
    const bodyText = await this.page.locator('body').textContent()
    return bodyText?.match(/Feature session:\s*([^\s]+)/)?.[1] ?? ''
  }

  private async currentPreviewDiagnosticsText() {
    const bodyText = await this.page.locator('body').textContent()
    return bodyText?.match(/Diagnostics(.*?)CancelCommit/s)?.[1] ?? ''
  }

  private async hasVisibleFeatureErrorDiagnostics() {
    return this.page.locator('aside').getByText(/^error$/i).isVisible().catch(() => false)
  }
}

export class FeatureChainHarness {
  constructor(
    private readonly workbench: FeatureWorkbenchHarness,
    readonly context: {
      profileTarget: string
      bodyTarget: string
    },
  ) {}

  async addFilletFromFirstEdge() {
    await this.workbench.activateFeature('fillet')
    await this.workbench.selectFirstViewportTargetMatching(/^body_feature_extrude-1\.edge_/)
    await this.workbench.setNumericField('Radius', 0.5)
    await this.workbench.expectFeaturePreviewReady('fillet')
    await this.workbench.commitFeature('feature_fillet-1')
    return this
  }

  async addPlaneFromTopPlane() {
    await this.workbench.activateFeature('plane')
    await this.workbench.page.getByRole('button', { name: /Top Plane/ }).first().click()
    await expect.poll(() => this.workbench.currentEditorSelection(), { timeout: 10_000 }).toContain('construction_plane-xy')
    await this.workbench.expectFeaturePreviewReady('plane')
    await this.workbench.commitFeature('feature_plane-1')
    return this
  }
}

export function meanPixelDelta(left: Buffer, right: Buffer) {
  const length = Math.min(left.length, right.length)
  let total = 0

  for (let index = 0; index < length; index += 1) {
    total += Math.abs(left[index]! - right[index]!)
  }

  return total / Math.max(length, 1)
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

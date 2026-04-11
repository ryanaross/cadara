import type { RenderableEntityRecord } from '@/contracts/render/schema'
import type { SketchSessionState } from '@/domain/editor/sketch-session'
import { mergeSketchRenderables, type MergedSketchRenderables } from '@/domain/editor/sketch-session-controller'
import { getPrimitiveRefKey } from '@/domain/editor/schema'
import type { ViewportRenderableRecord } from '@/domain/workspace/viewport-renderables'

export interface ComposeViewportRenderablesInput {
  snapshotRenderables: RenderableEntityRecord[]
  previewRenderables: RenderableEntityRecord[] | null
  sketchSession: SketchSessionState | null
  hiddenTargetKeys: Record<string, boolean>
}

export interface ComposedViewportRenderables extends MergedSketchRenderables {
  documentRenderables: ViewportRenderableRecord[]
}

export function composeViewportRenderables(
  input: ComposeViewportRenderablesInput,
): ComposedViewportRenderables {
  const layeredRenderables = [
    ...input.snapshotRenderables.map((renderable) => ({
      origin: 'document' as const,
      renderable,
    })),
    ...(input.previewRenderables ?? []).map((renderable) => ({
      origin: 'preview' as const,
      renderable,
    })),
  ].filter(({ renderable }) => !input.hiddenTargetKeys[getPrimitiveRefKey(renderable.binding.target)])

  const mergedRenderables = mergeSketchRenderables(
    layeredRenderables,
    input.sketchSession,
  )

  return {
    ...mergedRenderables,
    documentRenderables: mergedRenderables.documentRenderables,
  }
}

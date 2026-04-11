import type { RenderableEntityRecord } from '@/contracts/render/schema'

export type ViewportRenderableOrigin = 'document' | 'preview'

export interface ViewportRenderableRecord {
  origin: ViewportRenderableOrigin
  renderable: RenderableEntityRecord
}

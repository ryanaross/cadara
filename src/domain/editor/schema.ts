import type { ToolId } from '@/domain/tools/tool-registry'
import type { ToolbarMode } from '@/domain/tools/schema'

export type DocumentId = `doc_${string}`
export type RevisionId = `rev_${string}`
export type FeatureId = `feature_${string}`
export type SketchId = `sketch_${string}`
export type BodyId = `body_${string}`
export type FaceId = `face_${string}`
export type EdgeId = `edge_${string}`
export type VertexId = `vertex_${string}`
export type SketchPrimitiveId = `curve_${string}` | `point_${string}`
export type ConstructionId = `construction_${string}`

export type PrimitiveRef =
  | { kind: 'body'; bodyId: BodyId }
  | { kind: 'face'; bodyId: BodyId; faceId: FaceId }
  | { kind: 'edge'; bodyId: BodyId; edgeId: EdgeId }
  | { kind: 'vertex'; bodyId: BodyId; vertexId: VertexId }
  | { kind: 'sketch'; sketchId: SketchId }
  | { kind: 'sketchPrimitive'; sketchId: SketchId; primitiveId: SketchPrimitiveId }
  | { kind: 'feature'; featureId: FeatureId }
  | { kind: 'construction'; constructionId: ConstructionId }

export type SelectionTarget = PrimitiveRef

export interface SelectionFilter {
  allowedKinds: readonly PrimitiveRef['kind'][]
  label: string
}

export type CommandPhase = 'idle' | 'armed' | 'collecting' | 'editing'

export interface ActiveCommand {
  toolId: ToolId
  phase: CommandPhase
  startedAt: number
}

export interface CommandPreview {
  kind: 'selection' | 'sketch'
  label: string
  target: PrimitiveRef | null
}

export interface FeatureEditSession {
  featureId: FeatureId
}

export interface EditorState {
  mode: ToolbarMode
  activeCommand: ActiveCommand | null
  selection: SelectionTarget[]
  selectionFilter: SelectionFilter | null
  hoverTarget: SelectionTarget | null
  preview: CommandPreview | null
  activeEditSession: FeatureEditSession | null
}

export interface ViewportInteractionEvent {
  type: 'hover' | 'select' | 'clearHover'
  target?: PrimitiveRef
}

export const defaultSelectionFilter: SelectionFilter = {
  allowedKinds: ['body', 'face', 'edge', 'vertex', 'sketch', 'sketchPrimitive', 'feature', 'construction'],
  label: 'All selectable geometry',
}

export const initialEditorState: EditorState = {
  mode: 'part',
  activeCommand: null,
  selection: [],
  selectionFilter: defaultSelectionFilter,
  hoverTarget: null,
  preview: null,
  activeEditSession: null,
}

export function getPrimitiveRefLabel(target: PrimitiveRef) {
  switch (target.kind) {
    case 'body':
      return target.bodyId
    case 'face':
      return `${target.bodyId}.${target.faceId}`
    case 'edge':
      return `${target.bodyId}.${target.edgeId}`
    case 'vertex':
      return `${target.bodyId}.${target.vertexId}`
    case 'sketch':
      return target.sketchId
    case 'sketchPrimitive':
      return `${target.sketchId}.${target.primitiveId}`
    case 'feature':
      return target.featureId
    case 'construction':
      return target.constructionId
  }
}

export function getPrimitiveRefKey(target: PrimitiveRef) {
  switch (target.kind) {
    case 'body':
      return `body:${target.bodyId}`
    case 'face':
      return `face:${target.bodyId}:${target.faceId}`
    case 'edge':
      return `edge:${target.bodyId}:${target.edgeId}`
    case 'vertex':
      return `vertex:${target.bodyId}:${target.vertexId}`
    case 'sketch':
      return `sketch:${target.sketchId}`
    case 'sketchPrimitive':
      return `sketchPrimitive:${target.sketchId}:${target.primitiveId}`
    case 'feature':
      return `feature:${target.featureId}`
    case 'construction':
      return `construction:${target.constructionId}`
  }
}

export function primitiveRefEquals(left: PrimitiveRef, right: PrimitiveRef) {
  return getPrimitiveRefKey(left) === getPrimitiveRefKey(right)
}

export function selectionFilterAllowsTarget(
  filter: SelectionFilter | null,
  target: PrimitiveRef,
) {
  return filter === null || filter.allowedKinds.includes(target.kind)
}

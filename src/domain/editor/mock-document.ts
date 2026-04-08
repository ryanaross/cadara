import type { FeatureId, PrimitiveRef } from '@/domain/editor/schema'

export const featureTreeSelections = {
  'origin-planes': { kind: 'construction', constructionId: 'construction_origin-planes' },
  'sketch-1': { kind: 'sketch', sketchId: 'sketch_primary' },
  'extrude-1': { kind: 'feature', featureId: 'feature_extrude-1' },
  'fillet-1': { kind: 'feature', featureId: 'feature_fillet-1' },
} as const satisfies Record<string, PrimitiveRef>

export const objectSelections = {
  'part-1': { kind: 'body', bodyId: 'body_part-1' },
  'surface-xy': { kind: 'construction', constructionId: 'construction_plane-xy' },
  'surface-yz': { kind: 'construction', constructionId: 'construction_plane-yz' },
} as const satisfies Record<string, PrimitiveRef>

export const viewportSelectionTargets = [
  { kind: 'face', bodyId: 'body_part-1', faceId: 'face_top' },
  { kind: 'edge', bodyId: 'body_part-1', edgeId: 'edge_outer-0' },
  { kind: 'vertex', bodyId: 'body_part-1', vertexId: 'vertex_front-right' },
] as const satisfies readonly PrimitiveRef[]

export const featureDraftLabels: Partial<Record<FeatureId, string>> = {
  'feature_extrude-1': 'Extrude 1',
  'feature_fillet-1': 'Fillet 1',
}

export function getFeatureDraftLabel(featureId: FeatureId) {
  return featureDraftLabels[featureId] ?? featureId
}

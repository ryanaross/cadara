import type {
  BodyId,
  ConstructionId,
  EdgeId,
  FaceId,
  FeatureId,
  LoopId,
  RegionId,
  SketchEntityId,
  SketchId,
  SketchPointId,
  VertexId,
} from '@/contracts/shared/ids'

/**
 * Durable reference to a body owned by the modeling backend.
 */
export interface BodyRef {
  kind: 'body'
  bodyId: BodyId
}

/**
 * Durable reference to a face. The face is owned by `bodyId`.
 */
export interface FaceRef {
  kind: 'face'
  bodyId: BodyId
  faceId: FaceId
}

/**
 * Durable reference to an edge. The edge is owned by `bodyId`.
 */
export interface EdgeRef {
  kind: 'edge'
  bodyId: BodyId
  edgeId: EdgeId
}

/**
 * Durable reference to a vertex. The vertex is owned by `bodyId`.
 */
export interface VertexRef {
  kind: 'vertex'
  bodyId: BodyId
  vertexId: VertexId
}

/**
 * Durable reference to a loop. The loop is owned by `bodyId`.
 */
export interface LoopRef {
  kind: 'loop'
  bodyId: BodyId
  loopId: LoopId
}

/**
 * Durable reference to an authored sketch.
 */
export interface SketchRef {
  kind: 'sketch'
  sketchId: SketchId
}

/**
 * Durable reference to a sketch entity.
 */
export interface SketchEntityRef {
  kind: 'sketchEntity'
  sketchId: SketchId
  entityId: SketchEntityId
}

/**
 * Durable reference to a sketch point.
 */
export interface SketchPointRef {
  kind: 'sketchPoint'
  sketchId: SketchId
  pointId: SketchPointId
}

/**
 * Durable reference to an authored feature.
 */
export interface FeatureRef {
  kind: 'feature'
  featureId: FeatureId
}

/**
 * Durable reference to authored construction geometry.
 */
export interface ConstructionRef {
  kind: 'construction'
  constructionId: ConstructionId
}

/**
 * Solver- or kernel-derived region/profile reference.
 * The editor must never author these directly.
 */
export interface RegionRef {
  kind: 'region'
  sketchId: SketchId
  regionId: RegionId
}

/**
 * Canonical durable reference union shared by editor and modeling contracts.
 */
export type DurableRef =
  | BodyRef
  | FaceRef
  | EdgeRef
  | VertexRef
  | LoopRef
  | SketchRef
  | SketchEntityRef
  | SketchPointRef
  | FeatureRef
  | ConstructionRef
  | RegionRef

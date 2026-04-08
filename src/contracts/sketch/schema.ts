import type {
  ConstraintId,
  DimensionId,
  RegionId,
  ReferenceId,
  SketchEntityId,
  SketchId,
  SketchPointId,
} from '@/contracts/shared/ids'
import type { OwnershipRecord } from '@/contracts/shared/diagnostics'
import type {
  ConstructionRef,
  EdgeRef,
  FaceRef,
  RegionRef,
  SketchEntityRef,
  SketchPointRef,
  SketchRef,
  VertexRef,
} from '@/contracts/shared/references'

/**
 * Declarative sketch-space point coordinates expressed in sketch plane units.
 * The sketch definition owns this tuple; callers must not infer world-space axes.
 */
export type SketchPoint2D = readonly [number, number]

/**
 * Versioned schema identifier for authored sketch payloads.
 */
export type SketchSchemaVersion = 'sketch-definition/v1alpha1'

/**
 * Versioned schema identifier for solved sketch payloads.
 */
export type SolvedSketchSchemaVersion = 'solved-sketch/v1alpha1'

/**
 * Current authored sketch schema version literal.
 */
export const SKETCH_SCHEMA_VERSION: SketchSchemaVersion = 'sketch-definition/v1alpha1'

/**
 * Current solved sketch schema version literal.
 */
export const SOLVED_SKETCH_SCHEMA_VERSION: SolvedSketchSchemaVersion = 'solved-sketch/v1alpha1'

/**
 * Durable authored sketch point definition.
 * The point record is part of the authored sketch graph and can be referenced by
 * entity endpoints, constraints, and dimensions.
 */
export interface SketchPointDefinition {
  /** Durable authored point identity within the containing sketch definition. */
  pointId: SketchPointId
  /** Human-readable label owned by the producer of the sketch definition. */
  label: string
  /** Durable target that must resolve to the same sketch as the containing record. */
  target: SketchPointRef
  /** Authored point coordinates in sketch-plane units relative to the parent sketch plane frame. */
  position: SketchPoint2D
  /** True when the point is construction-only and should not participate in profile/region extraction. */
  isConstruction: boolean
}

/**
 * Durable authored sketch entity definition.
 * The entity graph is authored input to the solver, not a solved/exported result.
 */
export type SketchEntityDefinition =
  | {
      kind: 'lineSegment'
      /** Durable authored entity identity within the containing sketch definition. */
      entityId: SketchEntityId
      /** Human-readable label owned by the producer of the sketch definition. */
      label: string
      /** Durable target that must resolve to the same sketch as the containing record. */
      target: SketchEntityRef
      /** True when the curve is construction-only and should not generate derived regions. */
      isConstruction: boolean
      /** Start endpoint reference. Must exist in `SketchDefinition.pointIds`. */
      startPointId: SketchPointId
      /** End endpoint reference. Must exist in `SketchDefinition.pointIds`. */
      endPointId: SketchPointId
    }
  | {
      kind: 'point'
      /** Durable authored entity identity within the containing sketch definition. */
      entityId: SketchEntityId
      /** Human-readable label owned by the producer of the sketch definition. */
      label: string
      /** Durable target that must resolve to the same sketch as the containing record. */
      target: SketchEntityRef
      /** True when the point is construction-only and should not generate derived regions. */
      isConstruction: boolean
      /** Referenced point record represented by this point entity. */
      pointId: SketchPointId
    }
  | {
      kind: 'circle'
      /** Durable authored entity identity within the containing sketch definition. */
      entityId: SketchEntityId
      /** Human-readable label owned by the producer of the sketch definition. */
      label: string
      /** Durable target that must resolve to the same sketch as the containing record. */
      target: SketchEntityRef
      /** True when the curve is construction-only and should not generate derived regions. */
      isConstruction: boolean
      /** Center-point reference. Must exist in `SketchDefinition.pointIds`. */
      centerPointId: SketchPointId
      /** Authored radius in sketch-plane units. Must be greater than zero. */
      radius: number
    }
  | {
      kind: 'arc'
      /** Durable authored entity identity within the containing sketch definition. */
      entityId: SketchEntityId
      /** Human-readable label owned by the producer of the sketch definition. */
      label: string
      /** Durable target that must resolve to the same sketch as the containing record. */
      target: SketchEntityRef
      /** True when the curve is construction-only and should not generate derived regions. */
      isConstruction: boolean
      /** Arc center-point reference. Must exist in `SketchDefinition.pointIds`. */
      centerPointId: SketchPointId
      /** Arc start-point reference. Must exist in `SketchDefinition.pointIds`. */
      startPointId: SketchPointId
      /** Arc end-point reference. Must exist in `SketchDefinition.pointIds`. */
      endPointId: SketchPointId
      /** Sweep direction from start to end around `centerPointId`. */
      sweepDirection: 'clockwise' | 'counterClockwise'
    }

/**
 * Durable authored geometric constraint definition.
 * The editor may author these; the solver owns their satisfaction status.
 */
export type ConstraintDefinition =
  | {
      constraintId: ConstraintId
      kind: 'coincident'
      /** Human-readable label owned by the producer of the sketch definition. */
      label: string
      /** Two distinct point references that the solver must force to the same solved position. */
      pointIds: readonly [SketchPointId, SketchPointId]
    }
  | {
      constraintId: ConstraintId
      kind: 'horizontal'
      /** Human-readable label owned by the producer of the sketch definition. */
      label: string
      /** Constrained line entity. Must exist in `SketchDefinition.entityIds`. */
      entityId: SketchEntityId
    }
  | {
      constraintId: ConstraintId
      kind: 'vertical'
      /** Human-readable label owned by the producer of the sketch definition. */
      label: string
      /** Constrained line entity. Must exist in `SketchDefinition.entityIds`. */
      entityId: SketchEntityId
    }

/**
 * Durable authored dimension definition.
 * Dimensions are solver-facing authored inputs and must not be inferred from UI state.
 */
export type DimensionDefinition =
  | {
      dimensionId: DimensionId
      kind: 'distance'
      /** Human-readable label owned by the producer of the sketch definition. */
      label: string
      /** Axis interpretation for `value` within the sketch-plane frame. */
      axis: 'aligned' | 'horizontal' | 'vertical'
      /** Two referenced points whose solved separation must match `value`. */
      pointIds: readonly [SketchPointId, SketchPointId]
      /** Requested dimension value in sketch-plane units. */
      value: number
    }
  | {
      dimensionId: DimensionId
      kind: 'circleRadius'
      /** Human-readable label owned by the producer of the sketch definition. */
      label: string
      /** Referenced circle entity whose solved radius must match `value`. */
      entityId: SketchEntityId
      /** Requested radius value in sketch-plane units. */
      value: number
    }

/**
 * Durable authored external sketch reference definition.
 * These records describe solver inputs that originate outside the local sketch graph.
 */
export type SketchReferenceDefinition =
  | {
      /** Durable authored reference identity within the containing sketch definition. */
      referenceId: ReferenceId
      kind: 'constructionPlane'
      /** Human-readable label owned by the producer of the sketch definition. */
      label: string
      /** External construction plane driving the sketch reference frame or derived projections. */
      source: ConstructionRef
      /** Declared projection mode into sketch-space coordinates. */
      projectionMode: 'coplanar'
    }
  | {
      /** Durable authored reference identity within the containing sketch definition. */
      referenceId: ReferenceId
      kind: 'modelReference'
      /** Human-readable label owned by the producer of the sketch definition. */
      label: string
      /** External model reference projected into sketch space for solving. */
      source: FaceRef | EdgeRef | VertexRef
      /** Declared projection mode into sketch-space coordinates. */
      projectionMode: 'projectAlongPlaneNormal' | 'useExistingCoplanarGeometry'
    }

/**
 * Durable authored sketch graph submitted to the solver/kernel boundary.
 * Regions are deliberately absent because the editor must not author them.
 */
export interface SketchDefinition {
  /** Schema version for the authored sketch definition payload. */
  schemaVersion: SketchSchemaVersion
  /** Canonical authored external-reference order. Each ID must be unique and appear exactly once in `references`. */
  referenceIds: ReferenceId[]
  /** Authored external references consumed by the solver alongside the local sketch graph. */
  references: SketchReferenceDefinition[]
  /** Canonical authored point order. Each ID must be unique and appear exactly once in `points`. */
  pointIds: SketchPointId[]
  /** Authored sketch points owned by the containing sketch definition. */
  points: SketchPointDefinition[]
  /** Canonical authored entity order. Each ID must be unique and appear exactly once in `entities`. */
  entityIds: SketchEntityId[]
  /** Authored sketch entities owned by the containing sketch definition. */
  entities: SketchEntityDefinition[]
  /** Canonical authored constraint order. Each ID must be unique and appear exactly once in `constraints`. */
  constraintIds: ConstraintId[]
  /** Authored geometric constraints owned by the containing sketch definition. */
  constraints: ConstraintDefinition[]
  /** Canonical authored dimension order. Each ID must be unique and appear exactly once in `dimensions`. */
  dimensionIds: DimensionId[]
  /** Authored dimensions owned by the containing sketch definition. */
  dimensions: DimensionDefinition[]
}

/**
 * Solver-owned solved point position for an authored sketch point.
 */
export interface SolvedSketchPointRecord {
  /** Authored point identity being reported in solved space. */
  pointId: SketchPointId
  /** Durable point target owned by the same sketch as the containing solved snapshot. */
  target: SketchPointRef
  /** Solver-computed point coordinates in sketch-plane units. */
  solvedPosition: SketchPoint2D
}

/**
 * Solver-owned solved sketch status summary.
 */
export type SolvedSketchStatus =
  | 'unsolved'
  | 'solved'
  | 'underConstrained'
  | 'fullyConstrained'
  | 'overConstrained'
  | 'inconsistent'
  | 'partiallySolved'

/**
 * Solver-owned solved entity geometry.
 * Geometry records are authoritative solver outputs, not authored inputs.
 */
export type SolvedSketchEntityGeometryRecord =
  | {
      entityId: SketchEntityId
      kind: 'point'
      solvedPosition: SketchPoint2D
    }
  | {
      entityId: SketchEntityId
      kind: 'lineSegment'
      startPosition: SketchPoint2D
      endPosition: SketchPoint2D
    }
  | {
      entityId: SketchEntityId
      kind: 'circle'
      centerPosition: SketchPoint2D
      solvedRadius: number
    }
  | {
      entityId: SketchEntityId
      kind: 'arc'
      centerPosition: SketchPoint2D
      startPosition: SketchPoint2D
      endPosition: SketchPoint2D
      sweepDirection: 'clockwise' | 'counterClockwise'
    }

/**
 * Solver-owned per-constraint status payload.
 */
export interface ConstraintStatusRecord {
  /** Authored constraint identity being reported. */
  constraintId: ConstraintId
  /** Machine-readable evaluation result for the authored constraint. */
  status: 'satisfied' | 'unsatisfied' | 'conflicting'
}

/**
 * Solver-owned per-dimension status payload.
 */
export interface DimensionStatusRecord {
  /** Authored dimension identity being reported. */
  dimensionId: DimensionId
  /** Machine-readable evaluation result for the authored dimension. */
  status: 'driving' | 'driven' | 'unsatisfied'
  /** Solver-computed value in sketch-plane units when available. */
  solvedValue: number | null
}

/**
 * Solver-owned machine-readable diagnostic payload for sketch solving.
 */
export interface SketchSolveDiagnostic {
  /** Stable diagnostic code for programmatic handling. */
  code: string
  /** Severity emitted by the solver/kernel producer. */
  severity: 'info' | 'warning' | 'error'
  /** Human-readable diagnostic summary. */
  message: string
  /** Precise authored or derived target implicated by the diagnostic, when known. */
  target:
    | { kind: 'entity'; entityId: SketchEntityId }
    | { kind: 'point'; pointId: SketchPointId }
    | { kind: 'constraint'; constraintId: ConstraintId }
    | { kind: 'dimension'; dimensionId: DimensionId }
    | { kind: 'region'; regionId: RegionId }
    | null
}

/**
 * Solver-owned solved sketch snapshot.
 * This record is derived output and may differ from authored input positions.
 */
export interface SolvedSketchSnapshot {
  /** Schema version for the solved sketch payload. */
  schemaVersion: SolvedSketchSchemaVersion
  /** Solver-owned constraint-status summary for the containing sketch. */
  status: SolvedSketchStatus
  /** Solver-computed geometry per authored entity when available. */
  solvedEntities: SolvedSketchEntityGeometryRecord[]
  /** Solver-computed point positions for authored points that remain valid in this solution. */
  solvedPoints: SolvedSketchPointRecord[]
  /** Solver-computed status per authored constraint. */
  constraintStatuses: ConstraintStatusRecord[]
  /** Solver-computed status/value per authored dimension. */
  dimensionStatuses: DimensionStatusRecord[]
  /** Solver/kernel diagnostics for the current solved sketch state. */
  diagnostics: SketchSolveDiagnostic[]
}

/**
 * Solver- or kernel-derived closed region record.
 * The editor must never author or persist these as primary sketch input.
 */
export interface RegionRecord extends OwnershipRecord {
  /** Durable derived region identity owned by the solver/kernel layer. */
  regionId: RegionId
  /** Human-readable label owned by the solver/kernel producer. */
  label: string
  /** Durable region reference for downstream feature authoring. */
  target: RegionRef
  /** Owning sketch from which the region was derived. */
  sourceSketch: SketchRef
  /** Boundary entities in traversal order around the region perimeter. */
  boundaryEntityIds: SketchEntityId[]
  /** Boundary points in traversal order paired with `boundaryEntityIds`. */
  boundaryPointIds: SketchPointId[]
  /** False when the producer is reporting an incomplete or invalid derived region candidate. */
  isClosed: boolean
}

/**
 * Durable authored sketch snapshot payload shared by document snapshots.
 * Authored graph, solved graph, and derived regions are separated explicitly.
 */
export interface SketchRecord extends OwnershipRecord {
  /** Durable sketch identity owned by the modeling layer. */
  sketchId: SketchId
  /** Human-readable sketch label owned by the modeling layer. */
  label: string
  /** Durable authored sketch graph submitted for solving and downstream feature use. */
  definition: SketchDefinition
  /** Solver-owned solved state corresponding to `definition` at the current revision. */
  solvedSnapshot: SolvedSketchSnapshot
  /** Derived regions owned by the solver/kernel layer for the current solved sketch state. */
  regions: RegionRecord[]
}

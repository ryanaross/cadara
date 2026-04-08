import type {
  BodyId,
  ConstructionId,
  DocumentId,
  EdgeId,
  FaceId,
  FeatureId,
  FeatureTreeNodeId,
  ObjectTreeNodeId,
  PickId,
  RenderableId,
  RevisionId,
  SketchId,
  SnapshotEntityId,
  PreviewId,
  ReferenceId,
  RequestId,
  VertexId,
} from '@/contracts/shared/ids'
import type { OwnershipRecord } from '@/contracts/shared/diagnostics'
import type { DurableRef } from '@/contracts/shared/references'
import type { SketchPoint2D, SketchRecord } from '@/contracts/sketch/schema'
import type {
  ContractVersion,
  FeatureTypeVersion,
  SnapshotSchemaVersion,
} from '@/contracts/shared/versioning'

export type { PreviewId, ReferenceId }
export type PrimitiveRef = DurableRef
export type SketchPlaneKey = 'xy' | 'yz' | 'xz'
export type FeatureBooleanOperation = 'newBody' | 'add' | 'remove'
export type SketchPoint = SketchPoint2D

/**
 * Transitional feature family identifiers supported by the current scaffold.
 * This is intentionally narrow rather than an open `string`.
 */
export type LegacyFeatureType = 'extrude' | 'fillet'

/**
 * Transitional extrude payload currently supported by the modeling boundary.
 * `profileTarget` must identify a durable derived region, durable sketch, or planar face
 * seed owned by the same document revision as the containing request or snapshot.
 */
export interface ExtrudeFeatureParameterPayload {
  depth: number
  direction: 'oneSided'
  operation: FeatureBooleanOperation
  profileTarget: PrimitiveRef
}

/**
 * Transitional fillet payload currently supported by the modeling boundary.
 * `radius` is expressed in document modeling units.
 */
export interface FilletFeatureParameterPayload {
  radius: number
}

/**
 * Transitional feature payload union currently supported by the modeling
 * boundary. The currently valid variants are fully enumerated here even though
 * Phase 4 will later replace them with dedicated feature-family contracts.
 */
export type LegacyFeatureParameterPayload =
  | ExtrudeFeatureParameterPayload
  | FilletFeatureParameterPayload

/**
 * Machine-readable invalidation payload for destroyed or replaced references.
 * Implementers must not silently remap invalid references.
 * `reason` must be backend-defined and machine-readable.
 * `target` and `sourceTarget` must identify the exact failed reference context.
 * Allowed invalidation reasons are backend-defined stable codes such as missing
 * topology, deleted sketch seed, or revision mismatch; callers must not parse
 * human-readable messages for control flow.
 */
export interface InvalidReferenceDetailPayload {
  reason: string
  target: PrimitiveRef
  ownerFeatureId: FeatureId | null
  ownerSketchId: SketchId | null
  sourceTarget: PrimitiveRef | null
}

/**
 * Structured modeling diagnostic detail payload.
 * Each variant is machine-readable and must preserve enough context for the
 * caller to explain the failure without guessing.
 */
export type ModelingDiagnosticDetail =
  | {
      kind: 'invalidReference'
      reference: InvalidReferenceDetailPayload
    }
  | {
      kind: 'revisionConflict'
      expectedRevisionId: RevisionId
      actualRevisionId: RevisionId
    }
  | {
      kind: 'stalePreview'
      previewId: PreviewId
      requestedRevisionId: RevisionId
      currentRevisionId: RevisionId
    }
    | {
      kind: 'rebuildFailure'
      affectedFeatureIds: FeatureId[]
      affectedTargets: PrimitiveRef[]
    }

/**
 * Revision acceptance state for a document mutation.
 * Conflicts must report both the expected and actual revision IDs.
 */
export type MutationRevisionState =
  | {
      kind: 'accepted'
      baseRevisionId: RevisionId
    }
  | {
      kind: 'conflict'
      expectedRevisionId: RevisionId
      actualRevisionId: RevisionId
    }

/**
 * Freshness state for preview evaluation results.
 * Preview responses may be stale when the base revision no longer matches the
 * current document revision.
 */
export type PreviewFreshness =
  | {
      kind: 'fresh'
      baseRevisionId: RevisionId
    }
  | {
      kind: 'stale'
      requestedRevisionId: RevisionId
      currentRevisionId: RevisionId
    }

/**
 * Top-level diagnostic record returned by the modeling boundary.
 */
export interface ModelingDiagnostic {
  code: string
  severity: 'info' | 'warning' | 'error'
  message: string
  target: PrimitiveRef | null
  detail: ModelingDiagnosticDetail | null
}

/**
 * Ownership metadata for durable snapshot records.
 * All durable records must resolve back to an owning document/revision, and to
 * their owning feature/sketch/body when applicable.
 */
export type SnapshotOwnershipRecord = OwnershipRecord

/**
 * Presentational feature-tree node derived from durable snapshot state.
 * `id` is a UI/view-model key only; durable identity is carried by `target`.
 */
export interface FeatureTreeNodeRecord {
  id: FeatureTreeNodeId
  label: string
  description: string
  kind: 'plane' | 'sketch' | 'feature'
  target: PrimitiveRef
  ownerFeatureId: FeatureId | null
  ownerSketchId: SketchId | null
  sourceFeatureId: FeatureId | null
}

/**
 * Presentational object-tree node derived from durable snapshot state.
 * `id` is a UI/view-model key only; durable identity is carried by `target`.
 */
export interface ObjectTreeNodeRecord {
  id: ObjectTreeNodeId
  label: string
  description: string
  kind: 'body' | 'construction'
  target: PrimitiveRef
  ownerBodyId: BodyId | null
  ownerFeatureId: FeatureId | null
}

/**
 * Durable named reference record.
 * Ownership fields must resolve the reference back to document/revision and any
 * owning feature/sketch context.
 * `target` must always be a canonical durable reference.
 * Invalid references must never silently remap; they must instead populate
 * `invalidation` with a machine-readable failure reason.
 */
export interface ReferenceRecord {
  id: ReferenceId
  label: string
  target: PrimitiveRef
  ownerFeatureId: FeatureId | null
  ownerSketchId: SketchId | null
  invalidation: InvalidReferenceDetailPayload | null
}

/**
 * Transient render export record for viewport rendering and picking.
 * `id` and `pickBinding.pickId` are render/picking keys only; durable identity
 * is carried by `target`.
 */
export interface RenderableEntityRecord {
  id: RenderableId
  label: string
  target: PrimitiveRef
  ownerBodyId: BodyId | null
  ownerFeatureId: FeatureId | null
  topology: 'face' | 'edge' | 'vertex'
  pickBinding: {
    pickId: PickId
    target: PrimitiveRef
    topology: 'face' | 'edge' | 'vertex'
  }
  geometry:
    | {
        kind: 'planarFace'
        center: readonly [number, number, number]
        size: readonly [number, number]
        normalAxis: 'x' | 'y' | 'z'
      }
    | {
        kind: 'polyline'
        points: readonly (readonly [number, number, number])[]
      }
    | {
        kind: 'pointMarker'
        position: readonly [number, number, number]
        radius: number
      }
}

export interface SketchSnapshotRecord extends SnapshotOwnershipRecord {
  sketchId: SketchId
  label: string
  planeTarget: PrimitiveRef
  planeKey: SketchPlaneKey
  sketch: SketchRecord
}

/**
 * Durable feature snapshot.
 * `featureType` and `parameterPayload` are transitional, but their currently
 * supported variants are explicitly declared in this contract.
 */
export interface FeatureSnapshotRecord extends SnapshotOwnershipRecord {
  featureId: FeatureId
  label: string
  featureType: LegacyFeatureType
  featureTypeVersion: FeatureTypeVersion
  parameterPayload: LegacyFeatureParameterPayload
  consumedTargets: PrimitiveRef[]
  producedTargets: PrimitiveRef[]
}

/**
 * Durable topology membership for a body snapshot.
 */
export interface BodyTopologySnapshotRecord {
  faceIds: FaceId[]
  edgeIds: EdgeId[]
  vertexIds: VertexId[]
}

/**
 * Durable body snapshot record.
 */
export interface BodySnapshotRecord extends SnapshotOwnershipRecord {
  bodyId: BodyId
  label: string
  topology: BodyTopologySnapshotRecord
}

/**
 * Durable construction snapshot record.
 */
export interface ConstructionSnapshotRecord extends SnapshotOwnershipRecord {
  constructionId: ConstructionId
  label: string
  constructionType: 'plane'
  target: PrimitiveRef
}

/**
 * Presentational entity graph record derived from durable snapshot state.
 * `id` is a view-model key only; durable identity is carried by `target`.
 */
export interface SnapshotEntityRecord extends SnapshotOwnershipRecord {
  id: SnapshotEntityId
  label: string
  target: PrimitiveRef
  relatedTargets: PrimitiveRef[]
  consumedByFeatureIds: FeatureId[]
}

/**
 * Canonical document snapshot payload for the current modeling boundary.
 */
export interface DocumentSnapshot {
  contractVersion: ContractVersion
  schemaVersion: SnapshotSchemaVersion
  documentId: DocumentId
  revisionId: RevisionId
  featureTree: FeatureTreeNodeRecord[]
  objects: ObjectTreeNodeRecord[]
  features: FeatureSnapshotRecord[]
  sketches: SketchSnapshotRecord[]
  bodies: BodySnapshotRecord[]
  constructions: ConstructionSnapshotRecord[]
  entities: SnapshotEntityRecord[]
  references: ReferenceRecord[]
  diagnostics: ModelingDiagnostic[]
  renderables: RenderableEntityRecord[]
}

/**
 * Base request envelope for all modeling operations.
 */
export interface BaseModelingRequest {
  contractVersion: ContractVersion
}

/**
 * Base request envelope scoped to a document.
 */
export interface BaseDocumentRequest extends BaseModelingRequest {
  documentId: DocumentId
}

/**
 * Mutation request envelope scoped to a base revision.
 */
export interface DocumentMutationRequest extends BaseDocumentRequest {
  baseRevisionId: RevisionId
}

/**
 * Common mutation result envelope.
 */
export interface ModelingOperationResult {
  contractVersion: ContractVersion
  documentId: DocumentId
  revisionId: RevisionId
  revisionState: MutationRevisionState
  changedTargets: PrimitiveRef[]
  diagnostics: ModelingDiagnostic[]
}

export type GetDocumentSnapshotRequest = BaseDocumentRequest

/**
 * Response envelope for a full document snapshot fetch.
 */
export interface GetDocumentSnapshotResponse {
  snapshot: DocumentSnapshot
}

/**
 * Transitional feature-creation request.
 * The currently valid payload variants are explicitly enumerated by
 * `LegacyFeatureParameterPayload`.
 */
export interface CreateFeatureRequest extends DocumentMutationRequest {
  featureType: LegacyFeatureType
  featureTypeVersion: FeatureTypeVersion
  parameterPayload: LegacyFeatureParameterPayload
  consumedTargets: PrimitiveRef[]
}

/**
 * Feature creation response.
 */
export interface CreateFeatureResponse extends ModelingOperationResult {
  featureId: FeatureId
}

/**
 * Transitional feature-update request.
 * The currently valid payload variants are explicitly enumerated by
 * `LegacyFeatureParameterPayload`.
 */
export interface UpdateFeatureRequest extends DocumentMutationRequest {
  featureId: FeatureId
  featureTypeVersion: FeatureTypeVersion
  parameterPayload: LegacyFeatureParameterPayload
  consumedTargets: PrimitiveRef[]
}

/**
 * Feature update response.
 */
export interface UpdateFeatureResponse extends ModelingOperationResult {
  featureId: FeatureId
}

export interface CommitSketchRequest extends DocumentMutationRequest {
  /** Editor- or orchestrator-owned correlation IDs for explicit solver sub-requests. */
  solverCorrelation: {
    /** Parent request ID for the sketch commit workflow. */
    requestId: RequestId
    /** Correlation ID for explicit external-reference projection. */
    projectionRequestId: RequestId
    /** Correlation ID for explicit sketch validation. */
    validationRequestId: RequestId
    /** Correlation ID for explicit sketch solve. */
    solveRequestId: RequestId
    /** Correlation ID for explicit region derivation. */
    regionRequestId: RequestId
  } | null
  sketchId: SketchId | null
  sketchLabel: string
  planeTarget: PrimitiveRef
  planeKey: SketchPlaneKey
  definition: SketchRecord['definition']
}

/**
 * Sketch commit response.
 */
export interface CommitSketchResponse extends ModelingOperationResult {
  sketchId: SketchId
}

/**
 * Feature deletion request.
 */
export interface DeleteFeatureRequest extends DocumentMutationRequest {
  featureId: FeatureId
}

/**
 * Feature deletion response.
 */
export interface DeleteFeatureResponse extends ModelingOperationResult {
  deletedFeatureId: FeatureId
}

/**
 * Transitional preview request.
 * The currently valid payload variants are explicitly enumerated by
 * `LegacyFeatureParameterPayload`.
 */
export interface EvaluatePreviewRequest extends DocumentMutationRequest {
  previewId: PreviewId
  featureType: LegacyFeatureType
  featureTypeVersion: FeatureTypeVersion
  parameterPayload: LegacyFeatureParameterPayload
  consumedTargets: PrimitiveRef[]
}

/**
 * Preview evaluation response.
 */
export interface EvaluatePreviewResponse {
  contractVersion: ContractVersion
  documentId: DocumentId
  revisionId: RevisionId
  previewId: PreviewId
  freshness: PreviewFreshness
  renderables: RenderableEntityRecord[]
  diagnostics: ModelingDiagnostic[]
}

/**
 * Reference resolution request.
 */
export interface ResolveReferenceRequest extends BaseDocumentRequest {
  target: PrimitiveRef
}

/**
 * Resolved durable reference record.
 * Ownership fields must resolve the reference back to document/revision and any
 * owning feature/sketch/body context.
 * `target` must always be a canonical durable reference.
 * Implementers must not silently remap invalid references; unresolved or
 * invalidated references must report the failure in `invalidation`.
 */
export interface ResolvedReferenceRecord {
  label: string
  target: PrimitiveRef
  ownerDocumentId: DocumentId
  ownerRevisionId: RevisionId
  ownerFeatureId: FeatureId | null
  ownerSketchId: SketchId | null
  ownerBodyId: BodyId | null
  invalidation: InvalidReferenceDetailPayload | null
}

/**
 * Reference resolution response.
 */
export interface ResolveReferenceResponse {
  contractVersion: ContractVersion
  resolution: ResolvedReferenceRecord
  diagnostics: ModelingDiagnostic[]
}

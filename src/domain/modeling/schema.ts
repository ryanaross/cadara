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
  RegionId,
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
 * Canonical feature families currently exposed by the kernel contract.
 * This union is closed so callers cannot invent feature types ad hoc.
 */
export type FeatureKind = 'extrude' | 'fillet' | 'plane' | 'revolve'

/**
 * Durable reference accepted as an extrude profile seed.
 * `region` means one explicit solver- or kernel-derived closed profile.
 * `face` means one explicit planar face owned by the current document revision.
 * Whole-sketch references are intentionally excluded so profile ownership is
 * never inferred from hidden loop-selection conventions.
 */
export type ExtrudeProfileRef =
  | { kind: 'region'; sketchId: SketchId; regionId: RegionId }
  | { kind: 'face'; bodyId: BodyId; faceId: FaceId }

/**
 * Fully typed extrude parameters.
 * `profile` is the single authoritative seed reference; callers must not repeat
 * the same meaning in side-band generic arrays.
 * `depth` is expressed in document modeling units and must be strictly positive.
 */
export interface ExtrudeFeatureParameters {
  /** Single authoritative profile seed for the extrude operation. */
  profile: ExtrudeProfileRef
  /** Positive extrusion distance in document modeling units. */
  depth: number
  /** Direction policy for this schema version. */
  direction: 'oneSided'
  /** Boolean behavior applied to the extrude result. */
  operation: FeatureBooleanOperation
}

/**
 * Fillet edge reference accepted by the kernel contract.
 */
export interface FilletEdgeRef {
  /** Durable edge reference; this variant is fixed for fillet target lists. */
  kind: 'edge'
  bodyId: BodyId
  edgeId: EdgeId
}

/**
 * Fully typed fillet parameters.
 * `edgeTargets` lists the exact durable edges to round.
 * `radius` is expressed in document modeling units and must be strictly positive.
 */
export interface FilletFeatureParameters {
  /** Exact durable edges to round; order has no semantic meaning. */
  edgeTargets: readonly FilletEdgeRef[]
  /** Positive fillet radius in document modeling units. */
  radius: number
}

/**
 * Construction-plane reference accepted by plane features.
 */
export interface PlaneReferenceTarget {
  /** Single coplanar seed reference used to create the construction plane. */
  target: { kind: 'construction'; constructionId: ConstructionId } | { kind: 'face'; bodyId: BodyId; faceId: FaceId }
}

/**
 * Fully typed plane parameters.
 * This placeholder contract intentionally supports only a single coplanar seed so
 * later extensions can add offset/angle variants without weakening current typing.
 */
export interface PlaneFeatureParameters {
  /** Plane creation mode for this schema version. */
  mode: 'coplanar'
  /** Single coplanar reference used to define the resulting plane. */
  reference: PlaneReferenceTarget
}

/**
 * Placeholder revolve profile reference.
 * This exists because the toolbar already exposes revolve and the plan allows a
 * placeholder if the feature is planned soon.
 */
export type RevolveProfileRef = ExtrudeProfileRef

/**
 * Placeholder revolve axis reference.
 * Axis ownership must remain durable and explicit.
 */
export type RevolveAxisRef =
  | { kind: 'edge'; bodyId: BodyId; edgeId: EdgeId }
  | { kind: 'construction'; constructionId: ConstructionId }

/**
 * Placeholder revolve parameters.
 * The kernel may reject these requests as unsupported, but the request shape is
 * already specific enough for an implementer to build against without guessing.
 */
export interface RevolveFeatureParameters {
  /** Explicit closed profile seed to revolve. */
  profile: RevolveProfileRef
  /** Explicit axis reference used by the revolve. */
  axis: RevolveAxisRef
  /** Rotation angle in document modeling units. */
  angle: number
  /** Boolean behavior applied to the revolve result. */
  operation: FeatureBooleanOperation
}

/**
 * Canonical typed feature definitions used across requests and snapshots.
 * Each variant owns its required references and parameters directly.
 */
export type FeatureDefinition =
  | {
      /** Stable discriminant for extrude features. */
      kind: 'extrude'
      /** Per-variant schema version owned by the extrude contract family. */
      featureTypeVersion: FeatureTypeVersion
      /** Exact rebuild inputs owned by this extrude feature instance. */
      parameters: ExtrudeFeatureParameters
    }
  | {
      /** Stable discriminant for fillet features. */
      kind: 'fillet'
      /** Per-variant schema version owned by the fillet contract family. */
      featureTypeVersion: FeatureTypeVersion
      parameters: FilletFeatureParameters
    }
  | {
      /** Stable discriminant for plane features. */
      kind: 'plane'
      /** Per-variant schema version owned by the plane contract family. */
      featureTypeVersion: FeatureTypeVersion
      parameters: PlaneFeatureParameters
    }
  | {
      /** Stable discriminant for revolve features. */
      kind: 'revolve'
      /** Per-variant schema version owned by the revolve contract family. */
      featureTypeVersion: FeatureTypeVersion
      parameters: RevolveFeatureParameters
    }

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
 * `accepted` means the mutation was committed against `baseRevisionId`.
 * `conflict` means the base revision was stale before validation completed.
 * `rejected` means the request was evaluated against the requested revision but
 * failed contract validation or capability checks and therefore did not commit.
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
  | {
      kind: 'rejected'
      baseRevisionId: RevisionId
      reasonCode: string
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
 * The embedded `definition` is authoritative and must contain every required
 * reference and parameter needed to rebuild the feature.
 */
export interface FeatureSnapshotRecordBase extends SnapshotOwnershipRecord {
  /** Durable feature identity. */
  featureId: FeatureId
  /** Human-readable feature label owned by the modeling system. */
  label: string
  /**
   * Durable targets created or materially re-owned by the rebuilt feature.
   * Unaffected targets must remain absent rather than inferred by callers.
   * Destroyed or replaced durable targets must be surfaced through invalidation
   * diagnostics rather than by silently removing them from this list.
   */
  producedTargets: PrimitiveRef[]
}

export type FeatureSnapshotRecord = FeatureSnapshotRecordBase & {
  /** Authoritative typed feature definition used to rebuild this feature. */
  definition: FeatureDefinition
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
 * Base typed feature mutation request.
 * `definition` is the only authoritative feature payload.
 * Invalid or unsupported definitions must return `revisionState.kind === "rejected"`
 * with machine-readable diagnostics and no committed mutation.
 */
export interface FeatureMutationRequest extends DocumentMutationRequest {
  /**
   * Exact feature definition owned by the request.
   * The kernel must reject invalid references or unsupported parameter
   * combinations explicitly rather than inferring omitted intent.
   */
  definition: FeatureDefinition
}

/**
 * Feature creation response.
 * `revisionState.kind === "accepted"` means the feature was committed.
 * `revisionState.kind === "rejected"` means the request was evaluated but the
 * definition could not be committed.
 */
export interface CreateFeatureResponse extends ModelingOperationResult {
  featureId: FeatureId
}

/**
 * Feature creation request.
 */
export interface CreateFeatureRequest extends FeatureMutationRequest {}

/**
 * Feature update request.
 */
export interface UpdateFeatureRequest extends FeatureMutationRequest {
  /** Durable feature identity to replace in-place. */
  featureId: FeatureId
}

/**
 * Feature update response.
 * Rejected updates must preserve durable identity and report why the update did
 * not commit.
 */
export interface UpdateFeatureResponse extends ModelingOperationResult {
  featureId: FeatureId
}

/**
 * Feature reorder request.
 * `beforeFeatureId` inserts the moved feature before another durable feature.
 * Null appends the feature to the end of the feature list.
 */
export interface ReorderFeatureRequest extends DocumentMutationRequest {
  /** Durable feature identity being moved in the feature list. */
  featureId: FeatureId
  /** Null appends to the tail; otherwise insert immediately before this feature. */
  beforeFeatureId: FeatureId | null
}

/**
 * Feature reorder response.
 */
export interface ReorderFeatureResponse extends ModelingOperationResult {
  /** Durable feature identity that was reordered. */
  featureId: FeatureId
  /** Final insertion anchor accepted by the kernel for this reorder request. */
  beforeFeatureId: FeatureId | null
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
 * Typed feature preview request.
 * The previewed feature definition is explicit and must not depend on out-of-band
 * generic target arrays.
 */
export interface EvaluatePreviewRequest extends DocumentMutationRequest {
  /** Editor-owned preview identity used to correlate stale responses. */
  previewId: PreviewId
  /** Exact typed feature definition to preview against `baseRevisionId`. */
  definition: FeatureDefinition
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

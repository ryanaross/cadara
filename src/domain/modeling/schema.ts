import type {
  BodyId,
  ConstructionId,
  EdgeId,
  DocumentId,
  FaceId,
  FeatureId,
  PrimitiveRef,
  RevisionId,
  SketchId,
  SketchPrimitiveId,
  VertexId,
} from '@/domain/editor/schema'

export type ContractVersion = 'modeling-contract/v1alpha1'
export type SnapshotSchemaVersion = 'document-snapshot/v1alpha1'
export type FeatureTypeVersion = 'feature-type/v1alpha1'
export type PreviewId = `preview_${string}`
export type ReferenceId = `ref_${string}`
export type SketchPlaneKey = 'xy' | 'yz' | 'xz'
export type FeatureBooleanOperation = 'newBody' | 'add' | 'remove'

export type SketchPoint = readonly [number, number]

export interface InvalidReferenceDetailPayload {
  reason: string
  target: PrimitiveRef
  ownerFeatureId: FeatureId | null
  ownerSketchId: SketchId | null
  sourceTarget: PrimitiveRef | null
}

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

export type SketchPrimitiveGeometry =
  | {
      kind: 'line'
      start: SketchPoint
      end: SketchPoint
    }
  | {
      kind: 'circle'
      center: SketchPoint
      radius: number
    }
  | {
      kind: 'point'
      position: SketchPoint
    }
  | {
      kind: 'profile'
      boundaryPrimitiveIds: SketchPrimitiveId[]
    }

export interface ModelingDiagnostic {
  code: string
  severity: 'info' | 'warning' | 'error'
  message: string
  target: PrimitiveRef | null
  detail: ModelingDiagnosticDetail | null
}

export interface SnapshotOwnershipRecord {
  ownerDocumentId: DocumentId
  ownerRevisionId: RevisionId
  ownerFeatureId: FeatureId | null
  ownerSketchId: SketchId | null
  ownerBodyId: BodyId | null
}

export interface FeatureTreeNodeRecord {
  id: string
  label: string
  description: string
  kind: 'plane' | 'sketch' | 'feature'
  target: PrimitiveRef
  ownerFeatureId: FeatureId | null
  ownerSketchId: SketchId | null
  sourceFeatureId: FeatureId | null
}

export interface ObjectTreeNodeRecord {
  id: string
  label: string
  description: string
  kind: 'body' | 'construction'
  target: PrimitiveRef
  ownerBodyId: BodyId | null
  ownerFeatureId: FeatureId | null
}

export interface ReferenceRecord {
  id: ReferenceId
  label: string
  target: PrimitiveRef
  ownerFeatureId: FeatureId | null
  ownerSketchId: SketchId | null
  invalidation: InvalidReferenceDetailPayload | null
}

export interface RenderableEntityRecord {
  id: string
  label: string
  target: PrimitiveRef
  ownerBodyId: BodyId | null
  ownerFeatureId: FeatureId | null
  topology: 'face' | 'edge' | 'vertex'
  pickBinding: {
    pickId: `pick_${string}`
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

export interface SketchPrimitiveRecord {
  primitiveId: SketchPrimitiveId
  label: string
  kind: 'line' | 'circle' | 'arc' | 'point' | 'profile'
  target: PrimitiveRef
  geometry: SketchPrimitiveGeometry
}

export interface SketchSnapshotRecord extends SnapshotOwnershipRecord {
  sketchId: SketchId
  label: string
  planeTarget: PrimitiveRef
  planeKey: SketchPlaneKey
  primitiveIds: SketchPrimitiveId[]
  primitives: SketchPrimitiveRecord[]
}

export interface FeatureSnapshotRecord extends SnapshotOwnershipRecord {
  featureId: FeatureId
  label: string
  featureType: string
  featureTypeVersion: FeatureTypeVersion
  parameterPayload: Record<string, unknown>
  consumedTargets: PrimitiveRef[]
  producedTargets: PrimitiveRef[]
}

export interface BodyTopologySnapshotRecord {
  faceIds: FaceId[]
  edgeIds: EdgeId[]
  vertexIds: VertexId[]
}

export interface BodySnapshotRecord extends SnapshotOwnershipRecord {
  bodyId: BodyId
  label: string
  topology: BodyTopologySnapshotRecord
}

export interface ConstructionSnapshotRecord extends SnapshotOwnershipRecord {
  constructionId: ConstructionId
  label: string
  constructionType: 'plane'
  target: PrimitiveRef
}

export interface SnapshotEntityRecord extends SnapshotOwnershipRecord {
  id: string
  label: string
  target: PrimitiveRef
  relatedTargets: PrimitiveRef[]
  consumedByFeatureIds: FeatureId[]
}

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

export interface BaseModelingRequest {
  contractVersion: ContractVersion
}

export interface BaseDocumentRequest extends BaseModelingRequest {
  documentId: DocumentId
}

export interface DocumentMutationRequest extends BaseDocumentRequest {
  baseRevisionId: RevisionId
}

export interface ModelingOperationResult {
  contractVersion: ContractVersion
  documentId: DocumentId
  revisionId: RevisionId
  revisionState: MutationRevisionState
  changedTargets: PrimitiveRef[]
  diagnostics: ModelingDiagnostic[]
}

export type GetDocumentSnapshotRequest = BaseDocumentRequest

export interface GetDocumentSnapshotResponse {
  snapshot: DocumentSnapshot
}

export interface CreateFeatureRequest extends DocumentMutationRequest {
  featureType: string
  featureTypeVersion: FeatureTypeVersion
  parameterPayload: Record<string, unknown>
  consumedTargets: PrimitiveRef[]
}

export interface CreateFeatureResponse extends ModelingOperationResult {
  featureId: FeatureId
}

export interface UpdateFeatureRequest extends DocumentMutationRequest {
  featureId: FeatureId
  featureTypeVersion: FeatureTypeVersion
  parameterPayload: Record<string, unknown>
  consumedTargets: PrimitiveRef[]
}

export interface UpdateFeatureResponse extends ModelingOperationResult {
  featureId: FeatureId
}

export interface CommitSketchPrimitiveInput {
  primitiveId: SketchPrimitiveId
  label: string
  kind: 'line' | 'circle' | 'point' | 'profile'
  geometry: SketchPrimitiveGeometry
}

export interface CommitSketchRequest extends DocumentMutationRequest {
  sketchId: SketchId | null
  sketchLabel: string
  planeTarget: PrimitiveRef
  planeKey: SketchPlaneKey
  primitiveIds: SketchPrimitiveId[]
  primitives: CommitSketchPrimitiveInput[]
}

export interface CommitSketchResponse extends ModelingOperationResult {
  sketchId: SketchId
}

export interface DeleteFeatureRequest extends DocumentMutationRequest {
  featureId: FeatureId
}

export interface DeleteFeatureResponse extends ModelingOperationResult {
  deletedFeatureId: FeatureId
}

export interface EvaluatePreviewRequest extends DocumentMutationRequest {
  previewId: PreviewId
  featureType: string
  featureTypeVersion: FeatureTypeVersion
  parameterPayload: Record<string, unknown>
  consumedTargets: PrimitiveRef[]
}

export interface EvaluatePreviewResponse {
  contractVersion: ContractVersion
  documentId: DocumentId
  revisionId: RevisionId
  previewId: PreviewId
  freshness: PreviewFreshness
  renderables: RenderableEntityRecord[]
  diagnostics: ModelingDiagnostic[]
}

export interface ResolveReferenceRequest extends BaseDocumentRequest {
  target: PrimitiveRef
}

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

export interface ResolveReferenceResponse {
  contractVersion: ContractVersion
  resolution: ResolvedReferenceRecord
  diagnostics: ModelingDiagnostic[]
}

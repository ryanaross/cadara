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

export interface ModelingDiagnostic {
  code: string
  severity: 'info' | 'warning' | 'error'
  message: string
  target: PrimitiveRef | null
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
  invalidationReason: string | null
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
}

export interface SketchSnapshotRecord extends SnapshotOwnershipRecord {
  sketchId: SketchId
  label: string
  planeTarget: PrimitiveRef
  primitiveIds: SketchPrimitiveId[]
  primitives: SketchPrimitiveRecord[]
}

export interface FeatureSnapshotRecord extends SnapshotOwnershipRecord {
  featureId: FeatureId
  label: string
  featureType: string
  featureTypeVersion: FeatureTypeVersion
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
  invalidationReason: string | null
}

export interface ResolveReferenceResponse {
  contractVersion: ContractVersion
  resolution: ResolvedReferenceRecord
  diagnostics: ModelingDiagnostic[]
}

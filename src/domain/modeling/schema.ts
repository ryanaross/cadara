import type {
  BodyId,
  DocumentId,
  FeatureId,
  PrimitiveRef,
  RevisionId,
  SketchId,
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

export interface FeatureTreeNodeRecord {
  id: string
  label: string
  description: string
  kind: 'plane' | 'sketch' | 'feature'
  target: PrimitiveRef
}

export interface ObjectTreeNodeRecord {
  id: string
  label: string
  description: string
  kind: 'body' | 'construction'
  target: PrimitiveRef
}

export interface ReferenceRecord {
  id: ReferenceId
  label: string
  target: PrimitiveRef
  ownerFeatureId: FeatureId | null
}

export interface RenderableEntityRecord {
  id: string
  label: string
  target: PrimitiveRef
}

export interface DocumentSnapshot {
  contractVersion: ContractVersion
  schemaVersion: SnapshotSchemaVersion
  documentId: DocumentId
  revisionId: RevisionId
  featureTree: FeatureTreeNodeRecord[]
  objects: ObjectTreeNodeRecord[]
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

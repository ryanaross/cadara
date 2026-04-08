import type {
  CreateFeatureRequest,
  CreateFeatureResponse,
  DeleteFeatureRequest,
  DeleteFeatureResponse,
  EvaluatePreviewRequest,
  EvaluatePreviewResponse,
  GetDocumentSnapshotRequest,
  ResolveReferenceRequest,
  ResolveReferenceResponse,
  UpdateFeatureRequest,
  UpdateFeatureResponse,
} from '@/domain/modeling/schema'

export interface KernelDocumentSnapshot {
  snapshot: unknown
}

export interface ModelingKernelAdapter {
  getDocumentSnapshot(request: GetDocumentSnapshotRequest): Promise<KernelDocumentSnapshot>
  createFeature(request: CreateFeatureRequest): Promise<CreateFeatureResponse>
  updateFeature(request: UpdateFeatureRequest): Promise<UpdateFeatureResponse>
  deleteFeature(request: DeleteFeatureRequest): Promise<DeleteFeatureResponse>
  evaluatePreview(request: EvaluatePreviewRequest): Promise<EvaluatePreviewResponse>
  resolveReference(request: ResolveReferenceRequest): Promise<ResolveReferenceResponse>
}

import type {
  CommitSketchRequest,
  CommitSketchResponse,
  CreateFeatureRequest,
  CreateFeatureResponse,
  DeleteFeatureRequest,
  DeleteFeatureResponse,
  EvaluatePreviewRequest,
  EvaluatePreviewResponse,
  GetDocumentSnapshotRequest,
  GetDocumentSnapshotResponse,
  ResolveReferenceRequest,
  ResolveReferenceResponse,
  UpdateFeatureRequest,
  UpdateFeatureResponse,
} from '@/domain/modeling/schema'

export interface ModelingKernelAdapter {
  getDocumentSnapshot(request: GetDocumentSnapshotRequest): Promise<GetDocumentSnapshotResponse>
  commitSketch(request: CommitSketchRequest): Promise<CommitSketchResponse>
  createFeature(request: CreateFeatureRequest): Promise<CreateFeatureResponse>
  updateFeature(request: UpdateFeatureRequest): Promise<UpdateFeatureResponse>
  deleteFeature(request: DeleteFeatureRequest): Promise<DeleteFeatureResponse>
  evaluatePreview(request: EvaluatePreviewRequest): Promise<EvaluatePreviewResponse>
  resolveReference(request: ResolveReferenceRequest): Promise<ResolveReferenceResponse>
}

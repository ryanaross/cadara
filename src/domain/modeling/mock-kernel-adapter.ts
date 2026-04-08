import type { PrimitiveRef } from '@/domain/editor/schema'
import { getPrimitiveRefKey, getPrimitiveRefLabel } from '@/domain/editor/schema'
import type { ModelingKernelAdapter } from '@/domain/modeling/kernel-adapter'
import type {
  CreateFeatureRequest,
  CreateFeatureResponse,
  DeleteFeatureRequest,
  DeleteFeatureResponse,
  DocumentSnapshot,
  EvaluatePreviewRequest,
  EvaluatePreviewResponse,
  GetDocumentSnapshotRequest,
  ResolveReferenceRequest,
  ResolveReferenceResponse,
  UpdateFeatureRequest,
  UpdateFeatureResponse,
} from '@/domain/modeling/schema'

const CONTRACT_VERSION = 'modeling-contract/v1alpha1' as const

const mockSnapshot: DocumentSnapshot = {
  contractVersion: CONTRACT_VERSION,
  schemaVersion: 'document-snapshot/v1alpha1',
  documentId: 'doc_workspace',
  revisionId: 'rev_0001',
  featureTree: [
    {
      id: 'origin-planes',
      label: 'Origin Planes',
      description: 'XY, YZ, XZ reference setup',
      kind: 'plane',
      target: { kind: 'construction', constructionId: 'construction_origin-planes' },
    },
    {
      id: 'sketch-1',
      label: 'Sketch 1',
      description: 'Primary profile on the XY plane',
      kind: 'sketch',
      target: { kind: 'sketch', sketchId: 'sketch_primary' },
    },
    {
      id: 'extrude-1',
      label: 'Extrude 1',
      description: 'Mid-plane boss feature',
      kind: 'feature',
      target: { kind: 'feature', featureId: 'feature_extrude-1' },
    },
    {
      id: 'fillet-1',
      label: 'Fillet 1',
      description: 'Edge softening for outer shell',
      kind: 'feature',
      target: { kind: 'feature', featureId: 'feature_fillet-1' },
    },
  ],
  objects: [
    {
      id: 'part-1',
      label: 'Part 1',
      description: 'Solid body',
      kind: 'body',
      target: { kind: 'body', bodyId: 'body_part-1' },
    },
    {
      id: 'surface-xy',
      label: 'Plane XY',
      description: 'Reference plane',
      kind: 'construction',
      target: { kind: 'construction', constructionId: 'construction_plane-xy' },
    },
    {
      id: 'surface-yz',
      label: 'Plane YZ',
      description: 'Reference plane',
      kind: 'construction',
      target: { kind: 'construction', constructionId: 'construction_plane-yz' },
    },
  ],
  references: [
    {
      id: 'ref_feature_extrude_profile',
      label: 'Extrude profile',
      target: { kind: 'sketch', sketchId: 'sketch_primary' },
      ownerFeatureId: 'feature_extrude-1',
    },
    {
      id: 'ref_feature_fillet_chain',
      label: 'Outer fillet chain',
      target: { kind: 'edge', bodyId: 'body_part-1', edgeId: 'edge_outer-0' },
      ownerFeatureId: 'feature_fillet-1',
    },
  ],
  diagnostics: [],
  renderables: [
    {
      id: 'render_face_top',
      label: 'body_part-1.face_top',
      target: { kind: 'face', bodyId: 'body_part-1', faceId: 'face_top' },
    },
    {
      id: 'render_edge_outer_0',
      label: 'body_part-1.edge_outer-0',
      target: { kind: 'edge', bodyId: 'body_part-1', edgeId: 'edge_outer-0' },
    },
    {
      id: 'render_vertex_front_right',
      label: 'body_part-1.vertex_front-right',
      target: { kind: 'vertex', bodyId: 'body_part-1', vertexId: 'vertex_front-right' },
    },
  ],
}

function findTarget(target: PrimitiveRef) {
  return [
    ...mockSnapshot.featureTree.map((record) => record.target),
    ...mockSnapshot.objects.map((record) => record.target),
    ...mockSnapshot.references.map((record) => record.target),
    ...mockSnapshot.renderables.map((record) => record.target),
  ].find((candidate) => getPrimitiveRefKey(candidate) === getPrimitiveRefKey(target))
}

export class MockKernelAdapter implements ModelingKernelAdapter {
  async getDocumentSnapshot(_request: GetDocumentSnapshotRequest) {
    void _request
    return {
      snapshot: structuredClone(mockSnapshot),
    }
  }

  async createFeature(request: CreateFeatureRequest): Promise<CreateFeatureResponse> {
    return {
      contractVersion: CONTRACT_VERSION,
      documentId: request.documentId,
      revisionId: request.baseRevisionId,
      featureId: `feature_${request.featureType}-preview`,
      changedTargets: request.consumedTargets,
      diagnostics: [
        {
          code: 'mock-create-feature',
          severity: 'info',
          message: 'Mock kernel accepted the feature request without mutating the document.',
          target: request.consumedTargets[0] ?? null,
        },
      ],
    }
  }

  async updateFeature(request: UpdateFeatureRequest): Promise<UpdateFeatureResponse> {
    return {
      contractVersion: CONTRACT_VERSION,
      documentId: request.documentId,
      revisionId: request.baseRevisionId,
      featureId: request.featureId,
      changedTargets: request.consumedTargets,
      diagnostics: [
        {
          code: 'mock-update-feature',
          severity: 'info',
          message: 'Mock kernel accepted the feature update without mutating the document.',
          target: request.consumedTargets[0] ?? null,
        },
      ],
    }
  }

  async deleteFeature(request: DeleteFeatureRequest): Promise<DeleteFeatureResponse> {
    return {
      contractVersion: CONTRACT_VERSION,
      documentId: request.documentId,
      revisionId: request.baseRevisionId,
      deletedFeatureId: request.featureId,
      changedTargets: [],
      diagnostics: [
        {
          code: 'mock-delete-feature',
          severity: 'info',
          message: 'Mock kernel accepted the feature delete without mutating the document.',
          target: { kind: 'feature', featureId: request.featureId },
        },
      ],
    }
  }

  async evaluatePreview(request: EvaluatePreviewRequest): Promise<EvaluatePreviewResponse> {
    return {
      contractVersion: CONTRACT_VERSION,
      documentId: request.documentId,
      revisionId: request.baseRevisionId,
      previewId: request.previewId,
      renderables: structuredClone(mockSnapshot.renderables),
      diagnostics: [
        {
          code: 'mock-preview',
          severity: 'info',
          message: 'Preview evaluation is mocked and returns the current renderable set.',
          target: request.consumedTargets[0] ?? null,
        },
      ],
    }
  }

  async resolveReference(request: ResolveReferenceRequest): Promise<ResolveReferenceResponse> {
    const resolvedTarget = findTarget(request.target)

    return {
      contractVersion: CONTRACT_VERSION,
      resolution: {
        label: resolvedTarget ? getPrimitiveRefLabel(resolvedTarget) : 'Unresolved reference',
        target: request.target,
        ownerDocumentId: mockSnapshot.documentId,
        ownerRevisionId: mockSnapshot.revisionId,
        ownerFeatureId: request.target.kind === 'feature' ? request.target.featureId : null,
        ownerSketchId: request.target.kind === 'sketch' ? request.target.sketchId : null,
        ownerBodyId:
          request.target.kind === 'body' ||
          request.target.kind === 'face' ||
          request.target.kind === 'edge' ||
          request.target.kind === 'vertex'
            ? request.target.bodyId
            : null,
        invalidationReason: resolvedTarget ? null : 'The requested primitive does not exist in the mock snapshot.',
      },
      diagnostics: resolvedTarget
        ? []
        : [
            {
              code: 'mock-unresolved-reference',
              severity: 'warning',
              message: 'The requested primitive is not part of the current mock snapshot.',
              target: request.target,
            },
          ],
    }
  }
}

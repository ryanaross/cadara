import type { PrimitiveRef } from '@/domain/editor/schema'
import { getPrimitiveRefKey, getPrimitiveRefLabel } from '@/domain/editor/schema'
import type { ModelingKernelAdapter } from '@/domain/modeling/kernel-adapter'
import type {
  CommitSketchRequest,
  CommitSketchResponse,
  CreateFeatureRequest,
  CreateFeatureResponse,
  DeleteFeatureRequest,
  DeleteFeatureResponse,
  DocumentSnapshot,
  EvaluatePreviewRequest,
  EvaluatePreviewResponse,
  GetDocumentSnapshotRequest,
  GetDocumentSnapshotResponse,
  ResolveReferenceRequest,
  ResolveReferenceResponse,
  SnapshotEntityRecord,
  UpdateFeatureRequest,
  UpdateFeatureResponse,
} from '@/domain/modeling/schema'
import type {
  FeatureTreeNodeId,
  ObjectTreeNodeId,
  PickId,
  RenderableId,
  SketchEntityId,
  SnapshotEntityId,
} from '@/contracts/shared/ids'
import type { SketchEntityRef } from '@/contracts/shared/references'

const CONTRACT_VERSION = 'modeling-contract/v1alpha1' as const
const REVISION_ID = 'rev_0001' as const
const DOCUMENT_ID = 'doc_workspace' as const
const CURRENT_REVISION_ID = 'rev_0002' as const

function sketchEntityRef(
  sketchId: `sketch_${string}`,
  primitiveId: import('@/domain/modeling/schema').SketchPrimitiveId,
): SketchEntityRef {
  return {
    kind: 'sketchEntity',
    sketchId,
    entityId: primitiveId.replace(/^curve_/, 'sketch_entity_').replace(/^point_/, 'sketch_entity_') as SketchEntityId,
  }
}

function hasRevisionConflict(baseRevisionId: string) {
  return baseRevisionId !== REVISION_ID
}

function createRevisionConflictDiagnostic(baseRevisionId: string) {
  return {
    code: 'mock-revision-conflict',
    severity: 'error' as const,
    message: `Request revision ${baseRevisionId} does not match current revision ${REVISION_ID}.`,
    target: null,
    detail: {
      kind: 'revisionConflict' as const,
      expectedRevisionId: baseRevisionId as `rev_${string}`,
      actualRevisionId: REVISION_ID,
    },
  }
}

function entity(
  input: Omit<
    SnapshotEntityRecord,
    'ownerDocumentId' | 'ownerRevisionId'
  >,
): SnapshotEntityRecord {
  return {
    ownerDocumentId: DOCUMENT_ID,
    ownerRevisionId: REVISION_ID,
    ...input,
  }
}

const entities: SnapshotEntityRecord[] = [
  entity({
    ownerFeatureId: null,
    ownerSketchId: null,
    ownerBodyId: null,
    id: 'snapshot_entity_construction_origin_planes' as SnapshotEntityId,
    label: 'Origin planes folder',
    target: { kind: 'construction', constructionId: 'construction_origin-planes' },
    relatedTargets: [
      { kind: 'construction', constructionId: 'construction_plane-xy' },
      { kind: 'construction', constructionId: 'construction_plane-yz' },
      { kind: 'construction', constructionId: 'construction_plane-xz' },
    ],
    consumedByFeatureIds: [],
  }),
  entity({
    ownerFeatureId: null,
    ownerSketchId: null,
    ownerBodyId: null,
    id: 'snapshot_entity_construction_plane_xy' as SnapshotEntityId,
    label: 'Plane XY',
    target: { kind: 'construction', constructionId: 'construction_plane-xy' },
    relatedTargets: [
      { kind: 'construction', constructionId: 'construction_origin-planes' },
      { kind: 'sketch', sketchId: 'sketch_primary' },
    ],
    consumedByFeatureIds: [],
  }),
  entity({
    ownerFeatureId: null,
    ownerSketchId: null,
    ownerBodyId: null,
    id: 'snapshot_entity_construction_plane_yz' as SnapshotEntityId,
    label: 'Plane YZ',
    target: { kind: 'construction', constructionId: 'construction_plane-yz' },
    relatedTargets: [{ kind: 'construction', constructionId: 'construction_origin-planes' }],
    consumedByFeatureIds: [],
  }),
  entity({
    ownerFeatureId: null,
    ownerSketchId: null,
    ownerBodyId: null,
    id: 'snapshot_entity_construction_plane_xz' as SnapshotEntityId,
    label: 'Plane XZ',
    target: { kind: 'construction', constructionId: 'construction_plane-xz' },
    relatedTargets: [{ kind: 'construction', constructionId: 'construction_origin-planes' }],
    consumedByFeatureIds: [],
  }),
  entity({
    ownerFeatureId: null,
    ownerSketchId: 'sketch_primary',
    ownerBodyId: null,
    id: 'snapshot_entity_sketch_primary' as SnapshotEntityId,
    label: 'Sketch 1',
    target: { kind: 'sketch', sketchId: 'sketch_primary' },
    relatedTargets: [
      { kind: 'construction', constructionId: 'construction_plane-xy' },
      sketchEntityRef('sketch_primary', 'curve_rect-bottom'),
      sketchEntityRef('sketch_primary', 'curve_rect-right'),
      sketchEntityRef('sketch_primary', 'curve_profile-outer'),
      sketchEntityRef('sketch_primary', 'point_origin'),
    ],
    consumedByFeatureIds: ['feature_extrude-1'],
  }),
  entity({
    ownerFeatureId: null,
    ownerSketchId: 'sketch_primary',
    ownerBodyId: null,
    id: 'snapshot_entity_sketch_primary_curve_rect_bottom' as SnapshotEntityId,
    label: 'Bottom edge',
    target: sketchEntityRef('sketch_primary', 'curve_rect-bottom'),
    relatedTargets: [
      { kind: 'sketch', sketchId: 'sketch_primary' },
      sketchEntityRef('sketch_primary', 'point_origin'),
    ],
    consumedByFeatureIds: [],
  }),
  entity({
    ownerFeatureId: null,
    ownerSketchId: 'sketch_primary',
    ownerBodyId: null,
    id: 'snapshot_entity_sketch_primary_curve_rect_right' as SnapshotEntityId,
    label: 'Right edge',
    target: sketchEntityRef('sketch_primary', 'curve_rect-right'),
    relatedTargets: [
      { kind: 'sketch', sketchId: 'sketch_primary' },
      sketchEntityRef('sketch_primary', 'point_origin'),
    ],
    consumedByFeatureIds: [],
  }),
  entity({
    ownerFeatureId: null,
    ownerSketchId: 'sketch_primary',
    ownerBodyId: null,
    id: 'snapshot_entity_sketch_primary_curve_profile_outer' as SnapshotEntityId,
    label: 'Outer profile',
    target: sketchEntityRef('sketch_primary', 'curve_profile-outer'),
    relatedTargets: [
      { kind: 'sketch', sketchId: 'sketch_primary' },
      { kind: 'construction', constructionId: 'construction_plane-xy' },
    ],
    consumedByFeatureIds: ['feature_extrude-1'],
  }),
  entity({
    ownerFeatureId: null,
    ownerSketchId: 'sketch_primary',
    ownerBodyId: null,
    id: 'snapshot_entity_sketch_primary_point_origin' as SnapshotEntityId,
    label: 'Origin point',
    target: sketchEntityRef('sketch_primary', 'point_origin'),
    relatedTargets: [
      { kind: 'sketch', sketchId: 'sketch_primary' },
      { kind: 'construction', constructionId: 'construction_plane-xy' },
    ],
    consumedByFeatureIds: [],
  }),
  entity({
    ownerFeatureId: 'feature_extrude-1',
    ownerSketchId: null,
    ownerBodyId: null,
    id: 'snapshot_entity_feature_extrude_1' as SnapshotEntityId,
    label: 'Extrude 1',
    target: { kind: 'feature', featureId: 'feature_extrude-1' },
    relatedTargets: [
      { kind: 'sketch', sketchId: 'sketch_primary' },
      { kind: 'body', bodyId: 'body_part-1' },
    ],
    consumedByFeatureIds: [],
  }),
  entity({
    ownerFeatureId: 'feature_fillet-1',
    ownerSketchId: null,
    ownerBodyId: 'body_part-1',
    id: 'snapshot_entity_feature_fillet_1' as SnapshotEntityId,
    label: 'Fillet 1',
    target: { kind: 'feature', featureId: 'feature_fillet-1' },
    relatedTargets: [
      { kind: 'edge', bodyId: 'body_part-1', edgeId: 'edge_outer-0' },
      { kind: 'body', bodyId: 'body_part-1' },
    ],
    consumedByFeatureIds: [],
  }),
  entity({
    ownerFeatureId: 'feature_extrude-1',
    ownerSketchId: null,
    ownerBodyId: 'body_part-1',
    id: 'snapshot_entity_body_part_1' as SnapshotEntityId,
    label: 'Part 1 body',
    target: { kind: 'body', bodyId: 'body_part-1' },
    relatedTargets: [
      { kind: 'feature', featureId: 'feature_extrude-1' },
      { kind: 'face', bodyId: 'body_part-1', faceId: 'face_top' },
      { kind: 'face', bodyId: 'body_part-1', faceId: 'face_bottom' },
      { kind: 'face', bodyId: 'body_part-1', faceId: 'face_side-front' },
      { kind: 'face', bodyId: 'body_part-1', faceId: 'face_side-right' },
      { kind: 'edge', bodyId: 'body_part-1', edgeId: 'edge_outer-0' },
      { kind: 'edge', bodyId: 'body_part-1', edgeId: 'edge_outer-1' },
      { kind: 'edge', bodyId: 'body_part-1', edgeId: 'edge_outer-2' },
      { kind: 'edge', bodyId: 'body_part-1', edgeId: 'edge_outer-3' },
      { kind: 'vertex', bodyId: 'body_part-1', vertexId: 'vertex_front-right' },
      { kind: 'vertex', bodyId: 'body_part-1', vertexId: 'vertex_front-left' },
      { kind: 'vertex', bodyId: 'body_part-1', vertexId: 'vertex_back-right' },
      { kind: 'vertex', bodyId: 'body_part-1', vertexId: 'vertex_back-left' },
    ],
    consumedByFeatureIds: ['feature_fillet-1'],
  }),
  entity({
    ownerFeatureId: 'feature_extrude-1',
    ownerSketchId: null,
    ownerBodyId: 'body_part-1',
    id: 'snapshot_entity_body_part_1_face_top' as SnapshotEntityId,
    label: 'Top face',
    target: { kind: 'face', bodyId: 'body_part-1', faceId: 'face_top' },
    relatedTargets: [
      { kind: 'body', bodyId: 'body_part-1' },
      { kind: 'edge', bodyId: 'body_part-1', edgeId: 'edge_outer-0' },
      { kind: 'edge', bodyId: 'body_part-1', edgeId: 'edge_outer-1' },
      { kind: 'vertex', bodyId: 'body_part-1', vertexId: 'vertex_front-right' },
      { kind: 'vertex', bodyId: 'body_part-1', vertexId: 'vertex_back-right' },
    ],
    consumedByFeatureIds: [],
  }),
  entity({
    ownerFeatureId: 'feature_extrude-1',
    ownerSketchId: null,
    ownerBodyId: 'body_part-1',
    id: 'snapshot_entity_body_part_1_face_bottom' as SnapshotEntityId,
    label: 'Bottom face',
    target: { kind: 'face', bodyId: 'body_part-1', faceId: 'face_bottom' },
    relatedTargets: [
      { kind: 'body', bodyId: 'body_part-1' },
      { kind: 'edge', bodyId: 'body_part-1', edgeId: 'edge_outer-2' },
      { kind: 'edge', bodyId: 'body_part-1', edgeId: 'edge_outer-3' },
      { kind: 'vertex', bodyId: 'body_part-1', vertexId: 'vertex_front-left' },
      { kind: 'vertex', bodyId: 'body_part-1', vertexId: 'vertex_back-left' },
    ],
    consumedByFeatureIds: [],
  }),
  entity({
    ownerFeatureId: 'feature_fillet-1',
    ownerSketchId: null,
    ownerBodyId: 'body_part-1',
    id: 'snapshot_entity_body_part_1_face_side_front' as SnapshotEntityId,
    label: 'Front side face',
    target: { kind: 'face', bodyId: 'body_part-1', faceId: 'face_side-front' },
    relatedTargets: [
      { kind: 'body', bodyId: 'body_part-1' },
      { kind: 'edge', bodyId: 'body_part-1', edgeId: 'edge_outer-0' },
      { kind: 'vertex', bodyId: 'body_part-1', vertexId: 'vertex_front-right' },
      { kind: 'vertex', bodyId: 'body_part-1', vertexId: 'vertex_front-left' },
    ],
    consumedByFeatureIds: ['feature_fillet-1'],
  }),
  entity({
    ownerFeatureId: 'feature_fillet-1',
    ownerSketchId: null,
    ownerBodyId: 'body_part-1',
    id: 'snapshot_entity_body_part_1_face_side_right' as SnapshotEntityId,
    label: 'Right side face',
    target: { kind: 'face', bodyId: 'body_part-1', faceId: 'face_side-right' },
    relatedTargets: [
      { kind: 'body', bodyId: 'body_part-1' },
      { kind: 'edge', bodyId: 'body_part-1', edgeId: 'edge_outer-1' },
      { kind: 'vertex', bodyId: 'body_part-1', vertexId: 'vertex_front-right' },
      { kind: 'vertex', bodyId: 'body_part-1', vertexId: 'vertex_back-right' },
    ],
    consumedByFeatureIds: ['feature_fillet-1'],
  }),
  entity({
    ownerFeatureId: 'feature_fillet-1',
    ownerSketchId: null,
    ownerBodyId: 'body_part-1',
    id: 'snapshot_entity_body_part_1_edge_outer_0' as SnapshotEntityId,
    label: 'Outer edge chain start',
    target: { kind: 'edge', bodyId: 'body_part-1', edgeId: 'edge_outer-0' },
    relatedTargets: [
      { kind: 'body', bodyId: 'body_part-1' },
      { kind: 'face', bodyId: 'body_part-1', faceId: 'face_top' },
      { kind: 'face', bodyId: 'body_part-1', faceId: 'face_side-front' },
      { kind: 'vertex', bodyId: 'body_part-1', vertexId: 'vertex_front-right' },
      { kind: 'vertex', bodyId: 'body_part-1', vertexId: 'vertex_front-left' },
    ],
    consumedByFeatureIds: ['feature_fillet-1'],
  }),
  entity({
    ownerFeatureId: 'feature_extrude-1',
    ownerSketchId: null,
    ownerBodyId: 'body_part-1',
    id: 'snapshot_entity_body_part_1_edge_outer_1' as SnapshotEntityId,
    label: 'Outer edge 1',
    target: { kind: 'edge', bodyId: 'body_part-1', edgeId: 'edge_outer-1' },
    relatedTargets: [
      { kind: 'body', bodyId: 'body_part-1' },
      { kind: 'face', bodyId: 'body_part-1', faceId: 'face_top' },
      { kind: 'face', bodyId: 'body_part-1', faceId: 'face_side-right' },
      { kind: 'vertex', bodyId: 'body_part-1', vertexId: 'vertex_front-right' },
      { kind: 'vertex', bodyId: 'body_part-1', vertexId: 'vertex_back-right' },
    ],
    consumedByFeatureIds: [],
  }),
  entity({
    ownerFeatureId: 'feature_extrude-1',
    ownerSketchId: null,
    ownerBodyId: 'body_part-1',
    id: 'snapshot_entity_body_part_1_edge_outer_2' as SnapshotEntityId,
    label: 'Outer edge 2',
    target: { kind: 'edge', bodyId: 'body_part-1', edgeId: 'edge_outer-2' },
    relatedTargets: [
      { kind: 'body', bodyId: 'body_part-1' },
      { kind: 'face', bodyId: 'body_part-1', faceId: 'face_bottom' },
      { kind: 'vertex', bodyId: 'body_part-1', vertexId: 'vertex_front-left' },
      { kind: 'vertex', bodyId: 'body_part-1', vertexId: 'vertex_back-left' },
    ],
    consumedByFeatureIds: [],
  }),
  entity({
    ownerFeatureId: 'feature_extrude-1',
    ownerSketchId: null,
    ownerBodyId: 'body_part-1',
    id: 'snapshot_entity_body_part_1_edge_outer_3' as SnapshotEntityId,
    label: 'Outer edge 3',
    target: { kind: 'edge', bodyId: 'body_part-1', edgeId: 'edge_outer-3' },
    relatedTargets: [
      { kind: 'body', bodyId: 'body_part-1' },
      { kind: 'face', bodyId: 'body_part-1', faceId: 'face_bottom' },
      { kind: 'vertex', bodyId: 'body_part-1', vertexId: 'vertex_front-right' },
      { kind: 'vertex', bodyId: 'body_part-1', vertexId: 'vertex_back-right' },
    ],
    consumedByFeatureIds: [],
  }),
  entity({
    ownerFeatureId: 'feature_extrude-1',
    ownerSketchId: null,
    ownerBodyId: 'body_part-1',
    id: 'snapshot_entity_body_part_1_vertex_front_right' as SnapshotEntityId,
    label: 'Front right vertex',
    target: { kind: 'vertex', bodyId: 'body_part-1', vertexId: 'vertex_front-right' },
    relatedTargets: [
      { kind: 'body', bodyId: 'body_part-1' },
      { kind: 'face', bodyId: 'body_part-1', faceId: 'face_top' },
      { kind: 'face', bodyId: 'body_part-1', faceId: 'face_side-front' },
      { kind: 'face', bodyId: 'body_part-1', faceId: 'face_side-right' },
      { kind: 'edge', bodyId: 'body_part-1', edgeId: 'edge_outer-0' },
      { kind: 'edge', bodyId: 'body_part-1', edgeId: 'edge_outer-1' },
    ],
    consumedByFeatureIds: [],
  }),
  entity({
    ownerFeatureId: 'feature_extrude-1',
    ownerSketchId: null,
    ownerBodyId: 'body_part-1',
    id: 'snapshot_entity_body_part_1_vertex_front_left' as SnapshotEntityId,
    label: 'Front left vertex',
    target: { kind: 'vertex', bodyId: 'body_part-1', vertexId: 'vertex_front-left' },
    relatedTargets: [
      { kind: 'body', bodyId: 'body_part-1' },
      { kind: 'face', bodyId: 'body_part-1', faceId: 'face_bottom' },
      { kind: 'face', bodyId: 'body_part-1', faceId: 'face_side-front' },
      { kind: 'edge', bodyId: 'body_part-1', edgeId: 'edge_outer-0' },
      { kind: 'edge', bodyId: 'body_part-1', edgeId: 'edge_outer-2' },
    ],
    consumedByFeatureIds: [],
  }),
  entity({
    ownerFeatureId: 'feature_extrude-1',
    ownerSketchId: null,
    ownerBodyId: 'body_part-1',
    id: 'snapshot_entity_body_part_1_vertex_back_right' as SnapshotEntityId,
    label: 'Back right vertex',
    target: { kind: 'vertex', bodyId: 'body_part-1', vertexId: 'vertex_back-right' },
    relatedTargets: [
      { kind: 'body', bodyId: 'body_part-1' },
      { kind: 'face', bodyId: 'body_part-1', faceId: 'face_top' },
      { kind: 'face', bodyId: 'body_part-1', faceId: 'face_side-right' },
      { kind: 'edge', bodyId: 'body_part-1', edgeId: 'edge_outer-1' },
      { kind: 'edge', bodyId: 'body_part-1', edgeId: 'edge_outer-3' },
    ],
    consumedByFeatureIds: [],
  }),
  entity({
    ownerFeatureId: 'feature_extrude-1',
    ownerSketchId: null,
    ownerBodyId: 'body_part-1',
    id: 'snapshot_entity_body_part_1_vertex_back_left' as SnapshotEntityId,
    label: 'Back left vertex',
    target: { kind: 'vertex', bodyId: 'body_part-1', vertexId: 'vertex_back-left' },
    relatedTargets: [
      { kind: 'body', bodyId: 'body_part-1' },
      { kind: 'face', bodyId: 'body_part-1', faceId: 'face_bottom' },
      { kind: 'edge', bodyId: 'body_part-1', edgeId: 'edge_outer-2' },
      { kind: 'edge', bodyId: 'body_part-1', edgeId: 'edge_outer-3' },
    ],
    consumedByFeatureIds: [],
  }),
]

const mockSnapshot: DocumentSnapshot = {
  contractVersion: CONTRACT_VERSION,
  schemaVersion: 'document-snapshot/v1alpha1',
  documentId: DOCUMENT_ID,
  revisionId: REVISION_ID,
  featureTree: [
    {
      id: 'feature_tree_node_origin_planes' as FeatureTreeNodeId,
      label: 'Origin Planes',
      description: 'XY, YZ, XZ reference setup',
      kind: 'plane',
      target: { kind: 'construction', constructionId: 'construction_origin-planes' },
      ownerFeatureId: null,
      ownerSketchId: null,
      sourceFeatureId: null,
    },
    {
      id: 'feature_tree_node_sketch_primary' as FeatureTreeNodeId,
      label: 'Sketch 1',
      description: 'Primary profile on the XY plane',
      kind: 'sketch',
      target: { kind: 'sketch', sketchId: 'sketch_primary' },
      ownerFeatureId: null,
      ownerSketchId: 'sketch_primary',
      sourceFeatureId: null,
    },
    {
      id: 'feature_tree_node_extrude_1' as FeatureTreeNodeId,
      label: 'Extrude 1',
      description: 'Mid-plane boss feature',
      kind: 'feature',
      target: { kind: 'feature', featureId: 'feature_extrude-1' },
      ownerFeatureId: 'feature_extrude-1',
      ownerSketchId: null,
      sourceFeatureId: 'feature_extrude-1',
    },
    {
      id: 'feature_tree_node_fillet_1' as FeatureTreeNodeId,
      label: 'Fillet 1',
      description: 'Edge softening for outer shell',
      kind: 'feature',
      target: { kind: 'feature', featureId: 'feature_fillet-1' },
      ownerFeatureId: 'feature_fillet-1',
      ownerSketchId: null,
      sourceFeatureId: 'feature_fillet-1',
    },
  ],
  objects: [
    {
      id: 'object_tree_node_body_part_1' as ObjectTreeNodeId,
      label: 'Part 1',
      description: 'Solid body generated by the primary boss',
      kind: 'body',
      target: { kind: 'body', bodyId: 'body_part-1' },
      ownerBodyId: 'body_part-1',
      ownerFeatureId: 'feature_extrude-1',
    },
    {
      id: 'object_tree_node_plane_xy' as ObjectTreeNodeId,
      label: 'Plane XY',
      description: 'Reference plane for the primary sketch',
      kind: 'construction',
      target: { kind: 'construction', constructionId: 'construction_plane-xy' },
      ownerBodyId: null,
      ownerFeatureId: null,
    },
    {
      id: 'object_tree_node_plane_yz' as ObjectTreeNodeId,
      label: 'Plane YZ',
      description: 'Reference plane',
      kind: 'construction',
      target: { kind: 'construction', constructionId: 'construction_plane-yz' },
      ownerBodyId: null,
      ownerFeatureId: null,
    },
    {
      id: 'object_tree_node_plane_xz' as ObjectTreeNodeId,
      label: 'Plane XZ',
      description: 'Reference plane',
      kind: 'construction',
      target: { kind: 'construction', constructionId: 'construction_plane-xz' },
      ownerBodyId: null,
      ownerFeatureId: null,
    },
  ],
  features: [
    {
      ownerDocumentId: DOCUMENT_ID,
      ownerRevisionId: REVISION_ID,
      ownerFeatureId: 'feature_extrude-1',
      ownerSketchId: null,
      ownerBodyId: null,
      featureId: 'feature_extrude-1',
      label: 'Extrude 1',
      featureType: 'extrude',
      featureTypeVersion: 'feature-type/v1alpha1',
      parameterPayload: {
        depth: 12,
        direction: 'oneSided',
        operation: 'newBody',
        profileTarget: sketchEntityRef('sketch_primary', 'curve_profile-outer'),
      },
      consumedTargets: [
        { kind: 'sketch', sketchId: 'sketch_primary' },
        sketchEntityRef('sketch_primary', 'curve_profile-outer'),
      ],
      producedTargets: [
        { kind: 'body', bodyId: 'body_part-1' },
        { kind: 'face', bodyId: 'body_part-1', faceId: 'face_top' },
        { kind: 'face', bodyId: 'body_part-1', faceId: 'face_bottom' },
      ],
    },
    {
      ownerDocumentId: DOCUMENT_ID,
      ownerRevisionId: REVISION_ID,
      ownerFeatureId: 'feature_fillet-1',
      ownerSketchId: null,
      ownerBodyId: 'body_part-1',
      featureId: 'feature_fillet-1',
      label: 'Fillet 1',
      featureType: 'fillet',
      featureTypeVersion: 'feature-type/v1alpha1',
      parameterPayload: {
        radius: 1.5,
      },
      consumedTargets: [{ kind: 'edge', bodyId: 'body_part-1', edgeId: 'edge_outer-0' }],
      producedTargets: [
        { kind: 'face', bodyId: 'body_part-1', faceId: 'face_side-front' },
        { kind: 'face', bodyId: 'body_part-1', faceId: 'face_side-right' },
      ],
    },
  ],
  sketches: [
    {
      ownerDocumentId: DOCUMENT_ID,
      ownerRevisionId: REVISION_ID,
      ownerFeatureId: null,
      ownerSketchId: 'sketch_primary',
      ownerBodyId: null,
      sketchId: 'sketch_primary',
      label: 'Sketch 1',
      planeTarget: { kind: 'construction', constructionId: 'construction_plane-xy' },
      planeKey: 'xy',
      primitiveIds: ['curve_rect-bottom', 'curve_rect-right', 'curve_profile-outer', 'point_origin'],
      primitives: [
        {
          primitiveId: 'curve_rect-bottom',
          entityId: 'sketch_entity_rect_bottom',
          label: 'Bottom edge',
          kind: 'line',
          target: sketchEntityRef('sketch_primary', 'curve_rect-bottom'),
          geometry: {
            kind: 'line',
            start: [-4, -3],
            end: [4, -3],
          },
        },
        {
          primitiveId: 'curve_rect-right',
          entityId: 'sketch_entity_rect_right',
          label: 'Right edge',
          kind: 'line',
          target: sketchEntityRef('sketch_primary', 'curve_rect-right'),
          geometry: {
            kind: 'line',
            start: [4, -3],
            end: [4, 3],
          },
        },
        {
          primitiveId: 'curve_profile-outer',
          entityId: 'sketch_entity_profile_outer',
          label: 'Outer profile',
          kind: 'profile',
          target: sketchEntityRef('sketch_primary', 'curve_profile-outer'),
          geometry: {
            kind: 'profile',
            boundaryPrimitiveIds: ['curve_rect-bottom', 'curve_rect-right'],
          },
        },
        {
          primitiveId: 'point_origin',
          entityId: 'sketch_entity_point_origin',
          label: 'Origin point',
          kind: 'point',
          target: sketchEntityRef('sketch_primary', 'point_origin'),
          geometry: {
            kind: 'point',
            position: [0, 0],
          },
        },
      ],
    },
  ],
  bodies: [
    {
      ownerDocumentId: DOCUMENT_ID,
      ownerRevisionId: REVISION_ID,
      ownerFeatureId: 'feature_extrude-1',
      ownerSketchId: null,
      ownerBodyId: 'body_part-1',
      bodyId: 'body_part-1',
      label: 'Part 1',
      topology: {
        faceIds: ['face_top', 'face_bottom', 'face_side-front', 'face_side-right'],
        edgeIds: ['edge_outer-0', 'edge_outer-1', 'edge_outer-2', 'edge_outer-3'],
        vertexIds: ['vertex_front-right', 'vertex_front-left', 'vertex_back-right', 'vertex_back-left'],
      },
    },
  ],
  constructions: [
    {
      ownerDocumentId: DOCUMENT_ID,
      ownerRevisionId: REVISION_ID,
      ownerFeatureId: null,
      ownerSketchId: null,
      ownerBodyId: null,
      constructionId: 'construction_origin-planes',
      label: 'Origin planes folder',
      constructionType: 'plane',
      target: { kind: 'construction', constructionId: 'construction_origin-planes' },
    },
    {
      ownerDocumentId: DOCUMENT_ID,
      ownerRevisionId: REVISION_ID,
      ownerFeatureId: null,
      ownerSketchId: null,
      ownerBodyId: null,
      constructionId: 'construction_plane-xy',
      label: 'Plane XY',
      constructionType: 'plane',
      target: { kind: 'construction', constructionId: 'construction_plane-xy' },
    },
    {
      ownerDocumentId: DOCUMENT_ID,
      ownerRevisionId: REVISION_ID,
      ownerFeatureId: null,
      ownerSketchId: null,
      ownerBodyId: null,
      constructionId: 'construction_plane-yz',
      label: 'Plane YZ',
      constructionType: 'plane',
      target: { kind: 'construction', constructionId: 'construction_plane-yz' },
    },
    {
      ownerDocumentId: DOCUMENT_ID,
      ownerRevisionId: REVISION_ID,
      ownerFeatureId: null,
      ownerSketchId: null,
      ownerBodyId: null,
      constructionId: 'construction_plane-xz',
      label: 'Plane XZ',
      constructionType: 'plane',
      target: { kind: 'construction', constructionId: 'construction_plane-xz' },
    },
  ],
  entities,
  references: [
    {
      id: 'ref_feature_extrude_profile',
      label: 'Extrude profile',
      target: sketchEntityRef('sketch_primary', 'curve_profile-outer'),
      ownerFeatureId: 'feature_extrude-1',
      ownerSketchId: 'sketch_primary',
      invalidation: null,
    },
    {
      id: 'ref_feature_fillet_chain',
      label: 'Outer fillet chain',
      target: { kind: 'edge', bodyId: 'body_part-1', edgeId: 'edge_outer-0' },
      ownerFeatureId: 'feature_fillet-1',
      ownerSketchId: null,
      invalidation: {
        reason: 'Upstream edge chain changed after the last rebuild.',
        target: { kind: 'edge', bodyId: 'body_part-1', edgeId: 'edge_outer-0' },
        ownerFeatureId: 'feature_fillet-1',
        ownerSketchId: null,
        sourceTarget: { kind: 'feature', featureId: 'feature_extrude-1' },
      },
    },
  ],
  diagnostics: [
    {
      code: 'mock-invalid-reference',
      severity: 'warning',
      message: 'Fillet 1 lost one downstream edge reference after an upstream topology change.',
      target: { kind: 'feature', featureId: 'feature_fillet-1' },
      detail: {
        kind: 'invalidReference',
        reference: {
          reason: 'Upstream edge chain changed after the last rebuild.',
          target: { kind: 'edge', bodyId: 'body_part-1', edgeId: 'edge_outer-0' },
          ownerFeatureId: 'feature_fillet-1',
          ownerSketchId: null,
          sourceTarget: { kind: 'feature', featureId: 'feature_extrude-1' },
        },
      },
    },
    {
      code: 'mock-rebuild-warning',
      severity: 'warning',
      message: 'Rebuild completed with downstream reference failures.',
      target: { kind: 'feature', featureId: 'feature_fillet-1' },
      detail: {
        kind: 'rebuildFailure',
        affectedFeatureIds: ['feature_fillet-1'],
        affectedTargets: [{ kind: 'edge', bodyId: 'body_part-1', edgeId: 'edge_outer-0' }],
      },
    },
  ],
  renderables: [
    {
      id: 'renderable_face_top' as RenderableId,
      label: 'body_part-1.face_top',
      target: { kind: 'face', bodyId: 'body_part-1', faceId: 'face_top' },
      ownerBodyId: 'body_part-1',
      ownerFeatureId: 'feature_extrude-1',
      topology: 'face',
      pickBinding: {
        pickId: 'pick_body_part-1_face_top' as PickId,
        target: { kind: 'face', bodyId: 'body_part-1', faceId: 'face_top' },
        topology: 'face',
      },
      geometry: {
        kind: 'planarFace',
        center: [0, 0, 3],
        size: [8, 6],
        normalAxis: 'z',
      },
    },
    {
      id: 'renderable_edge_outer_0' as RenderableId,
      label: 'body_part-1.edge_outer-0',
      target: { kind: 'edge', bodyId: 'body_part-1', edgeId: 'edge_outer-0' },
      ownerBodyId: 'body_part-1',
      ownerFeatureId: 'feature_fillet-1',
      topology: 'edge',
      pickBinding: {
        pickId: 'pick_body_part-1_edge_outer_0' as PickId,
        target: { kind: 'edge', bodyId: 'body_part-1', edgeId: 'edge_outer-0' },
        topology: 'edge',
      },
      geometry: {
        kind: 'polyline',
        points: [
          [-4, -3, 3],
          [0, -3, 3],
          [4, -3, 3],
        ],
      },
    },
    {
      id: 'renderable_vertex_front_right' as RenderableId,
      label: 'body_part-1.vertex_front-right',
      target: { kind: 'vertex', bodyId: 'body_part-1', vertexId: 'vertex_front-right' },
      ownerBodyId: 'body_part-1',
      ownerFeatureId: 'feature_extrude-1',
      topology: 'vertex',
      pickBinding: {
        pickId: 'pick_body_part-1_vertex_front_right' as PickId,
        target: { kind: 'vertex', bodyId: 'body_part-1', vertexId: 'vertex_front-right' },
        topology: 'vertex',
      },
      geometry: {
        kind: 'pointMarker',
        position: [4, -3, 3],
        radius: 0.22,
      },
    },
  ],
}

function findTarget(target: PrimitiveRef) {
  return mockSnapshot.entities.find(
    (candidate) => getPrimitiveRefKey(candidate.target) === getPrimitiveRefKey(target),
  )?.target
}

export class MockKernelAdapter implements ModelingKernelAdapter {
  async getDocumentSnapshot(_request: GetDocumentSnapshotRequest): Promise<GetDocumentSnapshotResponse> {
    void _request
    return {
      snapshot: structuredClone(mockSnapshot),
    }
  }

  async createFeature(request: CreateFeatureRequest): Promise<CreateFeatureResponse> {
    if (hasRevisionConflict(request.baseRevisionId)) {
      return {
        contractVersion: CONTRACT_VERSION,
        documentId: request.documentId,
        revisionId: REVISION_ID,
        featureId: `feature_${request.featureType}-preview`,
        revisionState: {
          kind: 'conflict',
          expectedRevisionId: request.baseRevisionId,
          actualRevisionId: REVISION_ID,
        },
        changedTargets: [],
        diagnostics: [createRevisionConflictDiagnostic(request.baseRevisionId)],
      }
    }

    return {
      contractVersion: CONTRACT_VERSION,
      documentId: request.documentId,
      revisionId: request.baseRevisionId,
      featureId: `feature_${request.featureType}-preview`,
      revisionState: {
        kind: 'accepted',
        baseRevisionId: request.baseRevisionId,
      },
      changedTargets: request.consumedTargets,
      diagnostics: [
        {
          code: 'mock-create-feature',
          severity: 'info',
          message: 'Mock kernel accepted the feature create request without mutating committed state.',
          target: request.consumedTargets[0] ?? null,
          detail: null,
        },
      ],
    }
  }

  async commitSketch(request: CommitSketchRequest): Promise<CommitSketchResponse> {
    const sketchId = request.sketchId ?? 'sketch_primary'

    if (hasRevisionConflict(request.baseRevisionId)) {
      return {
        contractVersion: CONTRACT_VERSION,
        documentId: request.documentId,
        revisionId: REVISION_ID,
        sketchId,
        revisionState: {
          kind: 'conflict',
          expectedRevisionId: request.baseRevisionId,
          actualRevisionId: REVISION_ID,
        },
        changedTargets: [],
        diagnostics: [createRevisionConflictDiagnostic(request.baseRevisionId)],
      }
    }

    return {
      contractVersion: CONTRACT_VERSION,
      documentId: request.documentId,
      revisionId: request.baseRevisionId,
      sketchId,
      revisionState: {
        kind: 'accepted',
        baseRevisionId: request.baseRevisionId,
      },
      changedTargets: [
        { kind: 'sketch', sketchId },
        ...request.primitiveIds.map((primitiveId) => sketchEntityRef(sketchId, primitiveId)),
      ],
      diagnostics: [
        {
          code: 'mock-commit-sketch',
          severity: 'info',
          message: 'Mock kernel accepted the sketch commit request without mutating the document.',
          target: { kind: 'sketch', sketchId },
          detail: null,
        },
      ],
    }
  }

  async updateFeature(request: UpdateFeatureRequest): Promise<UpdateFeatureResponse> {
    if (hasRevisionConflict(request.baseRevisionId)) {
      return {
        contractVersion: CONTRACT_VERSION,
        documentId: request.documentId,
        revisionId: REVISION_ID,
        featureId: request.featureId,
        revisionState: {
          kind: 'conflict',
          expectedRevisionId: request.baseRevisionId,
          actualRevisionId: REVISION_ID,
        },
        changedTargets: [],
        diagnostics: [createRevisionConflictDiagnostic(request.baseRevisionId)],
      }
    }

    return {
      contractVersion: CONTRACT_VERSION,
      documentId: request.documentId,
      revisionId: request.baseRevisionId,
      featureId: request.featureId,
      revisionState: {
        kind: 'accepted',
        baseRevisionId: request.baseRevisionId,
      },
      changedTargets: request.consumedTargets,
      diagnostics: [
        {
          code: 'mock-update-feature',
          severity: 'info',
          message: 'Mock kernel accepted the feature update request without mutating committed state.',
          target: request.consumedTargets[0] ?? null,
          detail: null,
        },
      ],
    }
  }

  async deleteFeature(request: DeleteFeatureRequest): Promise<DeleteFeatureResponse> {
    if (hasRevisionConflict(request.baseRevisionId)) {
      return {
        contractVersion: CONTRACT_VERSION,
        documentId: request.documentId,
        revisionId: REVISION_ID,
        deletedFeatureId: request.featureId,
        revisionState: {
          kind: 'conflict',
          expectedRevisionId: request.baseRevisionId,
          actualRevisionId: REVISION_ID,
        },
        changedTargets: [],
        diagnostics: [createRevisionConflictDiagnostic(request.baseRevisionId)],
      }
    }

    return {
      contractVersion: CONTRACT_VERSION,
      documentId: request.documentId,
      revisionId: request.baseRevisionId,
      deletedFeatureId: request.featureId,
      revisionState: {
        kind: 'accepted',
        baseRevisionId: request.baseRevisionId,
      },
      changedTargets: [],
      diagnostics: [
        {
          code: 'mock-delete-feature',
          severity: 'info',
          message: 'Mock kernel accepted the feature delete without mutating the document.',
          target: { kind: 'feature', featureId: request.featureId },
          detail: null,
        },
      ],
    }
  }

  async evaluatePreview(request: EvaluatePreviewRequest): Promise<EvaluatePreviewResponse> {
    const stale = request.baseRevisionId !== CURRENT_REVISION_ID

    return {
      contractVersion: CONTRACT_VERSION,
      documentId: request.documentId,
      revisionId: stale ? CURRENT_REVISION_ID : request.baseRevisionId,
      previewId: request.previewId,
      freshness: stale
        ? {
            kind: 'stale',
            requestedRevisionId: request.baseRevisionId,
            currentRevisionId: CURRENT_REVISION_ID,
          }
        : {
            kind: 'fresh',
            baseRevisionId: request.baseRevisionId,
          },
      renderables: stale ? [] : structuredClone(mockSnapshot.renderables),
      diagnostics: [
        ...(stale
          ? [
              {
                code: 'mock-stale-preview',
                severity: 'warning' as const,
                message: `Preview ${request.previewId} was rejected because revision ${request.baseRevisionId} is stale.`,
                target: request.consumedTargets[0] ?? null,
                detail: {
                  kind: 'stalePreview' as const,
                  previewId: request.previewId,
                  requestedRevisionId: request.baseRevisionId,
                  currentRevisionId: CURRENT_REVISION_ID,
                },
              },
            ]
          : [
              {
                code: 'mock-preview',
                severity: 'info' as const,
                message: `Preview evaluation for ${request.featureType} is mocked and does not mutate committed state.`,
                target: request.consumedTargets[0] ?? null,
                detail: null,
              },
            ]),
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
        invalidation: resolvedTarget
          ? null
          : {
              reason: 'The requested primitive does not exist in the mock snapshot.',
              target: request.target,
              ownerFeatureId: null,
              ownerSketchId: null,
              sourceTarget: null,
            },
      },
      diagnostics: resolvedTarget
        ? []
        : [
            {
              code: 'mock-unresolved-reference',
              severity: 'warning',
              message: 'The requested primitive is not part of the current mock snapshot.',
              target: request.target,
              detail: {
                kind: 'invalidReference',
                reference: {
                  reason: 'The requested primitive does not exist in the mock snapshot.',
                  target: request.target,
                  ownerFeatureId: null,
                  ownerSketchId: null,
                  sourceTarget: null,
                },
              },
            },
          ],
    }
  }
}

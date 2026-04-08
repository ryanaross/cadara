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
  SnapshotEntityRecord,
  UpdateFeatureRequest,
  UpdateFeatureResponse,
} from '@/domain/modeling/schema'

const CONTRACT_VERSION = 'modeling-contract/v1alpha1' as const
const REVISION_ID = 'rev_0001' as const
const DOCUMENT_ID = 'doc_workspace' as const

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
    id: 'entity-construction_origin-planes',
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
    id: 'entity-construction_plane-xy',
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
    id: 'entity-construction_plane-yz',
    label: 'Plane YZ',
    target: { kind: 'construction', constructionId: 'construction_plane-yz' },
    relatedTargets: [{ kind: 'construction', constructionId: 'construction_origin-planes' }],
    consumedByFeatureIds: [],
  }),
  entity({
    ownerFeatureId: null,
    ownerSketchId: null,
    ownerBodyId: null,
    id: 'entity-construction_plane-xz',
    label: 'Plane XZ',
    target: { kind: 'construction', constructionId: 'construction_plane-xz' },
    relatedTargets: [{ kind: 'construction', constructionId: 'construction_origin-planes' }],
    consumedByFeatureIds: [],
  }),
  entity({
    ownerFeatureId: null,
    ownerSketchId: 'sketch_primary',
    ownerBodyId: null,
    id: 'entity-sketch_primary',
    label: 'Sketch 1',
    target: { kind: 'sketch', sketchId: 'sketch_primary' },
    relatedTargets: [
      { kind: 'construction', constructionId: 'construction_plane-xy' },
      { kind: 'sketchPrimitive', sketchId: 'sketch_primary', primitiveId: 'curve_rect-bottom' },
      { kind: 'sketchPrimitive', sketchId: 'sketch_primary', primitiveId: 'curve_rect-right' },
      { kind: 'sketchPrimitive', sketchId: 'sketch_primary', primitiveId: 'curve_profile-outer' },
      { kind: 'sketchPrimitive', sketchId: 'sketch_primary', primitiveId: 'point_origin' },
    ],
    consumedByFeatureIds: ['feature_extrude-1'],
  }),
  entity({
    ownerFeatureId: null,
    ownerSketchId: 'sketch_primary',
    ownerBodyId: null,
    id: 'entity-sketch_primary.curve_rect-bottom',
    label: 'Bottom edge',
    target: { kind: 'sketchPrimitive', sketchId: 'sketch_primary', primitiveId: 'curve_rect-bottom' },
    relatedTargets: [
      { kind: 'sketch', sketchId: 'sketch_primary' },
      { kind: 'sketchPrimitive', sketchId: 'sketch_primary', primitiveId: 'point_origin' },
    ],
    consumedByFeatureIds: [],
  }),
  entity({
    ownerFeatureId: null,
    ownerSketchId: 'sketch_primary',
    ownerBodyId: null,
    id: 'entity-sketch_primary.curve_rect-right',
    label: 'Right edge',
    target: { kind: 'sketchPrimitive', sketchId: 'sketch_primary', primitiveId: 'curve_rect-right' },
    relatedTargets: [
      { kind: 'sketch', sketchId: 'sketch_primary' },
      { kind: 'sketchPrimitive', sketchId: 'sketch_primary', primitiveId: 'point_origin' },
    ],
    consumedByFeatureIds: [],
  }),
  entity({
    ownerFeatureId: null,
    ownerSketchId: 'sketch_primary',
    ownerBodyId: null,
    id: 'entity-sketch_primary.curve_profile-outer',
    label: 'Outer profile',
    target: { kind: 'sketchPrimitive', sketchId: 'sketch_primary', primitiveId: 'curve_profile-outer' },
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
    id: 'entity-sketch_primary.point_origin',
    label: 'Origin point',
    target: { kind: 'sketchPrimitive', sketchId: 'sketch_primary', primitiveId: 'point_origin' },
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
    id: 'entity-feature_extrude-1',
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
    id: 'entity-feature_fillet-1',
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
    id: 'entity-body_part-1',
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
    id: 'entity-body_part-1.face_top',
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
    id: 'entity-body_part-1.face_bottom',
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
    id: 'entity-body_part-1.face_side-front',
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
    id: 'entity-body_part-1.face_side-right',
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
    id: 'entity-body_part-1.edge_outer-0',
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
    id: 'entity-body_part-1.edge_outer-1',
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
    id: 'entity-body_part-1.edge_outer-2',
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
    id: 'entity-body_part-1.edge_outer-3',
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
    id: 'entity-body_part-1.vertex_front-right',
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
    id: 'entity-body_part-1.vertex_front-left',
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
    id: 'entity-body_part-1.vertex_back-right',
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
    id: 'entity-body_part-1.vertex_back-left',
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
      id: 'feature-tree-origin-planes',
      label: 'Origin Planes',
      description: 'XY, YZ, XZ reference setup',
      kind: 'plane',
      target: { kind: 'construction', constructionId: 'construction_origin-planes' },
      ownerFeatureId: null,
      ownerSketchId: null,
      sourceFeatureId: null,
    },
    {
      id: 'feature-tree-sketch-primary',
      label: 'Sketch 1',
      description: 'Primary profile on the XY plane',
      kind: 'sketch',
      target: { kind: 'sketch', sketchId: 'sketch_primary' },
      ownerFeatureId: null,
      ownerSketchId: 'sketch_primary',
      sourceFeatureId: null,
    },
    {
      id: 'feature-tree-extrude-1',
      label: 'Extrude 1',
      description: 'Mid-plane boss feature',
      kind: 'feature',
      target: { kind: 'feature', featureId: 'feature_extrude-1' },
      ownerFeatureId: 'feature_extrude-1',
      ownerSketchId: null,
      sourceFeatureId: 'feature_extrude-1',
    },
    {
      id: 'feature-tree-fillet-1',
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
      id: 'object-body-part-1',
      label: 'Part 1',
      description: 'Solid body generated by the primary boss',
      kind: 'body',
      target: { kind: 'body', bodyId: 'body_part-1' },
      ownerBodyId: 'body_part-1',
      ownerFeatureId: 'feature_extrude-1',
    },
    {
      id: 'object-plane-xy',
      label: 'Plane XY',
      description: 'Reference plane for the primary sketch',
      kind: 'construction',
      target: { kind: 'construction', constructionId: 'construction_plane-xy' },
      ownerBodyId: null,
      ownerFeatureId: null,
    },
    {
      id: 'object-plane-yz',
      label: 'Plane YZ',
      description: 'Reference plane',
      kind: 'construction',
      target: { kind: 'construction', constructionId: 'construction_plane-yz' },
      ownerBodyId: null,
      ownerFeatureId: null,
    },
    {
      id: 'object-plane-xz',
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
      consumedTargets: [
        { kind: 'sketch', sketchId: 'sketch_primary' },
        { kind: 'sketchPrimitive', sketchId: 'sketch_primary', primitiveId: 'curve_profile-outer' },
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
      primitiveIds: ['curve_rect-bottom', 'curve_rect-right', 'curve_profile-outer', 'point_origin'],
      primitives: [
        {
          primitiveId: 'curve_rect-bottom',
          label: 'Bottom edge',
          kind: 'line',
          target: { kind: 'sketchPrimitive', sketchId: 'sketch_primary', primitiveId: 'curve_rect-bottom' },
        },
        {
          primitiveId: 'curve_rect-right',
          label: 'Right edge',
          kind: 'line',
          target: { kind: 'sketchPrimitive', sketchId: 'sketch_primary', primitiveId: 'curve_rect-right' },
        },
        {
          primitiveId: 'curve_profile-outer',
          label: 'Outer profile',
          kind: 'profile',
          target: { kind: 'sketchPrimitive', sketchId: 'sketch_primary', primitiveId: 'curve_profile-outer' },
        },
        {
          primitiveId: 'point_origin',
          label: 'Origin point',
          kind: 'point',
          target: { kind: 'sketchPrimitive', sketchId: 'sketch_primary', primitiveId: 'point_origin' },
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
      target: { kind: 'sketchPrimitive', sketchId: 'sketch_primary', primitiveId: 'curve_profile-outer' },
      ownerFeatureId: 'feature_extrude-1',
      ownerSketchId: 'sketch_primary',
      invalidationReason: null,
    },
    {
      id: 'ref_feature_fillet_chain',
      label: 'Outer fillet chain',
      target: { kind: 'edge', bodyId: 'body_part-1', edgeId: 'edge_outer-0' },
      ownerFeatureId: 'feature_fillet-1',
      ownerSketchId: null,
      invalidationReason: null,
    },
  ],
  diagnostics: [],
  renderables: [
    {
      id: 'render_face_top',
      label: 'body_part-1.face_top',
      target: { kind: 'face', bodyId: 'body_part-1', faceId: 'face_top' },
      ownerBodyId: 'body_part-1',
      ownerFeatureId: 'feature_extrude-1',
      topology: 'face',
      pickBinding: {
        pickId: 'pick_body_part-1_face_top',
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
      id: 'render_edge_outer_0',
      label: 'body_part-1.edge_outer-0',
      target: { kind: 'edge', bodyId: 'body_part-1', edgeId: 'edge_outer-0' },
      ownerBodyId: 'body_part-1',
      ownerFeatureId: 'feature_fillet-1',
      topology: 'edge',
      pickBinding: {
        pickId: 'pick_body_part-1_edge_outer_0',
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
      id: 'render_vertex_front_right',
      label: 'body_part-1.vertex_front-right',
      target: { kind: 'vertex', bodyId: 'body_part-1', vertexId: 'vertex_front-right' },
      ownerBodyId: 'body_part-1',
      ownerFeatureId: 'feature_extrude-1',
      topology: 'vertex',
      pickBinding: {
        pickId: 'pick_body_part-1_vertex_front_right',
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

import type { SketchRecord } from '@/contracts/sketch/schema'
import type {
  ConstraintId,
  DimensionId,
  FeatureTreeNodeId,
  ObjectTreeNodeId,
  PickId,
  RegionId,
  RenderableId,
  SketchEntityId,
  SketchPointId,
  SnapshotEntityId,
} from '@/contracts/shared/ids'
import { getPrimitiveRefKey } from '@/domain/editor/schema'
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

const CONTRACT_VERSION = 'modeling-contract/v1alpha1' as const
const REVISION_ID = 'rev_0001' as const
const DOCUMENT_ID = 'doc_workspace' as const
const CURRENT_REVISION_ID = 'rev_0002' as const

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

const sketchRecord: SketchRecord = {
  ownerDocumentId: DOCUMENT_ID,
  ownerRevisionId: REVISION_ID,
  ownerFeatureId: null,
  ownerSketchId: 'sketch_primary',
  ownerBodyId: null,
  sketchId: 'sketch_primary',
  label: 'Sketch 1',
  definition: {
    schemaVersion: 'sketch-definition/v1alpha1',
    referenceIds: ['ref_sketch_primary_plane' as const],
    references: [
      {
        referenceId: 'ref_sketch_primary_plane' as const,
        kind: 'constructionPlane',
        label: 'Sketch plane',
        source: { kind: 'construction', constructionId: 'construction_plane-xy' },
        projectionMode: 'coplanar',
      },
    ],
    pointIds: [
      'sketch_point_1_rect-bottom-left' as SketchPointId,
      'sketch_point_1_rect-bottom-right' as SketchPointId,
      'sketch_point_1_rect-top-right' as SketchPointId,
      'sketch_point_1_rect-top-left' as SketchPointId,
    ],
    points: [
      {
        pointId: 'sketch_point_1_rect-bottom-left' as SketchPointId,
        label: 'Rectangle 1 bottom left',
        target: { kind: 'sketchPoint', sketchId: 'sketch_primary', pointId: 'sketch_point_1_rect-bottom-left' as SketchPointId },
        position: [-4, -3],
        isConstruction: false,
      },
      {
        pointId: 'sketch_point_1_rect-bottom-right' as SketchPointId,
        label: 'Rectangle 1 bottom right',
        target: { kind: 'sketchPoint', sketchId: 'sketch_primary', pointId: 'sketch_point_1_rect-bottom-right' as SketchPointId },
        position: [4, -3],
        isConstruction: false,
      },
      {
        pointId: 'sketch_point_1_rect-top-right' as SketchPointId,
        label: 'Rectangle 1 top right',
        target: { kind: 'sketchPoint', sketchId: 'sketch_primary', pointId: 'sketch_point_1_rect-top-right' as SketchPointId },
        position: [4, 3],
        isConstruction: false,
      },
      {
        pointId: 'sketch_point_1_rect-top-left' as SketchPointId,
        label: 'Rectangle 1 top left',
        target: { kind: 'sketchPoint', sketchId: 'sketch_primary', pointId: 'sketch_point_1_rect-top-left' as SketchPointId },
        position: [-4, 3],
        isConstruction: false,
      },
    ],
    entityIds: [
      'sketch_entity_1_rect-bottom' as SketchEntityId,
      'sketch_entity_1_rect-right' as SketchEntityId,
      'sketch_entity_1_rect-top' as SketchEntityId,
      'sketch_entity_1_rect-left' as SketchEntityId,
    ],
    entities: [
      {
        kind: 'lineSegment',
        entityId: 'sketch_entity_1_rect-bottom' as SketchEntityId,
        label: 'Rectangle 1 bottom',
        target: { kind: 'sketchEntity', sketchId: 'sketch_primary', entityId: 'sketch_entity_1_rect-bottom' as SketchEntityId },
        isConstruction: false,
        startPointId: 'sketch_point_1_rect-bottom-left' as SketchPointId,
        endPointId: 'sketch_point_1_rect-bottom-right' as SketchPointId,
      },
      {
        kind: 'lineSegment',
        entityId: 'sketch_entity_1_rect-right' as SketchEntityId,
        label: 'Rectangle 1 right',
        target: { kind: 'sketchEntity', sketchId: 'sketch_primary', entityId: 'sketch_entity_1_rect-right' as SketchEntityId },
        isConstruction: false,
        startPointId: 'sketch_point_1_rect-bottom-right' as SketchPointId,
        endPointId: 'sketch_point_1_rect-top-right' as SketchPointId,
      },
      {
        kind: 'lineSegment',
        entityId: 'sketch_entity_1_rect-top' as SketchEntityId,
        label: 'Rectangle 1 top',
        target: { kind: 'sketchEntity', sketchId: 'sketch_primary', entityId: 'sketch_entity_1_rect-top' as SketchEntityId },
        isConstruction: false,
        startPointId: 'sketch_point_1_rect-top-right' as SketchPointId,
        endPointId: 'sketch_point_1_rect-top-left' as SketchPointId,
      },
      {
        kind: 'lineSegment',
        entityId: 'sketch_entity_1_rect-left' as SketchEntityId,
        label: 'Rectangle 1 left',
        target: { kind: 'sketchEntity', sketchId: 'sketch_primary', entityId: 'sketch_entity_1_rect-left' as SketchEntityId },
        isConstruction: false,
        startPointId: 'sketch_point_1_rect-top-left' as SketchPointId,
        endPointId: 'sketch_point_1_rect-bottom-left' as SketchPointId,
      },
    ],
    constraintIds: [
      'constraint_1_bottom-horizontal' as ConstraintId,
      'constraint_1_top-horizontal' as ConstraintId,
      'constraint_1_right-vertical' as ConstraintId,
      'constraint_1_left-vertical' as ConstraintId,
    ],
    constraints: [
      {
        constraintId: 'constraint_1_bottom-horizontal' as ConstraintId,
        kind: 'horizontal',
        label: 'Rectangle 1 bottom horizontal',
        entityId: 'sketch_entity_1_rect-bottom' as SketchEntityId,
      },
      {
        constraintId: 'constraint_1_top-horizontal' as ConstraintId,
        kind: 'horizontal',
        label: 'Rectangle 1 top horizontal',
        entityId: 'sketch_entity_1_rect-top' as SketchEntityId,
      },
      {
        constraintId: 'constraint_1_right-vertical' as ConstraintId,
        kind: 'vertical',
        label: 'Rectangle 1 right vertical',
        entityId: 'sketch_entity_1_rect-right' as SketchEntityId,
      },
      {
        constraintId: 'constraint_1_left-vertical' as ConstraintId,
        kind: 'vertical',
        label: 'Rectangle 1 left vertical',
        entityId: 'sketch_entity_1_rect-left' as SketchEntityId,
      },
    ],
    dimensionIds: [
      'dimension_1_width' as DimensionId,
      'dimension_1_height' as DimensionId,
    ],
    dimensions: [
      {
        dimensionId: 'dimension_1_width' as DimensionId,
        kind: 'distance',
        label: 'Rectangle 1 width',
        axis: 'horizontal',
        pointIds: [
          'sketch_point_1_rect-bottom-left' as SketchPointId,
          'sketch_point_1_rect-bottom-right' as SketchPointId,
        ],
        value: 8,
      },
      {
        dimensionId: 'dimension_1_height' as DimensionId,
        kind: 'distance',
        label: 'Rectangle 1 height',
        axis: 'vertical',
        pointIds: [
          'sketch_point_1_rect-bottom-left' as SketchPointId,
          'sketch_point_1_rect-top-left' as SketchPointId,
        ],
        value: 6,
      },
    ],
  },
  solvedSnapshot: {
    schemaVersion: 'solved-sketch/v1alpha1',
    status: 'fullyConstrained',
    solvedEntities: [
      {
        entityId: 'sketch_entity_1_rect-bottom' as SketchEntityId,
        kind: 'lineSegment',
        startPosition: [-4, -3],
        endPosition: [4, -3],
      },
      {
        entityId: 'sketch_entity_1_rect-right' as SketchEntityId,
        kind: 'lineSegment',
        startPosition: [4, -3],
        endPosition: [4, 3],
      },
      {
        entityId: 'sketch_entity_1_rect-top' as SketchEntityId,
        kind: 'lineSegment',
        startPosition: [4, 3],
        endPosition: [-4, 3],
      },
      {
        entityId: 'sketch_entity_1_rect-left' as SketchEntityId,
        kind: 'lineSegment',
        startPosition: [-4, 3],
        endPosition: [-4, -3],
      },
    ],
    solvedPoints: [
      {
        pointId: 'sketch_point_1_rect-bottom-left' as SketchPointId,
        target: { kind: 'sketchPoint', sketchId: 'sketch_primary', pointId: 'sketch_point_1_rect-bottom-left' as SketchPointId },
        solvedPosition: [-4, -3],
      },
      {
        pointId: 'sketch_point_1_rect-bottom-right' as SketchPointId,
        target: { kind: 'sketchPoint', sketchId: 'sketch_primary', pointId: 'sketch_point_1_rect-bottom-right' as SketchPointId },
        solvedPosition: [4, -3],
      },
      {
        pointId: 'sketch_point_1_rect-top-right' as SketchPointId,
        target: { kind: 'sketchPoint', sketchId: 'sketch_primary', pointId: 'sketch_point_1_rect-top-right' as SketchPointId },
        solvedPosition: [4, 3],
      },
      {
        pointId: 'sketch_point_1_rect-top-left' as SketchPointId,
        target: { kind: 'sketchPoint', sketchId: 'sketch_primary', pointId: 'sketch_point_1_rect-top-left' as SketchPointId },
        solvedPosition: [-4, 3],
      },
    ],
    constraintStatuses: [
      {
        constraintId: 'constraint_1_bottom-horizontal' as ConstraintId,
        status: 'satisfied',
      },
      {
        constraintId: 'constraint_1_top-horizontal' as ConstraintId,
        status: 'satisfied',
      },
      {
        constraintId: 'constraint_1_right-vertical' as ConstraintId,
        status: 'satisfied',
      },
      {
        constraintId: 'constraint_1_left-vertical' as ConstraintId,
        status: 'satisfied',
      },
    ],
    dimensionStatuses: [
      {
        dimensionId: 'dimension_1_width' as DimensionId,
        status: 'driving',
        solvedValue: 8,
      },
      {
        dimensionId: 'dimension_1_height' as DimensionId,
        status: 'driving',
        solvedValue: 6,
      },
    ],
    diagnostics: [],
  },
  regions: [
    {
      ownerDocumentId: DOCUMENT_ID,
      ownerRevisionId: REVISION_ID,
      ownerFeatureId: null,
      ownerSketchId: 'sketch_primary',
      ownerBodyId: null,
      regionId: 'region_primary-outer' as RegionId,
      label: 'Outer region',
      target: { kind: 'region', sketchId: 'sketch_primary', regionId: 'region_primary-outer' as RegionId },
      sourceSketch: { kind: 'sketch', sketchId: 'sketch_primary' },
      boundaryEntityIds: [
        'sketch_entity_1_rect-bottom' as SketchEntityId,
        'sketch_entity_1_rect-right' as SketchEntityId,
        'sketch_entity_1_rect-top' as SketchEntityId,
        'sketch_entity_1_rect-left' as SketchEntityId,
      ],
      boundaryPointIds: [
        'sketch_point_1_rect-bottom-left' as SketchPointId,
        'sketch_point_1_rect-bottom-right' as SketchPointId,
        'sketch_point_1_rect-top-right' as SketchPointId,
        'sketch_point_1_rect-top-left' as SketchPointId,
      ],
      isClosed: true,
    },
  ],
}

function entity(input: Omit<SnapshotEntityRecord, 'ownerDocumentId' | 'ownerRevisionId'>): SnapshotEntityRecord {
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
      { kind: 'region', sketchId: 'sketch_primary', regionId: 'region_primary-outer' as RegionId },
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
      { kind: 'region', sketchId: 'sketch_primary', regionId: 'region_primary-outer' as RegionId },
      ...sketchRecord.definition.entities.map((entry) => entry.target),
      ...sketchRecord.definition.points.map((entry) => entry.target),
    ],
    consumedByFeatureIds: ['feature_extrude-1'],
  }),
  entity({
    ownerFeatureId: null,
    ownerSketchId: 'sketch_primary',
    ownerBodyId: null,
    id: 'snapshot_entity_sketch_primary_region_outer' as SnapshotEntityId,
    label: 'Outer region',
    target: { kind: 'region', sketchId: 'sketch_primary', regionId: 'region_primary-outer' as RegionId },
    relatedTargets: [
      { kind: 'sketch', sketchId: 'sketch_primary' },
      ...sketchRecord.definition.entities.map((entry) => entry.target),
    ],
    consumedByFeatureIds: ['feature_extrude-1'],
  }),
  ...sketchRecord.definition.entities.map((entry, index) =>
    entity({
      ownerFeatureId: null,
      ownerSketchId: 'sketch_primary',
      ownerBodyId: null,
      id: `snapshot_entity_sketch_primary_entity_${index}` as SnapshotEntityId,
      label: entry.label,
      target: entry.target,
      relatedTargets: [{ kind: 'sketch', sketchId: 'sketch_primary' }],
      consumedByFeatureIds: [],
    }),
  ),
  ...sketchRecord.definition.points.map((point, index) =>
    entity({
      ownerFeatureId: null,
      ownerSketchId: 'sketch_primary',
      ownerBodyId: null,
      id: `snapshot_entity_sketch_primary_point_${index}` as SnapshotEntityId,
      label: point.label,
      target: point.target,
      relatedTargets: [{ kind: 'sketch', sketchId: 'sketch_primary' }],
      consumedByFeatureIds: [],
    }),
  ),
  entity({
    ownerFeatureId: 'feature_extrude-1',
    ownerSketchId: null,
    ownerBodyId: null,
    id: 'snapshot_entity_feature_extrude_1' as SnapshotEntityId,
    label: 'Extrude 1',
    target: { kind: 'feature', featureId: 'feature_extrude-1' },
    relatedTargets: [
      { kind: 'region', sketchId: 'sketch_primary', regionId: 'region_primary-outer' as RegionId },
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
]

const snapshot: DocumentSnapshot = {
  contractVersion: CONTRACT_VERSION,
  schemaVersion: 'document-snapshot/v1alpha1',
  documentId: DOCUMENT_ID,
  revisionId: REVISION_ID,
  featureTree: [
    {
      id: 'feature_tree_node_plane_xy' as FeatureTreeNodeId,
      label: 'Top Plane',
      description: 'Primary XY reference plane',
      kind: 'plane',
      target: { kind: 'construction', constructionId: 'construction_plane-xy' },
      ownerFeatureId: null,
      ownerSketchId: null,
      sourceFeatureId: null,
    },
    {
      id: 'feature_tree_node_sketch_1' as FeatureTreeNodeId,
      label: 'Sketch 1',
      description: 'Primary sketch on the XY plane',
      kind: 'sketch',
      target: { kind: 'sketch', sketchId: 'sketch_primary' },
      ownerFeatureId: null,
      ownerSketchId: 'sketch_primary',
      sourceFeatureId: null,
    },
    {
      id: 'feature_tree_node_feature_extrude_1' as FeatureTreeNodeId,
      label: 'Extrude 1',
      description: 'Extrude from the derived outer sketch region',
      kind: 'feature',
      target: { kind: 'feature', featureId: 'feature_extrude-1' },
      ownerFeatureId: 'feature_extrude-1',
      ownerSketchId: null,
      sourceFeatureId: null,
    },
  ],
  objects: [
    {
      id: 'object_tree_node_body_part_1' as ObjectTreeNodeId,
      label: 'Part 1',
      description: 'Primary solid body',
      kind: 'body',
      target: { kind: 'body', bodyId: 'body_part-1' },
      ownerBodyId: 'body_part-1',
      ownerFeatureId: 'feature_extrude-1',
    },
    {
      id: 'object_tree_node_plane_xy' as ObjectTreeNodeId,
      label: 'Top Plane',
      description: 'Construction plane',
      kind: 'construction',
      target: { kind: 'construction', constructionId: 'construction_plane-xy' },
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
        profileTarget: { kind: 'region', sketchId: 'sketch_primary', regionId: 'region_primary-outer' as RegionId },
      },
      consumedTargets: [
        { kind: 'sketch', sketchId: 'sketch_primary' },
        { kind: 'region', sketchId: 'sketch_primary', regionId: 'region_primary-outer' as RegionId },
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
      sketch: sketchRecord,
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
      constructionId: 'construction_plane-xy',
      label: 'Top Plane',
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
      label: 'Right Plane',
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
      label: 'Front Plane',
      constructionType: 'plane',
      target: { kind: 'construction', constructionId: 'construction_plane-xz' },
    },
  ],
  entities,
  references: [
    {
      id: 'ref_feature_extrude_region' as const,
      label: 'Extrude region',
      target: { kind: 'region', sketchId: 'sketch_primary', regionId: 'region_primary-outer' as RegionId },
      ownerFeatureId: 'feature_extrude-1',
      ownerSketchId: 'sketch_primary',
      invalidation: null,
    },
  ],
  diagnostics: [],
  renderables: [
    {
      id: 'renderable_face_top' as RenderableId,
      label: 'Top face',
      target: { kind: 'face', bodyId: 'body_part-1', faceId: 'face_top' },
      ownerBodyId: 'body_part-1',
      ownerFeatureId: 'feature_extrude-1',
      topology: 'face',
      pickBinding: {
        pickId: 'pick_face_top' as PickId,
        target: { kind: 'face', bodyId: 'body_part-1', faceId: 'face_top' },
        topology: 'face',
      },
      geometry: {
        kind: 'planarFace',
        center: [0, 0, 12],
        size: [8, 6],
        normalAxis: 'z',
      },
    },
    {
      id: 'renderable_edge_outer_0' as RenderableId,
      label: 'Outer edge',
      target: { kind: 'edge', bodyId: 'body_part-1', edgeId: 'edge_outer-0' },
      ownerBodyId: 'body_part-1',
      ownerFeatureId: 'feature_extrude-1',
      topology: 'edge',
      pickBinding: {
        pickId: 'pick_edge_outer_0' as PickId,
        target: { kind: 'edge', bodyId: 'body_part-1', edgeId: 'edge_outer-0' },
        topology: 'edge',
      },
      geometry: {
        kind: 'polyline',
        points: [[-4, -3, 12], [4, -3, 12]],
      },
    },
  ],
}

export class MockKernelAdapter implements ModelingKernelAdapter {
  async getDocumentSnapshot(_request: GetDocumentSnapshotRequest): Promise<GetDocumentSnapshotResponse> {
    return {
      snapshot,
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
        ...request.definition.entities.map((entity) => entity.target),
        ...request.definition.points.map((point) => point.target),
      ],
      diagnostics: [
        {
          code: 'mock-commit-sketch',
          severity: 'info',
          message: 'Mock kernel accepted the sketch definition commit request without mutating the document.',
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
      diagnostics: [],
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
      changedTargets: [{ kind: 'feature', featureId: request.featureId }],
      diagnostics: [],
    }
  }

  async evaluatePreview(request: EvaluatePreviewRequest): Promise<EvaluatePreviewResponse> {
    return {
      contractVersion: CONTRACT_VERSION,
      documentId: request.documentId,
      revisionId: request.baseRevisionId,
      previewId: request.previewId,
      freshness: request.baseRevisionId === REVISION_ID
        ? { kind: 'fresh', baseRevisionId: request.baseRevisionId }
        : {
            kind: 'stale',
            requestedRevisionId: request.baseRevisionId,
            currentRevisionId: CURRENT_REVISION_ID,
          },
      renderables: snapshot.renderables,
      diagnostics: [],
    }
  }

  async resolveReference(request: ResolveReferenceRequest): Promise<ResolveReferenceResponse> {
    const entityRecord = entities.find((entry) => getPrimitiveRefKey(entry.target) === getPrimitiveRefKey(request.target))

    return {
      contractVersion: CONTRACT_VERSION,
      resolution: {
        label: entityRecord?.label ?? 'Resolved target',
        target: request.target,
        ownerDocumentId: DOCUMENT_ID,
        ownerRevisionId: REVISION_ID,
        ownerFeatureId: entityRecord?.ownerFeatureId ?? null,
        ownerSketchId: entityRecord?.ownerSketchId ?? null,
        ownerBodyId: entityRecord?.ownerBodyId ?? null,
        invalidation: null,
      },
      diagnostics: [],
    }
  }
}

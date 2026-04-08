import type { SketchDefinition, SketchRecord } from '@/contracts/sketch/schema'
import type { SketchSolverAdapter } from '@/contracts/solver/adapter'
import { SOLVER_SCHEMA_VERSION } from '@/contracts/solver/schema'
import type {
  ConstraintId,
  DimensionId,
  FeatureTreeNodeId,
  ObjectTreeNodeId,
  PickId,
  RegionId,
  RenderableId,
  SketchId,
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
import type { ModelingCommitSketchCorrelation } from '@/domain/modeling/modeling-service'
import {
  DEFAULT_MOCK_SKETCH_PLANE_FRAME,
  DEFAULT_MOCK_SOLVER_TOLERANCES,
  MockSketchSolverAdapter,
  evaluateMockSketchDefinition,
} from '@/domain/solver/mock-sketch-solver-adapter'

const CONTRACT_VERSION = 'modeling-contract/v1alpha1' as const
const REVISION_ID = 'rev_0001' as const
const DOCUMENT_ID = 'doc_workspace' as const
const CURRENT_REVISION_ID = 'rev_0002' as const
const SKETCH_ID = 'sketch_primary' as const

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

function getCommitSolverCorrelation(
  request: CommitSketchRequest & { solverCorrelation?: ModelingCommitSketchCorrelation | null },
): ModelingCommitSketchCorrelation {
  if (!request.solverCorrelation) {
    throw new Error('Sketch commit request must include explicit solverCorrelation request IDs.')
  }

  return request.solverCorrelation
}

function mapSketchSolverDiagnostic(
  sketchId: SketchId,
  diagnostic: {
    code: string
    severity: 'info' | 'warning' | 'error'
    message: string
    target: { kind: 'entity'; entityId: SketchEntityId }
      | { kind: 'point'; pointId: SketchPointId }
      | { kind: 'constraint'; constraintId: ConstraintId }
      | { kind: 'dimension'; dimensionId: DimensionId }
      | { kind: 'region'; regionId: RegionId }
      | null
  },
) {
  return {
    code: `mock-solver:${diagnostic.code}`,
    severity: diagnostic.severity,
    message: diagnostic.message,
    target:
      diagnostic.target?.kind === 'entity'
        ? { kind: 'sketchEntity' as const, sketchId, entityId: diagnostic.target.entityId }
        : diagnostic.target?.kind === 'point'
          ? { kind: 'sketchPoint' as const, sketchId, pointId: diagnostic.target.pointId }
          : diagnostic.target?.kind === 'region'
            ? { kind: 'region' as const, sketchId, regionId: diagnostic.target.regionId }
            : null,
    detail: null,
  }
}

const sketchDefinition: SketchDefinition = {
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
}

function createSketchReferenceFrame(input: {
  planeTarget: CommitSketchRequest['planeTarget'] | SketchRecord['definition']['references'][number]['source']
  planeKey: 'xy' | 'yz' | 'xz'
}) {
  const byPlaneKey = {
    xy: {
      ...DEFAULT_MOCK_SKETCH_PLANE_FRAME,
      xAxis: [1, 0, 0] as const,
      yAxis: [0, 1, 0] as const,
      normal: [0, 0, 1] as const,
    },
    yz: {
      ...DEFAULT_MOCK_SKETCH_PLANE_FRAME,
      xAxis: [0, 1, 0] as const,
      yAxis: [0, 0, 1] as const,
      normal: [1, 0, 0] as const,
    },
    xz: {
      ...DEFAULT_MOCK_SKETCH_PLANE_FRAME,
      xAxis: [1, 0, 0] as const,
      yAxis: [0, 0, 1] as const,
      normal: [0, -1, 0] as const,
    },
  } satisfies Record<'xy' | 'yz' | 'xz', typeof DEFAULT_MOCK_SKETCH_PLANE_FRAME>

  return byPlaneKey[input.planeKey]
}

async function buildSketchRecord(
  _solverAdapter: SketchSolverAdapter,
  input: {
    documentId: typeof DOCUMENT_ID
    revisionId: typeof REVISION_ID
    sketchId: 'sketch_primary'
    label: string
    definition: SketchDefinition
  },
): Promise<SketchRecord> {
  const evaluation = evaluateMockSketchDefinition({
    documentId: input.documentId,
    revisionId: input.revisionId,
    sketchId: input.sketchId,
    plane: createSketchReferenceFrame({
      planeTarget: { kind: 'construction', constructionId: 'construction_plane-xy' },
      planeKey: 'xy',
    }),
    tolerances: DEFAULT_MOCK_SOLVER_TOLERANCES,
    definition: input.definition,
    requestId: 'request_mock-snapshot-bootstrap',
  })

  return {
    ownerDocumentId: input.documentId,
    ownerRevisionId: input.revisionId,
    ownerFeatureId: null,
    ownerSketchId: input.sketchId,
    ownerBodyId: null,
    sketchId: input.sketchId,
    label: input.label,
    definition: input.definition,
    solvedSnapshot: evaluation.solve.solvedSnapshot,
    regions: evaluation.regions.regions,
  }
}

async function buildSnapshot(solverAdapter: SketchSolverAdapter): Promise<DocumentSnapshot> {
  const sketchRecord = await buildSketchRecord(solverAdapter, {
    documentId: DOCUMENT_ID,
    revisionId: REVISION_ID,
    sketchId: SKETCH_ID,
    label: 'Sketch 1',
    definition: sketchDefinition,
  })
  const primaryRegion = sketchRecord.regions[0]

  if (!primaryRegion) {
    throw new Error('Mock snapshot bootstrap expected a solver-derived primary region.')
  }

  const entities = [
    entity({
      ownerFeatureId: null,
      ownerSketchId: null,
      ownerBodyId: null,
      id: 'snapshot_entity_construction_origin_planes' as SnapshotEntityId,
      label: 'Origin planes',
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
      relatedTargets: [{ kind: 'construction', constructionId: 'construction_origin-planes' }],
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
      ownerSketchId: SKETCH_ID,
      ownerBodyId: null,
      id: 'snapshot_entity_sketch_primary' as SnapshotEntityId,
      label: 'Sketch 1',
      target: { kind: 'sketch', sketchId: SKETCH_ID },
      relatedTargets: [
        { kind: 'construction', constructionId: 'construction_plane-xy' },
        ...sketchRecord.regions.map((region) => region.target),
        ...sketchRecord.definition.entities.map((entry) => entry.target),
        ...sketchRecord.definition.points.map((entry) => entry.target),
      ],
      consumedByFeatureIds: ['feature_extrude-1'],
    }),
    entity({
      ownerFeatureId: null,
      ownerSketchId: SKETCH_ID,
      ownerBodyId: null,
      id: 'snapshot_entity_sketch_primary_region_outer' as SnapshotEntityId,
      label: primaryRegion.label,
      target: primaryRegion.target,
      relatedTargets: [
        { kind: 'sketch', sketchId: SKETCH_ID },
        ...sketchRecord.definition.entities.map((entry) => entry.target),
      ],
      consumedByFeatureIds: ['feature_extrude-1'],
    }),
    ...sketchRecord.definition.entities.map((entry, index) =>
      entity({
        ownerFeatureId: null,
        ownerSketchId: SKETCH_ID,
        ownerBodyId: null,
        id: `snapshot_entity_sketch_primary_entity_${index}` as SnapshotEntityId,
        label: entry.label,
        target: entry.target,
        relatedTargets: [{ kind: 'sketch', sketchId: SKETCH_ID }],
        consumedByFeatureIds: [],
      }),
    ),
    ...sketchRecord.definition.points.map((point, index) =>
      entity({
        ownerFeatureId: null,
        ownerSketchId: SKETCH_ID,
        ownerBodyId: null,
        id: `snapshot_entity_sketch_primary_point_${index}` as SnapshotEntityId,
        label: point.label,
        target: point.target,
        relatedTargets: [{ kind: 'sketch', sketchId: SKETCH_ID }],
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
        primaryRegion.target,
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

  return {
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
        target: { kind: 'sketch', sketchId: SKETCH_ID },
        ownerFeatureId: null,
        ownerSketchId: SKETCH_ID,
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
          profileTarget: primaryRegion.target,
        },
        consumedTargets: [
          { kind: 'sketch', sketchId: SKETCH_ID },
          primaryRegion.target,
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
        ownerSketchId: SKETCH_ID,
        ownerBodyId: null,
        sketchId: SKETCH_ID,
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
        target: primaryRegion.target,
        ownerFeatureId: 'feature_extrude-1',
        ownerSketchId: SKETCH_ID,
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
}

function entity(input: Omit<SnapshotEntityRecord, 'ownerDocumentId' | 'ownerRevisionId'>): SnapshotEntityRecord {
  return {
    ownerDocumentId: DOCUMENT_ID,
    ownerRevisionId: REVISION_ID,
    ...input,
  }
}

export class MockKernelAdapter implements ModelingKernelAdapter {
  private readonly solverAdapter: SketchSolverAdapter

  private snapshotPromise: Promise<DocumentSnapshot> | null = null

  constructor(options?: { solverAdapter?: SketchSolverAdapter }) {
    this.solverAdapter = options?.solverAdapter ?? new MockSketchSolverAdapter()
  }

  private getSnapshot() {
    if (!this.snapshotPromise) {
      this.snapshotPromise = buildSnapshot(this.solverAdapter)
    }

    return this.snapshotPromise
  }

  async getDocumentSnapshot(_request: GetDocumentSnapshotRequest): Promise<GetDocumentSnapshotResponse> {
    return {
      snapshot: await this.getSnapshot(),
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
    const solverCorrelation = getCommitSolverCorrelation(request)
    const referenceFrame = createSketchReferenceFrame({
      planeTarget: request.planeTarget,
      planeKey: request.planeKey,
    })

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

    const projection = await this.solverAdapter.projectExternalReferences({
      contractVersion: CONTRACT_VERSION,
      solverSchemaVersion: SOLVER_SCHEMA_VERSION,
      requestId: solverCorrelation.projectionRequestId,
      documentId: request.documentId,
      revisionId: request.baseRevisionId,
      sketchId,
      plane: referenceFrame,
      tolerances: DEFAULT_MOCK_SOLVER_TOLERANCES,
      references: request.definition.references.map((reference) => ({
        referenceId: reference.referenceId,
        reference,
      })),
    })
    const validation = await this.solverAdapter.validateSketch({
      contractVersion: CONTRACT_VERSION,
      solverSchemaVersion: SOLVER_SCHEMA_VERSION,
      requestId: solverCorrelation.validationRequestId,
      documentId: request.documentId,
      revisionId: request.baseRevisionId,
      sketchId,
      plane: referenceFrame,
      tolerances: DEFAULT_MOCK_SOLVER_TOLERANCES,
      definition: request.definition,
      projectedReferences: projection.projectedReferences,
    })
    const solved = await this.solverAdapter.solveSketch({
      contractVersion: CONTRACT_VERSION,
      solverSchemaVersion: SOLVER_SCHEMA_VERSION,
      requestId: solverCorrelation.solveRequestId,
      documentId: request.documentId,
      revisionId: request.baseRevisionId,
      sketchId,
      plane: referenceFrame,
      tolerances: DEFAULT_MOCK_SOLVER_TOLERANCES,
      partialSolvePolicy: 'bestEffort',
      definition: request.definition,
      projectedReferences: projection.projectedReferences,
      incrementalEdit: null,
    })
    const regions = await this.solverAdapter.deriveSketchRegions({
      contractVersion: CONTRACT_VERSION,
      solverSchemaVersion: SOLVER_SCHEMA_VERSION,
      requestId: solverCorrelation.regionRequestId,
      documentId: request.documentId,
      revisionId: request.baseRevisionId,
      sketchId,
      solvedSnapshot: solved.solvedSnapshot,
      definition: request.definition,
    })

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
        ...solved.derivedRegions.map((region) => region.target),
        ...request.definition.entities.map((entity) => entity.target),
        ...request.definition.points.map((point) => point.target),
      ],
      diagnostics: [
        ...projection.diagnostics.map((diagnostic) => mapSketchSolverDiagnostic(sketchId, diagnostic)),
        ...validation.diagnostics.map((diagnostic) => mapSketchSolverDiagnostic(sketchId, diagnostic)),
        ...solved.diagnostics.map((diagnostic) => mapSketchSolverDiagnostic(sketchId, diagnostic)),
        ...regions.diagnostics.map((diagnostic) => mapSketchSolverDiagnostic(sketchId, diagnostic)),
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
    const snapshot = await this.getSnapshot()
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
    const snapshot = await this.getSnapshot()
    const entityRecord = snapshot.entities.find((entry) => getPrimitiveRefKey(entry.target) === getPrimitiveRefKey(request.target))

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

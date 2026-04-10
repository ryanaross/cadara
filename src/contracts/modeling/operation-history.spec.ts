import {
  createCommitSketchHistoryEntry,
  createCreateFeatureHistoryEntry,
  createEmptyOperationHistory,
  createReorderFeatureHistoryEntry,
  validateOperationHistoryPayload,
  type ModelingOperationHistoryPayload,
} from '@/contracts/modeling/operation-history'
import type { CommitSketchRequest, CreateFeatureRequest, ReorderFeatureRequest } from '@/contracts/modeling/schema'
import { EXTRUDE_FEATURE_SCHEMA_VERSION } from '@/contracts/shared/versioning'
import { SKETCH_SCHEMA_VERSION } from '@/contracts/sketch/schema'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

const sketchDefinition = {
  schemaVersion: SKETCH_SCHEMA_VERSION,
  referenceIds: [],
  references: [],
  pointIds: [],
  points: [],
  entityIds: [],
  entities: [],
  constraintIds: [],
  constraints: [],
  dimensionIds: [],
  dimensions: [],
}

const commitSketchRequest: CommitSketchRequest = {
  contractVersion: 'modeling-contract/v1alpha1',
  documentId: 'doc_workspace',
  baseRevisionId: 'rev_0001',
  solverCorrelation: {
    requestId: 'request_commit',
    projectionRequestId: 'request_commit:project',
    validationRequestId: 'request_commit:validate',
    solveRequestId: 'request_commit:solve',
    regionRequestId: 'request_commit:regions',
  },
  sketchId: 'sketch_profile',
  sketchLabel: 'Profile',
  plane: {
    key: 'xy',
    support: { kind: 'construction', constructionId: 'construction_plane-xy' },
    frame: {
      origin: [0, 0, 0],
      xAxis: [1, 0, 0],
      yAxis: [0, 1, 0],
      normal: [0, 0, 1],
      linearUnit: 'documentLength',
      handedness: 'rightHanded',
    },
  },
  planeTarget: { kind: 'construction', constructionId: 'construction_plane-xy' },
  planeKey: 'xy',
  definition: sketchDefinition,
}

const createFeatureRequest: CreateFeatureRequest = {
  contractVersion: 'modeling-contract/v1alpha1',
  documentId: 'doc_workspace',
  baseRevisionId: 'rev_0002',
  definition: {
    kind: 'extrude',
    featureTypeVersion: EXTRUDE_FEATURE_SCHEMA_VERSION,
    parameters: {
      profile: { kind: 'region', sketchId: 'sketch_profile', regionId: 'region_profile' },
      startExtent: { kind: 'profilePlane' },
      endExtent: { kind: 'blind', direction: 'positive', distance: 10 },
      depth: 10,
      direction: 'oneSided',
      operation: 'newBody',
      booleanScope: { kind: 'standalone' },
    },
  },
}

const reorderFeatureRequest: ReorderFeatureRequest = {
  contractVersion: 'modeling-contract/v1alpha1',
  documentId: 'doc_workspace',
  baseRevisionId: 'rev_0003',
  featureId: 'feature_extrude-2',
  beforeFeatureId: 'feature_extrude-1',
}

function testValidatesRepresentativeHistory() {
  const payload: ModelingOperationHistoryPayload = {
    ...createEmptyOperationHistory('doc_workspace'),
    entries: [
      createCommitSketchHistoryEntry(commitSketchRequest),
      createCreateFeatureHistoryEntry(createFeatureRequest),
      createReorderFeatureHistoryEntry(reorderFeatureRequest),
    ],
  }

  const result = validateOperationHistoryPayload(payload)

  assert(result.ok, 'Representative sketch and feature operation history should validate.')
  assert(result.payload.entries[0]?.kind === 'commitSketch', 'Commit sketch entry kind must be preserved.')
  assert(
    !('solverCorrelation' in result.payload.entries[0]!.payload),
    'Persisted sketch entries must omit solver request correlation metadata.',
  )
  assert(
    !('baseRevisionId' in result.payload.entries[1]!.payload),
    'Persisted feature entries must omit replay-derived base revision metadata.',
  )
}

function testRejectsUnsupportedVersion() {
  const result = validateOperationHistoryPayload({
    ...createEmptyOperationHistory('doc_workspace'),
    schemaVersion: 'modeling-operation-history/v0',
  })

  assert(!result.ok, 'Unsupported history schema versions must fail validation.')
  assert(
    !result.ok && result.reasonCode === 'unsupported-schema-version',
    'Unsupported history schema versions must report a stable reason code.',
  )
}

function testRejectsTransportMetadataLeak() {
  const result = validateOperationHistoryPayload({
    ...createEmptyOperationHistory('doc_workspace'),
    entries: [
      {
        kind: 'createFeature',
        payload: {
          baseRevisionId: 'rev_0001',
          definition: createFeatureRequest.definition,
        },
      },
    ],
  })

  assert(!result.ok, 'Operation entries with transport metadata must fail validation.')
  assert(
    !result.ok && result.reasonCode === 'transport-field-leak',
    'Transport metadata leaks must report a stable reason code.',
  )
}

testValidatesRepresentativeHistory()
testRejectsUnsupportedVersion()
testRejectsTransportMetadataLeak()

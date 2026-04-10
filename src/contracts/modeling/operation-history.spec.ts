import {
  createCommitSketchHistoryEntry,
  createCreateFeatureHistoryEntry,
  createEmptyOperationHistory,
  createReorderFeatureHistoryEntry,
  validateOperationHistoryPayload,
  type ModelingOperationHistoryPayload,
} from '@/contracts/modeling/operation-history'
import type { CommitSketchRequest, CreateFeatureRequest, FeatureDefinition, ReorderFeatureRequest } from '@/contracts/modeling/schema'
import { EXTRUDE_FEATURE_SCHEMA_VERSION } from '@/contracts/shared/versioning'
import { SKETCH_SCHEMA_VERSION } from '@/contracts/sketch/schema'
import { sweepAdvancedFeatureExample } from '@/contracts/modeling/advanced-solid'

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
      profiles: [{ kind: 'region', sketchId: 'sketch_profile', regionId: 'region_profile' }],
      startExtent: { kind: 'profilePlane' },
      endExtent: { kind: 'blind', direction: 'positive', distance: 10 },
      operation: 'newBody',
      booleanScope: { kind: 'standalone' },
    },
  },
}

const createExtrudeDefinition = createFeatureRequest.definition as Extract<FeatureDefinition, { kind: 'extrude' }>

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

function testValidatesProfileCollectionFeaturePayloads() {
  const multiProfilePayload: ModelingOperationHistoryPayload = {
    ...createEmptyOperationHistory('doc_workspace'),
    entries: [
      createCreateFeatureHistoryEntry({
        ...createFeatureRequest,
        definition: {
          ...createExtrudeDefinition,
          parameters: {
            ...createExtrudeDefinition.parameters,
            profiles: [
              createExtrudeDefinition.parameters.profiles[0],
              { kind: 'region', sketchId: 'sketch_profile', regionId: 'region_inner' },
            ],
          },
        },
      }),
    ],
  }

  const result = validateOperationHistoryPayload(multiProfilePayload)

  assert(result.ok, 'One-profile and multi-profile extrude history payloads should validate.')
}

function testRejectsLegacyAndInvalidProfileCollections() {
  const legacyPayload = validateOperationHistoryPayload({
    ...createEmptyOperationHistory('doc_workspace'),
    entries: [{
      kind: 'createFeature',
      payload: {
        definition: {
          ...createExtrudeDefinition,
          parameters: {
            ...createExtrudeDefinition.parameters,
            profiles: undefined,
            profile: createExtrudeDefinition.parameters.profiles[0],
          },
        },
      },
    }],
  })
  const emptyPayload = validateOperationHistoryPayload({
    ...createEmptyOperationHistory('doc_workspace'),
    entries: [{
      kind: 'createFeature',
      payload: {
        definition: {
          ...createExtrudeDefinition,
          parameters: {
            ...createExtrudeDefinition.parameters,
            profiles: [],
          },
        },
      },
    }],
  })
  const duplicatePayload = validateOperationHistoryPayload({
    ...createEmptyOperationHistory('doc_workspace'),
    entries: [{
      kind: 'updateFeature',
      payload: {
        featureId: 'feature_extrude-1',
        definition: {
          ...createExtrudeDefinition,
          parameters: {
            ...createExtrudeDefinition.parameters,
            profiles: [
              createExtrudeDefinition.parameters.profiles[0],
              createExtrudeDefinition.parameters.profiles[0],
            ],
          },
        },
      },
    }],
  })

  assert(!legacyPayload.ok && legacyPayload.reasonCode === 'legacy-profile-parameter', 'Legacy singular profile history payloads should be rejected.')
  assert(!emptyPayload.ok && emptyPayload.reasonCode === 'invalid-profile-collection', 'Empty profile collection history payloads should be rejected.')
  assert(!duplicatePayload.ok && duplicatePayload.reasonCode === 'duplicate-profile-reference', 'Duplicate profile collection history payloads should be rejected.')
}

function testPreservesAdvancedParticipantsAndOperationIntent() {
  const sweepSubtractDefinition = {
    ...sweepAdvancedFeatureExample,
    parameters: {
      ...sweepAdvancedFeatureExample.parameters,
      operationIntent: 'subtract' as const,
      participants: [
        ...sweepAdvancedFeatureExample.parameters.participants,
        { role: 'targetBody' as const, targets: [{ kind: 'body' as const, bodyId: 'body_target' as const }] },
      ],
    },
  }
  const payload: ModelingOperationHistoryPayload = {
    ...createEmptyOperationHistory('doc_workspace'),
    entries: [
      createCreateFeatureHistoryEntry({
        ...createFeatureRequest,
        definition: sweepSubtractDefinition,
      }),
      {
        kind: 'updateFeature',
        payload: {
          featureId: 'feature_sweep-1',
          definition: sweepSubtractDefinition,
        },
      },
    ],
  }

  const result = validateOperationHistoryPayload(payload)

  assert(result.ok, 'Advanced solid feature history payloads should validate.')
  assert(
      result.ok &&
      result.payload.entries[0]?.kind === 'createFeature' &&
      result.payload.entries[0].payload.definition.kind === 'sweep' &&
      result.payload.entries[0].payload.definition.parameters.operationIntent === 'subtract' &&
      result.payload.entries[1]?.kind === 'updateFeature' &&
      result.payload.entries[1].payload.definition.kind === 'sweep' &&
      result.payload.entries[1].payload.definition.parameters.participants.some((participant) => participant.role === 'targetBody'),
    'Sweep operation history must preserve participant roles and operation intent across create and update entries.',
  )
}

function testRejectsInvalidAdvancedParticipants() {
  const result = validateOperationHistoryPayload({
    ...createEmptyOperationHistory('doc_workspace'),
    entries: [{
      kind: 'createFeature',
      payload: {
        definition: {
          ...sweepAdvancedFeatureExample,
          parameters: {
            ...sweepAdvancedFeatureExample.parameters,
            participants: [{ role: 'targetBody', targets: 'body_target' }],
          },
        },
      },
    }],
  })

  assert(!result.ok && result.reasonCode === 'invalid-advanced-participant', 'Invalid advanced participants should report a stable reason code.')
}

testValidatesRepresentativeHistory()
testRejectsUnsupportedVersion()
testRejectsTransportMetadataLeak()
testValidatesProfileCollectionFeaturePayloads()
testRejectsLegacyAndInvalidProfileCollections()
testPreservesAdvancedParticipantsAndOperationIntent()
testRejectsInvalidAdvancedParticipants()

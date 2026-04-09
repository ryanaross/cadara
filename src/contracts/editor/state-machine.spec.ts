import {
  getEditorSelectionKey,
  type EditorEffectRuntime,
  initialEditorState,
  replayEditorEvents,
  replayEditorEventsWithRuntime,
  transitionEditorState,
  type EditorEvent,
} from './state-machine'
import type { SelectionTargetCatalog } from '@/domain/editor/schema'
import type { DocumentSnapshot } from '@/contracts/modeling/schema'
import { RENDER_EXPORT_SCHEMA_VERSION } from '@/contracts/shared/versioning'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function createSelectionCatalog(): SelectionTargetCatalog {
  return {
    existingSketchKeys: ['sketch:sketch_a'],
    constructionPlaneKeys: ['construction:construction_plane-xy'],
    planarFaceKeys: ['face:body_a:face_top'],
  }
}

function createRegionSelectionCatalog(): SelectionTargetCatalog {
  return {
    existingSketchKeys: ['sketch:sketch_a', 'region:sketch_a:region_profile_a'],
    constructionPlaneKeys: ['construction:construction_plane-xy'],
    planarFaceKeys: ['face:body_a:face_top'],
  }
}

function createSnapshot(): DocumentSnapshot {
  return {
    contractVersion: 'modeling-contract/v1alpha1',
    schemaVersion: 'document-snapshot/v1alpha1',
    documentId: 'doc_workspace',
    revisionId: 'rev_1',
    settings: {
      linearUnit: 'millimeter',
      modelingTolerance: 0.001,
      angularToleranceRadians: 0.0001,
    },
    capabilities: {
      supportedFeatureKinds: ['extrude'],
      previewableFeatureKinds: ['extrude'],
      supportedProfileKinds: ['region', 'face'],
      supportsFaceBackedSketchPlanes: true,
      supportsDurableTopologyNaming: false,
    },
    featureTree: [],
    objects: [],
    references: [],
    render: {
      schemaVersion: RENDER_EXPORT_SCHEMA_VERSION,
      records: [],
    },
    sketches: [],
    features: [],
    bodies: [],
    constructions: [
      {
        ownerDocumentId: 'doc_workspace',
        ownerRevisionId: 'rev_1',
        ownerFeatureId: null,
        ownerSketchId: null,
        ownerBodyId: null,
        constructionId: 'construction_plane-xy',
        label: 'Top Plane',
        constructionType: 'plane',
        target: { kind: 'construction', constructionId: 'construction_plane-xy' },
      },
    ],
    entities: [
      {
        ownerDocumentId: 'doc_workspace',
        ownerRevisionId: 'rev_1',
        ownerFeatureId: null,
        ownerSketchId: null,
        ownerBodyId: null,
        id: 'snapshot_entity_plane_xy',
        label: 'Top Plane',
        target: { kind: 'construction', constructionId: 'construction_plane-xy' },
        relatedTargets: [],
        consumedByFeatureIds: [],
        selectionSemantics: ['constructionPlane', 'planarReference'],
      },
    ],
    diagnostics: [],
  }
}

function runEventTrace(events: readonly EditorEvent[]) {
  return replayEditorEvents(events)
}

function testSketchActivationEmitsCorrelatedOpenEffect() {
  const result = transitionEditorState(
    {
      ...initialEditorState,
      document: {
        documentId: 'doc_workspace',
        revisionId: 'rev_1',
      },
      snapshot: createSnapshot(),
      selectionCatalog: createSelectionCatalog(),
    },
    {
      type: 'tool.activated',
      toolId: 'sketch',
    },
  )

  assert(result.state.kind === 'selectionCommand', 'Sketch activation should arm a selection command.')
  assert(result.state.command.commandSessionId === 'command_sketch-1', 'Sketch command session ID should be deterministic.')
  assert(result.effects.length === 0, 'Sketch without a selection should not emit an effect yet.')

  const openResult = transitionEditorState(
    {
      ...result.state,
    },
    {
      type: 'viewport.selectionRequested',
      target: { kind: 'construction', constructionId: 'construction_plane-xy' },
    },
  )

  assert(openResult.effects.length === 1, 'Selecting a valid sketch plane should emit one open-session effect.')
  assert(openResult.effects[0]?.type === 'sketch.openSession', 'The emitted effect should be sketch.openSession.')
  assert(
    openResult.effects[0]?.commandSessionId === 'command_sketch-1',
    'The open-session effect must preserve the originating command session ID.',
  )
}

function testFeaturePreviewIgnoresStaleResponseIds() {
  const activation = transitionEditorState(
    {
      ...initialEditorState,
      document: {
        documentId: 'doc_workspace',
        revisionId: 'rev_1',
      },
      selectionCatalog: createRegionSelectionCatalog(),
      selection: [{ kind: 'region', sketchId: 'sketch_a', regionId: 'region_profile_a' }],
    },
    {
      type: 'tool.activated',
      toolId: 'extrude',
    },
  )

  assert(activation.state.kind === 'editingFeature', 'Extrude activation should enter feature editing.')
  assert(activation.effects.length === 1, 'Extrude activation should emit a preview effect.')
  assert(activation.effects[0]?.type === 'feature.evaluatePreview', 'The emitted effect should be feature.evaluatePreview.')

  const staleIgnored = transitionEditorState(activation.state, {
    type: 'effect.featurePreviewCompleted',
    requestId: 'request_feature-preview-stale',
    documentId: 'doc_workspace',
    commandSessionId: 'command_extrude-1',
    baseRevisionId: 'rev_1',
    revisionId: 'rev_1',
    stale: false,
    diagnostics: [],
    renderables: [],
  })

  assert(
    staleIgnored.state === activation.state,
    'A preview response with the wrong request ID must be ignored.',
  )
}

function testReplayIsDeterministic() {
  const snapshot = createSnapshot()
  const payload = {
    requestId: 'request_snapshot-1' as const,
    documentId: snapshot.documentId,
    revisionId: snapshot.revisionId,
    snapshot,
    selectionCatalog: createSelectionCatalog(),
  }

  const events: EditorEvent[] = [
    { type: 'session.started' },
    { type: 'effect.snapshotLoaded', payload },
    { type: 'tool.activated', toolId: 'sketch' },
    {
      type: 'viewport.selectionRequested',
      target: { kind: 'construction', constructionId: 'construction_plane-xy' },
    },
  ]

  const first = runEventTrace(events)
  const second = runEventTrace(events)

  assert(
    JSON.stringify(first.state) === JSON.stringify(second.state),
    'Replaying the same event trace should reach the same machine state.',
  )
  assert(
    JSON.stringify(first.effects) === JSON.stringify(second.effects),
    'Replaying the same event trace should emit the same effect sequence.',
  )
}

function testSelectionKeyUsesDurableRefs() {
  const key = getEditorSelectionKey({ kind: 'feature', featureId: 'feature_alpha' })
  assert(key === 'feature:feature_alpha', 'Selection key derivation should remain deterministic.')
}

async function testRuntimeLoopProcessesSketchOpen() {
  const runtimeSnapshot: DocumentSnapshot = createSnapshot()
  const runtime: EditorEffectRuntime = {
    getCurrentDocumentSnapshot: async () => runtimeSnapshot,
    commitSketch: async (_input) => null,
    evaluatePreview: async () => ({
      revisionId: 'rev_1' as const,
      stale: false,
      diagnostics: [],
      renderables: [],
    }),
    commitFeature: async () => ({
      revisionId: 'rev_1' as const,
      featureId: 'feature_alpha' as const,
      accepted: true,
      diagnostics: [],
    }),
  }

  const result = await replayEditorEventsWithRuntime(
    [
      { type: 'session.started' },
      {
        type: 'effect.snapshotLoaded',
        payload: {
          requestId: 'request_snapshot-1',
          documentId: 'doc_workspace',
          revisionId: 'rev_1',
          snapshot: runtimeSnapshot,
          selectionCatalog: createSelectionCatalog(),
        },
      },
      { type: 'tool.activated', toolId: 'sketch' },
      {
        type: 'viewport.selectionRequested',
        target: { kind: 'construction', constructionId: 'construction_plane-xy' },
      },
    ],
    runtime,
  )

  assert(result.state.kind === 'editingSketch', 'Runtime loop should enter sketch editing after opening a sketch session.')
  assert(
    result.state.session.planeTarget.kind === 'construction',
    'Opened sketch session should preserve the selected construction plane.',
  )
  assert(
    result.state.command.commandSessionId === 'command_sketch-1',
    'Runtime loop should preserve the originating command session ID.',
  )
}

testSketchActivationEmitsCorrelatedOpenEffect()
testFeaturePreviewIgnoresStaleResponseIds()
testReplayIsDeterministic()
testSelectionKeyUsesDurableRefs()
await testRuntimeLoopProcessesSketchOpen()

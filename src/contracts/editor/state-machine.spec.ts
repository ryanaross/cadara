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
import type { SnapshotEntityRecord, SketchSnapshotRecord } from '@/contracts/modeling/schema'
import type {
  ConstructionId,
  DocumentId,
  RevisionId,
  SketchId,
  SnapshotEntityId,
} from '@/contracts/shared/ids'
import {
  CONTRACT_VERSION,
  RENDER_EXPORT_SCHEMA_VERSION,
  SNAPSHOT_SCHEMA_VERSION,
} from '@/contracts/shared/versioning'
import { createSketchSessionFromSnapshot, mapSketchPointToWorld } from '@/domain/editor/sketch-session'
import type { SketchPlaneDefinition } from '@/contracts/shared/sketch-plane'
import { createStandardPlaneDefinition } from '@/domain/modeling/opencascade-kernel-seed'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function createSelectionCatalog(): SelectionTargetCatalog {
  return {
    selectableTargetKeys: [
      'sketch:sketch_a',
      'construction:construction_plane-xy',
      'construction:construction_plane-yz',
      'construction:construction_plane-xz',
      'face:body_a:face_top',
      'body:body_a',
      'edge:body_a:edge_a',
      'edge:body_a:edge_axis',
    ],
    existingSketchKeys: ['sketch:sketch_a'],
    constructionPlaneKeys: [
      'construction:construction_plane-xy',
      'construction:construction_plane-yz',
      'construction:construction_plane-xz',
    ],
    planarFaceKeys: ['face:body_a:face_top'],
  }
}

function createRegionSelectionCatalog(): SelectionTargetCatalog {
  return {
    selectableTargetKeys: [
      'sketch:sketch_a',
      'region:sketch_a:region_profile_a',
      'construction:construction_plane-xy',
      'construction:construction_plane-yz',
      'construction:construction_plane-xz',
      'face:body_a:face_top',
      'body:body_a',
      'edge:body_a:edge_a',
      'edge:body_a:edge_axis',
    ],
    existingSketchKeys: ['sketch:sketch_a', 'region:sketch_a:region_profile_a'],
    constructionPlaneKeys: [
      'construction:construction_plane-xy',
      'construction:construction_plane-yz',
      'construction:construction_plane-xz',
    ],
    planarFaceKeys: ['face:body_a:face_top'],
  }
}

function createSnapshot(): DocumentSnapshot {
  return {
    contractVersion: 'modeling-contract/v1alpha1',
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
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
    cursor: { kind: 'empty' },
    bodies: [],
    constructions: [
      {
        ownerDocumentId: 'doc_workspace',
        ownerRevisionId: 'rev_1',
        ownerFeatureId: null,
        ownerSketchId: null,
        ownerBodyId: null,
        constructionId: 'construction_plane-xy' as ConstructionId,
        label: 'Top Plane',
        constructionType: 'plane',
        plane: createStandardPlaneDefinition('xy'),
        target: { kind: 'construction', constructionId: 'construction_plane-xy' as ConstructionId },
      },
    ],
    entities: [
      {
        ownerDocumentId: 'doc_workspace',
        ownerRevisionId: 'rev_1',
        ownerFeatureId: null,
        ownerSketchId: null,
        ownerBodyId: null,
        id: 'snapshot_entity_plane_xy' as SnapshotEntityId,
        label: 'Top Plane',
        target: { kind: 'construction', constructionId: 'construction_plane-xy' as ConstructionId },
        relatedTargets: [],
        consumedByFeatureIds: [],
        selectionSemantics: ['constructionPlane', 'planarReference'],
      },
    ],
    diagnostics: [],
    document: {
      contractVersion: CONTRACT_VERSION,
      schemaVersion: SNAPSHOT_SCHEMA_VERSION,
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
      features: [],
      cursor: { kind: 'empty' },
      sketches: [],
      bodies: [],
      constructions: [
        {
          ownerDocumentId: 'doc_workspace',
          ownerRevisionId: 'rev_1',
          ownerFeatureId: null,
          ownerSketchId: null,
          ownerBodyId: null,
          constructionId: 'construction_plane-xy' as ConstructionId,
          label: 'Top Plane',
          constructionType: 'plane',
          plane: createStandardPlaneDefinition('xy'),
          target: { kind: 'construction', constructionId: 'construction_plane-xy' as ConstructionId },
        },
      ],
      entities: [
        {
          ownerDocumentId: 'doc_workspace',
          ownerRevisionId: 'rev_1',
          ownerFeatureId: null,
          ownerSketchId: null,
          ownerBodyId: null,
          id: 'snapshot_entity_plane_xy' as SnapshotEntityId,
          label: 'Top Plane',
          target: { kind: 'construction', constructionId: 'construction_plane-xy' as ConstructionId },
          relatedTargets: [],
          consumedByFeatureIds: [],
          selectionSemantics: ['constructionPlane', 'planarReference'],
        },
      ],
      references: [],
      diagnostics: [],
      render: {
        schemaVersion: RENDER_EXPORT_SCHEMA_VERSION,
        records: [],
      },
    },
    presentation: {
      featureTree: [],
      objects: [],
      entities: [
        {
          ownerDocumentId: 'doc_workspace',
          ownerRevisionId: 'rev_1',
          ownerFeatureId: null,
          ownerSketchId: null,
          ownerBodyId: null,
          id: 'snapshot_entity_plane_xy' as SnapshotEntityId,
          label: 'Top Plane',
          target: { kind: 'construction', constructionId: 'construction_plane-xy' as ConstructionId },
          relatedTargets: [],
          consumedByFeatureIds: [],
          selectionSemantics: ['constructionPlane', 'planarReference'],
        },
      ],
    },
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

function testSketchActivationAcceptsAllPrimaryConstructionPlanes() {
  const baseState = {
    ...initialEditorState,
    document: {
      documentId: 'doc_workspace' as DocumentId,
      revisionId: 'rev_1' as RevisionId,
    },
    snapshot: createSnapshot(),
    selectionCatalog: createSelectionCatalog(),
  }

  for (const constructionId of [
    'construction_plane-xy',
    'construction_plane-yz',
    'construction_plane-xz',
  ] as const) {
    const activated = transitionEditorState(baseState, {
      type: 'tool.activated',
      toolId: 'sketch',
    })
    const openResult = transitionEditorState(activated.state, {
      type: 'viewport.selectionRequested',
      target: { kind: 'construction', constructionId },
    })

    assert(
      openResult.effects[0]?.type === 'sketch.openSession',
      `Primary construction plane ${constructionId} should emit sketch.openSession.`,
    )
  }
}

function testSketchSessionPreservesStoredPlaneDefinition() {
  const yzPlane: SketchPlaneDefinition = {
    support: { kind: 'construction', constructionId: 'construction_plane-yz' as ConstructionId },
    frame: {
      origin: [0, 0, 0],
      xAxis: [0, 1, 0],
      yAxis: [0, 0, 1],
      normal: [1, 0, 0],
      linearUnit: 'documentLength',
      handedness: 'rightHanded',
    },
    key: 'yz',
  }

  const session = createSketchSessionFromSnapshot({
    ownerDocumentId: 'doc_workspace',
    ownerRevisionId: 'rev_1',
    ownerFeatureId: null,
    ownerSketchId: 'sketch_yz',
    ownerBodyId: null,
    sketchId: 'sketch_yz',
    label: 'Sketch YZ',
    plane: yzPlane,
    planeTarget: yzPlane.support,
    planeKey: 'yz',
    sketch: {
      ownerDocumentId: 'doc_workspace',
      ownerRevisionId: 'rev_1',
      ownerFeatureId: null,
      ownerSketchId: 'sketch_yz',
      ownerBodyId: null,
      sketchId: 'sketch_yz',
      label: 'Sketch YZ',
      planeSupport: yzPlane.support,
      definition: {
        schemaVersion: 'sketch-definition/v1alpha1',
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
      },
      solvedSnapshot: {
        schemaVersion: 'solved-sketch/v1alpha1',
        status: {
          solveState: 'solved',
          constraintState: 'underConstrained',
        },
        solvedEntities: [],
        solvedPoints: [],
        constraintStatuses: [],
        dimensionStatuses: [],
        diagnostics: [],
      },
      regions: [],
    },
  })

  const worldPoint = mapSketchPointToWorld(session.plane, [2, 3])

  assert(session.plane.frame.normal[0] === 1, 'Sketch sessions should retain the stored plane definition.')
  assert(worldPoint[0] === 0 && worldPoint[1] === 2 && worldPoint[2] === 3, 'Sketch display mapping must use the stored plane definition.')
}

function createReopenableYzSketchSnapshot(): DocumentSnapshot {
  const yzSketchId = 'sketch_yz' as SketchId
  const yzPlane: SketchPlaneDefinition = {
    support: { kind: 'construction', constructionId: 'construction_plane-yz' as ConstructionId },
    frame: {
      origin: [0, 0, 0],
      xAxis: [0, 1, 0],
      yAxis: [0, 0, 1],
      normal: [1, 0, 0],
      linearUnit: 'documentLength',
      handedness: 'rightHanded',
    },
    key: 'yz',
  }

  const yzSketch: SketchSnapshotRecord = {
    ownerDocumentId: 'doc_workspace' as DocumentId,
    ownerRevisionId: 'rev_1' as RevisionId,
    ownerFeatureId: null,
    ownerSketchId: yzSketchId,
    ownerBodyId: null,
    sketchId: yzSketchId,
    label: 'Sketch YZ',
    plane: yzPlane,
    planeTarget: yzPlane.support,
    planeKey: 'yz' as const,
    sketch: {
      ownerDocumentId: 'doc_workspace',
      ownerRevisionId: 'rev_1',
      ownerFeatureId: null,
      ownerSketchId: yzSketchId,
      ownerBodyId: null,
      sketchId: yzSketchId,
      label: 'Sketch YZ',
      planeSupport: yzPlane.support,
      definition: {
          schemaVersion: 'sketch-definition/v1alpha1',
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
      },
      solvedSnapshot: {
        schemaVersion: 'solved-sketch/v1alpha1',
        status: {
          solveState: 'solved',
          constraintState: 'underConstrained',
        },
        solvedEntities: [],
        solvedPoints: [],
        constraintStatuses: [],
        dimensionStatuses: [],
        diagnostics: [],
      },
      regions: [],
    },
  }

  const yzSketchEntity: SnapshotEntityRecord = {
    ownerDocumentId: 'doc_workspace' as DocumentId,
    ownerRevisionId: 'rev_1' as RevisionId,
    ownerFeatureId: null,
    ownerSketchId: yzSketchId,
    ownerBodyId: null,
    id: 'snapshot_entity_sketch_yz' as SnapshotEntityId,
    label: 'Sketch YZ',
    target: { kind: 'sketch' as const, sketchId: yzSketchId },
    relatedTargets: [],
    consumedByFeatureIds: [],
    selectionSemantics: ['existingSketch'] as const,
  }

  const baseSnapshot = createSnapshot()

  return {
    ...baseSnapshot,
    sketches: [
      ...baseSnapshot.sketches,
      yzSketch,
    ],
    document: {
      ...baseSnapshot.document,
      sketches: [
        ...baseSnapshot.document.sketches,
        yzSketch,
      ],
      entities: [
        ...baseSnapshot.document.entities,
        yzSketchEntity,
      ],
    },
    entities: [
      ...baseSnapshot.entities,
      yzSketchEntity,
    ],
    presentation: {
      ...baseSnapshot.presentation,
      entities: [
        ...baseSnapshot.presentation.entities,
        yzSketchEntity,
      ],
    },
  }
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

function testRevolveActivationStartsFeaturePreviewFlow() {
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
      toolId: 'revolve',
    },
  )

  assert(activation.state.kind === 'editingFeature', 'Revolve activation should enter feature editing.')
  assert(activation.state.session.featureType === 'revolve', 'Revolve activation should create a revolve session.')
  assert(activation.effects.length === 0, 'Revolve activation without an axis should stay local until the draft is complete.')

  const completed = transitionEditorState(activation.state, {
    type: 'viewport.selectionRequested',
    target: { kind: 'edge', bodyId: 'body_a', edgeId: 'edge_axis' },
  })

  assert(completed.state.kind === 'editingFeature', 'Revolve selection updates should remain in feature editing.')
  assert(completed.effects.length === 1, 'Selecting the missing revolve axis should emit one preview effect.')
  assert(completed.effects[0]?.type === 'feature.evaluatePreview', 'Completed revolve drafts should request a preview effect.')
}

function testRevolveActivationSupportsFaceThenEdgeSelection() {
  const activation = transitionEditorState(
    {
      ...initialEditorState,
      document: {
        documentId: 'doc_workspace',
        revisionId: 'rev_1',
      },
      selectionCatalog: {
        ...createRegionSelectionCatalog(),
        selectableTargetKeys: [
          ...createRegionSelectionCatalog().selectableTargetKeys,
          'face:body_a:face_side',
          'body:body_b',
        ],
      },
      selection: [{ kind: 'face', bodyId: 'body_a', faceId: 'face_top' }],
    },
    {
      type: 'tool.activated',
      toolId: 'revolve',
    },
  )

  assert(activation.state.kind === 'editingFeature', 'Face-selected revolve activation should enter feature editing.')
  assert(activation.state.session.featureType === 'revolve', 'Face-selected revolve activation should create a revolve session.')
  assert(
    activation.state.session.draft.profileTargets[0]?.kind === 'face',
    'Face-selected revolve activation should keep the selected face as the revolve profile.',
  )
  assert(activation.effects.length === 0, 'Face-selected revolve activation should wait for an axis before previewing.')

  const completed = transitionEditorState(activation.state, {
    type: 'viewport.selectionRequested',
    target: { kind: 'edge', bodyId: 'body_a', edgeId: 'edge_axis' },
  })

  assert(completed.state.kind === 'editingFeature', 'Revolve face-then-edge flow should remain in feature editing.')
  assert(completed.state.session.featureType === 'revolve', 'Revolve face-then-edge flow should preserve the revolve session kind.')
  assert(
    completed.state.session.draft.axisTarget?.kind === 'edge',
    'Revolve face-then-edge flow should preserve the selected edge as the axis target.',
  )
  assert(completed.effects.length === 1, 'Selecting the axis after a face profile should emit one preview effect.')
  assert(completed.effects[0]?.type === 'feature.evaluatePreview', 'Completed face-then-edge revolve drafts should request a preview effect.')
}

function testShellActivationSeedsBodyFromSelectedFace() {
  const activation = transitionEditorState(
    {
      ...initialEditorState,
      document: {
        documentId: 'doc_workspace',
        revisionId: 'rev_1',
      },
      selectionCatalog: createRegionSelectionCatalog(),
      selection: [{ kind: 'face', bodyId: 'body_a', faceId: 'face_top' }],
    },
    {
      type: 'tool.activated',
      toolId: 'shell',
    },
  )

  assert(activation.state.kind === 'editingFeature', 'Shell activation should enter feature editing.')
  assert(activation.state.session.featureType === 'shell', 'Shell activation should create a shell session.')
  assert(activation.state.session.draft.bodyTarget?.bodyId === 'body_a', 'Shell activation should infer the source body from a selected face.')
  assert(activation.effects.length === 1, 'Shell activation with a face target should emit one preview effect.')
  assert(activation.effects[0]?.type === 'feature.evaluatePreview', 'Shell activation should request a preview effect.')
}

function testThickenActivationSeedsFaceTargetsFromSelection() {
  const activation = transitionEditorState(
    {
      ...initialEditorState,
      document: {
        documentId: 'doc_workspace',
        revisionId: 'rev_1',
      },
      selectionCatalog: createRegionSelectionCatalog(),
      selection: [{ kind: 'face', bodyId: 'body_a', faceId: 'face_top' }],
    },
    {
      type: 'tool.activated',
      toolId: 'thicken',
    },
  )

  assert(activation.state.kind === 'editingFeature', 'Thicken activation should enter feature editing.')
  assert(activation.state.session.featureType === 'thicken', 'Thicken activation should create a thicken session.')
  assert(
    activation.state.session.draft.faceTargets[0]?.faceId === 'face_top',
    'Thicken activation should seed the selected face into the draft.',
  )
  assert(activation.effects.length === 1, 'Thicken activation with a face target should emit one preview effect.')
  assert(activation.effects[0]?.type === 'feature.evaluatePreview', 'Thicken activation should request a preview effect.')
}

function testSplitAndDeleteSolidActivationStartFeatureSessions() {
  const splitActivation = transitionEditorState(
    {
      ...initialEditorState,
      document: {
        documentId: 'doc_workspace',
        revisionId: 'rev_1',
      },
      selectionCatalog: createRegionSelectionCatalog(),
      selection: [{ kind: 'body', bodyId: 'body_a' }],
    },
    {
      type: 'tool.activated',
      toolId: 'split',
    },
  )

  assert(splitActivation.state.kind === 'editingFeature', 'Split activation should enter feature editing.')
  assert(splitActivation.state.session.featureType === 'split', 'Split activation should create a split session.')
  assert(
    splitActivation.state.session.draft.targetBodyTarget?.bodyId === 'body_a',
    'Split activation should seed the selected body as the target body.',
  )
  assert(splitActivation.effects.length === 0, 'Split activation should wait for the tool body before previewing.')

  const deleteSolidActivation = transitionEditorState(
    {
      ...initialEditorState,
      document: {
        documentId: 'doc_workspace',
        revisionId: 'rev_1',
      },
      selectionCatalog: createRegionSelectionCatalog(),
      selection: [{ kind: 'body', bodyId: 'body_a' }],
    },
    {
      type: 'tool.activated',
      toolId: 'deleteSolid',
    },
  )

  assert(deleteSolidActivation.state.kind === 'editingFeature', 'Delete-solid activation should enter feature editing.')
  assert(deleteSolidActivation.state.session.featureType === 'deleteSolid', 'Delete-solid activation should create a delete-solid session.')
  assert(
    deleteSolidActivation.state.session.draft.bodyTargets[0]?.bodyId === 'body_a',
    'Delete-solid activation should seed the selected body into the delete list.',
  )
  assert(deleteSolidActivation.effects.length === 1, 'Delete-solid activation with a selected body should emit one preview effect.')
  assert(deleteSolidActivation.effects[0]?.type === 'feature.evaluatePreview', 'Delete-solid activation should request a preview effect.')
}

function testActiveReferencePickerRoutesSingleAndMultiSelections() {
  const catalog = createRegionSelectionCatalog()
  const activation = transitionEditorState(
    {
      ...initialEditorState,
      document: {
        documentId: 'doc_workspace',
        revisionId: 'rev_1',
      },
      selectionCatalog: {
        ...catalog,
        selectableTargetKeys: [
          ...catalog.selectableTargetKeys,
          'face:body_a:face_side',
          'body:body_b',
        ],
      },
      selection: [{ kind: 'face', bodyId: 'body_a', faceId: 'face_top' }],
    },
    {
      type: 'tool.activated',
      toolId: 'shell',
    },
  )

  assert(activation.state.kind === 'editingFeature', 'Shell activation should enter feature editing.')

  const facesActive = transitionEditorState(activation.state, {
    type: 'form.referencePickerActivated',
    fieldId: 'shell-faces',
  })

  assert(facesActive.state.kind === 'editingFeature', 'Reference picker activation should stay in feature editing.')
  assert(
    facesActive.state.activeReferencePickerFieldId === 'shell-faces',
    'Reference picker activation should track the active form field id.',
  )
  assert(
    facesActive.state.selectionFilter?.label === 'Shell faces',
    'Reference picker activation should switch to the field selection filter.',
  )

  const faceAppended = transitionEditorState(facesActive.state, {
    type: 'viewport.selectionRequested',
    target: { kind: 'face', bodyId: 'body_a', faceId: 'face_side' },
  })

  assert(faceAppended.state.kind === 'editingFeature', 'Multi-reference selection should stay in feature editing.')
  assert(
    faceAppended.state.session.featureType === 'shell' && faceAppended.state.session.draft.faceTargets.length === 2,
    'Active multi-reference picker selection should append unique selected instances.',
  )

  const bodyActive = transitionEditorState(faceAppended.state, {
    type: 'form.referencePickerActivated',
    fieldId: 'shell-body',
  })

  assert(bodyActive.state.kind === 'editingFeature', 'Switching active picker fields should stay in feature editing.')
  assert(
    bodyActive.state.activeReferencePickerFieldId === 'shell-body',
    'Switching active picker fields should update the active field id.',
  )
  assert(
    bodyActive.state.selectionFilter?.label === 'Shell body',
    'Switching active picker fields should update the current selection filter.',
  )

  const bodySelected = transitionEditorState(bodyActive.state, {
    type: 'viewport.selectionRequested',
    target: { kind: 'body', bodyId: 'body_b' },
  })

  assert(bodySelected.state.kind === 'editingFeature', 'Single-reference selection should stay in feature editing.')
  assert(
    bodySelected.state.session.featureType === 'shell' && bodySelected.state.session.draft.bodyTarget?.bodyId === 'body_b',
    'Active single-reference picker selection should replace the bound reference.',
  )
}

function testReferencePickerCancellationAndSessionCleanup() {
  const activation = transitionEditorState(
    {
      ...initialEditorState,
      document: {
        documentId: 'doc_workspace',
        revisionId: 'rev_1',
      },
      selectionCatalog: createRegionSelectionCatalog(),
      selection: [{ kind: 'face', bodyId: 'body_a', faceId: 'face_top' }],
    },
    {
      type: 'tool.activated',
      toolId: 'shell',
    },
  )

  assert(activation.state.kind === 'editingFeature', 'Shell activation should enter feature editing.')

  const active = transitionEditorState(activation.state, {
    type: 'form.referencePickerActivated',
    fieldId: 'shell-faces',
  })

  assert(active.state.kind === 'editingFeature', 'Reference picker activation should stay in feature editing.')

  const escaped = transitionEditorState(active.state, {
    type: 'form.referencePickerCancelled',
  })

  assert(escaped.state.kind === 'editingFeature', 'Escape cancellation should not cancel the whole feature session.')
  assert(escaped.state.activeReferencePickerFieldId === null, 'Escape cancellation should clear the active picker field.')
  assert(escaped.state.selection.length === 0, 'Escape cancellation should clear picker-specific pending selection.')
  assert(
    escaped.state.selectionFilter?.label === 'Shell references',
    'Escape cancellation should restore the feature-level selection filter.',
  )

  const cancelled = transitionEditorState(active.state, {
    type: 'command.cancelled',
    commandSessionId: active.state.command.commandSessionId,
  })

  assert(cancelled.state.kind === 'idle', 'Feature session cancellation should leave feature editing.')

  const switched = transitionEditorState(active.state, {
    type: 'tool.activated',
    toolId: 'fillet',
  })

  assert(switched.state.kind === 'editingFeature', 'Switching to another feature tool should enter the new feature session.')
  assert(
    switched.state.activeReferencePickerFieldId === null,
    'Switching to another feature session should clear active picker state.',
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
    commitSketch: async () => null,
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

async function testRuntimeLoopOpensSketchFromNonXYConstruction() {
  const runtimeSnapshot: DocumentSnapshot = {
    ...createSnapshot(),
    constructions: [
      {
        ownerDocumentId: 'doc_workspace',
        ownerRevisionId: 'rev_1',
        ownerFeatureId: null,
        ownerSketchId: null,
        ownerBodyId: null,
        constructionId: 'construction_plane-yz' as ConstructionId,
        label: 'Right Plane',
        constructionType: 'plane',
        plane: createStandardPlaneDefinition('yz'),
        target: { kind: 'construction', constructionId: 'construction_plane-yz' as ConstructionId },
      },
    ],
    document: {
      ...createSnapshot().document,
      constructions: [
        {
          ownerDocumentId: 'doc_workspace',
          ownerRevisionId: 'rev_1',
          ownerFeatureId: null,
          ownerSketchId: null,
          ownerBodyId: null,
          constructionId: 'construction_plane-yz' as ConstructionId,
          label: 'Right Plane',
          constructionType: 'plane',
          plane: createStandardPlaneDefinition('yz'),
          target: { kind: 'construction', constructionId: 'construction_plane-yz' as ConstructionId },
        },
      ],
      entities: [
        {
          ownerDocumentId: 'doc_workspace',
          ownerRevisionId: 'rev_1',
          ownerFeatureId: null,
          ownerSketchId: null,
          ownerBodyId: null,
          id: 'snapshot_entity_plane_yz' as SnapshotEntityId,
          label: 'Right Plane',
          target: { kind: 'construction', constructionId: 'construction_plane-yz' as ConstructionId },
          relatedTargets: [],
          consumedByFeatureIds: [],
          selectionSemantics: ['constructionPlane', 'planarReference'],
        },
      ],
    },
    entities: [
      {
        ownerDocumentId: 'doc_workspace',
        ownerRevisionId: 'rev_1',
        ownerFeatureId: null,
        ownerSketchId: null,
        ownerBodyId: null,
        id: 'snapshot_entity_plane_yz' as SnapshotEntityId,
        label: 'Right Plane',
        target: { kind: 'construction', constructionId: 'construction_plane-yz' as ConstructionId },
        relatedTargets: [],
        consumedByFeatureIds: [],
        selectionSemantics: ['constructionPlane', 'planarReference'],
      },
    ],
    presentation: {
      ...createSnapshot().presentation,
      entities: [
        {
          ownerDocumentId: 'doc_workspace',
          ownerRevisionId: 'rev_1',
          ownerFeatureId: null,
          ownerSketchId: null,
          ownerBodyId: null,
          id: 'snapshot_entity_plane_yz' as SnapshotEntityId,
          label: 'Right Plane',
          target: { kind: 'construction', constructionId: 'construction_plane-yz' as ConstructionId },
          relatedTargets: [],
          consumedByFeatureIds: [],
          selectionSemantics: ['constructionPlane', 'planarReference'],
        },
      ],
    },
  }
  const runtime: EditorEffectRuntime = {
    getCurrentDocumentSnapshot: async () => runtimeSnapshot,
    commitSketch: async () => null,
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
        target: { kind: 'construction', constructionId: 'construction_plane-yz' },
      },
    ],
    runtime,
  )

  assert(result.state.kind === 'editingSketch', 'YZ construction plane should also open a sketch session.')
  assert(result.state.session.plane.key === 'yz', 'Sketch session should preserve the selected YZ plane definition.')
}

async function testRuntimeLoopReopensStoredSketchPlane() {
  const runtimeSnapshot = createReopenableYzSketchSnapshot()
  const runtime: EditorEffectRuntime = {
    getCurrentDocumentSnapshot: async () => runtimeSnapshot,
    commitSketch: async () => null,
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
          selectionCatalog: {
            ...createSelectionCatalog(),
            selectableTargetKeys: [...createSelectionCatalog().selectableTargetKeys, 'sketch:sketch_yz'],
            existingSketchKeys: ['sketch:sketch_a', 'sketch:sketch_yz'],
          },
        },
      },
      { type: 'tool.activated', toolId: 'sketch' },
      {
        type: 'viewport.selectionRequested',
        target: { kind: 'sketch', sketchId: 'sketch_yz' },
      },
    ],
    runtime,
  )

  assert(result.state.kind === 'editingSketch', 'Existing sketches should reopen into the sketch editor.')
  assert(result.state.session.sketchId === 'sketch_yz', 'Reopened sketch sessions should preserve the sketch identity.')
  assert(result.state.session.plane.key === 'yz', 'Reopened sketch sessions should preserve the stored sketch plane.')
}

testSketchActivationEmitsCorrelatedOpenEffect()
testSketchActivationAcceptsAllPrimaryConstructionPlanes()
testSketchSessionPreservesStoredPlaneDefinition()
testFeaturePreviewIgnoresStaleResponseIds()
testRevolveActivationStartsFeaturePreviewFlow()
testRevolveActivationSupportsFaceThenEdgeSelection()
testShellActivationSeedsBodyFromSelectedFace()
testThickenActivationSeedsFaceTargetsFromSelection()
testSplitAndDeleteSolidActivationStartFeatureSessions()
testActiveReferencePickerRoutesSingleAndMultiSelections()
testReferencePickerCancellationAndSessionCleanup()
testReplayIsDeterministic()
testSelectionKeyUsesDurableRefs()
await testRuntimeLoopProcessesSketchOpen()
await testRuntimeLoopOpensSketchFromNonXYConstruction()
await testRuntimeLoopReopensStoredSketchPlane()

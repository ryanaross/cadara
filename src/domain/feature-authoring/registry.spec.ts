import {
  applySelectionToFeatureEditSession,
  buildFeatureDefinition,
  createFeatureEditSession,
  getFeatureEditorFormSchema,
  patchFeatureEditSession,
} from '@/domain/editor/feature-editing'
import {
  createFeatureEditorClearReferencePatch,
  createFeatureEditorFieldPatch,
  createFeatureEditorReferenceSelectionPatch,
  createFeatureEditorRemoveReferenceItemPatch,
} from '@/domain/feature-authoring/form-events'
import { getRegisteredFeatureAuthoringDefinitions } from '@/domain/feature-authoring/registry'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function testRegistryContainsCurrentFeatureSet() {
  const registeredKinds = getRegisteredFeatureAuthoringDefinitions()
    .map((definition) => definition.metadata.kind)
    .sort()

  assert(
    JSON.stringify(registeredKinds) === JSON.stringify(['extrude', 'fillet', 'plane', 'revolve', 'shell']),
    'The feature authoring registry should contain every current durable feature kind.',
  )
}

function testRevolveDraftSelectionAndDefinitionBuilder() {
  const initialSession = createFeatureEditSession({
    featureType: 'revolve',
    selectedTarget: { kind: 'region', sketchId: 'sketch_a', regionId: 'region_a' },
  })

  assert(initialSession.featureType === 'revolve', 'Revolve activation should create a revolve authoring session.')
  assert(buildFeatureDefinition(initialSession) === null, 'Revolve drafts without an axis should not build a modeling definition.')

  const completedSession = applySelectionToFeatureEditSession(initialSession, {
    kind: 'edge',
    bodyId: 'body_a',
    edgeId: 'edge_axis',
  })
  const definition = buildFeatureDefinition(completedSession)

  assert(definition?.kind === 'revolve', 'Completed revolve drafts should build a revolve modeling definition.')
  assert(definition.parameters.axis.kind === 'edge', 'The selected edge should become the revolve axis.')
}

function testShellOwnsFaceSelectionDefaultsAndFormSchema() {
  const session = createFeatureEditSession({
    featureType: 'shell',
    selectedTarget: { kind: 'face', bodyId: 'body_a', faceId: 'face_top' },
  })

  assert(session.featureType === 'shell', 'Shell activation should create a shell authoring session.')
  assert(session.draft.bodyTarget?.bodyId === 'body_a', 'Shell should infer the source body from the selected removable face.')
  assert(session.draft.faceTargets.length === 1, 'Shell should seed removable faces from the selected face.')

  const schema = getFeatureEditorFormSchema(session)
  const fieldIds = schema.sections.flatMap((section) => section.fields.map((field) => field.id))

  assert(fieldIds.includes('shell-thickness'), 'Shell form schema should describe its thickness numeric field.')
  assert(fieldIds.includes('shell-operation'), 'Shell form schema should describe its operation choice field.')
  assert(fieldIds.includes('shell-faces'), 'Shell form schema should describe its removable-face collection.')
}

function testGenericFormEventsPatchRevolveAndShellDrafts() {
  const revolveSession = createFeatureEditSession({
    featureType: 'revolve',
    selectedTarget: null,
  })
  const revolveAngleField = getFeatureEditorFormSchema(revolveSession)
    .sections.flatMap((section) => section.fields)
    .find((field) => field.id === 'revolve-angle')

  assert(revolveAngleField?.kind === 'numeric', 'Revolve schema should expose the angle as a generic numeric field.')

  const patchedRevolve = patchFeatureEditSession(
    revolveSession,
    createFeatureEditorFieldPatch(revolveAngleField, 180),
  )

  assert(
    patchedRevolve.featureType === 'revolve' && Math.abs(patchedRevolve.draft.angle - Math.PI) < 0.000001,
    'Generic numeric form events should convert revolve angle degrees to draft radians.',
  )

  const shellSession = createFeatureEditSession({
    featureType: 'shell',
    selectedTarget: { kind: 'face', bodyId: 'body_a', faceId: 'face_top' },
  })
  const shellOperationField = getFeatureEditorFormSchema(shellSession)
    .sections.flatMap((section) => section.fields)
    .find((field) => field.id === 'shell-operation')

  assert(shellOperationField?.kind === 'enum', 'Shell schema should expose operation as a generic enum field.')

  const patchedShell = patchFeatureEditSession(
    shellSession,
    createFeatureEditorFieldPatch(shellOperationField, 'cut'),
  )

  assert(
    patchedShell.featureType === 'shell' && patchedShell.draft.operation === 'cut',
    'Generic enum form events should patch shell operation without feature-specific inspector logic.',
  )
}

function testGenericReferenceFormEventsPatchSingleAndMultiReferences() {
  const revolveSession = createFeatureEditSession({
    featureType: 'revolve',
    selectedTarget: null,
  })
  const revolveAxisField = getFeatureEditorFormSchema(revolveSession)
    .sections.flatMap((section) => section.fields)
    .find((field) => field.id === 'revolve-axis')

  assert(revolveAxisField?.kind === 'referencePicker', 'Revolve schema should expose an axis reference picker.')

  const axisTarget = { kind: 'edge' as const, bodyId: 'body_a' as const, edgeId: 'edge_axis' as const }
  const selectedRevolve = patchFeatureEditSession(
    revolveSession,
    createFeatureEditorReferenceSelectionPatch(revolveAxisField, axisTarget),
  )
  const clearedRevolve = patchFeatureEditSession(
    selectedRevolve,
    createFeatureEditorClearReferencePatch(revolveAxisField),
  )

  assert(
    selectedRevolve.featureType === 'revolve' &&
      selectedRevolve.draft.axisTarget?.kind === 'edge' &&
      selectedRevolve.draft.axisTarget.edgeId === 'edge_axis',
    'Generic single-reference selection events should patch the selected field.',
  )
  assert(
    clearedRevolve.featureType === 'revolve' && clearedRevolve.draft.axisTarget === null,
    'Generic single-reference clear events should set the bound reference to null.',
  )

  const shellSession = createFeatureEditSession({
    featureType: 'shell',
    selectedTarget: { kind: 'face', bodyId: 'body_a', faceId: 'face_top' },
  })
  const shellFacesField = getFeatureEditorFormSchema(shellSession)
    .sections.flatMap((section) => section.fields)
    .find((field) => field.id === 'shell-faces')

  assert(shellFacesField?.kind === 'referenceCollection', 'Shell schema should expose removable faces as a reference collection.')

  const sideFace = { kind: 'face' as const, bodyId: 'body_a' as const, faceId: 'face_side' as const }
  const appendedShell = patchFeatureEditSession(
    shellSession,
    createFeatureEditorReferenceSelectionPatch(shellFacesField, sideFace),
  )
  const duplicateShell = patchFeatureEditSession(
    appendedShell,
    createFeatureEditorReferenceSelectionPatch(
      getFeatureEditorFormSchema(appendedShell).sections.flatMap((section) => section.fields).find((field) => field.id === 'shell-faces') as typeof shellFacesField,
      sideFace,
    ),
  )
  const removedShell = patchFeatureEditSession(
    duplicateShell,
    createFeatureEditorRemoveReferenceItemPatch(
      getFeatureEditorFormSchema(duplicateShell).sections.flatMap((section) => section.fields).find((field) => field.id === 'shell-faces') as typeof shellFacesField,
      sideFace,
    ),
  )
  const clearedShell = patchFeatureEditSession(
    removedShell,
    createFeatureEditorClearReferencePatch(
      getFeatureEditorFormSchema(removedShell).sections.flatMap((section) => section.fields).find((field) => field.id === 'shell-faces') as typeof shellFacesField,
    ),
  )

  assert(
    appendedShell.featureType === 'shell' && appendedShell.draft.faceTargets.length === 2,
    'Generic multi-reference selection events should append unique selected instances.',
  )
  assert(
    duplicateShell.featureType === 'shell' && duplicateShell.draft.faceTargets.length === 2,
    'Generic multi-reference selection events should ignore duplicate selected instances.',
  )
  assert(
    removedShell.featureType === 'shell' && removedShell.draft.faceTargets.length === 1 && removedShell.draft.faceTargets[0]?.faceId === 'face_top',
    'Generic multi-reference remove events should remove only the requested selected instance.',
  )
  assert(
    clearedShell.featureType === 'shell' && clearedShell.draft.faceTargets.length === 0,
    'Generic multi-reference clear events should remove all selected instances.',
  )
}

testRegistryContainsCurrentFeatureSet()
testRevolveDraftSelectionAndDefinitionBuilder()
testShellOwnsFaceSelectionDefaultsAndFormSchema()
testGenericFormEventsPatchRevolveAndShellDrafts()
testGenericReferenceFormEventsPatchSingleAndMultiReferences()

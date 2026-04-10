import {
  applySelectionToFeatureEditSession,
  buildFeatureDefinition,
  createFeatureEditSession,
  getFeatureEditorFormSchema,
  patchFeatureEditSession,
} from '@/domain/editor/feature-editing'
import { createFeatureEditorFieldPatch } from '@/domain/feature-authoring/form-events'
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

testRegistryContainsCurrentFeatureSet()
testRevolveDraftSelectionAndDefinitionBuilder()
testShellOwnsFaceSelectionDefaultsAndFormSchema()
testGenericFormEventsPatchRevolveAndShellDrafts()

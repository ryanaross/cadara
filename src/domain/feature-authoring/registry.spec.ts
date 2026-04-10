// @ts-expect-error vite-node executes this spec under Node even though app tsconfig excludes Node globals.
import { readFileSync } from 'node:fs'

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
import type { FeatureAuthoringDefinition } from '@/domain/feature-authoring/definition'

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
    JSON.stringify(registeredKinds) === JSON.stringify(['extrude', 'fillet', 'plane', 'revolve', 'shell', 'sweep']),
    'The feature authoring registry should contain every current authored feature kind.',
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

function testSweepDraftSelectionAndDefinitionBuilder() {
  const profile = { kind: 'region' as const, sketchId: 'sketch_a' as const, regionId: 'region_a' as const }
  const path = { kind: 'edge' as const, bodyId: 'body_a' as const, edgeId: 'edge_path' as const }
  const targetBody = { kind: 'body' as const, bodyId: 'body_a' as const }
  const initialSession = createFeatureEditSession({
    featureType: 'sweep',
    selectedTarget: profile,
  })

  assert(initialSession.featureType === 'sweep', 'Sweep activation should create a sweep authoring session.')
  assert(buildFeatureDefinition(initialSession) === null, 'Sweep drafts without a path should not build a modeling definition.')

  const completedSession = applySelectionToFeatureEditSession(initialSession, path)
  const definition = buildFeatureDefinition(completedSession)

  assert(definition?.kind === 'sweep', 'Completed sweep drafts should build a sweep modeling definition.')
  assert(
    definition.parameters.participants.some((participant) => participant.role === 'profile' && participant.targets[0] === profile),
    'Sweep definitions should preserve the selected profile participant role.',
  )
  assert(
    definition.parameters.participants.some((participant) => participant.role === 'path' && participant.targets[0] === path),
    'Sweep definitions should preserve the selected path participant role.',
  )

  const schema = getFeatureEditorFormSchema(completedSession)
  const operationField = schema.sections.flatMap((section) => section.fields).find((field) => field.id === 'sweep-operation-intent')
  assert(operationField?.kind === 'enum', 'Sweep form schema should expose operation intent as a generic enum field.')

  const subtractSession = patchFeatureEditSession(
    completedSession,
    createFeatureEditorFieldPatch(operationField, 'subtract'),
  )
  assert(buildFeatureDefinition(subtractSession) === null, 'Boolean sweep drafts should require explicit target bodies.')

  const targetBodiesField = getFeatureEditorFormSchema(subtractSession)
    .sections.flatMap((section) => section.fields)
    .find((field) => field.id === 'sweep-target-bodies')
  assert(targetBodiesField?.kind === 'referenceCollection', 'Sweep form schema should expose target bodies as a reference collection.')

  const booleanSession = patchFeatureEditSession(
    subtractSession,
    createFeatureEditorReferenceSelectionPatch(targetBodiesField, targetBody),
  )
  const booleanDefinition = buildFeatureDefinition(booleanSession)

  assert(
    booleanSession.featureType === 'sweep' &&
      booleanDefinition?.kind === 'sweep' &&
      booleanDefinition.parameters.operationIntent === 'subtract' &&
      booleanDefinition.parameters.participants.some((participant) => participant.role === 'targetBody'),
    'Sweep boolean authoring should build operation intent and explicit targetBody participants.',
  )
}

function testProfileBasedAuthoringUsesReferenceCollections() {
  const profileA = { kind: 'region' as const, sketchId: 'sketch_a' as const, regionId: 'region_a' as const }
  const profileB = { kind: 'region' as const, sketchId: 'sketch_a' as const, regionId: 'region_b' as const }
  const extrudeSession = createFeatureEditSession({
    featureType: 'extrude',
    selectedTarget: profileA,
  })
  const extrudeProfileField = getFeatureEditorFormSchema(extrudeSession)
    .sections.flatMap((section) => section.fields)
    .find((field) => field.id === 'extrude-profile')

  assert(extrudeProfileField?.kind === 'referenceCollection', 'Extrude schema should expose profiles as a reference collection.')
  assert(extrudeProfileField.picker.allowsMultiple, 'Extrude profile picker should allow multiple profile references.')

  const extrudeMulti = patchFeatureEditSession(
    extrudeSession,
    createFeatureEditorReferenceSelectionPatch(extrudeProfileField, profileB),
  )
  const extrudeDefinition = buildFeatureDefinition(extrudeMulti)

  assert(
    extrudeMulti.featureType === 'extrude' && extrudeDefinition?.kind === 'extrude' && extrudeDefinition.parameters.profiles.length === 2,
    'Extrude authoring should build multi-profile contract payloads from collection fields.',
  )

  const revolveSession = createFeatureEditSession({
    featureType: 'revolve',
    selectedTarget: profileA,
  })
  const revolveProfileField = getFeatureEditorFormSchema(revolveSession)
    .sections.flatMap((section) => section.fields)
    .find((field) => field.id === 'revolve-profile')

  assert(revolveProfileField?.kind === 'referenceCollection', 'Revolve schema should expose profiles as a reference collection.')
  assert(revolveProfileField.picker.allowsMultiple, 'Revolve profile picker should allow multiple profile references.')

  const revolveMulti = patchFeatureEditSession(
    revolveSession,
    createFeatureEditorReferenceSelectionPatch(revolveProfileField, profileB),
  )
  const revolveComplete = applySelectionToFeatureEditSession(revolveMulti, {
    kind: 'edge',
    bodyId: 'body_a',
    edgeId: 'edge_axis',
  })
  const revolveDefinition = buildFeatureDefinition(revolveComplete)

  assert(
    revolveComplete.featureType === 'revolve' && revolveDefinition?.kind === 'revolve' && revolveDefinition.parameters.profiles.length === 2,
    'Revolve authoring should build multi-profile contract payloads while keeping the axis separate.',
  )
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

function testAdvancedParticipantDescriptorsAreMachineReadable() {
  const definitions: readonly FeatureAuthoringDefinition[] = getRegisteredFeatureAuthoringDefinitions()
  const extrude = definitions.find((definition) => definition.metadata.kind === 'extrude')
  const fillet = definitions.find((definition) => definition.metadata.kind === 'fillet')
  const shell = definitions.find((definition) => definition.metadata.kind === 'shell')
  const sweep = definitions.find((definition) => definition.metadata.kind === 'sweep')

  assert(extrude?.advancedParticipants?.some((participant) => participant.role === 'profile'), 'Extrude should declare profile participants for profile/path substrate coverage.')
  assert(fillet?.advancedParticipants?.some((participant) => participant.role === 'edge'), 'Fillet should declare edge participants for topology modifier substrate coverage.')
  assert(shell?.advancedParticipants?.some((participant) => participant.role === 'body'), 'Shell should declare body participants for body-operation substrate coverage.')
  assert(sweep?.advancedParticipants?.some((participant) => participant.role === 'path'), 'Sweep should declare path participants for profile/path substrate coverage.')

  const shellSession = createFeatureEditSession({
    featureType: 'shell',
    selectedTarget: { kind: 'face', bodyId: 'body_a', faceId: 'face_top' },
  })
  const shellFacesField = getFeatureEditorFormSchema(shellSession)
    .sections.flatMap((section) => section.fields)
    .find((field) => field.id === 'shell-faces')

  assert(shellFacesField?.kind === 'referenceCollection', 'Shell form should expose removable faces as a reference collection.')
  assert(shellFacesField.advancedParticipant?.role === 'face', 'Shell form should expose the face participant role on the generic field.')

  const patch = createFeatureEditorReferenceSelectionPatch(shellFacesField, {
    kind: 'face',
    bodyId: 'body_a',
    faceId: 'face_side',
  })
  assert(patch.participantRole === 'face', 'Generic reference selection patches should preserve the participant role.')
}

function testAdvancedAuthoringAndInspectorDoNotImportKernelModules() {
  const files = [
    'src/domain/feature-authoring/definition.ts',
    'src/domain/feature-authoring/form-schema.ts',
    'src/domain/feature-authoring/form-events.ts',
    'src/domain/feature-authoring/features/sweep.ts',
    'src/components/layout/feature-inspector.tsx',
  ]

  for (const file of files) {
    const source = readFileSync(file, 'utf8')
    assert(!source.includes('/occ/') && !source.includes('opencascade'), `${file} should not import kernel-specific modules.`)
  }
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
testSweepDraftSelectionAndDefinitionBuilder()
testProfileBasedAuthoringUsesReferenceCollections()
testShellOwnsFaceSelectionDefaultsAndFormSchema()
testAdvancedParticipantDescriptorsAreMachineReadable()
testAdvancedAuthoringAndInspectorDoNotImportKernelModules()
testGenericFormEventsPatchRevolveAndShellDrafts()
testGenericReferenceFormEventsPatchSingleAndMultiReferences()

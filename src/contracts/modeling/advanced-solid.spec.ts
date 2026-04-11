import {
  ADVANCED_SOLID_FEATURE_SCHEMA_VERSION,
  validateAdvancedSolidFeatureDefinition,
  type AdvancedSolidFeatureAuthoringDescriptor,
} from '@/contracts/modeling/advanced-solid'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

const sweepDescriptor = {
  featureKind: 'sweep',
  participants: [
    {
      role: 'profile',
      label: 'Profile',
      required: true,
      cardinality: { min: 1, max: 1 },
      acceptedKinds: ['region', 'face'],
    },
    {
      role: 'path',
      label: 'Path',
      required: true,
      cardinality: { min: 1, max: 1 },
      acceptedKinds: ['edge', 'sketchEntity'],
    },
    {
      role: 'targetBody',
      label: 'Target body',
      required: false,
      cardinality: { min: 0, max: null },
      acceptedKinds: ['body'],
    },
    {
      role: 'guideCurve',
      label: 'Guide curve',
      required: false,
      cardinality: { min: 0, max: null },
      acceptedKinds: ['edge', 'sketchEntity'],
    },
  ],
  operationIntent: {
    supportedIntents: ['create', 'add', 'subtract'],
    requiredParticipantsByIntent: {
      add: ['targetBody'],
      subtract: ['targetBody'],
    },
  },
} satisfies AdvancedSolidFeatureAuthoringDescriptor

const loftDescriptor = {
  featureKind: 'loft',
  participants: [
    {
      role: 'profile',
      label: 'Profile',
      required: true,
      cardinality: { min: 2, max: null },
      acceptedKinds: ['region', 'face'],
    },
    {
      role: 'guideCurve',
      label: 'Guide curve',
      required: false,
      cardinality: { min: 0, max: null },
      acceptedKinds: ['edge', 'sketchEntity'],
    },
    {
      role: 'targetBody',
      label: 'Target body',
      required: false,
      cardinality: { min: 0, max: null },
      acceptedKinds: ['body'],
    },
  ],
  operationIntent: {
    supportedIntents: ['create', 'add', 'subtract', 'intersect'],
    requiredParticipantsByIntent: {
      add: ['targetBody'],
      subtract: ['targetBody'],
      intersect: ['targetBody'],
    },
  },
} satisfies AdvancedSolidFeatureAuthoringDescriptor

const chamferDescriptor = {
  featureKind: 'chamfer',
  participants: [
    {
      role: 'edge',
      label: 'Edge targets',
      required: true,
      cardinality: { min: 1, max: null },
      acceptedKinds: ['edge'],
    },
  ],
  options: [
    {
      key: 'distance',
      label: 'Distance',
      required: true,
      valueKind: 'positiveNumber',
    },
  ],
} satisfies AdvancedSolidFeatureAuthoringDescriptor

const thickenDescriptor = {
  featureKind: 'thicken',
  participants: [
    {
      role: 'face',
      label: 'Face targets',
      required: true,
      cardinality: { min: 1, max: null },
      acceptedKinds: ['face'],
    },
    {
      role: 'targetBody',
      label: 'Boolean target body',
      required: false,
      cardinality: { min: 0, max: null },
      acceptedKinds: ['body'],
    },
  ],
  operationIntent: {
    supportedIntents: ['create', 'add', 'subtract', 'intersect'],
    requiredParticipantsByIntent: {
      add: ['targetBody'],
      subtract: ['targetBody'],
      intersect: ['targetBody'],
    },
  },
  options: [
    {
      key: 'thickness',
      label: 'Thickness',
      required: true,
      valueKind: 'positiveNumber',
    },
  ],
} satisfies AdvancedSolidFeatureAuthoringDescriptor

function testAdvancedParticipantValidationAcceptsRoleSpecificPayloads() {
  const diagnostics = validateAdvancedSolidFeatureDefinition({
    kind: 'sweep',
    featureTypeVersion: ADVANCED_SOLID_FEATURE_SCHEMA_VERSION,
    parameters: {
      operationIntent: 'create',
      participants: [
        { role: 'profile', targets: [{ kind: 'region', sketchId: 'sketch_a', regionId: 'region_a' }] },
        { role: 'path', targets: [{ kind: 'edge', bodyId: 'body_a', edgeId: 'edge_path' }] },
      ],
    },
  }, sweepDescriptor)

  assert(diagnostics.length === 0, 'Contract-valid advanced participant payloads should validate.')
}

function testAdvancedParticipantValidationRejectsMissingAndWrongKinds() {
  const diagnostics = validateAdvancedSolidFeatureDefinition({
    kind: 'sweep',
    featureTypeVersion: ADVANCED_SOLID_FEATURE_SCHEMA_VERSION,
    parameters: {
      operationIntent: 'create',
      participants: [
        { role: 'profile', targets: [] },
        { role: 'path', targets: [{ kind: 'body', bodyId: 'body_wrong' }] },
      ],
    },
  }, sweepDescriptor)

  assert(
    diagnostics.some((diagnostic) => diagnostic.code === 'advanced-feature-missing-participant' && diagnostic.role === 'profile'),
    'Missing required participant diagnostics should include the participant role.',
  )
  assert(
    diagnostics.some((diagnostic) => diagnostic.code === 'advanced-feature-invalid-target-kind' && diagnostic.role === 'path'),
    'Invalid target-kind diagnostics should include the participant role.',
  )
}

function testAdvancedOperationIntentValidationRejectsUnsupportedModes() {
  const unsupportedIntentDiagnostics = validateAdvancedSolidFeatureDefinition({
    kind: 'sweep',
    featureTypeVersion: ADVANCED_SOLID_FEATURE_SCHEMA_VERSION,
    parameters: {
      operationIntent: 'intersect',
      participants: [
        { role: 'profile', targets: [{ kind: 'region', sketchId: 'sketch_a', regionId: 'region_a' }] },
        { role: 'path', targets: [{ kind: 'edge', bodyId: 'body_a', edgeId: 'edge_path' }] },
      ],
    },
  }, sweepDescriptor)

  const missingTargetDiagnostics = validateAdvancedSolidFeatureDefinition({
    kind: 'sweep',
    featureTypeVersion: ADVANCED_SOLID_FEATURE_SCHEMA_VERSION,
    parameters: {
      operationIntent: 'add',
      participants: [
        { role: 'profile', targets: [{ kind: 'region', sketchId: 'sketch_a', regionId: 'region_a' }] },
        { role: 'path', targets: [{ kind: 'edge', bodyId: 'body_a', edgeId: 'edge_path' }] },
      ],
    },
  }, sweepDescriptor)

  assert(
    unsupportedIntentDiagnostics.some((diagnostic) => diagnostic.code === 'advanced-feature-unsupported-operation'),
    'Unsupported operation intent should produce a stable diagnostic code.',
  )
  assert(
    missingTargetDiagnostics.some((diagnostic) => diagnostic.code === 'advanced-feature-missing-participant' && diagnostic.role === 'targetBody'),
    'Operation-specific required participants should be validated by role.',
  )
}

function testSweepPathCardinalityAndBooleanTargetValidation() {
  const invalidPathCardinality = validateAdvancedSolidFeatureDefinition({
    kind: 'sweep',
    featureTypeVersion: ADVANCED_SOLID_FEATURE_SCHEMA_VERSION,
    parameters: {
      operationIntent: 'create',
      participants: [
        { role: 'profile', targets: [{ kind: 'region', sketchId: 'sketch_a', regionId: 'region_a' }] },
        {
          role: 'path',
          targets: [
            { kind: 'edge', bodyId: 'body_a', edgeId: 'edge_path_a' },
            { kind: 'sketchEntity', sketchId: 'sketch_a', entityId: 'sketch_entity_path_b' },
          ],
        },
      ],
    },
  }, sweepDescriptor)

  const validBoolean = validateAdvancedSolidFeatureDefinition({
    kind: 'sweep',
    featureTypeVersion: ADVANCED_SOLID_FEATURE_SCHEMA_VERSION,
    parameters: {
      operationIntent: 'subtract',
      participants: [
        { role: 'profile', targets: [{ kind: 'face', bodyId: 'body_profile', faceId: 'face_profile' }] },
        { role: 'path', targets: [{ kind: 'edge', bodyId: 'body_path', edgeId: 'edge_path' }] },
        { role: 'targetBody', targets: [{ kind: 'body', bodyId: 'body_target' }] },
      ],
    },
  }, sweepDescriptor)

  assert(
    invalidPathCardinality.some((diagnostic) => diagnostic.code === 'advanced-feature-invalid-cardinality' && diagnostic.role === 'path'),
    'Sweep path cardinality validation should reject multiple path targets.',
  )
  assert(validBoolean.length === 0, 'Boolean sweep validation should accept an explicit targetBody participant.')
}

function testLoftValidationPreservesOrderedProfilesAndGuideCurves() {
  const valid = validateAdvancedSolidFeatureDefinition({
    kind: 'loft',
    featureTypeVersion: ADVANCED_SOLID_FEATURE_SCHEMA_VERSION,
    parameters: {
      operationIntent: 'create',
      participants: [
        {
          role: 'profile',
          targets: [
            { kind: 'region', sketchId: 'sketch_a', regionId: 'region_a' },
            { kind: 'face', bodyId: 'body_b', faceId: 'face_b' },
          ],
        },
        { role: 'guideCurve', targets: [{ kind: 'edge', bodyId: 'body_guide', edgeId: 'edge_guide' }] },
      ],
    },
  }, loftDescriptor)

  assert(valid.length === 0, 'Loft validation should accept two or more ordered profiles and optional guide curves.')
}

function testLoftValidationRejectsMissingProfilesAndInvalidBooleanTargets() {
  const missingProfiles = validateAdvancedSolidFeatureDefinition({
    kind: 'loft',
    featureTypeVersion: ADVANCED_SOLID_FEATURE_SCHEMA_VERSION,
    parameters: {
      operationIntent: 'create',
      participants: [
        { role: 'profile', targets: [{ kind: 'region', sketchId: 'sketch_a', regionId: 'region_a' }] },
      ],
    },
  }, loftDescriptor)

  const invalidBoolean = validateAdvancedSolidFeatureDefinition({
    kind: 'loft',
    featureTypeVersion: ADVANCED_SOLID_FEATURE_SCHEMA_VERSION,
    parameters: {
      operationIntent: 'add',
      participants: [
        {
          role: 'profile',
          targets: [
            { kind: 'region', sketchId: 'sketch_a', regionId: 'region_a' },
            { kind: 'region', sketchId: 'sketch_b', regionId: 'region_b' },
          ],
        },
        { role: 'targetBody', targets: [{ kind: 'face', bodyId: 'body_wrong', faceId: 'face_wrong' }] },
      ],
    },
  }, loftDescriptor)

  assert(
    missingProfiles.some((diagnostic) => diagnostic.code === 'advanced-feature-missing-participant' && diagnostic.role === 'profile')
      && missingProfiles.some((diagnostic) => diagnostic.code === 'advanced-feature-invalid-cardinality' && diagnostic.role === 'profile'),
    'Loft validation should require at least two profile targets.',
  )
  assert(
    invalidBoolean.some((diagnostic) => diagnostic.code === 'advanced-feature-invalid-target-kind' && diagnostic.role === 'targetBody'),
    'Loft boolean validation should require explicit body targets.',
  )
}

function testChamferEdgeParticipantsAndDistanceValidation() {
  const valid = validateAdvancedSolidFeatureDefinition({
    kind: 'chamfer',
    featureTypeVersion: ADVANCED_SOLID_FEATURE_SCHEMA_VERSION,
    parameters: {
      participants: [
        { role: 'edge', targets: [{ kind: 'edge', bodyId: 'body_a', edgeId: 'edge_outer' }] },
      ],
      options: { distance: 0.5 },
    },
  }, chamferDescriptor)
  const wrongKind = validateAdvancedSolidFeatureDefinition({
    kind: 'chamfer',
    featureTypeVersion: ADVANCED_SOLID_FEATURE_SCHEMA_VERSION,
    parameters: {
      participants: [
        { role: 'edge', targets: [{ kind: 'face', bodyId: 'body_a', faceId: 'face_top' }] },
      ],
      options: { distance: 0.5 },
    },
  }, chamferDescriptor)
  const invalidDistance = validateAdvancedSolidFeatureDefinition({
    kind: 'chamfer',
    featureTypeVersion: ADVANCED_SOLID_FEATURE_SCHEMA_VERSION,
    parameters: {
      participants: [
        { role: 'edge', targets: [{ kind: 'edge', bodyId: 'body_a', edgeId: 'edge_outer' }] },
      ],
      options: { distance: 0 },
    },
  }, chamferDescriptor)

  assert(valid.length === 0, 'Chamfer validation should accept edge participants and a positive constant distance.')
  assert(
    wrongKind.some((diagnostic) => diagnostic.code === 'advanced-feature-invalid-target-kind' && diagnostic.role === 'edge'),
    'Chamfer validation should reject non-edge participants.',
  )
  assert(
    invalidDistance.some((diagnostic) => diagnostic.code === 'advanced-feature-invalid-option'),
    'Chamfer validation should reject non-positive distances.',
  )
}

function testThickenFaceParticipantsAndThicknessValidation() {
  const valid = validateAdvancedSolidFeatureDefinition({
    kind: 'thicken',
    featureTypeVersion: ADVANCED_SOLID_FEATURE_SCHEMA_VERSION,
    parameters: {
      operationIntent: 'create',
      participants: [
        { role: 'face', targets: [{ kind: 'face', bodyId: 'body_a', faceId: 'face_outer' }] },
      ],
      options: { thickness: 0.5, side: 'oneSide' },
    },
  }, thickenDescriptor)
  const wrongKind = validateAdvancedSolidFeatureDefinition({
    kind: 'thicken',
    featureTypeVersion: ADVANCED_SOLID_FEATURE_SCHEMA_VERSION,
    parameters: {
      operationIntent: 'create',
      participants: [
        { role: 'face', targets: [{ kind: 'edge', bodyId: 'body_a', edgeId: 'edge_outer' }] },
      ],
      options: { thickness: 0.5, side: 'oneSide' },
    },
  }, thickenDescriptor)
  const invalidThickness = validateAdvancedSolidFeatureDefinition({
    kind: 'thicken',
    featureTypeVersion: ADVANCED_SOLID_FEATURE_SCHEMA_VERSION,
    parameters: {
      operationIntent: 'create',
      participants: [
        { role: 'face', targets: [{ kind: 'face', bodyId: 'body_a', faceId: 'face_outer' }] },
      ],
      options: { thickness: 0, side: 'oneSide' },
    },
  }, thickenDescriptor)
  const missingTargetBody = validateAdvancedSolidFeatureDefinition({
    kind: 'thicken',
    featureTypeVersion: ADVANCED_SOLID_FEATURE_SCHEMA_VERSION,
    parameters: {
      operationIntent: 'subtract',
      participants: [
        { role: 'face', targets: [{ kind: 'face', bodyId: 'body_a', faceId: 'face_outer' }] },
      ],
      options: { thickness: 0.5, side: 'symmetric' },
    },
  }, thickenDescriptor)

  assert(valid.length === 0, 'Thicken validation should accept face participants and positive thickness.')
  assert(
    wrongKind.some((diagnostic) => diagnostic.code === 'advanced-feature-invalid-target-kind' && diagnostic.role === 'face'),
    'Thicken validation should reject non-face participants.',
  )
  assert(
    invalidThickness.some((diagnostic) => diagnostic.code === 'advanced-feature-invalid-option'),
    'Thicken validation should reject non-positive thickness values.',
  )
  assert(
    missingTargetBody.some((diagnostic) => diagnostic.code === 'advanced-feature-missing-participant' && diagnostic.role === 'targetBody'),
    'Thicken boolean validation should require explicit target bodies.',
  )
}

testAdvancedParticipantValidationAcceptsRoleSpecificPayloads()
testAdvancedParticipantValidationRejectsMissingAndWrongKinds()
testAdvancedOperationIntentValidationRejectsUnsupportedModes()
testSweepPathCardinalityAndBooleanTargetValidation()
testLoftValidationPreservesOrderedProfilesAndGuideCurves()
testLoftValidationRejectsMissingProfilesAndInvalidBooleanTargets()
testChamferEdgeParticipantsAndDistanceValidation()
testThickenFaceParticipantsAndThicknessValidation()

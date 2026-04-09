import type { FeatureId, PrimitiveRef, RevisionId } from '@/domain/editor/schema'
import { primitiveRefEquals } from '@/domain/editor/schema'
import type {
  ExtrudeFeatureParameters,
  ExtrudeProfileRef,
  FeatureDefinition,
  FeatureBooleanOperation,
  FeatureSnapshotRecord,
  ModelingDiagnostic,
  PreviewId,
} from '@/contracts/modeling/schema'
import { EXTRUDE_FEATURE_SCHEMA_VERSION } from '@/contracts/shared/versioning'

export const EXTRUDE_FEATURE_TYPE = 'extrude' as const
export const FEATURE_TYPE_VERSION = EXTRUDE_FEATURE_SCHEMA_VERSION

export interface ExtrudeFeatureParameterDraft {
  profileTarget: ExtrudeProfileRef | null
  depth: number
  direction: 'oneSided'
  operation: FeatureBooleanOperation
}

export interface FeatureEditDraftMap {
  extrude: ExtrudeFeatureParameterDraft
}

export interface ExtrudeFeatureEditSessionState {
  mode: 'create' | 'edit'
  featureType: 'extrude'
  featureTypeVersion: typeof FEATURE_TYPE_VERSION
  featureId: FeatureId | null
  draft: ExtrudeFeatureParameterDraft
  previewId: PreviewId
  status: 'idle' | 'previewing' | 'previewReady' | 'submitting'
  lastPreviewRevisionId: RevisionId | null
  lastCommittedRevisionId: RevisionId | null
  diagnostics: ModelingDiagnostic[]
}

export type FeatureEditSessionState = ExtrudeFeatureEditSessionState

export function createDefaultExtrudeDraft(
  selectedTarget: PrimitiveRef | null,
): ExtrudeFeatureParameterDraft {
  return {
    profileTarget: toExtrudeProfileRef(selectedTarget),
    depth: 12,
    direction: 'oneSided',
    operation: 'newBody',
  }
}

export function createExtrudeFeatureEditSession(input: {
  selectedTarget: PrimitiveRef | null
  featureId?: FeatureId | null
  draft?: ExtrudeFeatureParameterDraft
  mode?: 'create' | 'edit'
}): FeatureEditSessionState {
  const draft = input.draft ?? createDefaultExtrudeDraft(input.selectedTarget)
  const previewSeed = input.featureId ?? 'extrude-create'

  return {
    mode: input.mode ?? (input.featureId ? 'edit' : 'create'),
    featureType: 'extrude',
    featureTypeVersion: FEATURE_TYPE_VERSION,
    featureId: input.featureId ?? null,
    draft,
    previewId: `preview_${previewSeed}`,
    status: 'idle',
    lastPreviewRevisionId: null,
    lastCommittedRevisionId: null,
    diagnostics: [],
  }
}

export function hydrateExtrudeFeatureEditSession(
  feature: FeatureSnapshotRecord,
): FeatureEditSessionState | null {
  if (feature.definition.kind !== EXTRUDE_FEATURE_TYPE) {
    return null
  }

  const draft = createExtrudeDraftFromFeature(feature)

  return createExtrudeFeatureEditSession({
    selectedTarget: draft.profileTarget,
    featureId: feature.featureId,
    draft,
    mode: 'edit',
  })
}

export function createExtrudeDraftFromFeature(
  feature: FeatureSnapshotRecord,
): ExtrudeFeatureParameterDraft {
  if (feature.definition.kind !== 'extrude') {
    throw new Error('Extrude draft hydration requires an extrude feature payload.')
  }

  const payload = feature.definition.parameters

  return {
    profileTarget: assertExtrudeProfileRef(payload.profile),
    depth: payload.endExtent.distance,
    direction: payload.direction ?? 'oneSided',
    operation: payload.operation,
  }
}

function assertExtrudeProfileRef(value: PrimitiveRef): ExtrudeProfileRef {
  switch (value.kind) {
    case 'region':
    case 'face':
      return value
    default:
      throw new Error('Extrude draft references must resolve to region or face targets.')
  }
}

export function buildExtrudeFeatureParameters(
  draft: ExtrudeFeatureParameterDraft,
): ExtrudeFeatureParameters | null {
  if (!draft.profileTarget) {
    return null
  }

  return {
    profile: draft.profileTarget,
    startExtent: {
      kind: 'profilePlane',
    },
    endExtent: {
      kind: 'blind',
      direction: 'positive',
      distance: draft.depth,
    },
    depth: draft.depth,
    direction: draft.direction,
    operation: draft.operation,
    booleanScope:
      draft.operation === 'newBody'
        ? { kind: 'standalone' }
        : { kind: 'targetBodies', bodyIds: [] },
  }
}

export function buildExtrudeFeatureDefinition(
  draft: ExtrudeFeatureParameterDraft,
): Extract<FeatureDefinition, { kind: 'extrude' }> | null {
  const parameters = buildExtrudeFeatureParameters(draft)

  if (!parameters) {
    return null
  }

  return {
    kind: 'extrude',
    featureTypeVersion: FEATURE_TYPE_VERSION,
    parameters,
  }
}

export function updateExtrudeDraft(
  draft: ExtrudeFeatureParameterDraft,
  patch: Partial<ExtrudeFeatureParameterDraft>,
): ExtrudeFeatureParameterDraft {
  return {
    ...draft,
    ...patch,
  }
}

export function targetMatchesExtrudeProfile(
  target: PrimitiveRef,
  draft: ExtrudeFeatureParameterDraft,
) {
  return draft.profileTarget ? primitiveRefEquals(target, draft.profileTarget) : false
}

function isPrimitiveRef(value: unknown): value is PrimitiveRef {
  return (
    typeof value === 'object' &&
    value !== null &&
    'kind' in value &&
    typeof (value as { kind: unknown }).kind === 'string'
  )
}

function toExtrudeProfileRef(value: PrimitiveRef | null): ExtrudeProfileRef | null {
  if (!value || !isPrimitiveRef(value)) {
    return null
  }

  switch (value.kind) {
    case 'region':
      return value
    case 'face':
      return value
    default:
      return null
  }
}

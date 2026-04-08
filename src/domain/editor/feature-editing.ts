import type { FeatureId, PrimitiveRef, RevisionId } from '@/domain/editor/schema'
import { primitiveRefEquals } from '@/domain/editor/schema'
import type {
  FeatureBooleanOperation,
  FeatureSnapshotRecord,
  ModelingDiagnostic,
  PreviewId,
  ExtrudeFeatureParameterPayload,
} from '@/domain/modeling/schema'

export const EXTRUDE_FEATURE_TYPE = 'extrude' as const
export const FEATURE_TYPE_VERSION = 'feature-type/v1alpha1' as const

export interface ExtrudeFeatureParameterDraft {
  profileTarget: PrimitiveRef | null
  depth: number
  direction: 'oneSided'
  operation: FeatureBooleanOperation
}

export interface FeatureEditDraftMap {
  extrude: ExtrudeFeatureParameterDraft
}

export interface FeatureEditSessionState {
  mode: 'create' | 'edit'
  featureType: keyof FeatureEditDraftMap
  featureTypeVersion: typeof FEATURE_TYPE_VERSION
  featureId: FeatureId | null
  draft: FeatureEditDraftMap[keyof FeatureEditDraftMap]
  previewId: PreviewId
  status: 'idle' | 'previewing' | 'previewReady' | 'submitting'
  lastPreviewRevisionId: RevisionId | null
  lastCommittedRevisionId: RevisionId | null
  diagnostics: ModelingDiagnostic[]
}

export function createDefaultExtrudeDraft(
  selectedTarget: PrimitiveRef | null,
): ExtrudeFeatureParameterDraft {
  return {
    profileTarget:
      selectedTarget &&
      (selectedTarget.kind === 'sketch' || selectedTarget.kind === 'sketchEntity')
        ? selectedTarget
        : null,
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
  if (feature.featureType !== EXTRUDE_FEATURE_TYPE) {
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
  if (feature.featureType !== 'extrude') {
    throw new Error('Extrude draft hydration requires an extrude feature payload.')
  }

  const payload = feature.parameterPayload as ExtrudeFeatureParameterPayload
  const profileTarget = payload.profileTarget

  return {
    profileTarget: isPrimitiveRef(profileTarget)
      ? profileTarget
      : feature.consumedTargets.find((target) => target.kind === 'sketch') ?? null,
    depth: typeof payload.depth === 'number' ? payload.depth : 12,
    direction: payload.direction === 'oneSided' ? 'oneSided' : 'oneSided',
    operation:
      payload.operation === 'newBody' ||
      payload.operation === 'add' ||
      payload.operation === 'remove'
        ? payload.operation
        : 'newBody',
  }
}

export function buildExtrudeConsumedTargets(
  draft: ExtrudeFeatureParameterDraft,
): PrimitiveRef[] {
  return draft.profileTarget ? [draft.profileTarget] : []
}

export function buildExtrudeParameterPayload(
  draft: ExtrudeFeatureParameterDraft,
): ExtrudeFeatureParameterPayload | null {
  if (!draft.profileTarget) {
    return null
  }

  return {
    depth: draft.depth,
    direction: draft.direction,
    operation: draft.operation,
    profileTarget: draft.profileTarget,
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

import type { FeatureId, PrimitiveRef, RevisionId } from '@/domain/editor/schema'
import { primitiveRefEquals } from '@/domain/editor/schema'
import type {
  ExtrudeFeatureParameters,
  ExtrudeProfileRef,
  FeatureBooleanOperation,
  FeatureBooleanScope,
  FeatureDefinition,
  FeatureSnapshotRecord,
  FilletFeatureParameters,
  ModelingDiagnostic,
  PlaneFeatureParameters,
  PreviewId,
  RevolveAxisRef,
  RevolveFeatureParameters,
  ShellFeatureParameters,
} from '@/contracts/modeling/schema'
import type { BodyId } from '@/contracts/shared/ids'
import {
  EXTRUDE_FEATURE_SCHEMA_VERSION,
  FILLET_FEATURE_SCHEMA_VERSION,
  PLANE_FEATURE_SCHEMA_VERSION,
  REVOLVE_FEATURE_SCHEMA_VERSION,
  SHELL_FEATURE_SCHEMA_VERSION,
} from '@/contracts/shared/versioning'

export interface ExtrudeFeatureParameterDraft {
  profileTarget: ExtrudeProfileRef | null
  depth: number
  direction: 'oneSided'
  operation: FeatureBooleanOperation
  booleanScope: FeatureBooleanScope
}

export interface RevolveFeatureParameterDraft {
  profileTarget: ExtrudeProfileRef | null
  axisTarget: RevolveAxisRef | null
  startAngle: number
  angle: number
  operation: FeatureBooleanOperation
  booleanScope: FeatureBooleanScope
}

export interface FilletFeatureParameterDraft {
  edgeTargets: readonly Extract<PrimitiveRef, { kind: 'edge' }>[]
  radius: number
}

export interface PlaneFeatureParameterDraft {
  referenceTarget: Extract<PrimitiveRef, { kind: 'construction' | 'face' }> | null
}

export interface ShellFeatureParameterDraft {
  bodyTarget: Extract<PrimitiveRef, { kind: 'body' }> | null
  faceTargets: readonly Extract<PrimitiveRef, { kind: 'face' }>[]
  thickness: number
  operation: FeatureBooleanOperation
  booleanScope: FeatureBooleanScope
}

export interface FeatureEditSessionStateBase {
  mode: 'create' | 'edit'
  featureId: FeatureId | null
  previewId: PreviewId
  status: 'idle' | 'previewing' | 'previewReady' | 'submitting'
  lastPreviewRevisionId: RevisionId | null
  lastCommittedRevisionId: RevisionId | null
  diagnostics: ModelingDiagnostic[]
}

export interface ExtrudeFeatureEditSessionState extends FeatureEditSessionStateBase {
  featureType: 'extrude'
  featureTypeVersion: typeof EXTRUDE_FEATURE_SCHEMA_VERSION
  draft: ExtrudeFeatureParameterDraft
}

export interface RevolveFeatureEditSessionState extends FeatureEditSessionStateBase {
  featureType: 'revolve'
  featureTypeVersion: typeof REVOLVE_FEATURE_SCHEMA_VERSION
  draft: RevolveFeatureParameterDraft
}

export interface FilletFeatureEditSessionState extends FeatureEditSessionStateBase {
  featureType: 'fillet'
  featureTypeVersion: typeof FILLET_FEATURE_SCHEMA_VERSION
  draft: FilletFeatureParameterDraft
}

export interface PlaneFeatureEditSessionState extends FeatureEditSessionStateBase {
  featureType: 'plane'
  featureTypeVersion: typeof PLANE_FEATURE_SCHEMA_VERSION
  draft: PlaneFeatureParameterDraft
}

export interface ShellFeatureEditSessionState extends FeatureEditSessionStateBase {
  featureType: 'shell'
  featureTypeVersion: typeof SHELL_FEATURE_SCHEMA_VERSION
  draft: ShellFeatureParameterDraft
}

export type FeatureEditSessionState =
  | ExtrudeFeatureEditSessionState
  | RevolveFeatureEditSessionState
  | FilletFeatureEditSessionState
  | PlaneFeatureEditSessionState
  | ShellFeatureEditSessionState

export type FeatureDraftPatch = Record<string, unknown>

function createBaseFeatureSession(
  featureType: FeatureEditSessionState['featureType'],
  featureId: FeatureId | null,
): FeatureEditSessionStateBase {
  const previewSeed = featureId ?? `${featureType}-create`

  return {
    mode: featureId ? 'edit' : 'create',
    featureId,
    previewId: `preview_${previewSeed}` as PreviewId,
    status: 'idle' as const,
    lastPreviewRevisionId: null,
    lastCommittedRevisionId: null,
    diagnostics: [],
  }
}

function asExtrudeProfileRef(value: PrimitiveRef | null): ExtrudeProfileRef | null {
  if (!value) {
    return null
  }

  switch (value.kind) {
    case 'region':
    case 'face':
      return value
    default:
      return null
  }
}

function asRevolveAxisRef(value: PrimitiveRef | null): RevolveAxisRef | null {
  if (!value) {
    return null
  }

  switch (value.kind) {
    case 'edge':
      return value
    case 'construction':
      return value
    default:
      return null
  }
}

function asBodyRef(value: PrimitiveRef | null): Extract<PrimitiveRef, { kind: 'body' }> | null {
  return value?.kind === 'body' ? value : null
}

function asFaceRef(value: PrimitiveRef | null): Extract<PrimitiveRef, { kind: 'face' }> | null {
  return value?.kind === 'face' ? value : null
}

function asEdgeRef(value: PrimitiveRef | null): Extract<PrimitiveRef, { kind: 'edge' }> | null {
  return value?.kind === 'edge' ? value : null
}

function asPlaneReferenceTarget(
  value: PrimitiveRef | null,
): Extract<PrimitiveRef, { kind: 'construction' | 'face' }> | null {
  return value?.kind === 'construction' || value?.kind === 'face' ? value : null
}

function appendUniqueTarget<TTarget extends PrimitiveRef>(
  current: readonly TTarget[],
  target: TTarget,
) {
  return current.some((entry) => primitiveRefEquals(entry, target)) ? current : [...current, target]
}

export function createFeatureEditSession(input: {
  featureType: FeatureEditSessionState['featureType']
  selectedTarget: PrimitiveRef | null
  featureId?: FeatureId | null
}): FeatureEditSessionState {
  const featureId = input.featureId ?? null
  const base = createBaseFeatureSession(input.featureType, featureId)

  switch (input.featureType) {
    case 'extrude':
      return {
        ...base,
        featureType: 'extrude',
        featureTypeVersion: EXTRUDE_FEATURE_SCHEMA_VERSION,
        draft: {
          profileTarget: asExtrudeProfileRef(input.selectedTarget),
          depth: 12,
          direction: 'oneSided',
          operation: 'newBody',
          booleanScope: { kind: 'standalone' },
        },
      }
    case 'revolve':
      return {
        ...base,
        featureType: 'revolve',
        featureTypeVersion: REVOLVE_FEATURE_SCHEMA_VERSION,
        draft: {
          profileTarget: asExtrudeProfileRef(input.selectedTarget),
          axisTarget: asRevolveAxisRef(input.selectedTarget),
          startAngle: 0,
          angle: Math.PI * 2,
          operation: 'newBody',
          booleanScope: { kind: 'standalone' },
        },
      }
    case 'fillet':
      return {
        ...base,
        featureType: 'fillet',
        featureTypeVersion: FILLET_FEATURE_SCHEMA_VERSION,
        draft: {
          edgeTargets: asEdgeRef(input.selectedTarget) ? [asEdgeRef(input.selectedTarget)!] : [],
          radius: 1,
        },
      }
    case 'plane':
      return {
        ...base,
        featureType: 'plane',
        featureTypeVersion: PLANE_FEATURE_SCHEMA_VERSION,
        draft: {
          referenceTarget: asPlaneReferenceTarget(input.selectedTarget),
        },
      }
    case 'shell':
      {
        const selectedFace = asFaceRef(input.selectedTarget)

      return {
        ...base,
        featureType: 'shell',
        featureTypeVersion: SHELL_FEATURE_SCHEMA_VERSION,
        draft: {
          bodyTarget: asBodyRef(input.selectedTarget) ?? (selectedFace ? { kind: 'body', bodyId: selectedFace.bodyId } : null),
          faceTargets: selectedFace ? [selectedFace] : [],
          thickness: 1,
          operation: 'newBody',
          booleanScope: { kind: 'standalone' },
        },
      }
      }
  }
}

export function hydrateFeatureEditSession(
  feature: FeatureSnapshotRecord,
): FeatureEditSessionState | null {
  const featureId = feature.featureId

  switch (feature.definition.kind) {
    case 'extrude':
      return {
        ...createBaseFeatureSession('extrude', featureId),
        mode: 'edit',
        featureType: 'extrude',
        featureTypeVersion: EXTRUDE_FEATURE_SCHEMA_VERSION,
        draft: {
          profileTarget: feature.definition.parameters.profile,
          depth: feature.definition.parameters.endExtent.distance,
          direction: feature.definition.parameters.direction ?? 'oneSided',
          operation: feature.definition.parameters.operation,
          booleanScope: feature.definition.parameters.booleanScope,
        },
      }
    case 'revolve':
      return {
        ...createBaseFeatureSession('revolve', featureId),
        mode: 'edit',
        featureType: 'revolve',
        featureTypeVersion: REVOLVE_FEATURE_SCHEMA_VERSION,
        draft: {
          profileTarget: feature.definition.parameters.profile,
          axisTarget: feature.definition.parameters.axis,
          startAngle: feature.definition.parameters.startAngle,
          angle: feature.definition.parameters.extent.radians,
          operation: feature.definition.parameters.operation,
          booleanScope: feature.definition.parameters.booleanScope,
        },
      }
    case 'fillet':
      return {
        ...createBaseFeatureSession('fillet', featureId),
        mode: 'edit',
        featureType: 'fillet',
        featureTypeVersion: FILLET_FEATURE_SCHEMA_VERSION,
        draft: {
          edgeTargets: [...feature.definition.parameters.edgeTargets],
          radius: feature.definition.parameters.radius,
        },
      }
    case 'plane':
      return {
        ...createBaseFeatureSession('plane', featureId),
        mode: 'edit',
        featureType: 'plane',
        featureTypeVersion: PLANE_FEATURE_SCHEMA_VERSION,
        draft: {
          referenceTarget: feature.definition.parameters.reference.target,
        },
      }
    case 'shell':
      return {
        ...createBaseFeatureSession('shell', featureId),
        mode: 'edit',
        featureType: 'shell',
        featureTypeVersion: SHELL_FEATURE_SCHEMA_VERSION,
        draft: {
          bodyTarget: feature.definition.parameters.bodyTarget,
          faceTargets: [...feature.definition.parameters.faceTargets],
          thickness: feature.definition.parameters.thickness,
          operation: feature.definition.parameters.operation,
          booleanScope: feature.definition.parameters.booleanScope,
        },
      }
  }
}

function toBodyIds(value: unknown): readonly BodyId[] | null {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    return null
  }

  return value as readonly BodyId[]
}

function toBooleanScope(patch: FeatureDraftPatch, current: FeatureBooleanScope): FeatureBooleanScope {
  if (patch.booleanScope && typeof patch.booleanScope === 'object' && patch.booleanScope !== null) {
    const next = patch.booleanScope as Partial<FeatureBooleanScope> & { kind?: string }

    if (next.kind === 'standalone') {
      return { kind: 'standalone' }
    }

    if (next.kind === 'targetBody' && typeof (next as { bodyId?: unknown }).bodyId === 'string') {
      return { kind: 'targetBody', bodyId: (next as { bodyId: BodyId }).bodyId }
    }

    if (next.kind === 'targetBodies') {
      const bodyIds = toBodyIds((next as { bodyIds?: unknown }).bodyIds)
      if (bodyIds) {
        return { kind: 'targetBodies', bodyIds }
      }
    }
  }

  if (patch.operation === 'newBody') {
    return { kind: 'standalone' }
  }

  if (typeof patch.booleanTargetBodyId === 'string') {
    return { kind: 'targetBody', bodyId: patch.booleanTargetBodyId as BodyId }
  }

  const bodyIds = toBodyIds(patch.booleanTargetBodyIds)
  if (bodyIds) {
    return bodyIds.length <= 1
      ? bodyIds[0]
        ? { kind: 'targetBody', bodyId: bodyIds[0] }
        : current
      : { kind: 'targetBodies', bodyIds }
  }

  return current
}

export function patchFeatureEditSession(
  session: FeatureEditSessionState,
  patch: FeatureDraftPatch,
): FeatureEditSessionState {
  switch (session.featureType) {
    case 'extrude':
      return {
        ...session,
        draft: {
          ...session.draft,
          profileTarget:
            patch.profileTarget === undefined ? session.draft.profileTarget : asExtrudeProfileRef(patch.profileTarget as PrimitiveRef | null),
          depth: typeof patch.depth === 'number' ? patch.depth : session.draft.depth,
          direction: patch.direction === 'oneSided' ? 'oneSided' : session.draft.direction,
          operation:
            patch.operation === 'newBody' || patch.operation === 'join' || patch.operation === 'cut' || patch.operation === 'intersect'
              ? patch.operation
              : session.draft.operation,
          booleanScope: toBooleanScope(patch, session.draft.booleanScope),
        },
      }
    case 'revolve':
      return {
        ...session,
        draft: {
          ...session.draft,
          profileTarget:
            patch.profileTarget === undefined ? session.draft.profileTarget : asExtrudeProfileRef(patch.profileTarget as PrimitiveRef | null),
          axisTarget:
            patch.axisTarget === undefined ? session.draft.axisTarget : asRevolveAxisRef(patch.axisTarget as PrimitiveRef | null),
          startAngle: typeof patch.startAngle === 'number' ? patch.startAngle : session.draft.startAngle,
          angle: typeof patch.angle === 'number' ? patch.angle : session.draft.angle,
          operation:
            patch.operation === 'newBody' || patch.operation === 'join' || patch.operation === 'cut' || patch.operation === 'intersect'
              ? patch.operation
              : session.draft.operation,
          booleanScope: toBooleanScope(patch, session.draft.booleanScope),
        },
      }
    case 'fillet':
      return {
        ...session,
        draft: {
          ...session.draft,
          edgeTargets:
            patch.edgeTargets === undefined && patch.edgeTarget === undefined
              ? session.draft.edgeTargets
              : Array.isArray(patch.edgeTargets)
                ? (patch.edgeTargets.filter((entry): entry is Extract<PrimitiveRef, { kind: 'edge' }> => entry?.kind === 'edge'))
                : asEdgeRef(patch.edgeTarget as PrimitiveRef | null)
                  ? [patch.edgeTarget as Extract<PrimitiveRef, { kind: 'edge' }>]
                  : session.draft.edgeTargets,
          radius: typeof patch.radius === 'number' ? patch.radius : session.draft.radius,
        },
      }
    case 'plane':
      return {
        ...session,
        draft: {
          referenceTarget:
            patch.referenceTarget === undefined
              ? session.draft.referenceTarget
              : asPlaneReferenceTarget(patch.referenceTarget as PrimitiveRef | null),
        },
      }
    case 'shell':
      return {
        ...session,
        draft: {
          ...session.draft,
          bodyTarget:
            patch.bodyTarget === undefined ? session.draft.bodyTarget : asBodyRef(patch.bodyTarget as PrimitiveRef | null),
          faceTargets:
            patch.faceTargets === undefined && patch.faceTarget === undefined
              ? session.draft.faceTargets
              : Array.isArray(patch.faceTargets)
                ? (patch.faceTargets.filter((entry): entry is Extract<PrimitiveRef, { kind: 'face' }> => entry?.kind === 'face'))
                : asFaceRef(patch.faceTarget as PrimitiveRef | null)
                  ? [patch.faceTarget as Extract<PrimitiveRef, { kind: 'face' }>]
                  : session.draft.faceTargets,
          thickness: typeof patch.thickness === 'number' ? patch.thickness : session.draft.thickness,
          operation:
            patch.operation === 'newBody' || patch.operation === 'join' || patch.operation === 'cut' || patch.operation === 'intersect'
              ? patch.operation
              : session.draft.operation,
          booleanScope: toBooleanScope(patch, session.draft.booleanScope),
        },
      }
  }
}

export function applySelectionToFeatureEditSession(
  session: FeatureEditSessionState,
  target: PrimitiveRef,
): FeatureEditSessionState {
  switch (session.featureType) {
    case 'extrude':
      return target.kind === 'region' || target.kind === 'face'
        ? patchFeatureEditSession(session, { profileTarget: target })
        : target.kind === 'body' && session.draft.operation !== 'newBody'
          ? patchFeatureEditSession(session, { booleanTargetBodyId: target.bodyId })
          : session
    case 'revolve':
      if (target.kind === 'region' || target.kind === 'face') {
        return patchFeatureEditSession(session, { profileTarget: target })
      }
      if (target.kind === 'edge' || target.kind === 'construction') {
        return patchFeatureEditSession(session, { axisTarget: target })
      }
      if (target.kind === 'body' && session.draft.operation !== 'newBody') {
        return patchFeatureEditSession(session, { booleanTargetBodyId: target.bodyId })
      }
      return session
    case 'fillet':
      return target.kind === 'edge'
        ? {
            ...session,
            draft: {
              ...session.draft,
              edgeTargets: appendUniqueTarget(session.draft.edgeTargets, target),
            },
          }
        : session
    case 'plane':
      return target.kind === 'construction' || target.kind === 'face'
        ? patchFeatureEditSession(session, { referenceTarget: target })
        : session
    case 'shell':
      if (target.kind === 'body') {
        return patchFeatureEditSession(session, {
          bodyTarget: target,
          booleanTargetBodyId:
            session.draft.operation === 'newBody' ? undefined : target.bodyId,
        })
      }
      if (target.kind === 'face') {
        return {
          ...session,
          draft: {
            ...session.draft,
            bodyTarget:
              session.draft.bodyTarget ?? { kind: 'body', bodyId: target.bodyId },
            faceTargets: appendUniqueTarget(session.draft.faceTargets, target),
          },
        }
      }
      return session
  }
}

export function buildFeatureDefinition(
  session: FeatureEditSessionState,
): FeatureDefinition | null {
  switch (session.featureType) {
    case 'extrude':
      return buildExtrudeFeatureDefinition(session.draft)
    case 'revolve':
      return buildRevolveFeatureDefinition(session.draft)
    case 'fillet':
      return buildFilletFeatureDefinition(session.draft)
    case 'plane':
      return buildPlaneFeatureDefinition(session.draft)
    case 'shell':
      return buildShellFeatureDefinition(session.draft)
  }
}

export function getFeaturePrimarySelectionTarget(
  session: FeatureEditSessionState,
): PrimitiveRef | null {
  switch (session.featureType) {
    case 'extrude':
      return session.draft.profileTarget
    case 'revolve':
      return session.draft.axisTarget ?? session.draft.profileTarget
    case 'fillet':
      return session.draft.edgeTargets[0] ?? null
    case 'plane':
      return session.draft.referenceTarget
    case 'shell':
      return session.draft.faceTargets[0] ?? session.draft.bodyTarget
  }
}

export function getFeatureSessionPreviewLabel(
  session: FeatureEditSessionState,
  prefix = 'Draft',
): string {
  switch (session.featureType) {
    case 'extrude':
      return session.draft.profileTarget
        ? `${prefix} extrude on ${session.draft.profileTarget.kind}`
        : 'Select a sketch region or planar face for extrude'
    case 'revolve':
      if (!session.draft.profileTarget) {
        return 'Select a sketch region or planar face for revolve'
      }
      if (!session.draft.axisTarget) {
        return 'Select an edge or construction axis for revolve'
      }
      return `${prefix} revolve with explicit profile and axis`
    case 'fillet':
      return session.draft.edgeTargets.length > 0
        ? `${prefix} fillet on ${session.draft.edgeTargets.length} edge${session.draft.edgeTargets.length === 1 ? '' : 's'}`
        : 'Select one or more edges for fillet'
    case 'plane':
      return session.draft.referenceTarget
        ? `${prefix} plane from ${session.draft.referenceTarget.kind}`
        : 'Select a construction plane or planar face'
    case 'shell':
      if (!session.draft.bodyTarget) {
        return 'Select a body to shell'
      }
      if (session.draft.faceTargets.length === 0) {
        return 'Select one or more removable faces for shell'
      }
      return `${prefix} shell on ${session.draft.bodyTarget.bodyId}`
  }
}

export function createPreviewMissingInputsDiagnostics(
  session: FeatureEditSessionState,
): ModelingDiagnostic[] {
  switch (session.featureType) {
    case 'extrude':
      return [{
        code: 'feature-preview-missing-profile',
        severity: 'warning',
        message: 'Select a derived sketch region or planar face before previewing extrude.',
        target: null,
        detail: null,
      }]
    case 'revolve':
      return [{
        code: 'feature-preview-missing-references',
        severity: 'warning',
        message: 'Revolve preview requires both a profile and an axis reference.',
        target: null,
        detail: null,
      }]
    case 'fillet':
      return [{
        code: 'feature-preview-missing-edge',
        severity: 'warning',
        message: 'Fillet preview requires at least one edge target.',
        target: null,
        detail: null,
      }]
    case 'plane':
      return [{
        code: 'feature-preview-missing-reference',
        severity: 'warning',
        message: 'Plane preview requires one coplanar reference.',
        target: null,
        detail: null,
      }]
    case 'shell':
      return [{
        code: 'feature-preview-missing-shell-inputs',
        severity: 'warning',
        message: 'Shell preview requires one body and at least one removable face.',
        target: null,
        detail: null,
      }]
  }
}

export function createCommitMissingInputsDiagnostics(
  session: FeatureEditSessionState,
): ModelingDiagnostic[] {
  return createPreviewMissingInputsDiagnostics(session).map((diagnostic) => ({
    ...diagnostic,
    severity: 'error' as const,
    code: diagnostic.code.replace('preview', 'commit'),
    message: diagnostic.message.replace('preview', 'commit'),
  }))
}

function buildExtrudeFeatureDefinition(
  draft: ExtrudeFeatureParameterDraft,
): Extract<FeatureDefinition, { kind: 'extrude' }> | null {
  const parameters = buildExtrudeFeatureParameters(draft)
  return parameters
    ? {
        kind: 'extrude',
        featureTypeVersion: EXTRUDE_FEATURE_SCHEMA_VERSION,
        parameters,
      }
    : null
}

function buildExtrudeFeatureParameters(
  draft: ExtrudeFeatureParameterDraft,
): ExtrudeFeatureParameters | null {
  if (!draft.profileTarget) {
    return null
  }

  return {
    profile: draft.profileTarget,
    startExtent: { kind: 'profilePlane' },
    endExtent: {
      kind: 'blind',
      direction: 'positive',
      distance: draft.depth,
    },
    depth: draft.depth,
    direction: draft.direction,
    operation: draft.operation,
    booleanScope: draft.booleanScope,
  }
}

function buildRevolveFeatureDefinition(
  draft: RevolveFeatureParameterDraft,
): Extract<FeatureDefinition, { kind: 'revolve' }> | null {
  const parameters = buildRevolveFeatureParameters(draft)
  return parameters
    ? {
        kind: 'revolve',
        featureTypeVersion: REVOLVE_FEATURE_SCHEMA_VERSION,
        parameters,
      }
    : null
}

function buildRevolveFeatureParameters(
  draft: RevolveFeatureParameterDraft,
): RevolveFeatureParameters | null {
  if (!draft.profileTarget || !draft.axisTarget) {
    return null
  }

  return {
    profile: draft.profileTarget,
    axis: draft.axisTarget,
    startAngle: draft.startAngle,
    extent: {
      kind: 'angle',
      direction: 'counterClockwise',
      radians: draft.angle,
    },
    angle: draft.angle,
    operation: draft.operation,
    booleanScope: draft.booleanScope,
  }
}

function buildFilletFeatureDefinition(
  draft: FilletFeatureParameterDraft,
): Extract<FeatureDefinition, { kind: 'fillet' }> | null {
  const parameters = buildFilletFeatureParameters(draft)
  return parameters
    ? {
        kind: 'fillet',
        featureTypeVersion: FILLET_FEATURE_SCHEMA_VERSION,
        parameters,
      }
    : null
}

function buildFilletFeatureParameters(
  draft: FilletFeatureParameterDraft,
): FilletFeatureParameters | null {
  return draft.edgeTargets.length > 0
    ? {
        edgeTargets: draft.edgeTargets,
        radius: draft.radius,
      }
    : null
}

function buildPlaneFeatureDefinition(
  draft: PlaneFeatureParameterDraft,
): Extract<FeatureDefinition, { kind: 'plane' }> | null {
  const parameters = buildPlaneFeatureParameters(draft)
  return parameters
    ? {
        kind: 'plane',
        featureTypeVersion: PLANE_FEATURE_SCHEMA_VERSION,
        parameters,
      }
    : null
}

function buildPlaneFeatureParameters(
  draft: PlaneFeatureParameterDraft,
): PlaneFeatureParameters | null {
  return draft.referenceTarget
    ? {
        mode: 'coplanar',
        reference: {
          target: draft.referenceTarget,
        },
      }
    : null
}

function buildShellFeatureDefinition(
  draft: ShellFeatureParameterDraft,
): Extract<FeatureDefinition, { kind: 'shell' }> | null {
  const parameters = buildShellFeatureParameters(draft)
  return parameters
    ? {
        kind: 'shell',
        featureTypeVersion: SHELL_FEATURE_SCHEMA_VERSION,
        parameters,
      }
    : null
}

function buildShellFeatureParameters(
  draft: ShellFeatureParameterDraft,
): ShellFeatureParameters | null {
  if (!draft.bodyTarget || draft.faceTargets.length === 0) {
    return null
  }

  return {
    bodyTarget: draft.bodyTarget,
    faceTargets: draft.faceTargets,
    thickness: draft.thickness,
    operation: draft.operation,
    booleanScope: draft.booleanScope,
  }
}

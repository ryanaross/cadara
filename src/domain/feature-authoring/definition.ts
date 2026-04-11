import type {
  ExtrudeFeatureParameters,
  ExtrudeProfileRef,
  FeatureBooleanOperation,
  FeatureBooleanScope,
  FeatureDefinition,
  FilletFeatureParameters,
  ModelingDiagnostic,
  PlaneFeatureParameters,
  PreviewId,
  RevolveAxisRef,
  RevolveFeatureParameters,
  ShellFeatureParameters,
  AdvancedOperationIntentDescriptor,
  AdvancedParticipantDescriptor,
  AdvancedSolidFeatureParameters,
  AdvancedSolidOperationIntent,
  AuthoredFeatureKind,
} from '@/contracts/modeling/schema'
import type { AdvancedSolidFeatureDefinition } from '@/contracts/modeling/advanced-solid'
import type { BodyId } from '@/contracts/shared/ids'
import type {
  ExtrudeFeatureSchemaVersion,
  FilletFeatureSchemaVersion,
  PlaneFeatureSchemaVersion,
  RevolveFeatureSchemaVersion,
  ShellFeatureSchemaVersion,
} from '@/contracts/shared/versioning'
import { ADVANCED_SOLID_FEATURE_SCHEMA_VERSION } from '@/contracts/modeling/advanced-solid'
import type { FeatureId, PrimitiveRef, RevisionId, SelectionFilter } from '@/domain/editor/schema'
import type { ToolIconId, ToolbarMode } from '@/domain/tools/schema'
import type { FeatureEditorFormSchema } from '@/domain/feature-authoring/form-schema'

export interface ExtrudeFeatureParameterDraft {
  profileTargets: readonly ExtrudeProfileRef[]
  depth: number
  operation: FeatureBooleanOperation
  booleanScope: FeatureBooleanScope
}

export interface RevolveFeatureParameterDraft {
  profileTargets: readonly ExtrudeProfileRef[]
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

export interface SweepFeatureParameterDraft {
  profileTargets: readonly Extract<PrimitiveRef, { kind: 'region' | 'face' }>[]
  pathTarget: Extract<PrimitiveRef, { kind: 'edge' | 'sketchEntity' }> | null
  guideCurveTargets: readonly Extract<PrimitiveRef, { kind: 'edge' | 'sketchEntity' }>[]
  operationIntent: AdvancedSolidOperationIntent
  targetBodyTargets: readonly Extract<PrimitiveRef, { kind: 'body' }>[]
  options: Record<string, unknown>
}

export interface LoftFeatureParameterDraft {
  profileTargets: readonly Extract<PrimitiveRef, { kind: 'region' | 'face' }>[]
  guideCurveTargets: readonly Extract<PrimitiveRef, { kind: 'edge' | 'sketchEntity' }>[]
  operationIntent: AdvancedSolidOperationIntent
  targetBodyTargets: readonly Extract<PrimitiveRef, { kind: 'body' }>[]
  options: Record<string, unknown>
}

export interface ChamferFeatureParameterDraft {
  edgeTargets: readonly Extract<PrimitiveRef, { kind: 'edge' }>[]
  distance: number
}

export interface ThickenFeatureParameterDraft {
  faceTargets: readonly Extract<PrimitiveRef, { kind: 'face' }>[]
  operationIntent: AdvancedSolidOperationIntent
  targetBodyTargets: readonly Extract<PrimitiveRef, { kind: 'body' }>[]
  options: {
    thickness: number
    side: 'oneSide' | 'symmetric'
  }
}

export interface FeatureDraftByKind {
  extrude: ExtrudeFeatureParameterDraft
  revolve: RevolveFeatureParameterDraft
  fillet: FilletFeatureParameterDraft
  plane: PlaneFeatureParameterDraft
  shell: ShellFeatureParameterDraft
  sweep: SweepFeatureParameterDraft
  loft: LoftFeatureParameterDraft
  chamfer: ChamferFeatureParameterDraft
  thicken: ThickenFeatureParameterDraft
}

export interface FeatureParametersByKind {
  extrude: ExtrudeFeatureParameters
  revolve: RevolveFeatureParameters
  fillet: FilletFeatureParameters
  plane: PlaneFeatureParameters
  shell: ShellFeatureParameters
  sweep: AdvancedSolidFeatureParameters
  loft: AdvancedSolidFeatureParameters
  chamfer: AdvancedSolidFeatureParameters
  thicken: AdvancedSolidFeatureParameters
}

export interface FeatureVersionByKind {
  extrude: ExtrudeFeatureSchemaVersion
  revolve: RevolveFeatureSchemaVersion
  fillet: FilletFeatureSchemaVersion
  plane: PlaneFeatureSchemaVersion
  shell: ShellFeatureSchemaVersion
  sweep: typeof ADVANCED_SOLID_FEATURE_SCHEMA_VERSION
  loft: typeof ADVANCED_SOLID_FEATURE_SCHEMA_VERSION
  chamfer: typeof ADVANCED_SOLID_FEATURE_SCHEMA_VERSION
  thicken: typeof ADVANCED_SOLID_FEATURE_SCHEMA_VERSION
}

export type FeatureDefinitionByKind<TKind extends AuthoredFeatureKind> =
  TKind extends 'sweep' | 'loft' | 'chamfer' | 'thicken'
    ? AdvancedSolidFeatureDefinition & { kind: TKind }
    : Extract<FeatureDefinition, { kind: TKind }>

export interface FeatureEditSessionStateBase {
  mode: 'create' | 'edit'
  featureId: FeatureId | null
  previewId: PreviewId
  status: 'idle' | 'previewing' | 'previewReady' | 'submitting'
  lastPreviewRevisionId: RevisionId | null
  lastCommittedRevisionId: RevisionId | null
  diagnostics: ModelingDiagnostic[]
}

export type FeatureEditSessionStateForKind<TKind extends AuthoredFeatureKind> = FeatureEditSessionStateBase & {
  featureType: TKind
  featureTypeVersion: FeatureVersionByKind[TKind]
  draft: FeatureDraftByKind[TKind]
}

export type ExtrudeFeatureEditSessionState = FeatureEditSessionStateForKind<'extrude'>
export type RevolveFeatureEditSessionState = FeatureEditSessionStateForKind<'revolve'>
export type FilletFeatureEditSessionState = FeatureEditSessionStateForKind<'fillet'>
export type PlaneFeatureEditSessionState = FeatureEditSessionStateForKind<'plane'>
export type ShellFeatureEditSessionState = FeatureEditSessionStateForKind<'shell'>
export type SweepFeatureEditSessionState = FeatureEditSessionStateForKind<'sweep'>
export type LoftFeatureEditSessionState = FeatureEditSessionStateForKind<'loft'>
export type ChamferFeatureEditSessionState = FeatureEditSessionStateForKind<'chamfer'>
export type ThickenFeatureEditSessionState = FeatureEditSessionStateForKind<'thicken'>

export type FeatureEditSessionState =
  | ExtrudeFeatureEditSessionState
  | RevolveFeatureEditSessionState
  | FilletFeatureEditSessionState
  | PlaneFeatureEditSessionState
  | ShellFeatureEditSessionState
  | SweepFeatureEditSessionState
  | LoftFeatureEditSessionState
  | ChamferFeatureEditSessionState
  | ThickenFeatureEditSessionState

export type FeatureDraftPatch = Record<string, unknown>

export interface FeatureAuthoringMetadata<TKind extends AuthoredFeatureKind = AuthoredFeatureKind> {
  kind: TKind
  name: string
  tooltip: string
  icon: ToolIconId
  toolId: TKind
  groupId: 'features'
  modes: readonly ToolbarMode[]
}

export interface CreateFeatureDraftInput {
  selectedTarget: PrimitiveRef | null
}

export interface FeatureAuthoringDefinition<TKind extends AuthoredFeatureKind = AuthoredFeatureKind> {
  metadata: FeatureAuthoringMetadata<TKind>
  featureTypeVersion: FeatureVersionByKind[TKind]
  selectionFilter: SelectionFilter
  advancedParticipants?: readonly AdvancedParticipantDescriptor[]
  operationIntent?: AdvancedOperationIntentDescriptor
  createDraft(input: CreateFeatureDraftInput): FeatureDraftByKind[TKind]
  hydrateDraft(feature: FeatureDefinitionByKind<TKind>): FeatureDraftByKind[TKind]
  applyPatch(draft: FeatureDraftByKind[TKind], patch: FeatureDraftPatch): FeatureDraftByKind[TKind]
  applySelection(draft: FeatureDraftByKind[TKind], target: PrimitiveRef): FeatureDraftByKind[TKind]
  getPrimarySelectionTarget(draft: FeatureDraftByKind[TKind]): PrimitiveRef | null
  getPreviewLabel(draft: FeatureDraftByKind[TKind], prefix: string): string
  getMissingInputsDiagnostics(input: {
    draft: FeatureDraftByKind[TKind]
    phase: 'preview' | 'commit'
  }): ModelingDiagnostic[]
  buildDefinition(draft: FeatureDraftByKind[TKind]): FeatureDefinitionByKind<TKind> | null
  getFormSchema(session: FeatureEditSessionStateForKind<TKind>): FeatureEditorFormSchema
}

export function isBooleanOperation(value: unknown): value is FeatureBooleanOperation {
  return value === 'newBody' || value === 'join' || value === 'cut' || value === 'intersect'
}

export function toBodyIds(value: unknown): readonly BodyId[] | null {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    return null
  }

  return value as readonly BodyId[]
}

export function toBooleanScope(patch: FeatureDraftPatch, current: FeatureBooleanScope): FeatureBooleanScope {
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

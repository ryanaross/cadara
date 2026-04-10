import type { FeatureAuthoringDefinition } from '@/domain/feature-authoring/definition'
import { isBooleanOperation, toBooleanScope } from '@/domain/feature-authoring/definition'
import { createSelectionFilterForRequirement, revolveSelectionFilter } from '@/domain/editor/schema'
import { REVOLVE_FEATURE_SCHEMA_VERSION } from '@/contracts/shared/versioning'
import { appendUniqueTarget, asBodyRef, asExtrudeProfileRef, asRevolveAxisRef, createMissingInputDiagnostic } from '@/domain/feature-authoring/features/shared'

export const revolveAuthoringDefinition = {
  metadata: {
    kind: 'revolve',
    name: 'Revolve',
    tooltip: 'Create a revolved solid or surface.',
    icon: 'revolve',
    toolId: 'revolve',
    groupId: 'features',
    modes: ['part'],
  },
  featureTypeVersion: REVOLVE_FEATURE_SCHEMA_VERSION,
  selectionFilter: revolveSelectionFilter,
  createDraft(input) {
    const profileTarget = asExtrudeProfileRef(input.selectedTarget)
    return {
      profileTargets: profileTarget ? [profileTarget] : [],
      axisTarget: asRevolveAxisRef(input.selectedTarget),
      startAngle: 0,
      angle: Math.PI * 2,
      operation: 'newBody',
      booleanScope: { kind: 'standalone' },
    }
  },
  hydrateDraft(feature) {
    return {
      profileTargets: [...feature.parameters.profiles],
      axisTarget: feature.parameters.axis,
      startAngle: feature.parameters.startAngle,
      angle: feature.parameters.extent.radians,
      operation: feature.parameters.operation,
      booleanScope: feature.parameters.booleanScope,
    }
  },
  applyPatch(draft, patch) {
    return {
      ...draft,
      profileTargets:
        patch.profileTargets === undefined && patch.profileTarget === undefined
          ? draft.profileTargets
          : Array.isArray(patch.profileTargets)
            ? patch.profileTargets.filter((entry): entry is typeof draft.profileTargets[number] => asExtrudeProfileRef(entry as Parameters<typeof asExtrudeProfileRef>[0]) !== null)
            : asExtrudeProfileRef(patch.profileTarget as Parameters<typeof asExtrudeProfileRef>[0])
              ? [patch.profileTarget as typeof draft.profileTargets[number]]
              : draft.profileTargets,
      axisTarget:
        patch.axisTarget === undefined ? draft.axisTarget : asRevolveAxisRef(patch.axisTarget as Parameters<typeof asRevolveAxisRef>[0]),
      startAngle: typeof patch.startAngle === 'number' ? patch.startAngle : draft.startAngle,
      angle: typeof patch.angle === 'number' ? patch.angle : draft.angle,
      operation: isBooleanOperation(patch.operation) ? patch.operation : draft.operation,
      booleanScope: toBooleanScope(patch, draft.booleanScope),
    }
  },
  applySelection(draft, target) {
    if (target.kind === 'region' || target.kind === 'face') {
      return {
        ...draft,
        profileTargets: appendUniqueTarget(draft.profileTargets, target),
      }
    }
    if (target.kind === 'edge' || target.kind === 'construction') {
      return this.applyPatch(draft, { axisTarget: target })
    }

    const bodyTarget = asBodyRef(target)
    return bodyTarget && draft.operation !== 'newBody'
      ? this.applyPatch(draft, { booleanTargetBodyId: bodyTarget.bodyId })
      : draft
  },
  getPrimarySelectionTarget(draft) {
    return draft.axisTarget ?? draft.profileTargets[0] ?? null
  },
  getPreviewLabel(draft, prefix) {
    if (draft.profileTargets.length === 0) {
      return 'Select one or more sketch regions or planar faces for revolve'
    }
    if (!draft.axisTarget) {
      return 'Select an edge or construction axis for revolve'
    }
    return `${prefix} revolve with explicit profile and axis`
  },
  getMissingInputsDiagnostics(input) {
    return [createMissingInputDiagnostic({
      feature: 'revolve',
      phase: input.phase,
      suffix: 'references',
      message: 'Revolve preview requires both a profile and an axis reference.',
    })]
  },
  buildDefinition(draft) {
    return draft.profileTargets.length > 0 && draft.axisTarget
      ? {
          kind: 'revolve',
          featureTypeVersion: REVOLVE_FEATURE_SCHEMA_VERSION,
          parameters: {
            profiles: draft.profileTargets as readonly [typeof draft.profileTargets[number], ...typeof draft.profileTargets[number][]],
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
          },
        }
      : null
  },
  getFormSchema(session) {
    return {
      sections: [
        {
          id: 'references',
          title: 'References',
          fields: [
            {
              kind: 'referenceCollection',
              id: 'revolve-profile',
              label: 'Profile targets',
              value: session.draft.profileTargets,
              emptyLabel: 'None selected',
              helper: 'Accepted targets: derived sketch regions or planar faces.',
              error: session.draft.profileTargets.length > 0 ? null : { message: 'Select at least one profile target.' },
              picker: {
                mode: 'appendUnique',
                allowsMultiple: true,
                selectionFilter: createSelectionFilterForRequirement(revolveSelectionFilter, 'revolve-profile', 'Revolve profile'),
                itemLabel: 'Profile',
              },
              patch: { patchKey: 'profileTargets' },
            },
            {
              kind: 'referencePicker',
              id: 'revolve-axis',
              label: 'Axis target',
              value: session.draft.axisTarget,
              emptyLabel: 'None selected',
              helper: 'Accepted targets: one durable edge or one construction axis.',
              error: session.draft.axisTarget ? null : { message: 'Select a revolve axis.' },
              picker: {
                mode: 'replace',
                allowsMultiple: false,
                selectionFilter: createSelectionFilterForRequirement(revolveSelectionFilter, 'revolve-axis', 'Revolve axis'),
              },
              patch: { patchKey: 'axisTarget' },
            },
          ],
        },
        {
          id: 'parameters',
          title: 'Parameters',
          fields: [
            { kind: 'numeric', id: 'revolve-angle', label: 'Angle (degrees)', value: session.draft.angle * (180 / Math.PI), input: 'angleDegrees', step: 1, error: session.draft.angle > 0 ? null : { message: 'Angle must be greater than zero.' }, patch: { patchKey: 'angle' } },
            { kind: 'numeric', id: 'revolve-start-angle', label: 'Start Angle (degrees)', value: session.draft.startAngle * (180 / Math.PI), input: 'angleDegrees', step: 1, patch: { patchKey: 'startAngle' } },
            {
              kind: 'enum',
              id: 'revolve-operation',
              label: 'Operation',
              value: session.draft.operation,
              options: [
                { value: 'newBody', label: 'newBody' },
                { value: 'join', label: 'join' },
                { value: 'cut', label: 'cut' },
                { value: 'intersect', label: 'intersect' },
              ],
              patch: { patchKey: 'operation' },
            },
          ],
        },
        {
          id: 'diagnostics',
          title: 'Diagnostics',
          fields: [{ kind: 'diagnostics', id: 'revolve-diagnostics', label: 'Diagnostics', diagnostics: session.diagnostics }],
        },
      ],
    }
  },
} satisfies FeatureAuthoringDefinition<'revolve'>

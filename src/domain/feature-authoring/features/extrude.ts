import type { FeatureAuthoringDefinition } from '@/domain/feature-authoring/definition'
import { isBooleanOperation, toBooleanScope } from '@/domain/feature-authoring/definition'
import { createSelectionFilterForRequirement, extrudeSelectionFilter } from '@/domain/editor/schema'
import { EXTRUDE_FEATURE_SCHEMA_VERSION } from '@/contracts/shared/versioning'
import { asBodyRef, asExtrudeProfileRef, createMissingInputDiagnostic } from '@/domain/feature-authoring/features/shared'

export const extrudeAuthoringDefinition = {
  metadata: {
    kind: 'extrude',
    name: 'Extrude',
    tooltip: 'Create an extruded solid or surface.',
    icon: 'extrude',
    toolId: 'extrude',
    groupId: 'features',
    modes: ['part'],
  },
  featureTypeVersion: EXTRUDE_FEATURE_SCHEMA_VERSION,
  selectionFilter: extrudeSelectionFilter,
  createDraft(input) {
    return {
      profileTarget: asExtrudeProfileRef(input.selectedTarget),
      depth: 12,
      direction: 'oneSided',
      operation: 'newBody',
      booleanScope: { kind: 'standalone' },
    }
  },
  hydrateDraft(feature) {
    return {
      profileTarget: feature.parameters.profile,
      depth: feature.parameters.endExtent.distance,
      direction: feature.parameters.direction ?? 'oneSided',
      operation: feature.parameters.operation,
      booleanScope: feature.parameters.booleanScope,
    }
  },
  applyPatch(draft, patch) {
    return {
      ...draft,
      profileTarget:
        patch.profileTarget === undefined ? draft.profileTarget : asExtrudeProfileRef(patch.profileTarget as Parameters<typeof asExtrudeProfileRef>[0]),
      depth: typeof patch.depth === 'number' ? patch.depth : draft.depth,
      direction: patch.direction === 'oneSided' ? 'oneSided' : draft.direction,
      operation: isBooleanOperation(patch.operation) ? patch.operation : draft.operation,
      booleanScope: toBooleanScope(patch, draft.booleanScope),
    }
  },
  applySelection(draft, target) {
    if (target.kind === 'region' || target.kind === 'face') {
      return this.applyPatch(draft, { profileTarget: target })
    }

    const bodyTarget = asBodyRef(target)
    return bodyTarget && draft.operation !== 'newBody'
      ? this.applyPatch(draft, { booleanTargetBodyId: bodyTarget.bodyId })
      : draft
  },
  getPrimarySelectionTarget(draft) {
    return draft.profileTarget
  },
  getPreviewLabel(draft, prefix) {
    return draft.profileTarget
      ? `${prefix} extrude on ${draft.profileTarget.kind}`
      : 'Select a sketch region or planar face for extrude'
  },
  getMissingInputsDiagnostics(input) {
    return [createMissingInputDiagnostic({
      feature: 'extrude',
      phase: input.phase,
      suffix: 'profile',
      message: 'Select a derived sketch region or planar face before previewing extrude.',
    })]
  },
  buildDefinition(draft) {
    return draft.profileTarget
      ? {
          kind: 'extrude',
          featureTypeVersion: EXTRUDE_FEATURE_SCHEMA_VERSION,
          parameters: {
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
          fields: [{
            kind: 'referencePicker',
            id: 'extrude-profile',
            label: 'Profile target',
            value: session.draft.profileTarget,
            emptyLabel: 'None selected',
            helper: 'Accepted targets: one derived sketch region or one planar face.',
            error: session.draft.profileTarget ? null : { message: 'Select a profile target.' },
            picker: {
              mode: 'replace',
              allowsMultiple: false,
              selectionFilter: createSelectionFilterForRequirement(extrudeSelectionFilter, 'extrude-profile', 'Extrude profile'),
            },
            patch: { patchKey: 'profileTarget' },
          }],
        },
        {
          id: 'parameters',
          title: 'Parameters',
          fields: [
            {
              kind: 'numeric',
              id: 'extrude-depth',
              label: 'Depth',
              value: session.draft.depth,
              input: 'number',
              step: 0.1,
              error: session.draft.depth > 0 ? null : { message: 'Depth must be greater than zero.' },
              patch: { patchKey: 'depth' },
            },
            {
              kind: 'enum',
              id: 'extrude-operation',
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
          fields: [{ kind: 'diagnostics', id: 'extrude-diagnostics', label: 'Diagnostics', diagnostics: session.diagnostics }],
        },
      ],
    }
  },
} satisfies FeatureAuthoringDefinition<'extrude'>

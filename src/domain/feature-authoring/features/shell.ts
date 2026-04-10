import type { FeatureAuthoringDefinition } from '@/domain/feature-authoring/definition'
import { isBooleanOperation, toBooleanScope } from '@/domain/feature-authoring/definition'
import { createSelectionFilterForRequirement, shellSelectionFilter } from '@/domain/editor/schema'
import { SHELL_FEATURE_SCHEMA_VERSION } from '@/contracts/shared/versioning'
import { appendUniqueTarget, asBodyRef, asFaceRef, createMissingInputDiagnostic } from '@/domain/feature-authoring/features/shared'

export const shellAuthoringDefinition = {
  metadata: {
    kind: 'shell',
    name: 'Shell',
    tooltip: 'Hollow a solid body.',
    icon: 'shell',
    toolId: 'shell',
    groupId: 'features',
    modes: ['part'],
  },
  featureTypeVersion: SHELL_FEATURE_SCHEMA_VERSION,
  selectionFilter: shellSelectionFilter,
  createDraft(input) {
    const selectedFace = asFaceRef(input.selectedTarget)
    return {
      bodyTarget: asBodyRef(input.selectedTarget) ?? (selectedFace ? { kind: 'body', bodyId: selectedFace.bodyId } : null),
      faceTargets: selectedFace ? [selectedFace] : [],
      thickness: 1,
      operation: 'newBody',
      booleanScope: { kind: 'standalone' },
    }
  },
  hydrateDraft(feature) {
    return {
      bodyTarget: feature.parameters.bodyTarget,
      faceTargets: [...feature.parameters.faceTargets],
      thickness: feature.parameters.thickness,
      operation: feature.parameters.operation,
      booleanScope: feature.parameters.booleanScope,
    }
  },
  applyPatch(draft, patch) {
    return {
      ...draft,
      bodyTarget:
        patch.bodyTarget === undefined ? draft.bodyTarget : asBodyRef(patch.bodyTarget as Parameters<typeof asBodyRef>[0]),
      faceTargets:
        patch.faceTargets === undefined && patch.faceTarget === undefined
          ? draft.faceTargets
          : Array.isArray(patch.faceTargets)
            ? patch.faceTargets.filter((entry): entry is Extract<typeof draft.faceTargets[number], { kind: 'face' }> => entry?.kind === 'face')
            : asFaceRef(patch.faceTarget as Parameters<typeof asFaceRef>[0])
              ? [patch.faceTarget as typeof draft.faceTargets[number]]
              : draft.faceTargets,
      thickness: typeof patch.thickness === 'number' ? patch.thickness : draft.thickness,
      operation: isBooleanOperation(patch.operation) ? patch.operation : draft.operation,
      booleanScope: toBooleanScope(patch, draft.booleanScope),
    }
  },
  applySelection(draft, target) {
    if (target.kind === 'body') {
      return this.applyPatch(draft, {
        bodyTarget: target,
        booleanTargetBodyId: draft.operation === 'newBody' ? undefined : target.bodyId,
      })
    }

    if (target.kind === 'face') {
      return {
        ...draft,
        bodyTarget: draft.bodyTarget ?? { kind: 'body', bodyId: target.bodyId },
        faceTargets: appendUniqueTarget(draft.faceTargets, target),
      }
    }

    return draft
  },
  getPrimarySelectionTarget(draft) {
    return draft.faceTargets[0] ?? draft.bodyTarget
  },
  getPreviewLabel(draft, prefix) {
    if (!draft.bodyTarget) {
      return 'Select a body to shell'
    }
    if (draft.faceTargets.length === 0) {
      return 'Select one or more removable faces for shell'
    }
    return `${prefix} shell on ${draft.bodyTarget.bodyId}`
  },
  getMissingInputsDiagnostics(input) {
    return [createMissingInputDiagnostic({
      feature: 'shell',
      phase: input.phase,
      suffix: 'shell-inputs',
      message: 'Shell preview requires one body and at least one removable face.',
    })]
  },
  buildDefinition(draft) {
    return draft.bodyTarget && draft.faceTargets.length > 0
      ? {
          kind: 'shell',
          featureTypeVersion: SHELL_FEATURE_SCHEMA_VERSION,
          parameters: {
            bodyTarget: draft.bodyTarget,
            faceTargets: draft.faceTargets,
            thickness: draft.thickness,
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
              kind: 'referencePicker',
              id: 'shell-body',
              label: 'Source body',
              value: session.draft.bodyTarget,
              emptyLabel: 'None selected',
              helper: 'Shell requires one explicit source body.',
              error: session.draft.bodyTarget ? null : { message: 'Select a source body.' },
              picker: {
                mode: 'replace',
                allowsMultiple: false,
                selectionFilter: createSelectionFilterForRequirement(shellSelectionFilter, 'shell-body', 'Shell body'),
              },
              patch: { patchKey: 'bodyTarget' },
            },
            {
              kind: 'referenceCollection',
              id: 'shell-faces',
              label: 'Removable faces',
              value: session.draft.faceTargets,
              emptyLabel: 'None selected',
              helper: 'The draft preserves each removable face explicitly.',
              error: session.draft.faceTargets.length > 0 ? null : { message: 'Select at least one removable face.' },
              picker: {
                mode: 'appendUnique',
                allowsMultiple: true,
                selectionFilter: createSelectionFilterForRequirement(shellSelectionFilter, 'shell-face', 'Shell faces'),
                itemLabel: 'Face',
              },
              patch: { patchKey: 'faceTargets' },
            },
          ],
        },
        {
          id: 'parameters',
          title: 'Parameters',
          fields: [
            { kind: 'numeric', id: 'shell-thickness', label: 'Thickness', value: session.draft.thickness, input: 'number', step: 0.1, error: session.draft.thickness > 0 ? null : { message: 'Thickness must be greater than zero.' }, patch: { patchKey: 'thickness' } },
            {
              kind: 'enum',
              id: 'shell-operation',
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
          fields: [{ kind: 'diagnostics', id: 'shell-diagnostics', label: 'Diagnostics', diagnostics: session.diagnostics }],
        },
      ],
    }
  },
} satisfies FeatureAuthoringDefinition<'shell'>

import type { FeatureEditorFormField, FeatureEditorPatch } from '@/domain/feature-authoring/form-schema'

export function createFeatureEditorFieldPatch(
  field: Extract<FeatureEditorFormField, { kind: 'numeric' | 'enum' | 'referencePicker' | 'referenceCollection' }>,
  value: unknown,
): FeatureEditorPatch {
  return {
    [field.patch.patchKey]: field.kind === 'numeric' && field.input === 'angleDegrees' && typeof value === 'number'
      ? value * (Math.PI / 180)
      : value,
  }
}

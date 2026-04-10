import type { FeatureEditorFormField, FeatureEditorPatch } from '@/domain/feature-authoring/form-schema'
import { primitiveRefEquals, type PrimitiveRef } from '@/domain/editor/schema'

type FeatureEditorPatchableField = Extract<FeatureEditorFormField, { kind: 'numeric' | 'enum' | 'referencePicker' | 'referenceCollection' }>
type FeatureEditorReferenceField = Extract<FeatureEditorFormField, { kind: 'referencePicker' | 'referenceCollection' }>

export function createFeatureEditorFieldPatch(
  field: FeatureEditorPatchableField,
  value: unknown,
): FeatureEditorPatch {
  return {
    [field.patch.patchKey]: field.kind === 'numeric' && field.input === 'angleDegrees' && typeof value === 'number'
      ? value * (Math.PI / 180)
      : value,
  }
}

function getReferenceArray(field: FeatureEditorReferenceField) {
  return field.kind === 'referenceCollection'
    ? field.value
    : field.value
      ? [field.value]
      : []
}

export function createFeatureEditorReferenceSelectionPatch(
  field: FeatureEditorReferenceField,
  target: PrimitiveRef,
): FeatureEditorPatch {
  if (!field.picker.allowsMultiple) {
    return createFeatureEditorFieldPatch(field, target)
  }

  if (field.picker.mode === 'replace') {
    return createFeatureEditorFieldPatch(field, [target])
  }

  const current = getReferenceArray(field)
  const next = current.some((entry) => primitiveRefEquals(entry, target))
    ? current
    : [...current, target]

  return createFeatureEditorFieldPatch(field, next)
}

export function createFeatureEditorClearReferencePatch(field: FeatureEditorReferenceField): FeatureEditorPatch {
  return createFeatureEditorFieldPatch(field, field.picker.allowsMultiple ? [] : null)
}

export function createFeatureEditorRemoveReferenceItemPatch(
  field: FeatureEditorReferenceField,
  target: PrimitiveRef,
): FeatureEditorPatch {
  const next = getReferenceArray(field).filter((entry) => !primitiveRefEquals(entry, target))
  return createFeatureEditorFieldPatch(field, next)
}

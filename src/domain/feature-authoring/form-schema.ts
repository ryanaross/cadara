import type { ModelingDiagnostic } from '@/contracts/modeling/schema'
import type { PrimitiveRef, SelectionFilter } from '@/domain/editor/schema'

export type FeatureEditorPatch = Record<string, unknown>

export interface FeatureEditorPatchBinding {
  patchKey: string
}

export interface FeatureEditorFormSchema {
  sections: readonly FeatureEditorFormSection[]
}

export interface FeatureEditorFormSection {
  id: string
  title: string
  fields: readonly FeatureEditorFormField[]
}

export type FeatureEditorFormField =
  | FeatureNumericField
  | FeatureEnumField
  | FeatureReferencePickerField
  | FeatureReferenceCollectionField
  | FeatureSummaryField
  | FeatureDiagnosticsField
  | FeatureCustomField

export interface FeatureFormFieldBase {
  id: string
  label: string
  helper?: string
  hidden?: boolean
  disabled?: boolean
}

export interface FeatureNumericField extends FeatureFormFieldBase {
  kind: 'numeric'
  value: number
  input: 'number' | 'angleDegrees'
  step?: number
  patch: FeatureEditorPatchBinding
}

export interface FeatureEnumField extends FeatureFormFieldBase {
  kind: 'enum'
  value: string
  options: readonly FeatureEnumFieldOption[]
  patch: FeatureEditorPatchBinding
}

export interface FeatureEnumFieldOption {
  value: string
  label: string
}

export interface FeatureReferencePickerField extends FeatureFormFieldBase {
  kind: 'referencePicker'
  value: PrimitiveRef | null
  emptyLabel: string
  picker: FeatureReferencePickerBehavior
  patch: FeatureEditorPatchBinding
}

export interface FeatureReferenceCollectionField extends FeatureFormFieldBase {
  kind: 'referenceCollection'
  value: readonly PrimitiveRef[]
  emptyLabel: string
  picker: FeatureReferencePickerBehavior
  patch: FeatureEditorPatchBinding
}

export interface FeatureReferencePickerBehavior {
  mode: 'replace' | 'appendUnique'
  selectionFilter: SelectionFilter
}

export interface FeatureSummaryField extends FeatureFormFieldBase {
  kind: 'summary'
  value: string
}

export interface FeatureDiagnosticsField extends FeatureFormFieldBase {
  kind: 'diagnostics'
  diagnostics: readonly ModelingDiagnostic[]
}

export interface FeatureCustomField extends FeatureFormFieldBase {
  kind: 'custom'
  rendererId: string
  payload: unknown
}

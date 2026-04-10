import { Check, CircleSlash, Layers3, X } from 'lucide-react'

import { Input } from '@/components/ui/input'
import type { FeatureSnapshotRecord, ModelingDiagnostic } from '@/contracts/modeling/schema'
import { getPrimitiveRefLabel, type PrimitiveRef } from '@/domain/editor/schema'
import { getFeatureEditorFormSchema } from '@/domain/editor/feature-editing'
import {
  createFeatureEditorClearReferencePatch,
  createFeatureEditorFieldPatch,
  createFeatureEditorRemoveReferenceItemPatch,
} from '@/domain/feature-authoring/form-events'
import type { FeatureEditorFormField, FeatureNumericField } from '@/domain/feature-authoring/form-schema'
import { useEditorState } from '@/hooks/use-editor-state'

interface FeatureInspectorProps {
  featureSnapshot: FeatureSnapshotRecord | null
  onPatch: (patch: Record<string, unknown>) => void
  onCommit: () => void
  onCancel: () => void
}

function DiagnosticsList({ diagnostics }: { diagnostics: readonly ModelingDiagnostic[] }) {
  if (diagnostics.length === 0) {
    return (
      <p className="text-xs text-[var(--cad-muted-foreground)]">
        No diagnostics reported for the current preview.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {diagnostics.map((diagnostic, index) => (
        <div
          key={`${diagnostic.code}-${diagnostic.message}-${index}`}
          className="rounded-lg border border-[var(--cad-border)] bg-[rgba(12,16,22,0.8)] px-3 py-2"
        >
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--cad-muted)]">
            {diagnostic.severity}
          </p>
          <p className="mt-1 text-sm text-[var(--cad-foreground)]">{diagnostic.message}</p>
          {diagnostic.detail ? (
            <p className="mt-1 text-xs text-[var(--cad-muted-foreground)]">
              {formatDiagnosticDetail(diagnostic)}
            </p>
          ) : null}
          <p className="mt-1 text-xs text-[var(--cad-muted-foreground)]">{diagnostic.code}</p>
        </div>
      ))}
    </div>
  )
}

function formatDiagnosticDetail(diagnostic: ModelingDiagnostic) {
  const detail = diagnostic.detail

  if (!detail) {
    return null
  }

  switch (detail.kind) {
    case 'invalidReference':
      return `Broken ref ${getPrimitiveRefLabel(detail.reference.target)}: ${detail.reference.reason}`
    case 'revisionConflict':
      return `Expected ${detail.expectedRevisionId}, current ${detail.actualRevisionId}`
    case 'stalePreview':
      return `Preview ${detail.previewId} used ${detail.requestedRevisionId}; current is ${detail.currentRevisionId}`
    case 'rebuildFailure':
      return `Affected features: ${detail.affectedFeatureIds.join(', ') || 'none'}`
  }
}

function renderReference(value: unknown) {
  return value && typeof value === 'object' && 'kind' in value
    ? getPrimitiveRefLabel(value as Parameters<typeof getPrimitiveRefLabel>[0])
    : 'None selected'
}

function fieldBorderClass(field: Pick<FeatureEditorFormField, 'error'>, isActive = false) {
  if (field.error) {
    return 'border-red-500 text-red-100'
  }

  if (isActive) {
    return 'border-[var(--cad-accent)] text-[var(--cad-accent)]'
  }

  return 'border-[var(--cad-border)] text-[var(--cad-foreground)]'
}

function FieldMessage(props: { helper?: string; error?: { message: string } | null }) {
  if (props.error) {
    return <p className="text-xs text-red-300">{props.error.message}</p>
  }

  return props.helper ? (
    <p className="text-xs text-[var(--cad-muted-foreground)]">{props.helper}</p>
  ) : null
}

function NumericField(props: {
  field: FeatureNumericField
  onPatch: (patch: Record<string, unknown>) => void
}) {
  return (
    <section className="space-y-2">
      <label className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--cad-muted)]" htmlFor={props.field.id}>
        {props.field.label}
      </label>
      <Input
        id={props.field.id}
        type="number"
        value={Number.isFinite(props.field.value) ? props.field.value : 0}
        step={props.field.step ?? 0.1}
        disabled={props.field.disabled}
        onChange={(event) => props.onPatch(createFeatureEditorFieldPatch(props.field, Number(event.target.value)))}
        aria-invalid={props.field.error ? true : undefined}
        className={`h-10 rounded-md bg-[rgba(12,16,22,0.8)] ${fieldBorderClass(props.field)}`}
      />
      <FieldMessage helper={props.field.helper} error={props.field.error} />
    </section>
  )
}

function EnumField(props: {
  field: Extract<FeatureEditorFormField, { kind: 'enum' }>
  onPatch: (patch: Record<string, unknown>) => void
}) {
  return (
    <section className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--cad-muted)]">
        {props.field.label}
      </p>
      <div className="grid grid-cols-4 gap-2">
        {props.field.options.map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={props.field.disabled}
            onClick={() => props.onPatch(createFeatureEditorFieldPatch(props.field, option.value))}
            className={`rounded-md border px-2 py-2 text-xs font-medium transition ${
              props.field.value === option.value
                ? 'border-[var(--cad-border-strong)] bg-[var(--cad-surface-elevated)] text-[var(--cad-foreground)]'
                : 'border-[var(--cad-border)] bg-[rgba(12,16,22,0.8)] text-[var(--cad-muted-foreground)] hover:border-[var(--cad-border-strong)]'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <FieldMessage helper={props.field.helper} error={props.field.error} />
    </section>
  )
}

function ReferenceCard(props: {
  title: string
  value: string
  helper?: string
  error?: { message: string } | null
  isActive?: boolean
  onActivate?: () => void
  onClear?: () => void
  clearDisabled?: boolean
}) {
  const className = `w-full rounded-md border bg-[rgba(12,16,22,0.8)] px-3 py-3 text-left transition ${fieldBorderClass({ error: props.error }, props.isActive)}`
  const labelContent = (
    <>
      <p className="text-xs text-[var(--cad-muted-foreground)]">{props.title}</p>
      <p className={`mt-1 text-sm ${props.error ? 'text-red-100' : props.isActive ? 'text-[var(--cad-accent)]' : 'text-[var(--cad-foreground)]'}`}>
        {props.value}
      </p>
    </>
  )

  if (props.onActivate) {
    return (
      <div className={className}>
        <div className="flex items-start justify-between gap-2">
          <button type="button" onClick={props.onActivate} className="min-w-0 flex-1 text-left" aria-pressed={props.isActive}>
            {labelContent}
          </button>
          {props.onClear ? (
            <button
              type="button"
              onClick={props.onClear}
              disabled={props.clearDisabled}
              aria-label={`Clear ${props.title}`}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[var(--cad-border)] text-[var(--cad-muted-foreground)] transition hover:border-red-400 hover:text-red-200 disabled:pointer-events-none disabled:opacity-40"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
        <div className="mt-2">
          <FieldMessage helper={props.helper} error={props.error} />
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="flex items-start justify-between gap-2">
        <div>{labelContent}</div>
        {props.onClear ? (
          <button
            type="button"
            onClick={props.onClear}
            disabled={props.clearDisabled}
            aria-label={`Clear ${props.title}`}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[var(--cad-border)] text-[var(--cad-muted-foreground)] transition hover:border-red-400 hover:text-red-200 disabled:pointer-events-none disabled:opacity-40"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      <div className="mt-2">
        <FieldMessage helper={props.helper} error={props.error} />
      </div>
    </div>
  )
}

function ReferenceCollectionCard(props: {
  field: Extract<FeatureEditorFormField, { kind: 'referenceCollection' }>
  isActive: boolean
  onActivate: () => void
  onPatch: (patch: Record<string, unknown>) => void
}) {
  const hasSelection = props.field.value.length > 0

  return (
    <div
      className={`rounded-md border bg-[rgba(12,16,22,0.8)] px-3 py-3 ${fieldBorderClass(props.field, props.isActive)}`}
    >
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={props.onActivate}
          className="min-w-0 flex-1 text-left"
          aria-pressed={props.isActive}
        >
          <p className="text-xs text-[var(--cad-muted-foreground)]">{props.field.label}</p>
          <p className={`mt-1 text-sm ${props.isActive ? 'text-[var(--cad-accent)]' : 'text-[var(--cad-foreground)]'}`}>
            {hasSelection ? `${props.field.value.length} selected` : props.field.emptyLabel}
          </p>
        </button>
        <button
          type="button"
          onClick={() => props.onPatch(createFeatureEditorClearReferencePatch(props.field))}
          disabled={!hasSelection}
          aria-label={`Clear ${props.field.label}`}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[var(--cad-border)] text-[var(--cad-muted-foreground)] transition hover:border-red-400 hover:text-red-200 disabled:pointer-events-none disabled:opacity-40"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {hasSelection ? (
        <div className="mt-3 space-y-2">
          {props.field.value.map((target) => (
            <div
              key={getPrimitiveRefLabel(target)}
              className="flex items-center justify-between gap-2 rounded-md border border-[var(--cad-border)] bg-[rgba(7,10,14,0.72)] px-2 py-2"
            >
              <span className="min-w-0 truncate text-xs text-[var(--cad-foreground)]">
                {props.field.picker.itemLabel ?? props.field.label}: {getPrimitiveRefLabel(target)}
              </span>
              {props.field.picker.allowsMultiple ? (
                <button
                  type="button"
                  onClick={() => props.onPatch(createFeatureEditorRemoveReferenceItemPatch(props.field, target as PrimitiveRef))}
                  aria-label={`Remove ${getPrimitiveRefLabel(target)}`}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[var(--cad-border)] text-[var(--cad-muted-foreground)] transition hover:border-red-400 hover:text-red-200"
                >
                  <X className="h-3 w-3" />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
      <div className="mt-2">
        <FieldMessage helper={props.field.helper} error={props.field.error} />
      </div>
    </div>
  )
}

function FeatureFormFieldRenderer(props: {
  field: FeatureEditorFormField
  activeReferencePickerFieldId: string | null
  onReferencePickerActivate: (fieldId: string) => void
  onPatch: (patch: Record<string, unknown>) => void
}) {
  if (props.field.hidden) {
    return null
  }

  switch (props.field.kind) {
    case 'numeric':
      return <NumericField field={props.field} onPatch={props.onPatch} />
    case 'enum':
      return <EnumField field={props.field} onPatch={props.onPatch} />
    case 'referencePicker': {
      const field = props.field
      return (
        <ReferenceCard
          title={field.label}
          value={renderReference(field.value) || field.emptyLabel}
          helper={field.helper}
          error={field.error}
          isActive={props.activeReferencePickerFieldId === field.id}
          onActivate={() => props.onReferencePickerActivate(field.id)}
          onClear={() => props.onPatch(createFeatureEditorClearReferencePatch(field))}
          clearDisabled={!field.value}
        />
      )
    }
    case 'referenceCollection':
      return (
        <ReferenceCollectionCard
          field={props.field}
          isActive={props.activeReferencePickerFieldId === props.field.id}
          onActivate={() => props.onReferencePickerActivate(props.field.id)}
          onPatch={props.onPatch}
        />
      )
    case 'summary':
      return <ReferenceCard title={props.field.label} value={props.field.value} helper={props.field.helper} />
    case 'diagnostics':
      return <DiagnosticsList diagnostics={props.field.diagnostics} />
    case 'custom':
      return (
        <ReferenceCard
          title={props.field.label}
          value={`Custom renderer: ${props.field.rendererId}`}
          helper={props.field.helper}
        />
      )
  }
}

export function FeatureInspector({
  featureSnapshot,
  onPatch,
  onCommit,
  onCancel,
}: FeatureInspectorProps) {
  const {
    state: { activeEditSession, activeReferencePickerFieldId },
    dispatch,
  } = useEditorState()

  if (!activeEditSession) {
    return null
  }

  const title =
    activeEditSession.mode === 'edit'
      ? featureSnapshot?.label ?? activeEditSession.featureId ?? `Edit ${activeEditSession.featureType}`
      : `Create ${activeEditSession.featureType[0]!.toUpperCase()}${activeEditSession.featureType.slice(1)}`
  const formSchema = getFeatureEditorFormSchema(activeEditSession)

  return (
    <aside className="flex w-[320px] min-w-[320px] flex-col border-l border-[var(--cad-border)] bg-[linear-gradient(180deg,_rgba(16,21,29,0.98),_rgba(10,14,20,0.98))]">
      <header className="border-b border-[var(--cad-border)] px-4 py-4">
        <div className="flex items-center gap-2 text-[var(--cad-accent)]">
          <Layers3 className="h-4 w-4" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--cad-muted)]">
            Feature Session
          </p>
        </div>
        <p className="mt-2 text-sm font-medium text-[var(--cad-foreground)]">{title}</p>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
        {formSchema.sections.map((section) => (
          <section key={section.id} className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--cad-muted)]">
              {section.title}
            </p>
            {section.fields.map((field) => (
              <FeatureFormFieldRenderer
                key={field.id}
                field={field}
                activeReferencePickerFieldId={activeReferencePickerFieldId}
                onReferencePickerActivate={(fieldId) => dispatch({ type: 'form.referencePickerActivated', fieldId })}
                onPatch={onPatch}
              />
            ))}
          </section>
        ))}
      </div>

      <footer className="grid grid-cols-2 gap-2 border-t border-[var(--cad-border)] px-4 py-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center justify-center gap-2 rounded-md border border-[var(--cad-border)] bg-[rgba(12,16,22,0.8)] px-3 py-2 text-sm text-[var(--cad-muted-foreground)] transition hover:border-[var(--cad-border-strong)]"
        >
          <CircleSlash className="h-4 w-4" />
          Cancel
        </button>
        <button
          type="button"
          onClick={onCommit}
          className="flex items-center justify-center gap-2 rounded-md border border-[var(--cad-border-strong)] bg-[var(--cad-surface-elevated)] px-3 py-2 text-sm text-[var(--cad-foreground)] transition hover:brightness-110"
        >
          <Check className="h-4 w-4" />
          Commit
        </button>
      </footer>
    </aside>
  )
}

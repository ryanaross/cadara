import { Check, CircleSlash, Layers3 } from 'lucide-react'

import { Input } from '@/components/ui/input'
import type { FeatureSnapshotRecord, ModelingDiagnostic } from '@/contracts/modeling/schema'
import { getPrimitiveRefLabel } from '@/domain/editor/schema'
import { getFeatureEditorFormSchema } from '@/domain/editor/feature-editing'
import { createFeatureEditorFieldPatch } from '@/domain/feature-authoring/form-events'
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
      {diagnostics.map((diagnostic) => (
        <div
          key={`${diagnostic.code}-${diagnostic.message}`}
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
        className="h-10 rounded-md border-[var(--cad-border)] bg-[rgba(12,16,22,0.8)]"
      />
      {props.field.helper ? (
        <p className="text-xs text-[var(--cad-muted-foreground)]">{props.field.helper}</p>
      ) : null}
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
      {props.field.helper ? (
        <p className="text-xs text-[var(--cad-muted-foreground)]">{props.field.helper}</p>
      ) : null}
    </section>
  )
}

function ReferenceCard(props: {
  title: string
  value: string
  helper?: string
}) {
  return (
    <div className="rounded-md border border-[var(--cad-border)] bg-[rgba(12,16,22,0.8)] px-3 py-3">
      <p className="text-xs text-[var(--cad-muted-foreground)]">{props.title}</p>
      <p className="mt-1 text-sm text-[var(--cad-foreground)]">{props.value}</p>
      {props.helper ? (
        <p className="mt-2 text-xs text-[var(--cad-muted-foreground)]">{props.helper}</p>
      ) : null}
    </div>
  )
}

function FeatureFormFieldRenderer(props: {
  field: FeatureEditorFormField
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
    case 'referencePicker':
      return (
        <ReferenceCard
          title={props.field.label}
          value={renderReference(props.field.value) || props.field.emptyLabel}
          helper={props.field.helper}
        />
      )
    case 'referenceCollection':
      return (
        <ReferenceCard
          title={props.field.label}
          value={
            props.field.value.length > 0
              ? props.field.value.map(getPrimitiveRefLabel).join(', ')
              : props.field.emptyLabel
          }
          helper={props.field.helper}
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
    state: { activeEditSession },
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
        <p className="mt-1 text-xs text-[var(--cad-muted-foreground)]">
          Contract: `createFeature` / `updateFeature` + `evaluatePreview`
        </p>
        <p className="mt-1 text-xs text-[var(--cad-muted-foreground)]">
          Revision state:{' '}
          <span className="text-[var(--cad-foreground)]">
            {activeEditSession.lastPreviewRevisionId ?? activeEditSession.lastCommittedRevisionId ?? 'pending'}
          </span>
        </p>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
        {formSchema.sections.map((section) => (
          <section key={section.id} className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--cad-muted)]">
              {section.title}
            </p>
            {section.fields.map((field) => (
              <FeatureFormFieldRenderer key={field.id} field={field} onPatch={onPatch} />
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

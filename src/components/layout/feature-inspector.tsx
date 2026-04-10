import { Check, CircleSlash, Layers3 } from 'lucide-react'

import { Input } from '@/components/ui/input'
import type { FeatureBooleanOperation, FeatureSnapshotRecord, ModelingDiagnostic } from '@/contracts/modeling/schema'
import { getPrimitiveRefLabel } from '@/domain/editor/schema'
import { useEditorState } from '@/hooks/use-editor-state'

interface FeatureInspectorProps {
  featureSnapshot: FeatureSnapshotRecord | null
  onPatch: (patch: Record<string, unknown>) => void
  onCommit: () => void
  onCancel: () => void
}

function DiagnosticsList({ diagnostics }: { diagnostics: ModelingDiagnostic[] }) {
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
  id: string
  label: string
  value: number
  step?: number
  onChange: (value: number) => void
}) {
  return (
    <section className="space-y-2">
      <label className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--cad-muted)]" htmlFor={props.id}>
        {props.label}
      </label>
      <Input
        id={props.id}
        type="number"
        value={Number.isFinite(props.value) ? props.value : 0}
        step={props.step ?? 0.1}
        onChange={(event) => props.onChange(Number(event.target.value))}
        className="h-10 rounded-md border-[var(--cad-border)] bg-[rgba(12,16,22,0.8)]"
      />
    </section>
  )
}

function radiansToDegrees(value: number) {
  return value * (180 / Math.PI)
}

function degreesToRadians(value: number) {
  return value * (Math.PI / 180)
}

function OperationButtons(props: {
  value: FeatureBooleanOperation
  onChange: (value: FeatureBooleanOperation) => void
}) {
  return (
    <section className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--cad-muted)]">
        Operation
      </p>
      <div className="grid grid-cols-4 gap-2">
        {(['newBody', 'join', 'cut', 'intersect'] as const).map((operation) => (
          <button
            key={operation}
            type="button"
            onClick={() => props.onChange(operation)}
            className={`rounded-md border px-2 py-2 text-xs font-medium transition ${
              props.value === operation
                ? 'border-[var(--cad-border-strong)] bg-[var(--cad-surface-elevated)] text-[var(--cad-foreground)]'
                : 'border-[var(--cad-border)] bg-[rgba(12,16,22,0.8)] text-[var(--cad-muted-foreground)] hover:border-[var(--cad-border-strong)]'
            }`}
          >
            {operation}
          </button>
        ))}
      </div>
    </section>
  )
}

function ReferenceCard(props: {
  title: string
  value: string
  helper: string
}) {
  return (
    <div className="rounded-md border border-[var(--cad-border)] bg-[rgba(12,16,22,0.8)] px-3 py-3">
      <p className="text-xs text-[var(--cad-muted-foreground)]">{props.title}</p>
      <p className="mt-1 text-sm text-[var(--cad-foreground)]">{props.value}</p>
      <p className="mt-2 text-xs text-[var(--cad-muted-foreground)]">{props.helper}</p>
    </div>
  )
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
        <section className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--cad-muted)]">
            References
          </p>
          {activeEditSession.featureType === 'extrude' ? (
            <ReferenceCard
              title="Profile target"
              value={renderReference(activeEditSession.draft.profileTarget)}
              helper="Accepted targets: one derived sketch region or one planar face."
            />
          ) : null}
          {activeEditSession.featureType === 'revolve' ? (
            <>
              <ReferenceCard
                title="Profile target"
                value={renderReference(activeEditSession.draft.profileTarget)}
                helper="Accepted targets: one derived sketch region or one planar face."
              />
              <ReferenceCard
                title="Axis target"
                value={renderReference(activeEditSession.draft.axisTarget)}
                helper="Accepted targets: one durable edge or one construction axis."
              />
            </>
          ) : null}
          {activeEditSession.featureType === 'fillet' ? (
            <ReferenceCard
              title="Edge targets"
              value={
                activeEditSession.draft.edgeTargets.length > 0
                  ? activeEditSession.draft.edgeTargets.map(getPrimitiveRefLabel).join(', ')
                  : 'None selected'
              }
              helper="Each selected durable edge is preserved explicitly in the draft."
            />
          ) : null}
          {activeEditSession.featureType === 'plane' ? (
            <ReferenceCard
              title="Plane reference"
              value={renderReference(activeEditSession.draft.referenceTarget)}
              helper="Accepted targets: one construction plane or one planar face."
            />
          ) : null}
          {activeEditSession.featureType === 'shell' ? (
            <>
              <ReferenceCard
                title="Source body"
                value={renderReference(activeEditSession.draft.bodyTarget)}
                helper="Shell requires one explicit source body."
              />
              <ReferenceCard
                title="Removable faces"
                value={
                  activeEditSession.draft.faceTargets.length > 0
                    ? activeEditSession.draft.faceTargets.map(getPrimitiveRefLabel).join(', ')
                    : 'None selected'
                }
                helper="The draft preserves each removable face explicitly."
              />
            </>
          ) : null}
        </section>

        {activeEditSession.featureType === 'extrude' ? (
          <>
            <NumericField
              id="extrude-depth"
              label="Depth"
              value={activeEditSession.draft.depth}
              onChange={(value) => onPatch({ depth: value })}
            />
            <OperationButtons
              value={activeEditSession.draft.operation}
              onChange={(value) => onPatch({ operation: value })}
            />
          </>
        ) : null}

        {activeEditSession.featureType === 'revolve' ? (
          <>
            <NumericField
              id="revolve-angle"
              label="Angle (degrees)"
              value={radiansToDegrees(activeEditSession.draft.angle)}
              onChange={(value) => onPatch({ angle: degreesToRadians(value) })}
            />
            <NumericField
              id="revolve-start-angle"
              label="Start Angle (degrees)"
              value={radiansToDegrees(activeEditSession.draft.startAngle)}
              onChange={(value) => onPatch({ startAngle: degreesToRadians(value) })}
            />
            <OperationButtons
              value={activeEditSession.draft.operation}
              onChange={(value) => onPatch({ operation: value })}
            />
          </>
        ) : null}

        {activeEditSession.featureType === 'fillet' ? (
          <NumericField
            id="fillet-radius"
            label="Radius"
            value={activeEditSession.draft.radius}
            onChange={(value) => onPatch({ radius: value })}
          />
        ) : null}

        {activeEditSession.featureType === 'shell' ? (
          <>
            <NumericField
              id="shell-thickness"
              label="Thickness"
              value={activeEditSession.draft.thickness}
              onChange={(value) => onPatch({ thickness: value })}
            />
            <OperationButtons
              value={activeEditSession.draft.operation}
              onChange={(value) => onPatch({ operation: value })}
            />
          </>
        ) : null}

        <section className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--cad-muted)]">
            Diagnostics
          </p>
          <DiagnosticsList diagnostics={activeEditSession.diagnostics} />
        </section>
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

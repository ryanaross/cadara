import { Check, CircleSlash, Layers3 } from 'lucide-react'

import type { FeatureSnapshotRecord, ModelingDiagnostic } from '@/domain/modeling/schema'
import type { FeatureBooleanOperation } from '@/domain/modeling/schema'
import { getPrimitiveRefLabel } from '@/domain/editor/schema'
import { useEditorState } from '@/hooks/use-editor-state'

interface FeatureInspectorProps {
  featureSnapshot: FeatureSnapshotRecord | null
  onDepthChange: (value: number) => void
  onOperationChange: (value: FeatureBooleanOperation) => void
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

export function FeatureInspector({
  featureSnapshot,
  onDepthChange,
  onOperationChange,
  onCommit,
  onCancel,
}: FeatureInspectorProps) {
  const {
    state: { activeEditSession },
  } = useEditorState()

  if (!activeEditSession || activeEditSession.featureType !== 'extrude') {
    return null
  }

  const draft = activeEditSession.draft

  return (
    <aside className="flex w-[320px] min-w-[320px] flex-col border-l border-[var(--cad-border)] bg-[linear-gradient(180deg,_rgba(16,21,29,0.98),_rgba(10,14,20,0.98))]">
      <header className="border-b border-[var(--cad-border)] px-4 py-4">
        <div className="flex items-center gap-2 text-[var(--cad-accent)]">
          <Layers3 className="h-4 w-4" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--cad-muted)]">
            Feature Session
          </p>
        </div>
        <p className="mt-2 text-sm font-medium text-[var(--cad-foreground)]">
          {activeEditSession.mode === 'edit'
            ? featureSnapshot?.label ?? activeEditSession.featureId ?? 'Edit Extrude'
            : 'Create Extrude'}
        </p>
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
          <div className="rounded-lg border border-[var(--cad-border)] bg-[rgba(12,16,22,0.8)] px-3 py-3">
            <p className="text-xs text-[var(--cad-muted-foreground)]">Profile target</p>
            <p className="mt-1 text-sm text-[var(--cad-foreground)]">
              {draft.profileTarget
                ? `${draft.profileTarget.kind} / ${'primitiveId' in draft.profileTarget ? draft.profileTarget.primitiveId : 'sketchId' in draft.profileTarget ? draft.profileTarget.sketchId : 'selected'}`
                : 'No profile selected'}
            </p>
          </div>
        </section>

        <section className="space-y-2">
          <label className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--cad-muted)]" htmlFor="extrude-depth">
            Depth
          </label>
          <input
            id="extrude-depth"
            type="range"
            min="1"
            max="40"
            step="1"
            value={draft.depth}
            onChange={(event) => onDepthChange(Number(event.target.value))}
            className="w-full accent-[var(--cad-accent)]"
          />
          <div className="flex items-center justify-between text-xs text-[var(--cad-muted-foreground)]">
            <span>1 mm</span>
            <span className="text-[var(--cad-foreground)]">{draft.depth} mm</span>
            <span>40 mm</span>
          </div>
        </section>

        <section className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--cad-muted)]">
            Operation
          </p>
          <div className="grid grid-cols-3 gap-2">
            {(['newBody', 'add', 'remove'] as const).map((operation) => (
              <button
                key={operation}
                type="button"
                onClick={() => onOperationChange(operation)}
                className={`rounded-lg border px-2 py-2 text-xs font-medium transition ${
                  draft.operation === operation
                    ? 'border-[var(--cad-border-strong)] bg-[var(--cad-surface-elevated)] text-[var(--cad-foreground)]'
                    : 'border-[var(--cad-border)] bg-[rgba(12,16,22,0.8)] text-[var(--cad-muted-foreground)] hover:border-[var(--cad-border-strong)]'
                }`}
              >
                {operation}
              </button>
            ))}
          </div>
        </section>

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
          className="flex items-center justify-center gap-2 rounded-lg border border-[var(--cad-border)] bg-[rgba(12,16,22,0.8)] px-3 py-2 text-sm text-[var(--cad-muted-foreground)] transition hover:border-[var(--cad-border-strong)]"
        >
          <CircleSlash className="h-4 w-4" />
          Cancel
        </button>
        <button
          type="button"
          onClick={onCommit}
          className="flex items-center justify-center gap-2 rounded-lg border border-[var(--cad-border-strong)] bg-[var(--cad-surface-elevated)] px-3 py-2 text-sm text-[var(--cad-foreground)] transition hover:brightness-110"
        >
          <Check className="h-4 w-4" />
          Commit
        </button>
      </footer>
    </aside>
  )
}

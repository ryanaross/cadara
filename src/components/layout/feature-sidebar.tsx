import { Box, Component, Layers3, Workflow } from 'lucide-react'

import { ScrollArea } from '@/components/ui/scroll-area'
import type { PrimitiveRef } from '@/domain/editor/schema'
import {
  getPrimitiveRefKey,
  getPrimitiveRefLabel,
  selectionFilterAllowsTarget,
} from '@/domain/editor/schema'
import type { DocumentSnapshot, ModelingDiagnostic, ReferenceRecord } from '@/domain/modeling/schema'
import { useEditorState } from '@/hooks/use-editor-state'

interface FeatureSidebarProps {
  snapshot: DocumentSnapshot | null
  onSelectTarget: (target: PrimitiveRef) => void
}

const treeIconMap = {
  sketch: Workflow,
  feature: Layers3,
  part: Box,
  plane: Component,
} as const

function formatReferenceOwner(snapshot: DocumentSnapshot, featureId: string | null, sketchId: string | null) {
  if (featureId) {
    return snapshot.features.find((feature) => feature.featureId === featureId)?.label ?? featureId
  }

  if (sketchId) {
    return snapshot.sketches.find((sketch) => sketch.sketchId === sketchId)?.label ?? sketchId
  }

  return 'Document root'
}

function getReferenceStatus(reference: ReferenceRecord) {
  if (!reference.invalidation) {
    return null
  }

  return `${getPrimitiveRefLabel(reference.invalidation.target)} invalid: ${reference.invalidation.reason}`
}

function formatDocumentDiagnosticDetail(diagnostic: ModelingDiagnostic) {
  const detail = diagnostic.detail

  if (!detail) {
    return null
  }

  switch (detail.kind) {
    case 'invalidReference':
      return `Broken ref ${getPrimitiveRefLabel(detail.reference.target)} from ${
        detail.reference.sourceTarget ? getPrimitiveRefLabel(detail.reference.sourceTarget) : 'document state'
      }`
    case 'revisionConflict':
      return `Expected ${detail.expectedRevisionId}, current ${detail.actualRevisionId}`
    case 'stalePreview':
      return `Preview ${detail.previewId} requested ${detail.requestedRevisionId}, current ${detail.currentRevisionId}`
    case 'rebuildFailure':
      return `Affected features: ${detail.affectedFeatureIds.join(', ') || 'none'} | Targets: ${
        detail.affectedTargets.map((target) => getPrimitiveRefLabel(target)).join(', ') || 'none'
      }`
  }
}

export function FeatureSidebar({ snapshot, onSelectTarget }: FeatureSidebarProps) {
  const {
    state: { selection, selectionFilter, selectionCatalog, preview, activeEditSession, mode, sketchSession },
  } = useEditorState()

  const selectedLabels = selection.map((target) => getPrimitiveRefLabel(target))
  const activeFeatureLabel =
    activeEditSession === null
      ? 'No feature selected'
      : activeEditSession.mode === 'create'
        ? 'New extrude'
        : snapshot?.features.find((feature) => feature.featureId === activeEditSession.featureId)?.label ??
          activeEditSession.featureId

  return (
    <aside className="flex w-[360px] min-w-[360px] flex-col border-r border-[var(--cad-border)] bg-[linear-gradient(180deg,_rgba(17,21,28,0.96),_rgba(11,15,21,0.98))]">
      <section className="flex min-h-0 flex-1 flex-col border-b border-[var(--cad-border)]">
        <header className="border-b border-[var(--cad-border)] px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--cad-muted)]">
            Feature Tree
          </p>
          <p className="mt-1 text-sm text-[var(--cad-muted-foreground)]">
            Active mode: <span className="text-[var(--cad-foreground)]">{mode}</span>
          </p>
          <p className="mt-1 text-xs text-[var(--cad-muted-foreground)]">
            Filter: <span className="text-[var(--cad-foreground)]">{selectionFilter?.label ?? 'None'}</span>
          </p>
        </header>
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-1 px-3 py-3">
            {(snapshot?.featureTree ?? []).map((item) => {
              const Icon = treeIconMap[item.kind]
              const target = item.target
              const isSelected =
                selection.some((entry) => getPrimitiveRefKey(entry) === getPrimitiveRefKey(target))
              const isAllowed = selectionFilterAllowsTarget(selectionFilter, selection, target, selectionCatalog)

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (!isAllowed) {
                      return
                    }
                    onSelectTarget(target)
                  }}
                  className={`flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition hover:bg-[var(--cad-surface-elevated)] ${
                    isSelected ? 'bg-[var(--cad-surface-elevated)]' : ''
                  } ${!isAllowed ? 'cursor-not-allowed opacity-45' : ''}`}
                  aria-disabled={!isAllowed}
                  title={!isAllowed ? 'Filtered out by the current command' : undefined}
                >
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center text-[var(--cad-accent)]">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium leading-5 text-[var(--cad-foreground)]">
                      {item.label}
                    </span>
                    <span className="block truncate text-[10px] uppercase tracking-[0.18em] text-[var(--cad-muted)]">
                      Owner {formatReferenceOwner(snapshot!, item.ownerFeatureId, item.ownerSketchId)}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </ScrollArea>
      </section>

      <section className="grid min-h-0 flex-[1.2] grid-rows-[minmax(0,1fr)_minmax(0,0.9fr)] border-b border-[var(--cad-border)]">
        <div className="flex min-h-0 flex-col border-b border-[var(--cad-border)]">
          <header className="border-b border-[var(--cad-border)] px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--cad-muted)]">
              Parts & Objects
            </p>
          </header>
          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-1 px-3 py-3">
              {(snapshot?.objects ?? []).map((item) => {
                const target = item.target
                const isSelected =
                  selection.some((entry) => getPrimitiveRefKey(entry) === getPrimitiveRefKey(target))
                const isAllowed = selectionFilterAllowsTarget(selectionFilter, selection, target, selectionCatalog)

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (!isAllowed) {
                        return
                      }
                      onSelectTarget(target)
                    }}
                    className={`w-full rounded-md px-2 py-1.5 text-left transition hover:bg-[var(--cad-surface-elevated)] ${
                      isSelected ? 'bg-[var(--cad-surface-elevated)]' : ''
                    } ${!isAllowed ? 'cursor-not-allowed opacity-45' : ''}`}
                    aria-disabled={!isAllowed}
                    title={!isAllowed ? 'Filtered out by the current command' : undefined}
                  >
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center text-[var(--cad-accent)]">
                        {item.kind === 'body' ? (
                          <Box className="h-3.5 w-3.5" />
                        ) : (
                          <Component className="h-3.5 w-3.5" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium leading-5 text-[var(--cad-foreground)]">
                          {item.label}
                        </p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </ScrollArea>
        </div>

        <div className="flex min-h-0 flex-col">
          <header className="border-b border-[var(--cad-border)] px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--cad-muted)]">
              Snapshot References
            </p>
          </header>
          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-2 px-3 py-3">
              {(snapshot?.references ?? []).map((reference) => (
                <div
                  key={reference.id}
                  className={`rounded-md border px-2 py-2 ${
                    reference.invalidation
                      ? 'border-[rgba(214,106,106,0.4)] bg-[rgba(49,22,24,0.72)]'
                      : 'border-[var(--cad-border)] bg-[rgba(10,14,20,0.72)]'
                  }`}
                >
                  <p className="truncate text-sm font-medium text-[var(--cad-foreground)]">{reference.label}</p>
                  <p className="truncate text-xs text-[var(--cad-muted-foreground)]">
                    {getPrimitiveRefLabel(reference.target)}
                  </p>
                  <p className="mt-1 truncate text-[11px] uppercase tracking-[0.18em] text-[var(--cad-muted)]">
                    Owner {snapshot ? formatReferenceOwner(snapshot, reference.ownerFeatureId, reference.ownerSketchId) : 'n/a'}
                  </p>
                  {getReferenceStatus(reference) ? (
                    <p className="mt-1 text-xs text-[rgb(241,160,160)]">{getReferenceStatus(reference)}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </section>

      <section className="flex min-h-0 flex-[0.85] flex-col border-b border-[var(--cad-border)]">
        <header className="border-b border-[var(--cad-border)] px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--cad-muted)]">
            Document Diagnostics
          </p>
        </header>
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-2 px-3 py-3">
            {snapshot?.diagnostics.length ? (
              snapshot.diagnostics.map((diagnostic) => (
                <div
                  key={`${diagnostic.code}-${diagnostic.message}`}
                  className={`rounded-md border px-2 py-2 ${
                    diagnostic.severity === 'error'
                      ? 'border-[rgba(214,106,106,0.45)] bg-[rgba(49,22,24,0.72)]'
                      : diagnostic.severity === 'warning'
                        ? 'border-[rgba(196,152,84,0.45)] bg-[rgba(46,33,17,0.72)]'
                        : 'border-[var(--cad-border)] bg-[rgba(10,14,20,0.72)]'
                  }`}
                >
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--cad-muted)]">
                    {diagnostic.severity}
                  </p>
                  <p className="mt-1 text-sm text-[var(--cad-foreground)]">{diagnostic.message}</p>
                  {diagnostic.target ? (
                    <p className="mt-1 text-xs text-[var(--cad-muted-foreground)]">
                      Target {getPrimitiveRefLabel(diagnostic.target)}
                    </p>
                  ) : null}
                  {formatDocumentDiagnosticDetail(diagnostic) ? (
                    <p className="mt-1 text-xs text-[var(--cad-muted-foreground)]">
                      {formatDocumentDiagnosticDetail(diagnostic)}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-[var(--cad-muted)]">{diagnostic.code}</p>
                </div>
              ))
            ) : (
              <p className="text-xs text-[var(--cad-muted-foreground)]">No document diagnostics.</p>
            )}
          </div>
        </ScrollArea>
      </section>

      <section className="border-t border-[var(--cad-border)] px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--cad-muted)]">
          Editor Session
        </p>
        <p className="mt-2 text-xs text-[var(--cad-muted-foreground)]">
          Preview: <span className="text-[var(--cad-foreground)]">{preview?.label ?? 'No active preview'}</span>
        </p>
        <p className="mt-1 text-xs text-[var(--cad-muted-foreground)]">
          Edit session:{' '}
          <span className="text-[var(--cad-foreground)]">{activeFeatureLabel}</span>
        </p>
        <p className="mt-1 text-xs text-[var(--cad-muted-foreground)]">
          Edit status:{' '}
          <span className="text-[var(--cad-foreground)]">
            {activeEditSession?.status ?? 'idle'}
          </span>
        </p>
        <p className="mt-1 text-xs text-[var(--cad-muted-foreground)]">
          Selection:{' '}
          <span className="text-[var(--cad-foreground)]">
            {selectedLabels.length > 0 ? selectedLabels.join(', ') : 'Nothing selected'}
          </span>
        </p>
        <p className="mt-1 text-xs text-[var(--cad-muted-foreground)]">
          Target rule:{' '}
          <span className="text-[var(--cad-foreground)]">
            {selectionFilter?.requirements[0]?.description ?? 'No active target rule'}
          </span>
        </p>
        <p className="mt-1 text-xs text-[var(--cad-muted-foreground)]">
          Target slots:{' '}
          <span className="text-[var(--cad-foreground)]">
            {selectionFilter?.requirements
              .map((requirement) => requirement.slots.length)
              .join(' / ') ?? '0'}
          </span>
        </p>
        <p className="mt-1 text-xs text-[var(--cad-muted-foreground)]">
          Sketch draft:{' '}
          <span className="text-[var(--cad-foreground)]">
            {sketchSession?.commitRequest
              ? sketchSession.commitRequest.definition.entityIds.join(', ')
              : 'No authored entities'}
          </span>
        </p>
      </section>
    </aside>
  )
}

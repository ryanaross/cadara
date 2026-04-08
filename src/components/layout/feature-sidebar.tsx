import { Box, Component, Layers3, Workflow } from 'lucide-react'

import { ScrollArea } from '@/components/ui/scroll-area'
import type { PrimitiveRef } from '@/domain/editor/schema'
import type { DocumentSnapshot } from '@/domain/modeling/schema'
import {
  getPrimitiveRefKey,
  getPrimitiveRefLabel,
  selectionFilterAllowsTarget,
} from '@/domain/editor/schema'
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

export function FeatureSidebar({ snapshot, onSelectTarget }: FeatureSidebarProps) {
  const {
    state: { selection, selectionFilter, preview, activeEditSession, mode },
  } = useEditorState()

  const selectedLabels = selection.map((target) => getPrimitiveRefLabel(target))
  const activeFeatureLabel =
    activeEditSession === null
      ? 'No feature selected'
      : snapshot?.featureTree.find(
          (item) => item.target.kind === 'feature' && item.target.featureId === activeEditSession.featureId,
        )?.label ?? activeEditSession.featureId

  return (
    <aside className="flex w-[320px] min-w-[320px] flex-col border-r border-[var(--cad-border)] bg-[linear-gradient(180deg,_rgba(17,21,28,0.96),_rgba(11,15,21,0.98))]">
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
              const isAllowed = selectionFilterAllowsTarget(selectionFilter, target)

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (!target || !isAllowed) {
                      return
                    }
                    onSelectTarget(target)
                  }}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition hover:bg-[var(--cad-surface-elevated)] ${
                    isSelected ? 'bg-[var(--cad-surface-elevated)]' : ''
                  } ${!isAllowed ? 'cursor-not-allowed opacity-45' : ''}`}
                  aria-disabled={!isAllowed}
                  title={!isAllowed ? 'Filtered out by the current command' : undefined}
                >
                  <span className="flex h-4 w-4 items-center justify-center text-[var(--cad-accent)]">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-[var(--cad-foreground)]">
                      {item.label}
                    </span>
                    <span className="block truncate text-xs text-[var(--cad-muted-foreground)]">
                      {item.description}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </ScrollArea>
      </section>

      <section className="flex min-h-0 flex-[0.9] flex-col">
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
              const isAllowed = selectionFilterAllowsTarget(selectionFilter, target)

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (!target || !isAllowed) {
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
                  <div className="flex items-center gap-2">
                    <span className="flex h-4 w-4 items-center justify-center text-[var(--cad-accent)]">
                      {item.kind === 'body' ? (
                        <Box className="h-3.5 w-3.5" />
                      ) : (
                        <Component className="h-3.5 w-3.5" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--cad-foreground)]">
                        {item.label}
                      </p>
                      <p className="truncate text-xs text-[var(--cad-muted-foreground)]">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </button>
              )
            })}
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
          Revision:{' '}
          <span className="text-[var(--cad-foreground)]">{snapshot?.revisionId ?? 'Loading snapshot'}</span>
        </p>
        <p className="mt-1 text-xs text-[var(--cad-muted-foreground)]">
          Selection:{' '}
          <span className="text-[var(--cad-foreground)]">
            {selectedLabels.length > 0 ? selectedLabels.join(', ') : 'Nothing selected'}
          </span>
        </p>
      </section>
    </aside>
  )
}

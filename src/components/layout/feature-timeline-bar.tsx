import { Layers3 } from 'lucide-react'

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { DocumentFeatureCursor, DocumentSnapshot, FeatureSnapshotRecord } from '@/contracts/modeling/schema'
import type { PrimitiveRef } from '@/domain/editor/schema'
import {
  getPrimitiveRefKey,
  selectionFilterAllowsTarget,
} from '@/domain/editor/schema'
import { useEditorState } from '@/hooks/use-editor-state'

interface FeatureTimelineBarProps {
  snapshot: DocumentSnapshot | null
  onSelectTarget: (target: PrimitiveRef) => void
  onReopenTarget: (target: PrimitiveRef) => void
  onCursorRequested?: (cursor: DocumentFeatureCursor) => void
  visibleSelection: PrimitiveRef[]
}

function getFeatureDescription(feature: FeatureSnapshotRecord) {
  return `${feature.definition.kind} feature`
}

function getCursorIndex(features: readonly FeatureSnapshotRecord[], cursor: DocumentFeatureCursor) {
  if (cursor.kind === 'empty') {
    return -1
  }

  return features.findIndex((feature) => feature.featureId === cursor.featureId)
}

export function FeatureTimelineBar({
  snapshot,
  onSelectTarget,
  onReopenTarget,
  onCursorRequested,
  visibleSelection,
}: FeatureTimelineBarProps) {
  const {
    state: { selection, selectionFilter, selectionCatalog },
  } = useEditorState()
  const features = snapshot?.document.features ?? []
  const cursor = snapshot?.document.cursor ?? { kind: 'empty' as const }
  const cursorIndex = getCursorIndex(features, cursor)
  const getPositionCursor = (index: number): DocumentFeatureCursor => {
    if (index < 0) {
      return { kind: 'empty' }
    }

    const feature = features[index]
    return feature ? { kind: 'feature', featureId: feature.featureId } : { kind: 'empty' }
  }

  const renderCursorControl = (index: number, label: string) => {
    const isCursor = cursorIndex === index

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={`mx-0.5 h-9 w-3 shrink-0 rounded-sm border transition hover:border-[var(--cad-accent)] hover:bg-[rgba(107,151,214,0.35)] ${
              isCursor
                ? 'border-[var(--cad-accent)] bg-[var(--cad-accent)] shadow-[0_0_0_1px_rgba(107,151,214,0.45)]'
                : 'border-[var(--cad-border-strong)] bg-[rgba(255,255,255,0.08)]'
            }`}
            aria-label={label}
            aria-current={isCursor ? 'step' : undefined}
            onClick={() => onCursorRequested?.(getPositionCursor(index))}
          />
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    )
  }

  return (
    <TooltipProvider delayDuration={100}>
      <section
        className="flex min-h-[56px] shrink-0 items-center gap-3 border-t border-[var(--cad-border)] bg-[rgba(10,14,20,0.96)] px-3 py-2"
        aria-label="Feature timeline"
      >
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {features.length === 0 ? (
            <>
              {renderCursorControl(-1, 'Cursor at empty document')}
              <span className="flex h-8 items-center rounded-md border border-dashed border-[var(--cad-border)] px-3 text-xs text-[var(--cad-muted-foreground)]">
                Empty timeline
              </span>
            </>
          ) : null}
          {features.length > 0 ? renderCursorControl(-1, 'Move cursor before first feature') : null}
          {features.map((feature, index) => {
            const target = { kind: 'feature' as const, featureId: feature.featureId }
            const targetKey = getPrimitiveRefKey(target)
            const isSelected = visibleSelection.some((entry) => getPrimitiveRefKey(entry) === targetKey)
            const isAllowed = selectionFilterAllowsTarget(selectionFilter, selection, target, selectionCatalog)
            const isAfterCursor = cursorIndex >= 0 && index > cursorIndex

            return (
              <div key={feature.featureId} className="flex h-10 items-center">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => {
                        if (!isAllowed) {
                          return
                        }

                        onSelectTarget(target)
                      }}
                      onDoubleClick={() => onReopenTarget(target)}
                      className={`flex h-8 w-8 items-center justify-center rounded-md border text-[var(--cad-foreground)] transition hover:border-[var(--cad-border-strong)] hover:bg-[var(--cad-surface-elevated)] ${
                        isSelected
                          ? 'border-[var(--cad-border-strong)] bg-[var(--cad-surface-elevated)]'
                          : 'border-transparent bg-transparent'
                      } ${isAfterCursor ? 'opacity-45' : ''} ${!isAllowed ? 'cursor-not-allowed' : ''}`}
                      aria-label={`Select ${feature.label}. Double-click to reopen.`}
                      aria-disabled={!isAllowed}
                      title="Double-click to reopen authoring in place"
                    >
                      <Layers3 className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                      <div className="max-w-56">
                        <div className="font-medium">{feature.label}</div>
                        <div className="text-[var(--cad-muted-foreground)]">{getFeatureDescription(feature)}</div>
                        {isAfterCursor ? <div className="text-[var(--cad-muted-foreground)]">After current cursor</div> : null}
                      </div>
                  </TooltipContent>
                </Tooltip>
                {renderCursorControl(index, `Move cursor after ${feature.label}`)}
              </div>
            )
          })}
        </div>
      </section>
    </TooltipProvider>
  )
}

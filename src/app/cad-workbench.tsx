import { useEffect, useMemo, useState } from 'react'

import { ThreeCadViewport } from '@/components/cad/three-cad-viewport'
import { FeatureInspector } from '@/components/layout/feature-inspector'
import { FeatureSidebar } from '@/components/layout/feature-sidebar'
import { WorkspaceToolbar } from '@/components/layout/workspace-toolbar'
import { mergeSketchRenderables } from '@/domain/editor/sketch-session-controller'
import {
  getPrimitiveRefLabel,
  getPrimitiveRefKey,
  primitiveRefEquals,
  type PrimitiveRef,
} from '@/domain/editor/schema'
import {
  getFeatureSnapshot,
  getSelectionDetail,
} from '@/domain/modeling/document-snapshot-view'
import { installConsoleLoggingSubscribers } from '@/domain/tools/console-logging'
import { useEditorState } from '@/hooks/use-editor-state'
import { useFeatureEditing } from '@/hooks/use-feature-editing'
import { useToolActionBus } from '@/hooks/use-tool-actions'

export function CadWorkbench() {
  const actionBus = useToolActionBus()
  const {
    machineState,
    state: { activeCommand, selection, hoverTarget, sketchSession, activeEditSession },
    dispatch,
  } = useEditorState()
  const snapshot = machineState.snapshot
  const previewRenderables = machineState.previewRenderables
  const [hiddenTargetKeys, setHiddenTargetKeys] = useState<Record<string, boolean>>({})

  useEffect(() => installConsoleLoggingSubscribers(actionBus), [actionBus])

  useEffect(() => {
    const validTargetKeys = new Set([
      ...(snapshot?.presentation.featureTree ?? []).map((item) => getPrimitiveRefKey(item.target)),
      ...(snapshot?.presentation.objects ?? []).map((item) => getPrimitiveRefKey(item.target)),
    ])

    setHiddenTargetKeys((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([key, hidden]) => hidden && validTargetKeys.has(key)),
      ),
    )
  }, [snapshot])

  const visibleSelection = useMemo(
    () => selection.filter((target) => !hiddenTargetKeys[getPrimitiveRefKey(target)]),
    [hiddenTargetKeys, selection],
  )
  const visibleHoverTarget =
    hoverTarget && !hiddenTargetKeys[getPrimitiveRefKey(hoverTarget)] ? hoverTarget : null

  const primarySelection = visibleSelection[0] ?? visibleHoverTarget ?? null
  const selectionDetail =
    snapshot && primarySelection ? getSelectionDetail(snapshot, primarySelection) : null
  const activeFeatureSnapshot =
    snapshot && activeEditSession?.featureId
      ? getFeatureSnapshot(snapshot, activeEditSession.featureId)
      : primarySelection?.kind === 'feature' && snapshot
        ? getFeatureSnapshot(snapshot, primarySelection.featureId)
        : null
  const editableFeatureSnapshot = activeFeatureSnapshot ?? null

  const { commitFeature, cancelFeature } = useFeatureEditing()
  const viewportRenderables = useMemo(
    () => {
      const mergedRenderables = mergeSketchRenderables(
        previewRenderables ?? snapshot?.document.render.records ?? [],
        sketchSession,
      )

      return {
        ...mergedRenderables,
        documentRenderables: mergedRenderables.documentRenderables.filter(
          (renderable) => !hiddenTargetKeys[getPrimitiveRefKey(renderable.binding.target)],
        ),
      }
    },
    [hiddenTargetKeys, previewRenderables, sketchSession, snapshot],
  )

  const handleViewportHover = (target: PrimitiveRef) => {
    dispatch({ type: 'viewport.hovered', target })
  }

  const handleViewportSelect = (target: PrimitiveRef) => {
    dispatch({ type: 'viewport.selectionRequested', target })
  }

  const handleViewportHoverClear = () => {
    dispatch({ type: 'viewport.hoverCleared' })
  }

  const handleTargetVisibilityToggle = (target: PrimitiveRef) => {
    const targetKey = getPrimitiveRefKey(target)
    const nextHidden = !hiddenTargetKeys[targetKey]

    setHiddenTargetKeys((current) => ({
      ...current,
      [targetKey]: nextHidden,
    }))

    if (nextHidden && hoverTarget && primitiveRefEquals(hoverTarget, target)) {
      dispatch({ type: 'viewport.hoverCleared' })
    }
  }

  const handleSketchMove = (point: readonly [number, number]) => {
    dispatch({ type: 'sketch.pointerMoved', point })
  }

  const handleSketchRelease = (point: readonly [number, number]) => {
    dispatch({ type: 'sketch.pointerReleased', point })
  }

  return (
    <div className="flex h-screen min-h-screen flex-col bg-[var(--cad-background)] text-[var(--cad-foreground)]">
      <WorkspaceToolbar />
      <div className="flex min-h-0 flex-1">
        <FeatureSidebar
          snapshot={snapshot}
          hiddenTargetKeys={hiddenTargetKeys}
          onSelectTarget={handleViewportSelect}
          onToggleTargetVisibility={handleTargetVisibilityToggle}
          visibleSelection={visibleSelection}
        />
        <main className="relative min-h-0 flex-1 overflow-hidden border-l border-[var(--cad-border)] bg-[radial-gradient(circle_at_top,_rgba(79,104,140,0.12),_transparent_36%),linear-gradient(180deg,_rgba(14,18,24,0.96),_rgba(8,11,16,1))]">
          <ThreeCadViewport
            renderables={viewportRenderables.documentRenderables}
            sketchDisplayRenderables={viewportRenderables.sketchDisplayRenderables}
            hoverTarget={visibleHoverTarget}
            onHover={handleViewportHover}
            onSelect={handleViewportSelect}
            onClearHover={handleViewportHoverClear}
            onSketchMove={handleSketchMove}
            onSketchRelease={handleSketchRelease}
            selection={visibleSelection}
          />
          <div className="pointer-events-none absolute bottom-4 left-4 grid gap-3 rounded-xl border border-[var(--cad-border-strong)] bg-[rgba(8,12,17,0.9)] px-3 py-2 text-xs text-[var(--cad-muted-foreground)] shadow-[var(--cad-panel-shadow)]">
            <div>
              Machine: <span className="text-[var(--cad-foreground)]">{machineState.kind}</span>
            </div>
            <div>
              Command: <span className="text-[var(--cad-foreground)]">{activeCommand?.toolId ?? 'none'}</span>
            </div>
            <div>
              Phase: <span className="text-[var(--cad-foreground)]">{activeCommand?.phase ?? 'idle'}</span>
            </div>
            <div>
              Selection: <span className="text-[var(--cad-foreground)]">{visibleSelection.length}</span>
            </div>
            <div>
              Revision:{' '}
              <span className="text-[var(--cad-foreground)]">{snapshot?.document.revisionId ?? 'loading'}</span>
            </div>
            <div>
              Snapshot diagnostics:{' '}
              <span className="text-[var(--cad-foreground)]">{snapshot?.document.diagnostics.length ?? 0}</span>
            </div>
            <div>
              Sketch session:{' '}
              <span className="text-[var(--cad-foreground)]">
                {sketchSession?.commitRequest
                  ? `${sketchSession.commitRequest.definition.entityIds.length} entities staged`
                  : 'none'}
              </span>
            </div>
            <div>
              Sketch plane:{' '}
              <span className="text-[var(--cad-foreground)]">
                {sketchSession?.plane.key?.toUpperCase() ?? 'none'}
              </span>
            </div>
            <div>
              Feature session:{' '}
              <span className="text-[var(--cad-foreground)]">
                {activeEditSession
                  ? `${activeEditSession.mode}:${activeEditSession.featureType}:${activeEditSession.status}`
                  : 'none'}
              </span>
            </div>
            <div className="border-t border-[var(--cad-border)] pt-2">
              <div>
                Selection detail:{' '}
                <span className="text-[var(--cad-foreground)]">{selectionDetail?.label ?? 'none'}</span>
              </div>
              <div>
                Kind:{' '}
                <span className="text-[var(--cad-foreground)]">{selectionDetail?.kindLabel ?? 'none'}</span>
              </div>
              <div>
                Owner:{' '}
                <span className="text-[var(--cad-foreground)]">{selectionDetail?.ownerLabel ?? 'n/a'}</span>
              </div>
              <div>
                Related:{' '}
                <span className="text-[var(--cad-foreground)]">
                  {selectionDetail && selectionDetail.relatedLabels.length > 0
                    ? selectionDetail.relatedLabels.join(', ')
                    : 'none'}
                </span>
              </div>
              <div>
                Target:{' '}
                <span className="text-[var(--cad-foreground)]">
                  {primarySelection ? getPrimitiveRefLabel(primarySelection) : 'none'}
                </span>
              </div>
            </div>
          </div>
        </main>
        <FeatureInspector
          featureSnapshot={editableFeatureSnapshot}
          onDepthChange={(value) =>
            dispatch({ type: 'form.extrudePatched', patch: { depth: value } })
          }
          onOperationChange={(value) =>
            dispatch({ type: 'form.extrudePatched', patch: { operation: value } })
          }
          onCommit={commitFeature}
          onCancel={cancelFeature}
        />
      </div>
    </div>
  )
}

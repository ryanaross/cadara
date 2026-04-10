import { useEffect, useMemo, useState } from 'react'

import { ThreeCadViewport } from '@/components/cad/three-cad-viewport'
import { SketchToolOverlays } from '@/components/cad/sketch-tool-overlays'
import { SketchToolPanel } from '@/components/cad/sketch-tool-panel'
import { FeatureInspector } from '@/components/layout/feature-inspector'
import { FeatureSidebar } from '@/components/layout/feature-sidebar'
import { WorkspaceToolbar } from '@/components/layout/workspace-toolbar'
import { mergeSketchRenderables } from '@/domain/editor/sketch-session-controller'
import { getSketchToolPresentation } from '@/domain/editor/sketch-session'
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
import { useModelingService } from '@/hooks/use-modeling-service'
import { useToolActionBus } from '@/hooks/use-tool-actions'

export function CadWorkbench() {
  const actionBus = useToolActionBus()
  const modelingService = useModelingService()
  const {
    machineState,
    state: { activeCommand, selection, hoverTarget, sketchSession, activeEditSession },
    dispatch,
  } = useEditorState()
  const snapshot = machineState.snapshot
  const previewRenderables = machineState.previewRenderables
  const [hiddenTargetKeys, setHiddenTargetKeys] = useState<Record<string, boolean>>({})
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null)

  useEffect(() => installConsoleLoggingSubscribers(actionBus), [actionBus])

  useEffect(() => {
    let disposed = false

    void modelingService.getHistoryRestoreState().then((state) => {
      if (disposed) {
        return
      }

      setRestoreMessage(
        state.kind === 'failed'
          ? (state.diagnostics[0]?.message ?? 'Operation history restore failed.')
          : null,
      )
    })

    return () => {
      disposed = true
    }
  }, [modelingService])

  const visibleHiddenTargetKeys = useMemo(() => {
    if (!snapshot) {
      return hiddenTargetKeys
    }

    const validTargetKeys = new Set([
      ...(snapshot?.presentation.featureTree ?? []).map((item) => getPrimitiveRefKey(item.target)),
      ...(snapshot?.presentation.objects ?? []).map((item) => getPrimitiveRefKey(item.target)),
    ])

    return Object.fromEntries(
      Object.entries(hiddenTargetKeys).filter(([key, hidden]) => hidden && validTargetKeys.has(key)),
    )
  }, [hiddenTargetKeys, snapshot])

  const visibleSelection = useMemo(
    () => selection.filter((target) => !visibleHiddenTargetKeys[getPrimitiveRefKey(target)]),
    [selection, visibleHiddenTargetKeys],
  )
  const visibleHoverTarget =
    hoverTarget && !visibleHiddenTargetKeys[getPrimitiveRefKey(hoverTarget)] ? hoverTarget : null

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
          (renderable) => !visibleHiddenTargetKeys[getPrimitiveRefKey(renderable.binding.target)],
        ),
      }
    },
    [previewRenderables, sketchSession, snapshot, visibleHiddenTargetKeys],
  )
  const sketchToolPresentation = sketchSession ? getSketchToolPresentation(sketchSession) : null

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
          hiddenTargetKeys={visibleHiddenTargetKeys}
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
          <SketchToolPanel
            schema={sketchToolPresentation}
            onPatch={(patch) => dispatch({ type: 'sketch.toolPatched', patch })}
          />
          <SketchToolOverlays schema={sketchToolPresentation} />
          {restoreMessage ? (
            <div className="absolute right-4 top-4 max-w-sm rounded-lg border border-[var(--cad-border-strong)] bg-[rgba(8,12,17,0.95)] p-3 text-xs text-[var(--cad-foreground)] shadow-[var(--cad-panel-shadow)]">
              <div className="font-medium">History restore failed</div>
              <div className="mt-1 text-[var(--cad-muted-foreground)]">{restoreMessage}</div>
              <button
                className="mt-3 rounded-md border border-[var(--cad-border-strong)] px-2 py-1 text-[var(--cad-foreground)]"
                type="button"
                onClick={() => {
                  modelingService.resetOperationHistory()
                  setRestoreMessage(null)
                }}
              >
                Reset stored history
              </button>
            </div>
          ) : null}
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
          onPatch={(patch) =>
            dispatch({ type: 'form.featurePatched', patch })
          }
          onCommit={commitFeature}
          onCancel={cancelFeature}
        />
      </div>
    </div>
  )
}

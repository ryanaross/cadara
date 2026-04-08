import { useEffect, useState } from 'react'

import { ThreeCadViewport } from '@/components/cad/three-cad-viewport'
import { FeatureInspector } from '@/components/layout/feature-inspector'
import { FeatureSidebar } from '@/components/layout/feature-sidebar'
import { WorkspaceToolbar } from '@/components/layout/workspace-toolbar'
import { hydrateExtrudeFeatureEditSession } from '@/domain/editor/feature-editing'
import {
  commitActiveSketchSession,
  mergeSketchRenderables,
  openSketchSessionFromSelection,
} from '@/domain/editor/sketch-session-controller'
import {
  getPrimitiveRefLabel,
  type PrimitiveRef,
  type ViewportInteractionEvent,
} from '@/domain/editor/schema'
import {
  getFeatureSnapshot,
  getSelectionDetail,
} from '@/domain/modeling/document-snapshot-view'
import type { DocumentSnapshot } from '@/domain/modeling/schema'
import { installConsoleLoggingSubscribers } from '@/domain/tools/console-logging'
import { useEditorState } from '@/hooks/use-editor-state'
import { useFeatureEditing } from '@/hooks/use-feature-editing'
import { useModelingService } from '@/hooks/use-modeling-service'
import { useToolActionBus } from '@/hooks/use-tool-actions'

export function CadWorkbench() {
  const actionBus = useToolActionBus()
  const modelingService = useModelingService()
  const {
    state: { activeCommand, selection, hoverTarget, sketchSession, activeEditSession },
    dispatch,
  } = useEditorState()
  const [snapshot, setSnapshot] = useState<DocumentSnapshot | null>(null)
  const [snapshotDiagnostics, setSnapshotDiagnostics] = useState<DocumentSnapshot['diagnostics']>([])

  useEffect(() => installConsoleLoggingSubscribers(actionBus), [actionBus])

  useEffect(() => {
    let isCancelled = false

    modelingService
      .getCurrentDocumentSnapshot()
      .then((nextSnapshot) => {
        if (!isCancelled) {
          setSnapshot(nextSnapshot)
          setSnapshotDiagnostics(nextSnapshot.diagnostics)
        }
      })

    return () => {
      isCancelled = true
    }
  }, [modelingService])

  const handleViewportInteraction = (event: ViewportInteractionEvent) => {
    dispatch({ type: 'handleViewportInteraction', event })
  }

  const handleSelectionRequest = (target: PrimitiveRef) => {
    dispatch({ type: 'requestSelection', target })
  }

  useEffect(() => {
    if (activeCommand?.toolId !== 'sketch') {
      return
    }

    if (sketchSession) {
      return
    }

    const session = openSketchSessionFromSelection(selection, snapshot)

    if (!session) {
      return
    }

    dispatch({ type: 'hydrateSketchSession', session })
  }, [activeCommand?.toolId, dispatch, selection, sketchSession, snapshot])

  useEffect(() => {
    if (activeCommand?.toolId !== 'finishSketch' || !sketchSession || !snapshot) {
      return
    }

    let isCancelled = false

    commitActiveSketchSession({
      modelingService,
      session: sketchSession,
      baseRevisionId: snapshot.revisionId,
    })
      .then((result) => {
        if (isCancelled) {
          return
        }

        if (result === null) {
          dispatch({ type: 'finishSketchSession' })
          return
        }

        if (result.revisionState.kind === 'conflict') {
          dispatch({
            type: 'setPreview',
            preview: {
              kind: 'sketch',
              label:
                result.diagnostics[0]?.message ??
                `Sketch commit rejected due to revision conflict (${result.revisionState.actualRevisionId}).`,
              target: sketchSession.planeTarget,
            },
          })
          return
        }

        dispatch({ type: 'finishSketchSession' })

        modelingService
          .getCurrentDocumentSnapshot()
          .then((nextSnapshot) => {
            if (isCancelled) {
              return
            }

            setSnapshot(nextSnapshot)
            setSnapshotDiagnostics(nextSnapshot.diagnostics)
          })
          .catch((error: unknown) => {
            if (isCancelled) {
              return
            }

            dispatch({
              type: 'setPreview',
              preview: {
                kind: 'selection',
                label:
                  error instanceof Error
                    ? `Sketch committed, but snapshot refresh failed: ${error.message}`
                    : 'Sketch committed, but snapshot refresh failed.',
                target: sketchSession.planeTarget,
              },
            })
          })
      })
      .catch((error: unknown) => {
        if (isCancelled) {
          return
        }

        dispatch({
          type: 'setPreview',
          preview: {
            kind: 'sketch',
            label: error instanceof Error ? error.message : 'Sketch commit failed.',
            target: sketchSession.planeTarget,
          },
        })
      })

    return () => {
      isCancelled = true
    }
  }, [activeCommand?.toolId, dispatch, modelingService, sketchSession, snapshot])

  const primarySelection = selection[0] ?? hoverTarget ?? null
  const selectionDetail =
    snapshot && primarySelection ? getSelectionDetail(snapshot, primarySelection) : null
  const activeFeatureSnapshot =
    snapshot && activeEditSession?.featureId
      ? getFeatureSnapshot(snapshot, activeEditSession.featureId)
      : primarySelection?.kind === 'feature' && snapshot
        ? getFeatureSnapshot(snapshot, primarySelection.featureId)
        : null
  const editableFeatureSnapshot =
    activeFeatureSnapshot && hydrateExtrudeFeatureEditSession(activeFeatureSnapshot)
      ? activeFeatureSnapshot
      : null

  const { commitFeature, cancelFeature, previewRenderables } = useFeatureEditing(
    snapshot?.revisionId ?? null,
    editableFeatureSnapshot,
  )
  const viewportRenderables =
    activeEditSession && previewRenderables !== null
      ? previewRenderables
      : snapshot?.renderables ?? []

  const handleCommitFeature = () => {
    void commitFeature()
      .then((result) => {
        if (!result) {
          return
        }

        dispatch({ type: 'endEditSession' })

        modelingService
          .getCurrentDocumentSnapshot()
          .then((nextSnapshot) => {
            setSnapshot(nextSnapshot)
            setSnapshotDiagnostics(nextSnapshot.diagnostics)
            dispatch({
              type: 'setPreview',
              preview: {
                kind: 'selection',
                label: `Committed feature ${result.featureId}`,
                target: { kind: 'feature', featureId: result.featureId },
              },
            })
          })
          .catch((error: unknown) => {
            dispatch({
              type: 'setPreview',
              preview: {
                kind: 'selection',
                label:
                  error instanceof Error
                    ? `Feature committed, but snapshot refresh failed: ${error.message}`
                    : 'Feature committed, but snapshot refresh failed.',
                target: { kind: 'feature', featureId: result.featureId },
              },
            })
          })
      })
      .catch((error: unknown) => {
        dispatch({
          type: 'setPreview',
          preview: {
            kind: 'selection',
            label:
              error instanceof Error
                ? `Feature commit failed: ${error.message}`
                : 'Feature commit failed.',
            target:
              activeEditSession?.featureId != null
                ? { kind: 'feature', featureId: activeEditSession.featureId }
                : selection[0] ?? null,
          },
        })
      })
  }

  return (
    <div className="flex h-screen min-h-screen flex-col bg-[var(--cad-background)] text-[var(--cad-foreground)]">
      <WorkspaceToolbar />
      <div className="flex min-h-0 flex-1">
        <FeatureSidebar snapshot={snapshot} onSelectTarget={handleSelectionRequest} />
        <main className="relative min-h-0 flex-1 overflow-hidden border-l border-[var(--cad-border)] bg-[radial-gradient(circle_at_top,_rgba(79,104,140,0.12),_transparent_36%),linear-gradient(180deg,_rgba(14,18,24,0.96),_rgba(8,11,16,1))]">
          <ThreeCadViewport
            renderables={mergeSketchRenderables(viewportRenderables, sketchSession)}
            onInteraction={handleViewportInteraction}
          />
          <div className="pointer-events-none absolute bottom-4 left-4 grid gap-3 rounded-xl border border-[var(--cad-border-strong)] bg-[rgba(8,12,17,0.9)] px-3 py-2 text-xs text-[var(--cad-muted-foreground)] shadow-[var(--cad-panel-shadow)]">
            <div>
              Command: <span className="text-[var(--cad-foreground)]">{activeCommand?.toolId ?? 'none'}</span>
            </div>
            <div>
              Phase: <span className="text-[var(--cad-foreground)]">{activeCommand?.phase ?? 'idle'}</span>
            </div>
            <div>
              Selection: <span className="text-[var(--cad-foreground)]">{selection.length}</span>
            </div>
            <div>
              Revision:{' '}
              <span className="text-[var(--cad-foreground)]">{snapshot?.revisionId ?? 'loading'}</span>
            </div>
            <div>
              Snapshot diagnostics:{' '}
              <span className="text-[var(--cad-foreground)]">{snapshotDiagnostics.length}</span>
            </div>
            <div>
              Sketch session:{' '}
              <span className="text-[var(--cad-foreground)]">
                {sketchSession?.commitRequest
                  ? `${sketchSession.commitRequest.primitiveIds.length} primitive ids staged`
                  : 'none'}
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
            dispatch({ type: 'patchExtrudeEditSession', patch: { depth: value } })
          }
          onOperationChange={(value) =>
            dispatch({ type: 'patchExtrudeEditSession', patch: { operation: value } })
          }
          onCommit={handleCommitFeature}
          onCancel={cancelFeature}
        />
      </div>
    </div>
  )
}

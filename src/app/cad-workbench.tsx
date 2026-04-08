import { useEffect } from 'react'

import { FeatureSidebar } from '@/components/layout/feature-sidebar'
import { WorkspaceToolbar } from '@/components/layout/workspace-toolbar'
import { ThreeCadViewport } from '@/components/cad/three-cad-viewport'
import type { PrimitiveRef, ViewportInteractionEvent } from '@/domain/editor/schema'
import { installConsoleLoggingSubscribers } from '@/domain/tools/console-logging'
import { useEditorState } from '@/hooks/use-editor-state'
import { useToolActionBus } from '@/hooks/use-tool-actions'

export function CadWorkbench() {
  const actionBus = useToolActionBus()
  const {
    state: { activeCommand, selection },
    dispatch,
  } = useEditorState()

  useEffect(() => installConsoleLoggingSubscribers(actionBus), [actionBus])

  const handleViewportInteraction = (event: ViewportInteractionEvent) => {
    dispatch({ type: 'handleViewportInteraction', event })
  }

  const handleSelectionRequest = (target: PrimitiveRef) => {
    dispatch({ type: 'requestSelection', target })
  }

  return (
    <div className="flex h-screen min-h-screen flex-col bg-[var(--cad-background)] text-[var(--cad-foreground)]">
      <WorkspaceToolbar />
      <div className="flex min-h-0 flex-1">
        <FeatureSidebar onSelectTarget={handleSelectionRequest} />
        <main className="relative min-h-0 flex-1 overflow-hidden border-l border-[var(--cad-border)] bg-[radial-gradient(circle_at_top,_rgba(79,104,140,0.12),_transparent_36%),linear-gradient(180deg,_rgba(14,18,24,0.96),_rgba(8,11,16,1))]">
          <ThreeCadViewport onInteraction={handleViewportInteraction} />
          <div className="pointer-events-none absolute bottom-4 left-4 rounded-xl border border-[var(--cad-border-strong)] bg-[rgba(8,12,17,0.9)] px-3 py-2 text-xs text-[var(--cad-muted-foreground)] shadow-[var(--cad-panel-shadow)]">
            <div>
              Command: <span className="text-[var(--cad-foreground)]">{activeCommand?.toolId ?? 'none'}</span>
            </div>
            <div>
              Phase: <span className="text-[var(--cad-foreground)]">{activeCommand?.phase ?? 'idle'}</span>
            </div>
            <div>
              Selection: <span className="text-[var(--cad-foreground)]">{selection.length}</span>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

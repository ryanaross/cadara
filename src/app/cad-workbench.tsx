import { useEffect } from 'react'

import { FeatureSidebar } from '@/components/layout/feature-sidebar'
import { WorkspaceToolbar } from '@/components/layout/workspace-toolbar'
import { ThreeCadViewport } from '@/components/cad/three-cad-viewport'
import { installConsoleLoggingSubscribers } from '@/domain/tools/console-logging'
import type { ToolbarMode } from '@/domain/tools/schema'
import { useToolActionBus } from '@/hooks/use-tool-actions'

interface CadWorkbenchProps {
  mode: ToolbarMode
  onModeChange: (mode: ToolbarMode) => void
}

export function CadWorkbench({ mode, onModeChange }: CadWorkbenchProps) {
  const actionBus = useToolActionBus()

  useEffect(() => installConsoleLoggingSubscribers(actionBus), [actionBus])

  return (
    <div className="flex h-screen min-h-screen flex-col bg-[var(--cad-background)] text-[var(--cad-foreground)]">
      <WorkspaceToolbar mode={mode} onModeChange={onModeChange} />
      <div className="flex min-h-0 flex-1">
        <FeatureSidebar mode={mode} />
        <main className="relative min-h-0 flex-1 overflow-hidden border-l border-[var(--cad-border)] bg-[radial-gradient(circle_at_top,_rgba(79,104,140,0.12),_transparent_36%),linear-gradient(180deg,_rgba(14,18,24,0.96),_rgba(8,11,16,1))]">
          <ThreeCadViewport />
        </main>
      </div>
    </div>
  )
}

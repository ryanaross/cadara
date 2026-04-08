import { Box, Component, Layers3, Workflow } from 'lucide-react'

import { ScrollArea } from '@/components/ui/scroll-area'
import { featureTreeItems, partStudioObjects } from '@/domain/tools/mock-sidebar-data'
import type { ToolbarMode } from '@/domain/tools/schema'

interface FeatureSidebarProps {
  mode: ToolbarMode
}

const treeIconMap = {
  sketch: Workflow,
  feature: Layers3,
  part: Box,
  plane: Component,
} as const

export function FeatureSidebar({ mode }: FeatureSidebarProps) {
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
        </header>
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-1 px-3 py-3">
            {featureTreeItems.map((item) => {
              const Icon = treeIconMap[item.kind]
              return (
                <button
                  key={item.id}
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition hover:bg-[var(--cad-surface-elevated)]"
                >
                  <span className="flex h-4 w-4 items-center justify-center text-[var(--cad-accent)]">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--cad-foreground)]">
                    {item.label}
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
            {partStudioObjects.map((item) => (
              <div
                key={item.id}
                className="rounded-md px-2 py-1.5 transition hover:bg-[var(--cad-surface-elevated)]"
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-4 w-4 items-center justify-center text-[var(--cad-accent)]">
                    <Box className="h-3.5 w-3.5" />
                  </span>
                  <p className="min-w-0 truncate text-sm font-medium text-[var(--cad-foreground)]">
                    {item.label}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </section>
    </aside>
  )
}

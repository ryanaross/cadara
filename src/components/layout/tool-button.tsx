import type { LucideIcon } from 'lucide-react'

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { RegisteredToolDefinition } from '@/domain/tools/tool-registry'
import type { ToolbarMode } from '@/domain/tools/schema'
import { useToolActions } from '@/hooks/use-tool-actions'

interface ToolButtonProps {
  tool: RegisteredToolDefinition
  icon: LucideIcon
  onModeChange: (mode: ToolbarMode) => void
  inline?: boolean
  onTrigger?: () => void
}

export function ToolButton({
  tool,
  icon: Icon,
  onModeChange,
  inline = false,
  onTrigger,
}: ToolButtonProps) {
  const { triggerTool } = useToolActions()

  const handleClick = () => {
    if (tool.id === 'sketch') {
      onModeChange('sketch')
    }

    if (tool.id === 'finishSketch') {
      onModeChange('part')
    }

    triggerTool(tool.id, {
      source: inline ? 'search' : 'toolbar',
    })
    onTrigger?.()
  }

  const content = inline ? (
    <button
      type="button"
      onClick={handleClick}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-[var(--cad-surface-elevated)]"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--cad-border)] bg-[var(--cad-surface)] text-[var(--cad-foreground)]">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-[var(--cad-foreground)]">
          {tool.name}
        </span>
        <span className="block truncate text-xs text-[var(--cad-muted-foreground)]">
          {tool.tooltip}
        </span>
      </span>
    </button>
  ) : (
    <button
      type="button"
      onClick={handleClick}
      className="flex h-10 w-10 items-center justify-center rounded-lg border border-transparent bg-transparent text-[var(--cad-foreground)] transition hover:border-[var(--cad-border-strong)] hover:bg-[var(--cad-surface-elevated)]"
      aria-label={tool.tooltip}
    >
      <Icon className="h-4 w-4" />
    </button>
  )

  if (inline) {
    return content
  }

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent>{tool.tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

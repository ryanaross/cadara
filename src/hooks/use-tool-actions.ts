import { useContext } from 'react'

import { ToolActionContext } from '@/hooks/tool-action-context'
import type { ToolId } from '@/domain/tools/tool-registry'
import type { ToolTriggerMetadata } from '@/domain/tools/schema'

export function useToolActionBus() {
  const context = useContext(ToolActionContext)

  if (!context) {
    throw new Error('useToolActionBus must be used inside ToolActionProvider.')
  }

  return context.actionBus
}

export function useToolActions() {
  const context = useContext(ToolActionContext)

  if (!context) {
    throw new Error('useToolActions must be used inside ToolActionProvider.')
  }

  return {
    triggerTool(toolId: ToolId, metadata: ToolTriggerMetadata) {
      context.actionBus.triggerTool(toolId, context.mode, metadata)
    },
  }
}

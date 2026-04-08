import { useContext } from 'react'

import { ToolActionContext } from '@/hooks/tool-action-context'
import type { ToolId } from '@/domain/tools/tool-registry'
import type { ToolTriggerMetadata } from '@/domain/tools/schema'
import { useEditorState } from '@/hooks/use-editor-state'

export function useToolActionBus() {
  const context = useContext(ToolActionContext)

  if (!context) {
    throw new Error('useToolActionBus must be used inside ToolActionProvider.')
  }

  return context.actionBus
}

export function useToolActions() {
  const context = useContext(ToolActionContext)
  const {
    machineState,
    dispatch,
  } = useEditorState()

  if (!context) {
    throw new Error('useToolActions must be used inside ToolActionProvider.')
  }

  return {
    triggerTool(toolId: ToolId, metadata: ToolTriggerMetadata) {
      const nextMode =
        toolId === 'sketch'
          ? 'part'
          : toolId === 'line' || toolId === 'rectangle' || toolId === 'circle' || toolId === 'finishSketch'
            ? 'sketch'
            : machineState.mode

      dispatch({
        type: 'tool.activated',
        toolId,
      })

      context.actionBus.triggerTool(toolId, nextMode, metadata)
    },
  }
}

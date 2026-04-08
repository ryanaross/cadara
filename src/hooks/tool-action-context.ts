import { createContext } from 'react'

import type { ToolActionBus } from '@/domain/tools/tool-action-bus'
import type { ToolbarMode } from '@/domain/tools/schema'

export interface ToolActionContextValue {
  actionBus: ToolActionBus
  mode: ToolbarMode
}

export const ToolActionContext = createContext<ToolActionContextValue | null>(null)

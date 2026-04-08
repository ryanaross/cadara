import { createContext } from 'react'

import type { ToolActionBus } from '@/domain/tools/tool-action-bus'

export interface ToolActionContextValue {
  actionBus: ToolActionBus
}

export const ToolActionContext = createContext<ToolActionContextValue | null>(null)

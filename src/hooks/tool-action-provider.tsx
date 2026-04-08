import { useMemo } from 'react'
import type { PropsWithChildren } from 'react'

import { ToolActionContext } from '@/hooks/tool-action-context'
import type { ToolActionBus } from '@/domain/tools/tool-action-bus'
import type { ToolbarMode } from '@/domain/tools/schema'

interface ToolActionProviderProps extends PropsWithChildren {
  actionBus: ToolActionBus
  mode: ToolbarMode
}

export function ToolActionProvider({
  actionBus,
  mode,
  children,
}: ToolActionProviderProps) {
  const value = useMemo(
    () => ({
      actionBus,
      mode,
    }),
    [actionBus, mode],
  )

  return <ToolActionContext.Provider value={value}>{children}</ToolActionContext.Provider>
}

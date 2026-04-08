import { useMemo, useState } from 'react'

import { CadWorkbench } from '@/app/cad-workbench'
import { ToolActionProvider } from '@/hooks/tool-action-provider'
import { createToolActionBus } from '@/domain/tools/tool-action-bus'
import type { ToolbarMode } from '@/domain/tools/schema'

function App() {
  const [mode, setMode] = useState<ToolbarMode>('part')
  const actionBus = useMemo(() => createToolActionBus(), [])

  return (
    <ToolActionProvider actionBus={actionBus} mode={mode}>
      <CadWorkbench mode={mode} onModeChange={setMode} />
    </ToolActionProvider>
  )
}

export default App

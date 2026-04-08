import { useMemo } from 'react'

import { CadWorkbench } from '@/app/cad-workbench'
import { EditorProvider } from '@/hooks/editor-provider'
import { ToolActionProvider } from '@/hooks/tool-action-provider'
import { createToolActionBus } from '@/domain/tools/tool-action-bus'

function App() {
  const actionBus = useMemo(() => createToolActionBus(), [])

  return (
    <EditorProvider>
      <ToolActionProvider actionBus={actionBus}>
        <CadWorkbench />
      </ToolActionProvider>
    </EditorProvider>
  )
}

export default App

import { useMemo } from 'react'

import { CadWorkbench } from '@/app/cad-workbench'
import { createModelingService } from '@/domain/modeling/modeling-service'
import { MockKernelAdapter } from '@/domain/modeling/mock-kernel-adapter'
import { EditorProvider } from '@/hooks/editor-provider'
import { ModelingServiceProvider } from '@/hooks/modeling-service-provider'
import { ToolActionProvider } from '@/hooks/tool-action-provider'
import { createToolActionBus } from '@/domain/tools/tool-action-bus'

function App() {
  const actionBus = useMemo(() => createToolActionBus(), [])
  const modelingService = useMemo(
    () =>
      createModelingService(new MockKernelAdapter(), {
        currentDocumentId: 'doc_workspace',
      }),
    [],
  )

  return (
    <ModelingServiceProvider modelingService={modelingService}>
      <EditorProvider>
        <ToolActionProvider actionBus={actionBus}>
          <CadWorkbench />
        </ToolActionProvider>
      </EditorProvider>
    </ModelingServiceProvider>
  )
}

export default App

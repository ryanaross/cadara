import { useMemo } from 'react'

import { CadWorkbench } from '@/app/cad-workbench'
import { createModelingService } from '@/domain/modeling/modeling-service'
import { MockKernelAdapter } from '@/domain/modeling/mock-kernel-adapter'
import { MockSketchSolverAdapter } from '@/domain/solver/mock-sketch-solver-adapter'
import { EditorProvider } from '@/hooks/editor-provider'
import { ModelingServiceProvider } from '@/hooks/modeling-service-provider'
import { ToolActionProvider } from '@/hooks/tool-action-provider'
import { createToolActionBus } from '@/domain/tools/tool-action-bus'

function App() {
  const actionBus = useMemo(() => createToolActionBus(), [])
  const sketchSolver = useMemo(() => new MockSketchSolverAdapter(), [])
  const kernelAdapter = useMemo(
    () =>
      new MockKernelAdapter({
        solverAdapter: sketchSolver,
      }),
    [sketchSolver],
  )
  const modelingService = useMemo(
    () =>
      createModelingService(kernelAdapter, {
        currentDocumentId: 'doc_workspace',
        sketchSolver,
      }),
    [kernelAdapter, sketchSolver],
  )

  return (
    <ModelingServiceProvider modelingService={modelingService}>
      <EditorProvider modelingService={modelingService}>
        <ToolActionProvider actionBus={actionBus}>
          <CadWorkbench />
        </ToolActionProvider>
      </EditorProvider>
    </ModelingServiceProvider>
  )
}

export default App

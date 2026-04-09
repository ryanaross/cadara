import { useMemo } from 'react'

import { CadWorkbench } from '@/app/cad-workbench'
import { createModelingService } from '@/domain/modeling/modeling-service'
import { OpenCascadeKernelAdapter } from '@/domain/modeling/opencascade-kernel-adapter'
import {
  OCC_KERNEL_DOCUMENT_ID,
  OCC_KERNEL_INITIAL_REVISION_ID,
} from '@/domain/modeling/opencascade-kernel-seed'
import { MockSketchSolverAdapter } from '@/domain/solver/mock-sketch-solver-adapter'
import { EditorProvider } from '@/hooks/editor-provider'
import { ModelingServiceProvider } from '@/hooks/modeling-service-provider'
import { ToolActionProvider } from '@/hooks/tool-action-provider'
import { createToolActionBus } from '@/domain/tools/tool-action-bus'

function App() {
  const actionBus = useMemo(() => createToolActionBus(), [])
  const sketchSolver = useMemo(
    () => new MockSketchSolverAdapter({
      documentId: OCC_KERNEL_DOCUMENT_ID,
      revisionId: OCC_KERNEL_INITIAL_REVISION_ID,
    }),
    [],
  )
  const kernelAdapter = useMemo(
    () =>
      new OpenCascadeKernelAdapter({
        solverAdapter: sketchSolver,
        solverAdapterFactory: (revisionId) =>
          new MockSketchSolverAdapter({
            documentId: OCC_KERNEL_DOCUMENT_ID,
            revisionId,
          }),
      }),
    [sketchSolver],
  )
  const modelingService = useMemo(
    () =>
      createModelingService(kernelAdapter, {
        currentDocumentId: OCC_KERNEL_DOCUMENT_ID,
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

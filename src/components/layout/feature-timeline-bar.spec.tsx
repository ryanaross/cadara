import { renderToStaticMarkup } from 'react-dom/server'

import { FeatureSidebar } from '@/components/layout/feature-sidebar'
import { FeatureTimelineBar } from '@/components/layout/feature-timeline-bar'
import {
  getEditorViewState,
  initialEditorState,
} from '@/contracts/editor/state-machine'
import { getPrimitiveRefKey } from '@/domain/editor/schema'
import { MockKernelAdapter } from '@/domain/modeling/mock-kernel-adapter'
import { EditorContext } from '@/hooks/editor-context'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

const adapter = new MockKernelAdapter()
const response = await adapter.getDocumentSnapshot({
  contractVersion: 'modeling-contract/v1alpha1',
  documentId: 'doc_workspace',
})
const snapshot = response.snapshot
const editorValue = {
  machineState: initialEditorState,
  state: {
    ...getEditorViewState(initialEditorState),
    selectionCatalog: {
      selectableTargetKeys: snapshot.presentation.entities.map((entity) => getPrimitiveRefKey(entity.target)),
      existingSketchKeys: [],
      constructionPlaneKeys: [],
      planarFaceKeys: [],
    },
  },
  dispatch: () => undefined,
}

const sidebarMarkup = renderToStaticMarkup(
  <EditorContext.Provider value={editorValue}>
    <FeatureSidebar
      snapshot={snapshot}
      hiddenTargetKeys={{}}
      visibleSelection={[]}
      onSelectTarget={() => undefined}
      onReopenTarget={() => undefined}
      onToggleTargetVisibility={() => undefined}
    />
  </EditorContext.Provider>,
)

assert(sidebarMarkup.includes('Feature Tree'), 'Sidebar should render the feature tree section.')
assert(sidebarMarkup.includes('Parts &amp; Objects'), 'Sidebar should keep the parts and objects section.')
assert(sidebarMarkup.includes('Snapshot References'), 'Sidebar should keep snapshot references.')
assert(sidebarMarkup.includes('Document Diagnostics'), 'Sidebar should keep document diagnostics.')

const timelineMarkup = renderToStaticMarkup(
  <EditorContext.Provider value={editorValue}>
    <FeatureTimelineBar
      snapshot={snapshot}
      visibleSelection={[{ kind: 'feature', featureId: 'feature_extrude-1' }]}
      onSelectTarget={() => undefined}
      onReopenTarget={() => undefined}
      onCursorRequested={() => undefined}
    />
  </EditorContext.Provider>,
)

assert(timelineMarkup.includes('aria-label="Feature timeline"'), 'Timeline should expose a region label.')
assert(timelineMarkup.includes('aria-label="Select Extrude 1. Double-click to reopen."'), 'Timeline should expose feature selection labels.')
assert(timelineMarkup.includes('aria-current="step"'), 'Timeline should expose the current cursor position.')
assert(!timelineMarkup.includes('>Extrude 1</button>'), 'Timeline feature controls should be icon-only.')
assert(timelineMarkup.includes('aria-label="Move cursor before first feature"'), 'Timeline should expose a cursor position before the first feature.')
assert(timelineMarkup.includes('aria-label="Move cursor after Extrude 1"'), 'Timeline should expose feature cursor positions.')
assert(!timelineMarkup.includes('Hide Fillet 1') && !timelineMarkup.includes('Show Fillet 1'), 'Timeline should not render per-feature hide controls.')

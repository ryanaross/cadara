import { useReducer } from 'react'
import type { PropsWithChildren } from 'react'

import { editorReducer, initialEditorState } from '@/domain/editor/editor-state'
import { EditorContext } from '@/hooks/editor-context'

export function EditorProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(editorReducer, initialEditorState)

  return <EditorContext.Provider value={{ state, dispatch }}>{children}</EditorContext.Provider>
}

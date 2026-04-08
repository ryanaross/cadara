import { useContext } from 'react'

import { EditorContext } from '@/hooks/editor-context'

export function useEditorState() {
  const context = useContext(EditorContext)

  if (!context) {
    throw new Error('useEditorState must be used inside EditorProvider.')
  }

  return context
}

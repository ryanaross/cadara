import { createContext } from 'react'

import type { Dispatch } from 'react'

import type { EditorAction } from '@/domain/editor/editor-state'
import type { EditorState } from '@/domain/editor/schema'

export interface EditorContextValue {
  state: EditorState
  dispatch: Dispatch<EditorAction>
}

export const EditorContext = createContext<EditorContextValue | null>(null)

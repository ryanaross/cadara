import { useCallback, useEffect, useMemo, useReducer } from 'react'
import type { PropsWithChildren } from 'react'

import {
  createModelingServiceEditorEffectRuntime,
  getEditorViewState,
  initialEditorState,
  runEditorEffect,
  transitionEditorState,
  type EditorEffect,
  type EditorEvent,
  type EditorState,
} from '@/contracts/editor/state-machine'
import type { ModelingService } from '@/domain/modeling/modeling-service'
import { EditorContext } from '@/hooks/editor-context'

interface EditorProviderProps extends PropsWithChildren {
  modelingService: ModelingService
}

interface RuntimeState {
  machineState: EditorState
  pendingEffects: EditorEffect[]
}

type RuntimeAction =
  | { type: 'event'; event: EditorEvent }
  | { type: 'effects.flushed' }

function editorRuntimeReducer(state: RuntimeState, action: RuntimeAction): RuntimeState {
  switch (action.type) {
    case 'event': {
      const result = transitionEditorState(state.machineState, action.event)

      return {
        machineState: result.state,
        pendingEffects: [...state.pendingEffects, ...result.effects],
      }
    }
    case 'effects.flushed':
      if (state.pendingEffects.length === 0) {
        return state
      }

      return {
        ...state,
        pendingEffects: [],
      }
    default:
      return state
  }
}

export function EditorProvider({ modelingService, children }: EditorProviderProps) {
  const [runtimeState, runtimeDispatch] = useReducer(editorRuntimeReducer, {
    machineState: initialEditorState,
    pendingEffects: [],
  })
  const dispatch = useCallback((event: EditorEvent) => {
    runtimeDispatch({ type: 'event', event })
  }, [])

  useEffect(() => {
    dispatch({ type: 'session.started' })
  }, [dispatch])

  useEffect(() => {
    if (runtimeState.pendingEffects.length === 0) {
      return
    }

    const effects = runtimeState.pendingEffects
    const runtime = createModelingServiceEditorEffectRuntime(modelingService)
    runtimeDispatch({ type: 'effects.flushed' })

    effects.forEach((effect) => {
      void runEditorEffect(effect, runtime).then(dispatch)
    })
  }, [dispatch, modelingService, runtimeState.pendingEffects])

  const value = useMemo(
    () => ({
      machineState: runtimeState.machineState,
      state: getEditorViewState(runtimeState.machineState),
      dispatch,
    }),
    [dispatch, runtimeState.machineState],
  )

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
}

import type { ToolId } from '@/domain/tools/tool-registry'
import {
  acceptSketchDraw,
  beginSketchTool,
  createNewSketchSession,
  getSketchSessionPreviewLabel,
  startSketchDraw,
  updateSketchPointer,
  type SketchSessionState,
} from '@/domain/editor/sketch-session'
import type {
  ActiveCommand,
  EditorState,
  PrimitiveRef,
  SelectionFilter,
  ViewportInteractionEvent,
} from '@/domain/editor/schema'
import {
  defaultSelectionFilter,
  getPrimitiveRefLabel,
  initialEditorState,
  primitiveRefEquals,
  selectionFilterAllowsTarget,
} from '@/domain/editor/schema'

export type EditorAction =
  | { type: 'activateCommand'; toolId: ToolId; mode: EditorState['mode'] }
  | { type: 'startSketchSession'; planeTarget: PrimitiveRef }
  | { type: 'hydrateSketchSession'; session: SketchSessionState }
  | { type: 'setSelectionFilter'; filter: SelectionFilter | null }
  | { type: 'handleViewportInteraction'; event: ViewportInteractionEvent }
  | { type: 'requestSelection'; target: PrimitiveRef }
  | { type: 'clearSelection' }
  | { type: 'setPreview'; preview: EditorState['preview'] }
  | { type: 'endEditSession' }
  | { type: 'finishSketchSession' }

function createActiveCommand(toolId: ToolId): ActiveCommand {
  return {
    toolId,
    phase: 'armed',
    startedAt: Date.now(),
  }
}

export function getDefaultSelectionFilterForMode(mode: EditorState['mode']): SelectionFilter {
  return mode === 'sketch'
    ? {
        allowedKinds: ['construction', 'sketch', 'sketchPrimitive'] as const,
        label: 'Sketch references',
      }
    : defaultSelectionFilter
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'activateCommand': {
      if (toolIsFinishSketch(action.toolId) && state.sketchSession) {
        return {
          ...state,
          activeCommand: createActiveCommand(action.toolId),
          activeEditSession: null,
          selectionFilter: getDefaultSelectionFilterForMode(state.mode),
          preview: {
            kind: 'sketch',
            label: state.sketchSession.commitRequest
              ? 'Committing accepted sketch geometry'
              : 'Closing empty sketch session',
            target: state.sketchSession.planeTarget,
          },
        }
      }

      if (
        state.mode === 'sketch' &&
        state.sketchSession &&
        (action.toolId === 'line' || action.toolId === 'rectangle' || action.toolId === 'circle')
      ) {
        const session = beginSketchTool(state.sketchSession, action.toolId)
        return {
          ...state,
          mode: action.mode,
          activeCommand: createActiveCommand(action.toolId),
          activeEditSession: null,
          selectionFilter: getDefaultSelectionFilterForMode(action.mode),
          sketchSession: session,
          preview: {
            kind: 'sketch',
            label: getSketchSessionPreviewLabel(session),
            target: session.planeTarget,
          },
        }
      }

      return {
        ...state,
        mode: action.mode,
        activeCommand: createActiveCommand(action.toolId),
        activeEditSession: null,
        selectionFilter: getDefaultSelectionFilterForMode(action.mode),
        preview: {
          kind: 'selection',
          label: `Awaiting target for ${action.toolId}`,
          target: state.selection[0] ?? null,
        },
      }
    }
    case 'startSketchSession': {
      const session = createNewSketchSession(action.planeTarget)

      return {
        ...state,
        mode: 'sketch',
        selection: [action.planeTarget],
        hoverTarget: action.planeTarget,
        selectionFilter: getDefaultSelectionFilterForMode('sketch'),
        sketchSession: session,
        preview: {
          kind: 'sketch',
          label: getSketchSessionPreviewLabel(session),
          target: action.planeTarget,
        },
      }
    }
    case 'hydrateSketchSession':
      if (state.sketchSession?.sketchId === action.session.sketchId) {
        return state
      }

      return {
        ...state,
        mode: 'sketch',
        selection:
          action.session.sketchId === null
            ? [action.session.planeTarget]
            : [{ kind: 'sketch', sketchId: action.session.sketchId }],
        hoverTarget: null,
        selectionFilter: getDefaultSelectionFilterForMode('sketch'),
        sketchSession: action.session,
        preview: {
          kind: 'sketch',
          label: getSketchSessionPreviewLabel(action.session),
          target: action.session.planeTarget,
        },
      }
    case 'setSelectionFilter':
      return {
        ...state,
        selectionFilter: action.filter,
      }
    case 'handleViewportInteraction': {
      if (state.sketchSession && action.event.worldPosition) {
        const { planeKey } = state.sketchSession
        const point =
          planeKey === 'yz'
            ? ([action.event.worldPosition[1], action.event.worldPosition[2]] as const)
            : planeKey === 'xz'
              ? ([action.event.worldPosition[0], action.event.worldPosition[2]] as const)
              : ([action.event.worldPosition[0], action.event.worldPosition[1]] as const)

        if (action.event.type === 'canvasMove') {
          const session = updateSketchPointer(state.sketchSession, point)
          return {
            ...state,
            sketchSession: session,
            preview: {
              kind: 'sketch',
              label: getSketchSessionPreviewLabel(session),
              target: session.planeTarget,
            },
          }
        }

        if (action.event.type === 'canvasPointerDown') {
          const session = startSketchDraw(state.sketchSession, point)
          return {
            ...state,
            sketchSession: session,
            activeCommand: state.activeCommand
              ? {
                  ...state.activeCommand,
                  phase: 'editing',
                }
              : state.activeCommand,
            preview: {
              kind: 'sketch',
              label: getSketchSessionPreviewLabel(session),
              target: session.planeTarget,
            },
          }
        }

        if (action.event.type === 'canvasPointerUp') {
          const session = acceptSketchDraw(state.sketchSession, point)
          return {
            ...state,
            sketchSession: session,
            activeCommand: state.activeCommand
              ? {
                  ...state.activeCommand,
                  phase: 'collecting',
                }
              : state.activeCommand,
            preview: {
              kind: 'sketch',
              label: getSketchSessionPreviewLabel(session),
              target: session.planeTarget,
            },
          }
        }
      }

      if (action.event.type === 'clearHover') {
        if (state.sketchSession) {
          return {
            ...state,
            hoverTarget: null,
            preview: {
              kind: 'sketch',
              label: getSketchSessionPreviewLabel(state.sketchSession),
              target: state.sketchSession.planeTarget,
            },
          }
        }

        return {
          ...state,
          hoverTarget: null,
          preview: state.activeCommand
            ? {
                kind: 'selection',
                label: `Awaiting target for ${state.activeCommand.toolId}`,
                target: state.preview?.target ?? null,
              }
            : state.preview,
        }
      }

      if (
        !action.event.target ||
        !selectionFilterAllowsTarget(state.selectionFilter, action.event.target)
      ) {
        return state
      }

      if (action.event.type === 'hover') {
        if (state.sketchSession) {
          return {
            ...state,
            hoverTarget: action.event.target,
          }
        }

        return {
          ...state,
          hoverTarget: action.event.target,
          preview: state.activeCommand
            ? {
                kind: 'selection',
                label: `Hovering ${getPrimitiveRefLabel(action.event.target)}`,
                target: action.event.target,
              }
            : state.preview,
        }
      }

      const nextSelection = state.selection.some((target) =>
        primitiveRefEquals(target, action.event.target!),
      )
        ? state.selection
        : [action.event.target]

      return {
        ...state,
        selection: nextSelection,
        hoverTarget: action.event.target,
        activeEditSession:
          action.event.target.kind === 'feature'
            ? {
                featureId: action.event.target.featureId,
              }
            : null,
        activeCommand: state.activeCommand
          ? {
              ...state.activeCommand,
              phase: 'collecting',
            }
          : state.activeCommand,
        preview: state.activeCommand
          ? {
              kind: 'selection',
              label: `Selected ${getPrimitiveRefLabel(action.event.target)}`,
              target: action.event.target,
            }
          : state.preview,
      }
    }
    case 'requestSelection': {
      if (!selectionFilterAllowsTarget(state.selectionFilter, action.target)) {
        return {
          ...state,
          preview: state.activeCommand
            ? {
                kind: 'selection',
                label: `${action.target.kind} is filtered out for ${state.activeCommand.toolId}`,
                target: state.preview?.target ?? null,
              }
            : state.preview,
        }
      }

      return editorReducer(state, {
        type: 'handleViewportInteraction',
        event: { type: 'select', target: action.target },
      })
    }
    case 'clearSelection':
      return {
        ...state,
        selection: [],
      }
    case 'setPreview':
      return {
        ...state,
        preview: action.preview,
      }
    case 'endEditSession':
      return {
        ...state,
        activeEditSession: null,
      }
    case 'finishSketchSession':
      return {
        ...state,
        mode: 'part',
        activeCommand: null,
        selectionFilter: getDefaultSelectionFilterForMode('part'),
        sketchSession: null,
      }
    default:
      return state
  }
}

function toolIsFinishSketch(toolId: ToolId) {
  return toolId === 'finishSketch'
}

export { initialEditorState }

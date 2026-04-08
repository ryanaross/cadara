import type { ToolId } from '@/domain/tools/tool-registry'
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
  | { type: 'setSelectionFilter'; filter: SelectionFilter | null }
  | { type: 'handleViewportInteraction'; event: ViewportInteractionEvent }
  | { type: 'requestSelection'; target: PrimitiveRef }
  | { type: 'clearSelection' }
  | { type: 'setPreview'; preview: EditorState['preview'] }
  | { type: 'endEditSession' }

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
    case 'setSelectionFilter':
      return {
        ...state,
        selectionFilter: action.filter,
      }
    case 'handleViewportInteraction': {
      if (action.event.type === 'clearHover') {
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
    default:
      return state
  }
}

export { initialEditorState }

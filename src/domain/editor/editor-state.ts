import type { ToolId } from '@/domain/tools/tool-registry'
import {
  createExtrudeFeatureEditSession,
  targetMatchesExtrudeProfile,
  updateExtrudeDraft,
  type ExtrudeFeatureParameterDraft,
} from '@/domain/editor/feature-editing'
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
  FeatureId,
  PrimitiveRef,
  RevisionId,
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

const extrudeSelectionFilter = {
  allowedKinds: ['sketch', 'sketchPrimitive'] as const,
  label: 'Extrude profiles',
}

export type EditorAction =
  | { type: 'activateCommand'; toolId: ToolId; mode: EditorState['mode'] }
  | { type: 'startSketchSession'; planeTarget: PrimitiveRef }
  | { type: 'hydrateSketchSession'; session: SketchSessionState }
  | { type: 'setSelectionFilter'; filter: SelectionFilter | null }
  | { type: 'beginFeatureCreate'; featureType: 'extrude'; target: PrimitiveRef | null }
  | { type: 'beginFeatureEdit'; featureId: FeatureId; featureType: 'extrude'; draft: ExtrudeFeatureParameterDraft }
  | { type: 'patchExtrudeEditSession'; patch: Partial<ExtrudeFeatureParameterDraft> }
  | { type: 'setFeatureEditStatus'; status: NonNullable<EditorState['activeEditSession']>['status'] }
  | {
      type: 'setFeatureEditDiagnostics'
      diagnostics: NonNullable<EditorState['activeEditSession']>['diagnostics']
      revisionId?: RevisionId | null
    }
  | { type: 'markFeaturePreviewReady'; revisionId: RevisionId }
  | { type: 'markFeatureCommitted'; revisionId: RevisionId }
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

function getExtrudeSelectionPreview(
  target: PrimitiveRef | null,
  prefix = 'Extrude profile',
): EditorState['preview'] {
  return {
    kind: 'selection',
    label: target ? `${prefix} ${getPrimitiveRefLabel(target)} selected` : 'Select a sketch or profile for extrude',
    target,
  }
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

      if (action.toolId === 'extrude') {
        const target = state.selection[0] ?? null
        const session = createExtrudeFeatureEditSession({
          selectedTarget: target,
        })

        return {
          ...state,
          mode: action.mode,
          activeCommand: createActiveCommand(action.toolId),
          activeEditSession: session,
          selectionFilter: extrudeSelectionFilter,
          preview: getExtrudeSelectionPreview(session.draft.profileTarget),
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
    case 'beginFeatureCreate': {
      const session = createExtrudeFeatureEditSession({
        selectedTarget: action.target,
      })

      return {
        ...state,
        activeCommand: createActiveCommand('extrude'),
        activeEditSession: session,
        selectionFilter: extrudeSelectionFilter,
        preview: getExtrudeSelectionPreview(session.draft.profileTarget),
      }
    }
    case 'beginFeatureEdit':
      return {
        ...state,
        activeCommand: createActiveCommand('extrude'),
        activeEditSession: createExtrudeFeatureEditSession({
          selectedTarget: action.draft.profileTarget,
          featureId: action.featureId,
          draft: action.draft,
          mode: 'edit',
        }),
        selectionFilter: extrudeSelectionFilter,
        preview: getExtrudeSelectionPreview(action.draft.profileTarget, 'Editing extrude from'),
      }
    case 'patchExtrudeEditSession':
      if (!state.activeEditSession || state.activeEditSession.featureType !== 'extrude') {
        return state
      }

      {
        const draft = updateExtrudeDraft(state.activeEditSession.draft, action.patch)

        return {
          ...state,
          activeEditSession: {
            ...state.activeEditSession,
            draft,
            status: 'idle',
          },
          preview: getExtrudeSelectionPreview(draft.profileTarget, 'Extrude draft on'),
        }
      }
    case 'setFeatureEditStatus':
      if (!state.activeEditSession) {
        return state
      }

      return {
        ...state,
        activeEditSession: {
          ...state.activeEditSession,
          status: action.status,
        },
      }
    case 'setFeatureEditDiagnostics':
      if (!state.activeEditSession) {
        return state
      }

      return {
        ...state,
        activeEditSession: {
          ...state.activeEditSession,
          diagnostics: action.diagnostics,
          lastPreviewRevisionId:
            action.revisionId === undefined
              ? state.activeEditSession.lastPreviewRevisionId
              : action.revisionId,
        },
      }
    case 'markFeaturePreviewReady':
      if (!state.activeEditSession) {
        return state
      }

      return {
        ...state,
        activeEditSession: {
          ...state.activeEditSession,
          status: 'previewReady',
          lastPreviewRevisionId: action.revisionId,
        },
      }
    case 'markFeatureCommitted':
      if (!state.activeEditSession) {
        return state
      }

      return {
        ...state,
        activeEditSession: {
          ...state.activeEditSession,
          status: 'idle',
          lastCommittedRevisionId: action.revisionId,
        },
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

        if (action.event.type === 'canvasPointerUp') {
          const session =
            state.sketchSession.status === 'drawing'
              ? acceptSketchDraw(state.sketchSession, point)
              : startSketchDraw(state.sketchSession, point)

          return {
            ...state,
            sketchSession: session,
            activeCommand: state.activeCommand
              ? {
                  ...state.activeCommand,
                  phase: session.status === 'drawing' ? 'editing' : 'collecting',
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

      const nextEditSession =
        state.activeEditSession?.featureType === 'extrude' &&
        (action.event.target.kind === 'sketch' || action.event.target.kind === 'sketchPrimitive')
          ? {
              ...state.activeEditSession,
              draft: updateExtrudeDraft(state.activeEditSession.draft, {
                profileTarget: action.event.target,
              }),
              status: 'idle' as const,
            }
          : action.event.target.kind === 'feature'
            ? state.activeEditSession
            : null

      return {
        ...state,
        selection: nextSelection,
        hoverTarget: action.event.target,
        activeEditSession: nextEditSession,
        activeCommand: state.activeCommand
          ? {
              ...state.activeCommand,
              phase: 'collecting',
            }
          : state.activeCommand,
        preview: state.activeCommand
          ? {
              kind: 'selection',
              label:
                nextEditSession?.featureType === 'extrude' &&
                targetMatchesExtrudeProfile(action.event.target, nextEditSession.draft)
                  ? `Extrude profile ${getPrimitiveRefLabel(action.event.target)} selected`
                  : `Selected ${getPrimitiveRefLabel(action.event.target)}`,
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
        activeCommand: null,
        activeEditSession: null,
        selectionFilter: getDefaultSelectionFilterForMode(state.mode),
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

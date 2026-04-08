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
  getDefaultSelectionFilterForMode,
  getPrimitiveRefLabel,
  getSelectionFilterForCommand,
  getSelectionFilterRejectionLabel,
  getSelectionPreviewLabel,
  initialEditorState,
  primitiveRefEquals,
  resolveSelectionCandidate,
  selectionFilterAllowsTarget,
} from '@/domain/editor/schema'
import type { ModelingDiagnostic } from '@/domain/modeling/schema'
import type { SelectionTargetCatalog } from '@/domain/editor/schema'

export type EditorAction =
  | { type: 'activateCommand'; toolId: ToolId; mode: EditorState['mode'] }
  | { type: 'startSketchSession'; planeTarget: PrimitiveRef }
  | { type: 'hydrateSketchSession'; session: SketchSessionState }
  | { type: 'setSelectionCatalog'; catalog: SelectionTargetCatalog | null }
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

function previewEquals(left: EditorState['preview'], right: EditorState['preview']) {
  if (left === right) {
    return true
  }

  if (left === null || right === null) {
    return left === right
  }

  const targetsMatch =
    left.target === null || right.target === null
      ? left.target === right.target
      : primitiveRefEquals(left.target, right.target)

  return left.kind === right.kind && left.label === right.label && targetsMatch
}

function diagnosticsEqual(left: ModelingDiagnostic[], right: ModelingDiagnostic[]) {
  if (left === right) {
    return true
  }

  if (left.length !== right.length) {
    return false
  }

  return left.every((diagnostic, index) => {
    const candidate = right[index]

    if (!candidate) {
      return false
    }

    const targetMatches =
      diagnostic.target === null || candidate.target === null
        ? diagnostic.target === candidate.target
        : primitiveRefEquals(diagnostic.target, candidate.target)

    return (
      diagnostic.code === candidate.code &&
      diagnostic.severity === candidate.severity &&
      diagnostic.message === candidate.message &&
      targetMatches &&
      JSON.stringify(diagnostic.detail) === JSON.stringify(candidate.detail)
    )
  })
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
          selectionFilter: getSelectionFilterForCommand(action.toolId, action.mode),
          preview: getExtrudeSelectionPreview(session.draft.profileTarget),
        }
      }

      return {
        ...state,
        mode: action.mode,
        activeCommand: createActiveCommand(action.toolId),
        activeEditSession: null,
        selectionFilter: getSelectionFilterForCommand(action.toolId, action.mode),
        preview: {
          kind: 'selection',
          label: `Awaiting ${getSelectionFilterForCommand(action.toolId, action.mode).label.toLowerCase()}`,
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
    case 'setSelectionCatalog':
      if (state.selectionCatalog === action.catalog) {
        return state
      }

      return {
        ...state,
        selectionCatalog: action.catalog,
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
        selectionFilter: getSelectionFilterForCommand('extrude', state.mode),
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
        selectionFilter: getSelectionFilterForCommand('extrude', state.mode),
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

      if (state.activeEditSession.status === action.status) {
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

      if (
        diagnosticsEqual(state.activeEditSession.diagnostics, action.diagnostics) &&
        (action.revisionId === undefined ||
          action.revisionId === state.activeEditSession.lastPreviewRevisionId)
      ) {
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
                label: `Awaiting ${state.selectionFilter?.label.toLowerCase() ?? 'selection'}`,
                target: state.preview?.target ?? null,
              }
            : state.preview,
        }
      }

      if (
        !action.event.target ||
        !selectionFilterAllowsTarget(state.selectionFilter, state.selection, action.event.target, state.selectionCatalog)
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
                label: getSelectionPreviewLabel(state.selectionFilter, action.event.target, 'hover'),
                target: action.event.target,
              }
            : state.preview,
        }
      }

      const candidate = resolveSelectionCandidate(
        state.selectionFilter,
        state.selection,
        action.event.target,
        state.selectionCatalog,
      )

      if (!candidate.accepted) {
        return state
      }

      const nextSelection = candidate.nextSelection

      const nextEditSession =
        state.activeEditSession?.featureType === 'extrude' &&
        (action.event.target.kind === 'sketch' ||
          action.event.target.kind === 'sketchPrimitive' ||
          action.event.target.kind === 'face')
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
                  : getSelectionPreviewLabel(state.selectionFilter, action.event.target, 'select'),
              target: action.event.target,
            }
          : state.preview,
      }
    }
    case 'requestSelection': {
      if (
        !selectionFilterAllowsTarget(
          state.selectionFilter,
          state.selection,
          action.target,
          state.selectionCatalog,
        )
      ) {
        return {
          ...state,
          preview: state.activeCommand
            ? {
                kind: 'selection',
                label: getSelectionFilterRejectionLabel(state.selectionFilter, action.target),
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
      if (previewEquals(state.preview, action.preview)) {
        return state
      }

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

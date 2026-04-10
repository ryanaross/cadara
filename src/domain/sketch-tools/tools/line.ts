import type { SketchPoint } from '@/contracts/modeling/schema'
import type {
  SketchDraftEntity,
  SketchToolCommitContribution,
  SketchToolDefinition,
  SketchToolRuntimeState,
} from '@/domain/sketch-tools/definition'
import type { SketchToolPresentationSchema } from '@/domain/sketch-tools/editor-schema'
import {
  createIdleState,
  createPointerMoveResult,
  createPointerReleaseResult,
  distanceBetween,
  midpoint,
  validateDistance,
} from '@/domain/sketch-tools/shared'

function buildLinePreview(start: SketchPoint, end: SketchPoint): readonly SketchDraftEntity[] {
  return [
    {
      id: 'preview-line',
      kind: 'line',
      start,
      end,
      entityId: null,
      status: 'preview',
      label: 'Line preview',
    },
  ]
}

function validateLine(start: SketchPoint, end: SketchPoint) {
  return validateDistance(start, end, 'Line requires two distinct points.')
}

function buildLinePresentation(state: SketchToolRuntimeState): SketchToolPresentationSchema {
  const start = state.status === 'drawing' ? state.pointerDownPoint : null
  const end = state.status === 'drawing' ? state.livePoint : null
  const isDrawing = start !== null && end !== null
  const validation = state.validationMessage
    ? [{ id: 'line-validation', message: state.validationMessage, severity: 'error' as const }]
    : []
  const measurements = isDrawing
    ? [{ id: 'line-length', label: 'Length', value: distanceBetween(start, end), unit: 'mm' }]
    : []
  const overlays = isDrawing
    ? [
        {
          id: 'line-start-anchor',
          kind: 'anchor' as const,
          label: 'Start',
          point: start,
        },
        {
          id: 'line-length-overlay',
          kind: 'measurement' as const,
          label: 'Length',
          value: distanceBetween(start, end),
          unit: 'mm',
          anchor: midpoint(start, end),
        },
        {
          id: 'line-completion-cue',
          kind: 'completionCue' as const,
          label: 'Place endpoint',
          point: end,
          ready: validateLine(start, end).valid,
        },
      ]
    : []

  return {
    prompts: [
      {
        id: 'line-prompt',
        text: isDrawing ? 'Place endpoint' : 'Pick line start',
        tone: validation.length > 0 ? 'warning' : 'neutral',
      },
    ],
    steps: [{ id: 'line-step', label: isDrawing ? 'Endpoint' : 'Start point' }],
    measurements,
    completionHints: [
      {
        id: 'line-completion',
        text: isDrawing ? 'Click to accept the line' : 'Click to set the first point',
        ready: isDrawing ? validateLine(start, end).valid : false,
      },
    ],
    overlays,
    validation,
  }
}

export const lineSketchToolDefinition: SketchToolDefinition<'line'> = {
  metadata: {
    id: 'line',
    group: 'drawing',
    name: 'Line',
    tooltip: 'Create line geometry.',
    icon: 'line',
    modes: ['sketch'],
  },
  activate() {
    const state = createIdleState()

    return {
      state,
      stagedEntities: [],
      presentation: buildLinePresentation(state),
    }
  },
  pointerMove(input) {
    return createPointerMoveResult({
      pointerInput: input,
      buildPreview: buildLinePreview,
      buildPresentation: buildLinePresentation,
      validate: validateLine,
    })
  },
  pointerRelease(input) {
    return createPointerReleaseResult({
      pointerInput: input,
      buildPreview: buildLinePreview,
      buildPresentation: buildLinePresentation,
      validate: validateLine,
    })
  },
  getStagedEntities(state) {
    return state.pointerDownPoint && state.livePoint
      ? buildLinePreview(state.pointerDownPoint, state.livePoint)
      : []
  },
  validate: validateLine,
  getPresentation: buildLinePresentation,
  createCommitContribution({ sequence, start, end, factories }): SketchToolCommitContribution {
    const startPointId = factories.createPointId('line-start')
    const endPointId = factories.createPointId('line-end')
    const entityId = factories.createEntityId('line')

    return {
      points: [
        factories.createPoint(`Line ${sequence} start`, startPointId, start),
        factories.createPoint(`Line ${sequence} end`, endPointId, end),
      ],
      entities: [
        factories.createLineEntity(`Line ${sequence}`, entityId, startPointId, endPointId),
      ],
    }
  },
}

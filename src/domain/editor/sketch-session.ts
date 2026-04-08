import type { PrimitiveRef, SketchId, SketchPrimitiveId } from '@/domain/editor/schema'
import type {
  CommitSketchRequest,
  RenderableEntityRecord,
  SketchPlaneKey,
  SketchPoint,
  SketchPrimitiveGeometry,
  SketchPrimitiveRecord,
  SketchSnapshotRecord,
} from '@/domain/modeling/schema'

export type SketchToolId = 'line' | 'rectangle' | 'circle'

export type SketchDraftEntity =
  | {
      id: string
      kind: 'line'
      start: SketchPoint
      end: SketchPoint
      primitiveId: SketchPrimitiveId | null
      status: 'preview' | 'accepted'
      label: string
    }
  | {
      id: string
      kind: 'circle'
      center: SketchPoint
      radius: number
      primitiveId: SketchPrimitiveId | null
      status: 'preview' | 'accepted'
      label: string
    }

export interface SketchDraftCommitPrimitive {
  primitiveId: SketchPrimitiveId
  label: string
  kind: 'line' | 'circle' | 'profile'
  geometry: SketchPrimitiveGeometry
}

export interface SketchSessionState {
  sketchId: SketchId | null
  sketchLabel: string
  planeTarget: PrimitiveRef
  planeKey: SketchPlaneKey
  entities: SketchDraftEntity[]
  acceptedPrimitives: SketchDraftCommitPrimitive[]
  activeTool: SketchToolId | null
  status: 'idle' | 'drawing'
  pointerDownPoint: SketchPoint | null
  livePoint: SketchPoint | null
  sequence: number
  commitRequest: Omit<CommitSketchRequest, 'contractVersion' | 'documentId' | 'baseRevisionId'> | null
  validationMessage: string | null
}

export function derivePlaneKeyFromTarget(target: PrimitiveRef): SketchPlaneKey {
  if (target.kind !== 'construction') {
    return 'xy'
  }

  if (target.constructionId.endsWith('plane-yz')) {
    return 'yz'
  }

  if (target.constructionId.endsWith('plane-xz')) {
    return 'xz'
  }

  return 'xy'
}

export function createSketchSessionFromSnapshot(
  sketch: SketchSnapshotRecord,
): SketchSessionState {
  const acceptedPrimitives = sketch.primitives
    .filter((primitive) => primitive.kind === 'line' || primitive.kind === 'circle' || primitive.kind === 'profile')
    .map((primitive) => ({
      primitiveId: primitive.primitiveId,
      label: primitive.label,
      kind: primitive.kind as SketchDraftCommitPrimitive['kind'],
      geometry: primitive.geometry,
    }))

  const entities = sketch.primitives.flatMap((primitive) => mapSnapshotPrimitiveToDraftEntity(primitive))
  const sequence = getNextSketchPrimitiveSequence(acceptedPrimitives)

  return {
    sketchId: sketch.sketchId,
    sketchLabel: sketch.label,
    planeTarget: sketch.planeTarget,
    planeKey: sketch.planeKey,
    entities,
    acceptedPrimitives,
    activeTool: null,
    status: 'idle',
    pointerDownPoint: null,
    livePoint: null,
    sequence,
    commitRequest: buildCommitRequest({
      sketchId: sketch.sketchId,
      sketchLabel: sketch.label,
      planeTarget: sketch.planeTarget,
      planeKey: sketch.planeKey,
      acceptedPrimitives,
    }),
    validationMessage: null,
  }
}

export function createNewSketchSession(planeTarget: PrimitiveRef): SketchSessionState {
  return {
    sketchId: null,
    sketchLabel: 'Sketch Draft',
    planeTarget,
    planeKey: derivePlaneKeyFromTarget(planeTarget),
    entities: [],
    acceptedPrimitives: [],
    activeTool: null,
    status: 'idle',
    pointerDownPoint: null,
    livePoint: null,
    sequence: 0,
    commitRequest: null,
    validationMessage: null,
  }
}

function getNextSketchPrimitiveSequence(primitives: SketchDraftCommitPrimitive[]) {
  let highestSequence = 0

  for (const primitive of primitives) {
    const match = primitive.primitiveId.match(/-(\d+)(?:-|$)/)
    const parsed = match ? Number.parseInt(match[1], 10) : Number.NaN

    if (!Number.isNaN(parsed)) {
      highestSequence = Math.max(highestSequence, parsed)
    }
  }

  return highestSequence
}

function mapSnapshotPrimitiveToDraftEntity(primitive: SketchPrimitiveRecord): SketchDraftEntity[] {
  if (primitive.kind === 'line' && primitive.geometry.kind === 'line') {
    return [
      {
        id: primitive.primitiveId,
        kind: 'line',
        start: primitive.geometry.start,
        end: primitive.geometry.end,
        primitiveId: primitive.primitiveId,
        status: 'accepted',
        label: primitive.label,
      },
    ]
  }

  if (primitive.kind === 'circle' && primitive.geometry.kind === 'circle') {
    return [
      {
        id: primitive.primitiveId,
        kind: 'circle',
        center: primitive.geometry.center,
        radius: primitive.geometry.radius,
        primitiveId: primitive.primitiveId,
        status: 'accepted',
        label: primitive.label,
      },
    ]
  }

  return []
}

function buildCommitRequest(input: {
  sketchId: SketchId | null
  sketchLabel: string
  planeTarget: PrimitiveRef
  planeKey: SketchPlaneKey
  acceptedPrimitives: SketchDraftCommitPrimitive[]
}): SketchSessionState['commitRequest'] {
  return {
    sketchId: input.sketchId,
    sketchLabel: input.sketchLabel,
    planeTarget: input.planeTarget,
    planeKey: input.planeKey,
    primitiveIds: input.acceptedPrimitives.map((primitive) => primitive.primitiveId),
    primitives: input.acceptedPrimitives,
  }
}

function createLinePrimitive(sequence: number, start: SketchPoint, end: SketchPoint): SketchDraftCommitPrimitive {
  return {
    primitiveId: `curve_line-${sequence}` as SketchPrimitiveId,
    label: `Line ${sequence}`,
    kind: 'line',
    geometry: {
      kind: 'line',
      start,
      end,
    },
  }
}

function createCirclePrimitive(
  sequence: number,
  center: SketchPoint,
  radius: number,
): SketchDraftCommitPrimitive {
  return {
    primitiveId: `curve_circle-${sequence}` as SketchPrimitiveId,
    label: `Circle ${sequence}`,
    kind: 'circle',
    geometry: {
      kind: 'circle',
      center,
      radius,
    },
  }
}

function createRectanglePrimitives(
  sequence: number,
  start: SketchPoint,
  end: SketchPoint,
): SketchDraftCommitPrimitive[] {
  const [x0, y0] = start
  const [x1, y1] = end
  const bottomLeft: SketchPoint = [Math.min(x0, x1), Math.min(y0, y1)]
  const topRight: SketchPoint = [Math.max(x0, x1), Math.max(y0, y1)]
  const topLeft: SketchPoint = [bottomLeft[0], topRight[1]]
  const bottomRight: SketchPoint = [topRight[0], bottomLeft[1]]

  return [
    {
      primitiveId: `curve_rect-${sequence}-bottom` as SketchPrimitiveId,
      label: `Rectangle ${sequence} bottom`,
      kind: 'line',
      geometry: { kind: 'line', start: bottomLeft, end: bottomRight },
    },
    {
      primitiveId: `curve_rect-${sequence}-right` as SketchPrimitiveId,
      label: `Rectangle ${sequence} right`,
      kind: 'line',
      geometry: { kind: 'line', start: bottomRight, end: topRight },
    },
    {
      primitiveId: `curve_rect-${sequence}-top` as SketchPrimitiveId,
      label: `Rectangle ${sequence} top`,
      kind: 'line',
      geometry: { kind: 'line', start: topRight, end: topLeft },
    },
    {
      primitiveId: `curve_rect-${sequence}-left` as SketchPrimitiveId,
      label: `Rectangle ${sequence} left`,
      kind: 'line',
      geometry: { kind: 'line', start: topLeft, end: bottomLeft },
    },
    {
      primitiveId: `curve_profile-rect-${sequence}` as SketchPrimitiveId,
      label: `Rectangle ${sequence} profile`,
      kind: 'profile',
      geometry: {
        kind: 'profile',
        boundaryPrimitiveIds: [
          `curve_rect-${sequence}-bottom` as SketchPrimitiveId,
          `curve_rect-${sequence}-right` as SketchPrimitiveId,
          `curve_rect-${sequence}-top` as SketchPrimitiveId,
          `curve_rect-${sequence}-left` as SketchPrimitiveId,
        ],
      },
    },
  ]
}

export function beginSketchTool(
  session: SketchSessionState,
  toolId: SketchToolId,
): SketchSessionState {
  return {
    ...session,
    activeTool: toolId,
    status: 'idle',
    pointerDownPoint: null,
    livePoint: null,
    entities: session.entities.filter((entity) => entity.status === 'accepted'),
    validationMessage: null,
  }
}

export function updateSketchPointer(
  session: SketchSessionState,
  point: SketchPoint | null,
): SketchSessionState {
  if (session.activeTool === null) {
    return session
  }

  if (session.status !== 'drawing' || session.pointerDownPoint === null || point === null) {
    return {
      ...session,
      livePoint: point,
      validationMessage: session.validationMessage,
    }
  }

  return {
    ...session,
    livePoint: point,
    entities: [
      ...session.entities.filter((entity) => entity.status === 'accepted'),
      ...buildPreviewEntities(session.activeTool, session.pointerDownPoint, point),
    ],
    validationMessage: getSketchValidationMessage(session.activeTool, session.pointerDownPoint, point),
  }
}

export function startSketchDraw(
  session: SketchSessionState,
  point: SketchPoint,
): SketchSessionState {
  if (session.activeTool === null) {
    return session
  }

  return {
    ...session,
    status: 'drawing',
    pointerDownPoint: point,
    livePoint: point,
    entities: [
      ...session.entities.filter((entity) => entity.status === 'accepted'),
      ...buildPreviewEntities(session.activeTool, point, point),
    ],
    validationMessage: getSketchValidationMessage(session.activeTool, point, point),
  }
}

export function acceptSketchDraw(
  session: SketchSessionState,
  point: SketchPoint,
): SketchSessionState {
  if (session.activeTool === null || session.pointerDownPoint === null) {
    return session
  }

  const validationMessage = getSketchValidationMessage(
    session.activeTool,
    session.pointerDownPoint,
    point,
  )

  if (validationMessage) {
    return {
      ...session,
      entities: session.entities.filter((entity) => entity.status === 'accepted'),
      status: 'idle',
      pointerDownPoint: null,
      livePoint: point,
      validationMessage,
    }
  }

  const nextSequence = session.sequence + 1
  const acceptedPrimitives = [...session.acceptedPrimitives, ...buildAcceptedPrimitives(session.activeTool, nextSequence, session.pointerDownPoint, point)]
  const acceptedEntities = acceptedPrimitives.flatMap((primitive) => mapCommitPrimitiveToEntity(primitive))

  return {
    ...session,
    entities: acceptedEntities,
    acceptedPrimitives,
    status: 'idle',
    pointerDownPoint: null,
    livePoint: point,
    sequence: nextSequence,
    commitRequest: buildCommitRequest({
      sketchId: session.sketchId,
      sketchLabel: session.sketchLabel,
      planeTarget: session.planeTarget,
      planeKey: session.planeKey,
      acceptedPrimitives,
    }),
    validationMessage: null,
  }
}

function getSketchValidationMessage(
  toolId: SketchToolId,
  start: SketchPoint,
  end: SketchPoint,
) {
  const deltaX = end[0] - start[0]
  const deltaY = end[1] - start[1]
  const distance = Math.hypot(deltaX, deltaY)
  const epsilon = 0.0001

  if (toolId === 'line' && distance <= epsilon) {
    return 'Line requires two distinct points.'
  }

  if (toolId === 'circle' && distance <= epsilon) {
    return 'Circle radius must be greater than zero.'
  }

  if (toolId === 'rectangle' && (Math.abs(deltaX) <= epsilon || Math.abs(deltaY) <= epsilon)) {
    return 'Rectangle requires non-zero width and height.'
  }

  return null
}

function buildAcceptedPrimitives(
  toolId: SketchToolId,
  sequence: number,
  start: SketchPoint,
  end: SketchPoint,
): SketchDraftCommitPrimitive[] {
  if (toolId === 'line') {
    return [createLinePrimitive(sequence, start, end)]
  }

  if (toolId === 'circle') {
    const radius = Math.hypot(end[0] - start[0], end[1] - start[1])
    return [createCirclePrimitive(sequence, start, radius)]
  }

  return createRectanglePrimitives(sequence, start, end)
}

function buildPreviewEntities(
  toolId: SketchToolId,
  start: SketchPoint,
  end: SketchPoint,
): SketchDraftEntity[] {
  if (toolId === 'line') {
    return [
      {
        id: 'preview-line',
        kind: 'line',
        start,
        end,
        primitiveId: null,
        status: 'preview',
        label: 'Line preview',
      },
    ]
  }

  if (toolId === 'circle') {
    return [
      {
        id: 'preview-circle',
        kind: 'circle',
        center: start,
        radius: Math.hypot(end[0] - start[0], end[1] - start[1]),
        primitiveId: null,
        status: 'preview',
        label: 'Circle preview',
      },
    ]
  }

  const primitives = createRectanglePrimitives(0, start, end).filter((primitive) => primitive.kind === 'line')
  return primitives.map((primitive, index) => ({
    id: `preview-rectangle-${index}`,
    kind: 'line',
    start: primitive.geometry.kind === 'line' ? primitive.geometry.start : start,
    end: primitive.geometry.kind === 'line' ? primitive.geometry.end : end,
    primitiveId: null,
    status: 'preview',
    label: primitive.label,
  }))
}

function mapCommitPrimitiveToEntity(primitive: SketchDraftCommitPrimitive): SketchDraftEntity[] {
  if (primitive.kind === 'line' && primitive.geometry.kind === 'line') {
    return [
      {
        id: primitive.primitiveId,
        kind: 'line',
        start: primitive.geometry.start,
        end: primitive.geometry.end,
        primitiveId: primitive.primitiveId,
        status: 'accepted',
        label: primitive.label,
      },
    ]
  }

  if (primitive.kind === 'circle' && primitive.geometry.kind === 'circle') {
    return [
      {
        id: primitive.primitiveId,
        kind: 'circle',
        center: primitive.geometry.center,
        radius: primitive.geometry.radius,
        primitiveId: primitive.primitiveId,
        status: 'accepted',
        label: primitive.label,
      },
    ]
  }

  return []
}

export function getSketchSessionPreviewLabel(session: SketchSessionState): string {
  if (session.validationMessage) {
    return session.validationMessage
  }

  if (session.activeTool === null) {
    return session.acceptedPrimitives.length > 0
      ? `Sketch has ${session.acceptedPrimitives.length} committed primitives`
      : 'Sketch session ready'
  }

  if (session.status === 'drawing') {
    return `${session.activeTool} preview updates locally`
  }

  return `Ready to place ${session.activeTool}`
}

export function getSketchSessionRenderables(session: SketchSessionState): RenderableEntityRecord[] {
  return session.entities.map((entity, index) => createRenderableForEntity(session, entity, index))
}

function createRenderableForEntity(
  session: SketchSessionState,
  entity: SketchDraftEntity,
  index: number,
): RenderableEntityRecord {
  if (entity.kind === 'line') {
    const target =
      entity.primitiveId === null
        ? session.planeTarget
        : ({ kind: 'sketchPrimitive', sketchId: session.sketchId ?? ('sketch_draft' as SketchId), primitiveId: entity.primitiveId } as const)

    return {
      id: `sketch-render-line-${index}`,
      label: entity.label,
      target,
      ownerBodyId: null,
      ownerFeatureId: null,
      topology: 'edge',
      pickBinding: {
        pickId: `pick_sketch_line_${index}` as RenderableEntityRecord['pickBinding']['pickId'],
        target,
        topology: 'edge',
      },
      geometry: {
        kind: 'polyline',
        points: [
          mapSketchPointToWorld(session.planeKey, entity.start),
          mapSketchPointToWorld(session.planeKey, entity.end),
        ],
      },
    }
  }

  const pointCount = 48
  const points = Array.from({ length: pointCount + 1 }, (_, pointIndex) => {
    const angle = (Math.PI * 2 * pointIndex) / pointCount
    return mapSketchPointToWorld(session.planeKey, [
      entity.center[0] + Math.cos(angle) * entity.radius,
      entity.center[1] + Math.sin(angle) * entity.radius,
    ])
  })
  const target =
    entity.primitiveId === null
      ? session.planeTarget
      : ({ kind: 'sketchPrimitive', sketchId: session.sketchId ?? ('sketch_draft' as SketchId), primitiveId: entity.primitiveId } as const)

  return {
    id: `sketch-render-circle-${index}`,
    label: entity.label,
    target,
    ownerBodyId: null,
    ownerFeatureId: null,
    topology: 'edge',
    pickBinding: {
      pickId: `pick_sketch_circle_${index}` as RenderableEntityRecord['pickBinding']['pickId'],
      target,
      topology: 'edge',
    },
    geometry: {
      kind: 'polyline',
      points,
    },
  }
}

export function mapSketchPointToWorld(
  planeKey: SketchPlaneKey,
  point: SketchPoint,
): readonly [number, number, number] {
  if (planeKey === 'yz') {
    return [0, point[0], point[1]]
  }

  if (planeKey === 'xz') {
    return [point[0], 0, point[1]]
  }

  return [point[0], point[1], 0]
}

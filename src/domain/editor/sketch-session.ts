import type {
  ConstraintDefinition,
  DimensionDefinition,
  RegionRecord,
  SketchDefinition,
  SketchEntityDefinition,
  SketchPointDefinition,
} from '@/contracts/sketch/schema'
import { SKETCH_SCHEMA_VERSION } from '@/contracts/sketch/schema'
import type { DurableRef, SketchEntityRef, SketchPointRef } from '@/contracts/shared/references'
import type {
  ConstraintId,
  DimensionId,
  PickId,
  RenderableId,
  SketchEntityId,
  SketchId,
  SketchPointId,
} from '@/contracts/shared/ids'
import type {
  CommitSketchRequest,
  RenderableEntityRecord,
  SketchPlaneKey,
  SketchPoint,
  SketchSnapshotRecord,
} from '@/contracts/modeling/schema'

export type SketchToolId = 'line' | 'rectangle' | 'circle'

export type SketchDraftEntity =
  | {
      id: string
      kind: 'line'
      start: SketchPoint
      end: SketchPoint
      entityId: SketchEntityId | null
      status: 'preview' | 'accepted'
      label: string
    }
  | {
      id: string
      kind: 'circle'
      center: SketchPoint
      radius: number
      entityId: SketchEntityId | null
      status: 'preview' | 'accepted'
      label: string
    }

export interface SketchSessionState {
  sketchId: SketchId | null
  sketchLabel: string
  planeTarget: DurableRef
  planeKey: SketchPlaneKey
  entities: SketchDraftEntity[]
  definition: SketchDefinition
  activeTool: SketchToolId | null
  status: 'idle' | 'drawing'
  pointerDownPoint: SketchPoint | null
  livePoint: SketchPoint | null
  sequence: number
  solvedRegions: RegionRecord[]
  commitRequest: Omit<CommitSketchRequest, 'contractVersion' | 'documentId' | 'baseRevisionId'> | null
  validationMessage: string | null
}

export function derivePlaneKeyFromTarget(target: DurableRef): SketchPlaneKey {
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

function createPointId(sequence: number, suffix: string): SketchPointId {
  return `sketch_point_${sequence}_${suffix}` as SketchPointId
}

function createEntityId(sequence: number, suffix: string): SketchEntityId {
  return `sketch_entity_${sequence}_${suffix}` as SketchEntityId
}

function createConstraintId(sequence: number, suffix: string): ConstraintId {
  return `constraint_${sequence}_${suffix}` as ConstraintId
}

function createDimensionId(sequence: number, suffix: string): DimensionId {
  return `dimension_${sequence}_${suffix}` as DimensionId
}

function createSketchEntityRef(sketchId: SketchId, entityId: SketchEntityId): SketchEntityRef {
  return {
    kind: 'sketchEntity',
    sketchId,
    entityId,
  }
}

function createSketchPointRef(sketchId: SketchId, pointId: SketchPointId): SketchPointRef {
  return {
    kind: 'sketchPoint',
    sketchId,
    pointId,
  }
}

function createEmptyDefinition(): SketchDefinition {
  return {
    schemaVersion: SKETCH_SCHEMA_VERSION,
    referenceIds: [],
    references: [],
    pointIds: [],
    points: [],
    entityIds: [],
    entities: [],
    constraintIds: [],
    constraints: [],
    dimensionIds: [],
    dimensions: [],
  }
}

function cloneDefinition(definition: SketchDefinition): SketchDefinition {
  return {
    schemaVersion: definition.schemaVersion,
    referenceIds: [...definition.referenceIds],
    references: [...definition.references],
    pointIds: [...definition.pointIds],
    points: [...definition.points],
    entityIds: [...definition.entityIds],
    entities: [...definition.entities],
    constraintIds: [...definition.constraintIds],
    constraints: [...definition.constraints],
    dimensionIds: [...definition.dimensionIds],
    dimensions: [...definition.dimensions],
  }
}

function getNextDefinitionSequence(definition: SketchDefinition) {
  const ids = [
    ...definition.referenceIds,
    ...definition.pointIds,
    ...definition.entityIds,
    ...definition.constraintIds,
    ...definition.dimensionIds,
  ]

  let highestSequence = 0

  for (const id of ids) {
    const match = id.match(/_(\d+)_/)
    const parsed = match ? Number.parseInt(match[1], 10) : Number.NaN

    if (!Number.isNaN(parsed)) {
      highestSequence = Math.max(highestSequence, parsed)
    }
  }

  return highestSequence
}

export function createSketchSessionFromSnapshot(sketch: SketchSnapshotRecord): SketchSessionState {
  const entities = sketch.sketch.definition.entities.flatMap((entity) =>
    mapDefinitionEntityToDraftEntity(sketch.sketchId, sketch.sketch.definition.points, entity),
  )

  return {
    sketchId: sketch.sketchId,
    sketchLabel: sketch.label,
    planeTarget: sketch.planeTarget,
    planeKey: sketch.planeKey,
    entities,
    definition: cloneDefinition(sketch.sketch.definition),
    activeTool: null,
    status: 'idle',
    pointerDownPoint: null,
    livePoint: null,
    sequence: getNextDefinitionSequence(sketch.sketch.definition),
    solvedRegions: [...sketch.sketch.regions],
    commitRequest: buildCommitRequest({
      sketchId: sketch.sketchId,
      sketchLabel: sketch.label,
      planeTarget: sketch.planeTarget,
      planeKey: sketch.planeKey,
      definition: sketch.sketch.definition,
    }),
    validationMessage: null,
  }
}

export function createNewSketchSession(planeTarget: DurableRef): SketchSessionState {
  return {
    sketchId: null,
    sketchLabel: 'Sketch Draft',
    planeTarget,
    planeKey: derivePlaneKeyFromTarget(planeTarget),
    entities: [],
    definition: createEmptyDefinition(),
    activeTool: null,
    status: 'idle',
    pointerDownPoint: null,
    livePoint: null,
    sequence: 0,
    solvedRegions: [],
    commitRequest: null,
    validationMessage: null,
  }
}

function mapDefinitionEntityToDraftEntity(
  sketchId: SketchId,
  points: SketchPointDefinition[],
  entity: SketchEntityDefinition,
): SketchDraftEntity[] {
  if (entity.kind === 'lineSegment') {
    const start = points.find((point) => point.pointId === entity.startPointId)
    const end = points.find((point) => point.pointId === entity.endPointId)

    if (!start || !end) {
      return []
    }

    return [
      {
        id: entity.entityId,
        kind: 'line',
        start: start.position,
        end: end.position,
        entityId: createSketchEntityRef(sketchId, entity.entityId).entityId,
        status: 'accepted',
        label: entity.label,
      },
    ]
  }

  if (entity.kind === 'point') {
    const point = points.find((entry) => entry.pointId === entity.pointId)

    if (!point) {
      return []
    }

    return [
      {
        id: entity.entityId,
        kind: 'circle',
        center: point.position,
        radius: 0.1,
        entityId: entity.entityId,
        status: 'accepted',
        label: entity.label,
      },
    ]
  }

  if (entity.kind === 'circle') {
    const center = points.find((point) => point.pointId === entity.centerPointId)

    if (!center) {
      return []
    }

    return [
      {
        id: entity.entityId,
        kind: 'circle',
        center: center.position,
        radius: entity.radius,
        entityId: createSketchEntityRef(sketchId, entity.entityId).entityId,
        status: 'accepted',
        label: entity.label,
      },
    ]
  }

  const start = points.find((point) => point.pointId === entity.startPointId)
  const end = points.find((point) => point.pointId === entity.endPointId)

  if (!start || !end) {
    return []
  }

  return [
    {
      id: entity.entityId,
      kind: 'line',
      start: start.position,
      end: end.position,
      entityId: createSketchEntityRef(sketchId, entity.entityId).entityId,
      status: 'accepted',
      label: entity.label,
    },
  ]
}

function buildCommitRequest(input: {
  sketchId: SketchId | null
  sketchLabel: string
  planeTarget: DurableRef
  planeKey: SketchPlaneKey
  definition: SketchDefinition
}): SketchSessionState['commitRequest'] {
  return {
    solverCorrelation: null,
    sketchId: input.sketchId,
    sketchLabel: input.sketchLabel,
    planeTarget: input.planeTarget,
    planeKey: input.planeKey,
    definition: cloneDefinition(input.definition),
  }
}

function createPointDefinition(
  sketchId: SketchId,
  pointId: SketchPointId,
  label: string,
  position: SketchPoint,
): SketchPointDefinition {
  return {
    pointId,
    label,
    target: createSketchPointRef(sketchId, pointId),
    position,
    isConstruction: false,
  }
}

function createLineEntityDefinition(
  sketchId: SketchId,
  entityId: SketchEntityId,
  label: string,
  startPointId: SketchPointId,
  endPointId: SketchPointId,
): SketchEntityDefinition {
  return {
    kind: 'lineSegment',
    entityId,
    label,
    target: createSketchEntityRef(sketchId, entityId),
    isConstruction: false,
    startPointId,
    endPointId,
  }
}

function createCircleEntityDefinition(
  sketchId: SketchId,
  entityId: SketchEntityId,
  label: string,
  centerPointId: SketchPointId,
  radius: number,
): SketchEntityDefinition {
  return {
    kind: 'circle',
    entityId,
    label,
    target: createSketchEntityRef(sketchId, entityId),
    isConstruction: false,
    centerPointId,
    radius,
  }
}

function createConstraintDefinitionsForRectangle(
  sequence: number,
  bottomEntityId: SketchEntityId,
  rightEntityId: SketchEntityId,
  topEntityId: SketchEntityId,
  leftEntityId: SketchEntityId,
): ConstraintDefinition[] {
  return [
    {
      constraintId: createConstraintId(sequence, 'bottom-horizontal'),
      kind: 'horizontal',
      label: `Rectangle ${sequence} bottom horizontal`,
      entityId: bottomEntityId,
    },
    {
      constraintId: createConstraintId(sequence, 'top-horizontal'),
      kind: 'horizontal',
      label: `Rectangle ${sequence} top horizontal`,
      entityId: topEntityId,
    },
    {
      constraintId: createConstraintId(sequence, 'right-vertical'),
      kind: 'vertical',
      label: `Rectangle ${sequence} right vertical`,
      entityId: rightEntityId,
    },
    {
      constraintId: createConstraintId(sequence, 'left-vertical'),
      kind: 'vertical',
      label: `Rectangle ${sequence} left vertical`,
      entityId: leftEntityId,
    },
  ]
}

function createDimensionDefinitionsForRectangle(
  sequence: number,
  cornerPointIds: readonly [SketchPointId, SketchPointId, SketchPointId, SketchPointId],
  width: number,
  height: number,
): DimensionDefinition[] {
  const [bottomLeftId, bottomRightId, , topLeftId] = cornerPointIds

  return [
    {
      dimensionId: createDimensionId(sequence, 'width'),
      kind: 'distance',
      label: `Rectangle ${sequence} width`,
      axis: 'horizontal',
      pointIds: [bottomLeftId, bottomRightId],
      value: width,
    },
    {
      dimensionId: createDimensionId(sequence, 'height'),
      kind: 'distance',
      label: `Rectangle ${sequence} height`,
      axis: 'vertical',
      pointIds: [bottomLeftId, topLeftId],
      value: height,
    },
  ]
}

function appendDefinition(definition: SketchDefinition, patch: {
  points: SketchPointDefinition[]
  entities: SketchEntityDefinition[]
  constraints?: ConstraintDefinition[]
  dimensions?: DimensionDefinition[]
}): SketchDefinition {
  return {
    schemaVersion: definition.schemaVersion,
    referenceIds: [...definition.referenceIds],
    references: [...definition.references],
    pointIds: [...definition.pointIds, ...patch.points.map((point) => point.pointId)],
    points: [...definition.points, ...patch.points],
    entityIds: [...definition.entityIds, ...patch.entities.map((entity) => entity.entityId)],
    entities: [...definition.entities, ...patch.entities],
    constraintIds: [...definition.constraintIds, ...(patch.constraints ?? []).map((constraint) => constraint.constraintId)],
    constraints: [...definition.constraints, ...(patch.constraints ?? [])],
    dimensionIds: [...definition.dimensionIds, ...(patch.dimensions ?? []).map((dimension) => dimension.dimensionId)],
    dimensions: [...definition.dimensions, ...(patch.dimensions ?? [])],
  }
}

function buildAcceptedDefinitionPatch(
  sketchId: SketchId,
  toolId: SketchToolId,
  sequence: number,
  start: SketchPoint,
  end: SketchPoint,
): {
  points: SketchPointDefinition[]
  entities: SketchEntityDefinition[]
  constraints?: ConstraintDefinition[]
  dimensions?: DimensionDefinition[]
} {
  if (toolId === 'line') {
    const startPointId = createPointId(sequence, 'line-start')
    const endPointId = createPointId(sequence, 'line-end')
    const entityId = createEntityId(sequence, 'line')

    return {
      points: [
        createPointDefinition(sketchId, startPointId, `Line ${sequence} start`, start),
        createPointDefinition(sketchId, endPointId, `Line ${sequence} end`, end),
      ],
      entities: [
        createLineEntityDefinition(
          sketchId,
          entityId,
          `Line ${sequence}`,
          startPointId,
          endPointId,
        ),
      ],
    }
  }

  if (toolId === 'circle') {
    const centerPointId = createPointId(sequence, 'circle-center')
    const radius = Math.hypot(end[0] - start[0], end[1] - start[1])
    const entityId = createEntityId(sequence, 'circle')

    return {
      points: [
        createPointDefinition(sketchId, centerPointId, `Circle ${sequence} center`, start),
      ],
      entities: [
        createCircleEntityDefinition(
          sketchId,
          entityId,
          `Circle ${sequence}`,
          centerPointId,
          radius,
        ),
      ],
      dimensions: [
        {
          dimensionId: createDimensionId(sequence, 'radius'),
          kind: 'circleRadius',
          label: `Circle ${sequence} radius`,
          entityId,
          value: radius,
        },
      ],
    }
  }

  const [x0, y0] = start
  const [x1, y1] = end
  const bottomLeft: SketchPoint = [Math.min(x0, x1), Math.min(y0, y1)]
  const topRight: SketchPoint = [Math.max(x0, x1), Math.max(y0, y1)]
  const topLeft: SketchPoint = [bottomLeft[0], topRight[1]]
  const bottomRight: SketchPoint = [topRight[0], bottomLeft[1]]

  const cornerIds = [
    createPointId(sequence, 'rect-bottom-left'),
    createPointId(sequence, 'rect-bottom-right'),
    createPointId(sequence, 'rect-top-right'),
    createPointId(sequence, 'rect-top-left'),
  ] as const

  const entityIds = [
    createEntityId(sequence, 'rect-bottom'),
    createEntityId(sequence, 'rect-right'),
    createEntityId(sequence, 'rect-top'),
    createEntityId(sequence, 'rect-left'),
  ] as const

  return {
    points: [
      createPointDefinition(sketchId, cornerIds[0], `Rectangle ${sequence} bottom left`, bottomLeft),
      createPointDefinition(sketchId, cornerIds[1], `Rectangle ${sequence} bottom right`, bottomRight),
      createPointDefinition(sketchId, cornerIds[2], `Rectangle ${sequence} top right`, topRight),
      createPointDefinition(sketchId, cornerIds[3], `Rectangle ${sequence} top left`, topLeft),
    ],
    entities: [
      createLineEntityDefinition(sketchId, entityIds[0], `Rectangle ${sequence} bottom`, cornerIds[0], cornerIds[1]),
      createLineEntityDefinition(sketchId, entityIds[1], `Rectangle ${sequence} right`, cornerIds[1], cornerIds[2]),
      createLineEntityDefinition(sketchId, entityIds[2], `Rectangle ${sequence} top`, cornerIds[2], cornerIds[3]),
      createLineEntityDefinition(sketchId, entityIds[3], `Rectangle ${sequence} left`, cornerIds[3], cornerIds[0]),
    ],
    constraints: createConstraintDefinitionsForRectangle(
      sequence,
      entityIds[0],
      entityIds[1],
      entityIds[2],
      entityIds[3],
    ),
    dimensions: createDimensionDefinitionsForRectangle(
      sequence,
      cornerIds,
      Math.abs(topRight[0] - bottomLeft[0]),
      Math.abs(topRight[1] - bottomLeft[1]),
    ),
  }
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
        entityId: null,
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
        entityId: null,
        status: 'preview',
        label: 'Circle preview',
      },
    ]
  }

  const [x0, y0] = start
  const [x1, y1] = end
  const bottomLeft: SketchPoint = [Math.min(x0, x1), Math.min(y0, y1)]
  const topRight: SketchPoint = [Math.max(x0, x1), Math.max(y0, y1)]
  const topLeft: SketchPoint = [bottomLeft[0], topRight[1]]
  const bottomRight: SketchPoint = [topRight[0], bottomLeft[1]]

  return [
    {
      id: 'preview-rectangle-bottom',
      kind: 'line',
      start: bottomLeft,
      end: bottomRight,
      entityId: null,
      status: 'preview',
      label: 'Rectangle preview bottom',
    },
    {
      id: 'preview-rectangle-right',
      kind: 'line',
      start: bottomRight,
      end: topRight,
      entityId: null,
      status: 'preview',
      label: 'Rectangle preview right',
    },
    {
      id: 'preview-rectangle-top',
      kind: 'line',
      start: topRight,
      end: topLeft,
      entityId: null,
      status: 'preview',
      label: 'Rectangle preview top',
    },
    {
      id: 'preview-rectangle-left',
      kind: 'line',
      start: topLeft,
      end: bottomLeft,
      entityId: null,
      status: 'preview',
      label: 'Rectangle preview left',
    },
  ]
}

function buildAcceptedEntities(
  definitionPatch: ReturnType<typeof buildAcceptedDefinitionPatch>,
): SketchDraftEntity[] {
  const pointById = new Map(definitionPatch.points.map((point) => [point.pointId, point.position]))
  const acceptedEntities: SketchDraftEntity[] = []

  for (const entity of definitionPatch.entities) {
    if (entity.kind === 'lineSegment') {
      const start = pointById.get(entity.startPointId)
      const end = pointById.get(entity.endPointId)

      if (!start || !end) {
        continue
      }

      acceptedEntities.push({
        id: entity.entityId,
        kind: 'line',
        start,
        end,
        entityId: entity.entityId,
        status: 'accepted',
        label: entity.label,
      })
      continue
    }

    if (entity.kind === 'point') {
      const point = pointById.get(entity.pointId)

      if (!point) {
        continue
      }

      acceptedEntities.push({
        id: entity.entityId,
        kind: 'circle',
        center: point,
        radius: 0.1,
        entityId: entity.entityId,
        status: 'accepted',
        label: entity.label,
      })
      continue
    }

    if (entity.kind === 'circle') {
      const center = pointById.get(entity.centerPointId)

      if (!center) {
        continue
      }

      acceptedEntities.push({
        id: entity.entityId,
        kind: 'circle',
        center,
        radius: entity.radius,
        entityId: entity.entityId,
        status: 'accepted',
        label: entity.label,
      })
      continue
    }

    const start = pointById.get(entity.startPointId)
    const end = pointById.get(entity.endPointId)

    if (!start || !end) {
      continue
    }

    acceptedEntities.push({
      id: entity.entityId,
      kind: 'line',
      start,
      end,
      entityId: entity.entityId,
      status: 'accepted',
      label: entity.label,
    })
  }

  return acceptedEntities
}

export function beginSketchTool(session: SketchSessionState, toolId: SketchToolId): SketchSessionState {
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

export function startSketchDraw(session: SketchSessionState, point: SketchPoint): SketchSessionState {
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

export function acceptSketchDraw(session: SketchSessionState, point: SketchPoint): SketchSessionState {
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
  const sketchId = session.sketchId ?? ('sketch_draft' as SketchId)
  const definitionPatch = buildAcceptedDefinitionPatch(
    sketchId,
    session.activeTool,
    nextSequence,
    session.pointerDownPoint,
    point,
  )
  const definition = appendDefinition(session.definition, definitionPatch)
  const acceptedEntities = [...session.entities.filter((entity) => entity.status === 'accepted'), ...buildAcceptedEntities(definitionPatch)]

  return {
    ...session,
    entities: acceptedEntities,
    definition,
    status: 'idle',
    pointerDownPoint: null,
    livePoint: point,
    sequence: nextSequence,
    commitRequest: buildCommitRequest({
      sketchId: session.sketchId,
      sketchLabel: session.sketchLabel,
      planeTarget: session.planeTarget,
      planeKey: session.planeKey,
      definition,
    }),
    validationMessage: null,
  }
}

function getSketchValidationMessage(toolId: SketchToolId, start: SketchPoint, end: SketchPoint) {
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

export function getSketchSessionPreviewLabel(session: SketchSessionState): string {
  if (session.validationMessage) {
    return session.validationMessage
  }

  if (session.activeTool === null) {
    return session.definition.entityIds.length > 0
      ? `Sketch has ${session.definition.entityIds.length} authored entities`
      : 'Sketch session ready'
  }

  if (session.status === 'drawing') {
    return `${session.activeTool} preview active, click again to accept`
  }

  return `Ready to place ${session.activeTool}, click to set first point`
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
      entity.entityId === null
        ? session.planeTarget
        : createSketchEntityRef(session.sketchId ?? ('sketch_draft' as SketchId), entity.entityId)

    return {
      id: `renderable_sketch_line_${index}` as RenderableId,
      label: entity.label,
      target,
      ownerBodyId: null,
      ownerFeatureId: null,
      topology: 'edge',
      pickBinding: {
        pickId: `pick_sketch_line_${index}` as PickId,
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
    entity.entityId === null
      ? session.planeTarget
      : createSketchEntityRef(session.sketchId ?? ('sketch_draft' as SketchId), entity.entityId)

  return {
    id: `renderable_sketch_circle_${index}` as RenderableId,
    label: entity.label,
    target,
    ownerBodyId: null,
    ownerFeatureId: null,
    topology: 'edge',
    pickBinding: {
      pickId: `pick_sketch_circle_${index}` as PickId,
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

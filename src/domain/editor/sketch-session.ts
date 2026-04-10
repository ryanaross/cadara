import type {
  RegionRecord,
  SketchDefinition,
  SketchEntityDefinition,
  SketchPointDefinition,
} from '@/contracts/sketch/schema'
import { SKETCH_SCHEMA_VERSION } from '@/contracts/sketch/schema'
import type { SketchEntityRef, SketchPointRef } from '@/contracts/shared/references'
import type { SketchPlaneDefinition, SketchPlaneSupportRef } from '@/contracts/shared/sketch-plane'
import type {
  ConstraintId,
  DimensionId,
  RenderableId,
  SketchEntityId,
  SketchId,
  SketchPointId,
} from '@/contracts/shared/ids'
import type {
  CommitSketchRequest,
  SketchPlaneKey,
  SketchPoint,
  SketchSnapshotRecord,
} from '@/contracts/modeling/schema'
import type { RenderableEntityRecord } from '@/contracts/render/schema'
import { mapSketchPointToWorld as mapSketchPointToWorldFromPlane } from '@/domain/modeling/occ/planes'
import {
  createStandardPlaneDefinition,
  deriveStandardPlaneKeyFromConstructionId,
} from '@/domain/modeling/opencascade-kernel-seed'
import type { SketchToolPresentationSchema } from '@/domain/sketch-tools/editor-schema'
import type {
  SketchDraftEntity,
  SketchToolCommitContribution,
  SketchToolId,
} from '@/domain/sketch-tools/definition'
import { getSketchToolDefinition } from '@/domain/sketch-tools/registry'

export type { SketchDraftEntity, SketchToolId } from '@/domain/sketch-tools/definition'

export interface SketchSessionState {
  sketchId: SketchId | null
  sketchLabel: string
  plane: SketchPlaneDefinition
  planeTarget: SketchPlaneSupportRef
  planeKey: SketchPlaneKey | null
  entities: SketchDraftEntity[]
  definition: SketchDefinition
  activeTool: SketchToolId | null
  status: 'idle' | 'drawing'
  pointerDownPoint: SketchPoint | null
  livePoint: SketchPoint | null
  toolPresentation: SketchToolPresentationSchema | null
  sequence: number
  solvedRegions: RegionRecord[]
  commitRequest: Omit<CommitSketchRequest, 'contractVersion' | 'documentId' | 'baseRevisionId'> | null
  validationMessage: string | null
}

export interface SketchSessionDisplayRenderable {
  id: RenderableId
  label: string
  geometry: RenderableEntityRecord['geometry']
}

export function derivePlaneKeyFromTarget(target: SketchPlaneSupportRef): SketchPlaneKey | null {
  if (target.kind !== 'construction') {
    return null
  }

  return deriveStandardPlaneKeyFromConstructionId(target.constructionId)
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
    plane: sketch.plane,
    planeTarget: sketch.planeTarget,
    planeKey: sketch.planeKey ?? 'xy',
    entities,
    definition: cloneDefinition(sketch.sketch.definition),
    activeTool: null,
    status: 'idle',
    pointerDownPoint: null,
    livePoint: null,
    toolPresentation: null,
    sequence: getNextDefinitionSequence(sketch.sketch.definition),
    solvedRegions: [...sketch.sketch.regions],
    commitRequest: buildCommitRequest({
      sketchId: sketch.sketchId,
      sketchLabel: sketch.label,
      plane: sketch.plane,
      planeTarget: sketch.planeTarget,
      planeKey: sketch.planeKey ?? 'xy',
      definition: sketch.sketch.definition,
    }),
    validationMessage: null,
  }
}

export function createNewSketchSession(plane: SketchPlaneDefinition): SketchSessionState {
  const planeKey = plane.key

  return {
    sketchId: null,
    sketchLabel: 'Sketch Draft',
    plane,
    planeTarget: plane.support,
    planeKey,
    entities: [],
    definition: createEmptyDefinition(),
    activeTool: null,
    status: 'idle',
    pointerDownPoint: null,
    livePoint: null,
    toolPresentation: null,
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
  plane: SketchPlaneDefinition
  planeTarget: CommitSketchRequest['planeTarget']
  planeKey: SketchPlaneKey | null
  definition: SketchDefinition
}): SketchSessionState['commitRequest'] {
  return {
    solverCorrelation: null,
    sketchId: input.sketchId,
    sketchLabel: input.sketchLabel,
    plane: input.plane,
    planeTarget: input.planeTarget,
    planeKey: input.planeKey,
    definition: cloneDefinition(input.definition),
  }
}

export function createNewSketchSessionFromSupport(planeTarget: SketchPlaneSupportRef): SketchSessionState {
  const planeKey = derivePlaneKeyFromTarget(planeTarget)
  const plane =
    planeTarget.kind === 'construction' && planeKey
      ? createStandardPlaneDefinition(planeKey)
      : {
          support: planeTarget,
          frame: createStandardPlaneDefinition('xy').frame,
          key: planeKey,
        }

  return createNewSketchSession(plane)
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

function appendDefinition(definition: SketchDefinition, patch: SketchToolCommitContribution): SketchDefinition {
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

function buildAcceptedEntities(
  definitionPatch: SketchToolCommitContribution,
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
  const toolDefinition = getSketchToolDefinition(toolId)
  const activation = toolDefinition.activate()

  return {
    ...session,
    activeTool: toolId,
    status: activation.state.status,
    pointerDownPoint: activation.state.pointerDownPoint,
    livePoint: activation.state.livePoint,
    entities: session.entities.filter((entity) => entity.status === 'accepted'),
    validationMessage: activation.state.validationMessage,
    toolPresentation: activation.presentation,
  }
}

export function updateSketchPointer(
  session: SketchSessionState,
  point: SketchPoint | null,
): SketchSessionState {
  if (session.activeTool === null) {
    return session
  }

  const toolDefinition = getSketchToolDefinition(session.activeTool)
  const result = toolDefinition.pointerMove({
    state: getToolRuntimeState(session),
    point,
  })

  return {
    ...session,
    status: result.state.status,
    pointerDownPoint: result.state.pointerDownPoint,
    livePoint: result.state.livePoint,
    entities: [
      ...session.entities.filter((entity) => entity.status === 'accepted'),
      ...result.stagedEntities,
    ],
    validationMessage: result.state.validationMessage,
    toolPresentation: result.presentation,
  }
}

export function startSketchDraw(session: SketchSessionState, point: SketchPoint): SketchSessionState {
  if (session.activeTool === null) {
    return session
  }
  const toolDefinition = getSketchToolDefinition(session.activeTool)
  const result = toolDefinition.pointerRelease({
    state: {
      status: 'idle',
      pointerDownPoint: null,
      livePoint: null,
      validationMessage: null,
    },
    point,
  })

  return {
    ...session,
    status: result.state.status,
    pointerDownPoint: result.state.pointerDownPoint,
    livePoint: result.state.livePoint,
    entities: [
      ...session.entities.filter((entity) => entity.status === 'accepted'),
      ...result.stagedEntities,
    ],
    validationMessage: result.state.validationMessage,
    toolPresentation: result.presentation,
  }
}

export function acceptSketchDraw(session: SketchSessionState, point: SketchPoint): SketchSessionState {
  if (session.activeTool === null || session.pointerDownPoint === null) {
    return session
  }

  const toolDefinition = getSketchToolDefinition(session.activeTool)
  const result = toolDefinition.pointerRelease({
    state: getToolRuntimeState(session),
    point,
  })

  if (result.state.validationMessage) {
    return {
      ...session,
      entities: session.entities.filter((entity) => entity.status === 'accepted'),
      status: result.state.status,
      pointerDownPoint: result.state.pointerDownPoint,
      livePoint: result.state.livePoint,
      validationMessage: result.state.validationMessage,
      toolPresentation: result.presentation,
    }
  }

  const nextSequence = session.sequence + 1
  const sketchId = session.sketchId ?? ('sketch_draft' as SketchId)
  const definitionPatch = toolDefinition.createCommitContribution({
    sequence: nextSequence,
    start: session.pointerDownPoint,
    end: point,
    factories: {
      createPointId: (suffix) => createPointId(nextSequence, suffix),
      createEntityId: (suffix) => createEntityId(nextSequence, suffix),
      createConstraintId: (suffix) => createConstraintId(nextSequence, suffix),
      createDimensionId: (suffix) => createDimensionId(nextSequence, suffix),
      createPoint: (label, pointId, position) =>
        createPointDefinition(sketchId, pointId, label, position),
      createLineEntity: (label, entityId, startPointId, endPointId) =>
        createLineEntityDefinition(sketchId, entityId, label, startPointId, endPointId),
      createCircleEntity: (label, entityId, centerPointId, radius) =>
        createCircleEntityDefinition(sketchId, entityId, label, centerPointId, radius),
    },
  })
  const definition = appendDefinition(session.definition, definitionPatch)
  const acceptedEntities = [...session.entities.filter((entity) => entity.status === 'accepted'), ...buildAcceptedEntities(definitionPatch)]

  return {
    ...session,
    entities: acceptedEntities,
    definition,
    status: result.state.status,
    pointerDownPoint: result.state.pointerDownPoint,
    livePoint: result.state.livePoint,
    sequence: nextSequence,
    commitRequest: buildCommitRequest({
      sketchId: session.sketchId,
      sketchLabel: session.sketchLabel,
      plane: session.plane,
      planeTarget: session.planeTarget,
      planeKey: session.planeKey,
      definition,
    }),
    validationMessage: null,
    toolPresentation: result.presentation,
  }
}

function getToolRuntimeState(session: SketchSessionState) {
  return {
    status: session.status,
    pointerDownPoint: session.pointerDownPoint,
    livePoint: session.livePoint,
    validationMessage: session.validationMessage,
  }
}

export function getSketchSessionPreviewLabel(session: SketchSessionState): string {
  const primaryPrompt = session.toolPresentation?.validation?.[0]?.message
    ?? session.toolPresentation?.prompts[0]?.text

  if (primaryPrompt) {
    return primaryPrompt
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

export function getSketchToolPresentation(session: SketchSessionState): SketchToolPresentationSchema | null {
  if (session.activeTool === null) {
    return null
  }

  return session.toolPresentation
    ?? getSketchToolDefinition(session.activeTool).getPresentation(getToolRuntimeState(session))
}

export function getSketchSessionDisplayRenderables(session: SketchSessionState): SketchSessionDisplayRenderable[] {
  return session.entities.map((entity, index) => createDisplayRenderableForEntity(session, entity, index))
}

function createDisplayRenderableForEntity(
  session: SketchSessionState,
  entity: SketchDraftEntity,
  index: number,
): SketchSessionDisplayRenderable {
  if (entity.kind === 'line') {
    return {
      id: `renderable_sketch_line_${index}` as RenderableId,
      label: entity.label,
      geometry: {
        kind: 'polyline',
        points: [
          mapSketchPointToWorld(session.plane, entity.start),
          mapSketchPointToWorld(session.plane, entity.end),
        ],
        isClosed: false,
      },
    }
  }

  const pointCount = 48
  const points = Array.from({ length: pointCount + 1 }, (_, pointIndex) => {
    const angle = (Math.PI * 2 * pointIndex) / pointCount
    return mapSketchPointToWorld(session.plane, [
      entity.center[0] + Math.cos(angle) * entity.radius,
      entity.center[1] + Math.sin(angle) * entity.radius,
    ])
  })

  return {
    id: `renderable_sketch_circle_${index}` as RenderableId,
    label: entity.label,
    geometry: {
      kind: 'polyline',
      points,
      isClosed: true,
    },
  }
}

export function mapSketchPointToWorld(
  plane: SketchPlaneDefinition,
  point: SketchPoint,
): readonly [number, number, number] {
  return mapSketchPointToWorldFromPlane(plane, point)
}

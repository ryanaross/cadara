import type {
  ConstructionSnapshotRecord,
  ExtrudeFeatureParameters,
  FeatureBooleanOperation,
  FeatureBooleanScope,
  FeatureDefinition,
  FilletFeatureParameters,
  PlaneFeatureParameters,
  RevolveFeatureParameters,
  SketchSnapshotRecord,
  SnapshotEntityRecord,
} from '@/contracts/modeling/schema'
import type { RenderableEntityRecord } from '@/contracts/render/schema'
import type { RegionRecord } from '@/contracts/sketch/schema'
import type {
  BodyId,
  ConstructionId,
  FeatureId,
  PickId,
  RenderableId,
  SnapshotEntityId,
} from '@/contracts/shared/ids'
import type { DurableRef } from '@/contracts/shared/references'
import type { SketchPlaneDefinition } from '@/contracts/shared/sketch-plane'
import { RENDER_EXPORT_SCHEMA_VERSION } from '@/contracts/shared/versioning'
import {
  getConstructionBackedRevolveAxisRejectionReason,
  OCC_CONTRACT_GAP_CODES,
  getMultiBodyBooleanPolicy,
} from '@/domain/modeling/occ/implementation-policy'
import type { Vec3 } from '@/domain/modeling/occ/math'
import {
  buildAxisFromLineEdge,
  buildConstructionPlaneFromPlanarFace,
  buildRegionProfileFace,
  getExtrusionNormalForPlanarFace,
  getExtrusionNormalForSketchProfile,
} from '@/domain/modeling/occ/sketch-profile'
import { normalize, scale, toGpVec } from '@/domain/modeling/occ/geometry'
import type { OpenCascadeInstance } from '@/domain/modeling/occ/runtime'
import {
  extractSolidShapes,
  getOccDurableRefKey,
  OCC_REFERENCE_INVALIDATION_REASONS,
  trackNewSolidBody,
  trackReplacementSolidBody,
  type OccTrackedBody,
  type OccReferenceInvalidationRecord,
} from '@/domain/modeling/occ/topology'

export interface OccFeatureExecutionContext {
  oc: OpenCascadeInstance
  documentId: `doc_${string}`
  revisionId: `rev_${string}`
  modelingTolerance: number
  sketches: readonly SketchSnapshotRecord[]
  constructions: readonly ConstructionSnapshotRecord[]
  constructionPlanes: ReadonlyMap<ConstructionId, SketchPlaneDefinition>
  bodies: readonly OccTrackedBody[]
}

export interface OccFeatureExecutionResult {
  bodies: OccTrackedBody[]
  constructions: ConstructionSnapshotRecord[]
  constructionPlanes: Map<ConstructionId, SketchPlaneDefinition>
  producedTargets: DurableRef[]
  entities: SnapshotEntityRecord[]
  renderRecords: RenderableEntityRecord[]
  historyInvalidations: Map<string, OccReferenceInvalidationRecord>
}

export interface OccFeaturePresentationArtifacts {
  entities: SnapshotEntityRecord[]
  renderRecords: RenderableEntityRecord[]
}

function requireSketchSnapshot(
  context: OccFeatureExecutionContext,
  sketchId: SketchSnapshotRecord['sketchId'],
) {
  const sketch = context.sketches.find((entry) => entry.sketchId === sketchId)

  if (!sketch) {
    throw new Error(`Sketch ${sketchId} does not resolve in the current OCC authoring state.`)
  }

  return sketch
}

function requireRegion(
  sketch: SketchSnapshotRecord,
  regionId: RegionRecord['regionId'],
) {
  const region = sketch.sketch.regions.find((entry) => entry.regionId === regionId)

  if (!region) {
    throw new Error(`Sketch region ${regionId} does not resolve on sketch ${sketch.sketchId}.`)
  }

  return region
}

function requireBody(
  context: OccFeatureExecutionContext,
  bodyId: BodyId,
) {
  const body = context.bodies.find((entry) => entry.bodyId === bodyId)

  if (!body) {
    throw new Error(`Body ${bodyId} does not resolve in the current OCC authoring state.`)
  }

  return body
}

function requireFace(
  body: OccTrackedBody,
  faceId: `face_${string}`,
) {
  const face = body.facesById.get(faceId)

  if (!face) {
    throw new Error(`Face ${faceId} does not resolve on body ${body.bodyId}.`)
  }

  return face
}

function requireEdge(
  body: OccTrackedBody,
  edgeId: `edge_${string}`,
) {
  const edge = body.edgesById.get(edgeId)

  if (!edge) {
    throw new Error(`Edge ${edgeId} does not resolve on body ${body.bodyId}.`)
  }

  return edge
}

function requireConstructionPlaneDefinition(
  context: OccFeatureExecutionContext,
  constructionId: ConstructionId,
) {
  const plane = context.constructionPlanes.get(constructionId)

  if (!plane) {
    throw new Error(
      `${OCC_CONTRACT_GAP_CODES.constructionPlaneGeometryUnavailable}: Construction plane ${constructionId} does not expose internal plane geometry.`,
    )
  }

  return plane
}

function createBooleanBuilder(
  oc: OpenCascadeInstance,
  operation: Exclude<FeatureBooleanOperation, 'newBody'>,
  left: InstanceType<OpenCascadeInstance['TopoDS_Shape']>,
  right: InstanceType<OpenCascadeInstance['TopoDS_Shape']>,
) {
  const progress = new oc.Message_ProgressRange_1()

  switch (operation) {
    case 'join':
      return new oc.BRepAlgoAPI_Fuse_3(left, right, progress)
    case 'cut':
      return new oc.BRepAlgoAPI_Cut_3(left, right, progress)
    case 'intersect':
      return new oc.BRepAlgoAPI_Common_3(left, right, progress)
  }
}

function runBoolean(
  oc: OpenCascadeInstance,
  operation: Exclude<FeatureBooleanOperation, 'newBody'>,
  left: InstanceType<OpenCascadeInstance['TopoDS_Shape']>,
  right: InstanceType<OpenCascadeInstance['TopoDS_Shape']>,
) {
  const builder = createBooleanBuilder(oc, operation, left, right)
  builder.SetToFillHistory(true)
  builder.Build(new oc.Message_ProgressRange_1())

  if (!builder.IsDone()) {
    throw new Error(`OCC boolean ${operation} failed to build.`)
  }

  return {
    shape: builder.Shape(),
    builder,
  }
}

function createHistoryTargetForShape(
  target: DurableRef,
  ownerBodyId: BodyId,
) {
  switch (target.kind) {
    case 'face':
    case 'edge':
    case 'vertex':
      return {
        target,
        sourceTarget: { kind: 'body', bodyId: ownerBodyId } as DurableRef,
      }
    default:
      return null
  }
}

function collectTopologyHistoryInvalidations(
  current: OccTrackedBody,
  historySource: {
    Modified(shape: InstanceType<OpenCascadeInstance['TopoDS_Shape']>): { Size(): number }
    Generated(shape: InstanceType<OpenCascadeInstance['TopoDS_Shape']>): { Size(): number }
    IsDeleted(shape: InstanceType<OpenCascadeInstance['TopoDS_Shape']>): boolean
  },
) {
  const invalidations = new Map<string, OccReferenceInvalidationRecord>()
  const register = (
    target: DurableRef,
    shape: InstanceType<OpenCascadeInstance['TopoDS_Shape']>,
  ) => {
    const relation = createHistoryTargetForShape(target, current.bodyId)

    if (!relation) {
      return
    }

    let reason = OCC_REFERENCE_INVALIDATION_REASONS.missing

    if (historySource.IsDeleted(shape)) {
      reason = OCC_REFERENCE_INVALIDATION_REASONS.topologyDeleted
    } else if (
      historySource.Modified(shape).Size() > 0
      || historySource.Generated(shape).Size() > 0
    ) {
      reason = OCC_REFERENCE_INVALIDATION_REASONS.topologyModified
    }

    invalidations.set(getOccDurableRefKey(target), {
      target,
      reason,
      sourceTarget: relation.sourceTarget,
    })
  }

  for (const [faceId, face] of current.facesById.entries()) {
    register({ kind: 'face', bodyId: current.bodyId, faceId }, face)
  }

  for (const [edgeId, edge] of current.edgesById.entries()) {
    register({ kind: 'edge', bodyId: current.bodyId, edgeId }, edge)
  }

  for (const [vertexId, vertex] of current.verticesById.entries()) {
    register({ kind: 'vertex', bodyId: current.bodyId, vertexId }, vertex)
  }

  return invalidations
}

function resolveReplacementBodies(
  context: OccFeatureExecutionContext,
  bodyId: BodyId,
  shape: InstanceType<OpenCascadeInstance['TopoDS_Shape']>,
  ownerFeatureId: FeatureId,
  options: {
    allowEmpty: boolean
    historySource?: {
      Modified(shape: InstanceType<OpenCascadeInstance['TopoDS_Shape']>): { Size(): number }
      Generated(shape: InstanceType<OpenCascadeInstance['TopoDS_Shape']>): { Size(): number }
      IsDeleted(shape: InstanceType<OpenCascadeInstance['TopoDS_Shape']>): boolean
    }
  },
) {
  const current = requireBody(context, bodyId)
  const solids = extractSolidShapes(context.oc, shape)
  const historyInvalidations = options.historySource
    ? collectTopologyHistoryInvalidations(current, options.historySource)
    : new Map<string, OccReferenceInvalidationRecord>()

  if (solids.length === 0) {
    if (options.allowEmpty) {
      return {
        replacements: [] as OccTrackedBody[],
        historyInvalidations,
      }
    }

    throw new Error(
      `Feature ${ownerFeatureId} removed every solid while replacing body ${bodyId}; Phase 4 expected one solid result.`,
    )
  }

  if (solids.length !== 1) {
    throw new Error(
      `Feature ${ownerFeatureId} produced ${solids.length} solids while replacing body ${bodyId}; single-body replacement is required in Phase 4.`,
    )
  }

  return {
    replacements: [trackReplacementSolidBody(context.oc, {
      previous: current,
      ownerFeatureId,
      shape: solids[0]!,
    })],
    historyInvalidations,
  }
}

function allocateBodyId(featureId: FeatureId) {
  return `body_${featureId}` as BodyId
}

function trackSingleResultBody(
  context: OccFeatureExecutionContext,
  ownerFeatureId: FeatureId,
  label: string,
  shape: InstanceType<OpenCascadeInstance['TopoDS_Shape']>,
) {
  const solids = extractSolidShapes(context.oc, shape)

  if (solids.length !== 1) {
    throw new Error(
      `Feature ${ownerFeatureId} produced ${solids.length} solids; Phase 4 only accepts single-solid body results.`,
    )
  }

  const bodyId = allocateBodyId(ownerFeatureId)
  return trackNewSolidBody(context.oc, {
    bodyId,
    label,
    ownerFeatureId,
    shape: solids[0]!,
  })
}

function assertBooleanScopeCompatible(
  operation: FeatureBooleanOperation,
  booleanScope: FeatureBooleanScope,
) {
  if (operation === 'newBody' && booleanScope.kind !== 'standalone') {
    throw new Error('Boolean operation newBody requires standalone scope.')
  }

  if (operation !== 'newBody' && booleanScope.kind === 'standalone') {
    throw new Error(`Boolean operation ${operation} requires explicit target bodies.`)
  }
}

function requireUniqueTargetBodies(targetBodyIds: readonly BodyId[]) {
  const seen = new Set<BodyId>()

  for (const bodyId of targetBodyIds) {
    if (seen.has(bodyId)) {
      throw new Error(`Boolean target body ${bodyId} is duplicated in the explicit participant scope.`)
    }

    seen.add(bodyId)
  }
}

function applyBooleanPolicy(
  context: OccFeatureExecutionContext,
  ownerFeatureId: FeatureId,
  operation: FeatureBooleanOperation,
  booleanScope: FeatureBooleanScope,
  featureShape: InstanceType<OpenCascadeInstance['TopoDS_Shape']>,
) {
  assertBooleanScopeCompatible(operation, booleanScope)

  if (operation === 'newBody') {
    const body = trackSingleResultBody(context, ownerFeatureId, ownerFeatureId, featureShape)
    return {
      bodies: [
        ...context.bodies,
        body,
      ],
      producedTargets: [{ kind: 'body', bodyId: body.bodyId }] as DurableRef[],
      historyInvalidations: new Map<string, OccReferenceInvalidationRecord>(),
    }
  }

  let targetBodyIds: BodyId[]

  if (booleanScope.kind === 'targetBody') {
    targetBodyIds = [booleanScope.bodyId]
  } else if (booleanScope.kind === 'targetBodies') {
    targetBodyIds = [...booleanScope.bodyIds]
  } else {
    throw new Error(`Boolean operation ${operation} requires explicit target bodies.`)
  }

  if (targetBodyIds.length === 0) {
    throw new Error(`Boolean operation ${operation} requires at least one target body.`)
  }

  requireUniqueTargetBodies(targetBodyIds)

  const policy = getMultiBodyBooleanPolicy(operation, booleanScope)
  const nextBodies = [...context.bodies]
  const producedTargets: DurableRef[] = []

  if (!policy) {
    const bodyId = targetBodyIds[0]!
    const targetBody = requireBody(context, bodyId)
    const result = runBoolean(context.oc, operation, targetBody.shape, featureShape)
    const replacementResult = resolveReplacementBodies(context, bodyId, result.shape, ownerFeatureId, {
      allowEmpty: true,
      historySource: result.builder,
    })
    const index = nextBodies.findIndex((entry) => entry.bodyId === bodyId)
    nextBodies.splice(index, 1, ...replacementResult.replacements)
    for (const replacement of replacementResult.replacements) {
      producedTargets.push({ kind: 'body', bodyId: replacement.bodyId })
    }
    return {
      bodies: nextBodies,
      producedTargets,
      historyInvalidations: replacementResult.historyInvalidations,
    }
  }

  if (policy.application === 'sequential') {
    const [firstBodyId, ...restBodyIds] = targetBodyIds
    let currentResult = runBoolean(
      context.oc,
      policy.operation,
      requireBody(context, firstBodyId!).shape,
      featureShape,
    )
    const combinedHistoryInvalidations = new Map<string, OccReferenceInvalidationRecord>()
    const firstBody = requireBody(context, firstBodyId!)
    for (const [key, value] of collectTopologyHistoryInvalidations(firstBody, currentResult.builder)) {
      combinedHistoryInvalidations.set(key, value)
    }

    for (const bodyId of restBodyIds) {
      const body = requireBody(context, bodyId)
      currentResult = runBoolean(context.oc, policy.operation, currentResult.shape, body.shape)
      for (const [key, value] of collectTopologyHistoryInvalidations(body, currentResult.builder)) {
        combinedHistoryInvalidations.set(key, value)
      }
    }

    const replacementResult = resolveReplacementBodies(context, firstBodyId!, currentResult.shape, ownerFeatureId, {
      allowEmpty: true,
      historySource: currentResult.builder,
    })
    const firstIndex = nextBodies.findIndex((entry) => entry.bodyId === firstBodyId)
    nextBodies.splice(firstIndex, 1, ...replacementResult.replacements)

    for (const bodyId of targetBodyIds.slice(1)) {
      const index = nextBodies.findIndex((entry) => entry.bodyId === bodyId)
      if (index >= 0) {
        nextBodies.splice(index, 1)
      }
    }

    for (const replacement of replacementResult.replacements) {
      producedTargets.push({ kind: 'body', bodyId: replacement.bodyId })
    }
    for (const [key, value] of replacementResult.historyInvalidations) {
      combinedHistoryInvalidations.set(key, value)
    }
    return {
      bodies: nextBodies,
      producedTargets,
      historyInvalidations: combinedHistoryInvalidations,
    }
  }

  const combinedHistoryInvalidations = new Map<string, OccReferenceInvalidationRecord>()
  for (const bodyId of targetBodyIds) {
    const targetBody = requireBody(context, bodyId)
    const result = runBoolean(context.oc, policy.operation, targetBody.shape, featureShape)
    const replacementResult = resolveReplacementBodies(context, bodyId, result.shape, ownerFeatureId, {
      allowEmpty: true,
      historySource: result.builder,
    })
    const index = nextBodies.findIndex((entry) => entry.bodyId === bodyId)
    nextBodies.splice(index, 1, ...replacementResult.replacements)
    for (const replacement of replacementResult.replacements) {
      producedTargets.push({ kind: 'body', bodyId: replacement.bodyId })
    }
    for (const [key, value] of replacementResult.historyInvalidations) {
      combinedHistoryInvalidations.set(key, value)
    }
  }

  return {
    bodies: nextBodies,
    producedTargets,
    historyInvalidations: combinedHistoryInvalidations,
  }
}

function buildExtrudeFeatureShape(
  context: OccFeatureExecutionContext,
  parameters: ExtrudeFeatureParameters,
) {
  if (parameters.startExtent.kind !== 'profilePlane') {
    throw new Error('Extrude startExtent.kind must be profilePlane.')
  }

  if (parameters.endExtent.distance <= 0) {
    throw new Error('Extrude endExtent.distance must be positive.')
  }

  let profileShape: InstanceType<OpenCascadeInstance['TopoDS_Shape']>
  let extrusionNormal: Vec3

  if (parameters.profile.kind === 'region') {
    const sketch = requireSketchSnapshot(context, parameters.profile.sketchId)
    const region = requireRegion(sketch, parameters.profile.regionId)
    const profile = buildRegionProfileFace(context.oc, { plane: sketch.plane, sketch: sketch.sketch }, region)
    profileShape = profile.face
    extrusionNormal = getExtrusionNormalForSketchProfile(profile.plane, parameters.endExtent.direction)
  } else {
    const body = requireBody(context, parameters.profile.bodyId)
    const face = requireFace(body, parameters.profile.faceId)
    profileShape = face
    extrusionNormal = getExtrusionNormalForPlanarFace(context.oc, face, parameters.endExtent.direction)
  }

  const prism = new context.oc.BRepPrimAPI_MakePrism_1(
    profileShape,
    toGpVec(context.oc, scale(normalize(extrusionNormal), parameters.endExtent.distance)),
    false,
    true,
  )

  prism.Build(new context.oc.Message_ProgressRange_1())

  if (!prism.IsDone()) {
    throw new Error('OCC extrude prism build failed.')
  }

  return prism.Shape()
}

function buildRevolveFeatureShape(
  context: OccFeatureExecutionContext,
  parameters: RevolveFeatureParameters,
) {
  if (parameters.axis.kind === 'construction') {
    throw new Error(`${OCC_CONTRACT_GAP_CODES.constructionRevolveAxisUnsupported}: ${getConstructionBackedRevolveAxisRejectionReason()}`)
  }

  if (parameters.extent.kind !== 'angle') {
    throw new Error('Revolve extent.kind must be angle.')
  }

  if (parameters.extent.radians <= 0) {
    throw new Error('Revolve extent.radians must be positive.')
  }

  let profileShape: InstanceType<OpenCascadeInstance['TopoDS_Shape']>

  if (parameters.profile.kind === 'region') {
    const sketch = requireSketchSnapshot(context, parameters.profile.sketchId)
    const region = requireRegion(sketch, parameters.profile.regionId)
    profileShape = buildRegionProfileFace(context.oc, { plane: sketch.plane, sketch: sketch.sketch }, region).face
  } else {
    const body = requireBody(context, parameters.profile.bodyId)
    const face = requireFace(body, parameters.profile.faceId)
    getExtrusionNormalForPlanarFace(context.oc, face, 'positive')
    profileShape = face
  }

  const axisBody = requireBody(context, parameters.axis.bodyId)
  const axisEdge = requireEdge(axisBody, parameters.axis.edgeId)
  const axis = buildAxisFromLineEdge(context.oc, axisEdge)

  const signedExtent = parameters.extent.direction === 'counterClockwise'
    ? parameters.extent.radians
    : -parameters.extent.radians

  if (parameters.startAngle !== 0) {
    const rotation = new context.oc.gp_Trsf_1()
    rotation.SetRotation_1(axis, parameters.startAngle)
    const transform = new context.oc.BRepBuilderAPI_Transform_2(profileShape, rotation, true)
    transform.Build(new context.oc.Message_ProgressRange_1())

    if (!transform.IsDone()) {
      throw new Error('OCC revolve pre-rotation transform failed.')
    }

    profileShape = transform.Shape()
  }

  const revol = new context.oc.BRepPrimAPI_MakeRevol_1(
    profileShape,
    axis,
    signedExtent,
    false,
  )
  revol.Build(new context.oc.Message_ProgressRange_1())

  if (!revol.IsDone()) {
    throw new Error('OCC revolve build failed.')
  }

  return revol.Shape()
}

function executePlaneFeature(
  context: OccFeatureExecutionContext,
  ownerFeatureId: FeatureId,
  parameters: PlaneFeatureParameters,
): OccFeatureExecutionResult {
  if (parameters.mode !== 'coplanar') {
    throw new Error('Plane feature mode must be coplanar.')
  }

  if (parameters.reference.target.kind === 'construction') {
    const sourceConstructionId = parameters.reference.target.constructionId
    const sourceConstruction = context.constructions.find(
      (entry) => entry.constructionId === sourceConstructionId,
    )

    if (!sourceConstruction) {
      throw new Error(`Construction plane ${sourceConstructionId} does not resolve in the current OCC authoring state.`)
    }
  }

  const constructionId = `construction_${ownerFeatureId}` as ConstructionId
  const plane: SketchPlaneDefinition = parameters.reference.target.kind === 'construction'
    ? {
        support: { kind: 'construction', constructionId },
        frame: requireConstructionPlaneDefinition(context, parameters.reference.target.constructionId).frame,
        key: null,
      }
    : buildConstructionPlaneFromPlanarFace(
        context.oc,
        requireFace(requireBody(context, parameters.reference.target.bodyId), parameters.reference.target.faceId),
        parameters.reference.target.faceId,
        { kind: 'construction', constructionId },
      )

  const construction = {
    ownerDocumentId: context.documentId,
    ownerRevisionId: context.revisionId,
    ownerFeatureId,
    ownerSketchId: null,
    ownerBodyId: null,
    constructionId,
    label: ownerFeatureId,
    constructionType: 'plane',
    target: { kind: 'construction', constructionId },
  } satisfies ConstructionSnapshotRecord

  const constructionPlanes = new Map(context.constructionPlanes)
  constructionPlanes.set(constructionId, plane)
  const artifacts = createConstructionPresentationArtifacts(context, construction, plane)

  return {
    bodies: [...context.bodies],
    constructions: [...context.constructions, construction],
    constructionPlanes,
    producedTargets: [{ kind: 'construction', constructionId }],
    entities: artifacts.entities,
    renderRecords: artifacts.renderRecords,
    historyInvalidations: new Map<string, OccReferenceInvalidationRecord>(),
  }
}

function executeExtrudeFeature(
  context: OccFeatureExecutionContext,
  ownerFeatureId: FeatureId,
  parameters: ExtrudeFeatureParameters,
): OccFeatureExecutionResult {
  const featureShape = buildExtrudeFeatureShape(context, parameters)
  const result = applyBooleanPolicy(context, ownerFeatureId, parameters.operation, parameters.booleanScope, featureShape)

  return {
    bodies: result.bodies,
    constructions: [...context.constructions],
    constructionPlanes: new Map(context.constructionPlanes),
    producedTargets: result.producedTargets,
    entities: [],
    renderRecords: [],
    historyInvalidations: result.historyInvalidations,
  }
}

function executeRevolveFeature(
  context: OccFeatureExecutionContext,
  ownerFeatureId: FeatureId,
  parameters: RevolveFeatureParameters,
): OccFeatureExecutionResult {
  const featureShape = buildRevolveFeatureShape(context, parameters)
  const result = applyBooleanPolicy(context, ownerFeatureId, parameters.operation, parameters.booleanScope, featureShape)

  return {
    bodies: result.bodies,
    constructions: [...context.constructions],
    constructionPlanes: new Map(context.constructionPlanes),
    producedTargets: result.producedTargets,
    entities: [],
    renderRecords: [],
    historyInvalidations: result.historyInvalidations,
  }
}

function executeFilletFeature(
  context: OccFeatureExecutionContext,
  ownerFeatureId: FeatureId,
  parameters: FilletFeatureParameters,
): OccFeatureExecutionResult {
  if (parameters.radius <= 0) {
    throw new Error('Fillet radius must be positive.')
  }

  if (parameters.edgeTargets.length === 0) {
    throw new Error('Fillet requires at least one target edge.')
  }

  const targetsByBody = new Map<BodyId, FilletFeatureParameters['edgeTargets']>()

  for (const target of parameters.edgeTargets) {
    const list = targetsByBody.get(target.bodyId) ?? []
    targetsByBody.set(target.bodyId, [...list, target])
  }

  const nextBodies = [...context.bodies]
  const producedTargets: DurableRef[] = []
  const historyInvalidations = new Map<string, OccReferenceInvalidationRecord>()

  for (const [bodyId, targets] of targetsByBody.entries()) {
    const body = requireBody(context, bodyId)
    const fillet = new context.oc.BRepFilletAPI_MakeFillet(
      body.shape,
      context.oc.ChFi3d_FilletShape.ChFi3d_Rational as never,
    )

    for (const target of targets) {
      fillet.Add_2(parameters.radius, requireEdge(body, target.edgeId))
    }

    fillet.Build(new context.oc.Message_ProgressRange_1())

    if (!fillet.IsDone()) {
      throw new Error(`OCC fillet build failed for body ${bodyId}.`)
    }

    const replacementResult = resolveReplacementBodies(context, bodyId, fillet.Shape(), ownerFeatureId, {
      allowEmpty: false,
      historySource: fillet,
    })
    const index = nextBodies.findIndex((entry) => entry.bodyId === bodyId)
    nextBodies.splice(index, 1, ...replacementResult.replacements)
    for (const replacement of replacementResult.replacements) {
      producedTargets.push({ kind: 'body', bodyId: replacement.bodyId })
    }
    for (const [key, value] of replacementResult.historyInvalidations) {
      historyInvalidations.set(key, value)
    }
  }

  return {
    bodies: nextBodies,
    constructions: [...context.constructions],
    constructionPlanes: new Map(context.constructionPlanes),
    producedTargets,
    entities: [],
    renderRecords: [],
    historyInvalidations,
  }
}

export function executeOccFeature(
  context: OccFeatureExecutionContext,
  ownerFeatureId: FeatureId,
  definition: FeatureDefinition,
): OccFeatureExecutionResult {
  switch (definition.kind) {
    case 'plane':
      return executePlaneFeature(context, ownerFeatureId, definition.parameters)
    case 'extrude':
      return executeExtrudeFeature(context, ownerFeatureId, definition.parameters)
    case 'revolve':
      return executeRevolveFeature(context, ownerFeatureId, definition.parameters)
    case 'fillet':
      return executeFilletFeature(context, ownerFeatureId, definition.parameters)
  }
}

function constructionEntityId(constructionId: ConstructionId) {
  return `snapshot_entity_${constructionId}` as SnapshotEntityId
}

function constructionRenderableId(constructionId: ConstructionId) {
  return `renderable_${constructionId}` as RenderableId
}

function constructionPickId(constructionId: ConstructionId) {
  return `pick_${constructionId}` as PickId
}

function buildConstructionOutlinePoints(plane: SketchPlaneDefinition, size = 10) {
  const { origin, xAxis, yAxis } = plane.frame
  const cornerOffsets = [
    [-size, -size],
    [size, -size],
    [size, size],
    [-size, size],
  ] as const

  return cornerOffsets.map(([x, y]) => [
    origin[0] + xAxis[0] * x + yAxis[0] * y,
    origin[1] + xAxis[1] * x + yAxis[1] * y,
    origin[2] + xAxis[2] * x + yAxis[2] * y,
  ] as const)
}

export function createConstructionPresentationArtifacts(
  context: Pick<OccFeatureExecutionContext, 'documentId' | 'revisionId'>,
  construction: ConstructionSnapshotRecord,
  plane: SketchPlaneDefinition,
): OccFeaturePresentationArtifacts {
  const entity: SnapshotEntityRecord = {
    ownerDocumentId: context.documentId,
    ownerRevisionId: context.revisionId,
    ownerFeatureId: construction.ownerFeatureId,
    ownerSketchId: null,
    ownerBodyId: null,
    id: constructionEntityId(construction.constructionId),
    label: construction.label,
    target: { kind: 'construction', constructionId: construction.constructionId },
    relatedTargets: [],
    consumedByFeatureIds: [],
    selectionSemantics: ['constructionPlane', 'planarReference'],
  }

  const renderRecord: RenderableEntityRecord = {
    id: constructionRenderableId(construction.constructionId),
    label: construction.label,
    ownerBodyId: null,
    ownerFeatureId: construction.ownerFeatureId,
    binding: {
      pickId: constructionPickId(construction.constructionId),
      pickPriority: 5,
      target: { kind: 'construction', constructionId: construction.constructionId },
      topology: null,
      semanticClass: 'construction',
    },
    geometry: {
      kind: 'polyline',
      points: buildConstructionOutlinePoints(plane),
      isClosed: true,
    },
  }

  return {
    entities: [entity],
    renderRecords: [renderRecord],
  }
}

export function createEmptyOccRenderExport() {
  return {
    schemaVersion: RENDER_EXPORT_SCHEMA_VERSION,
    records: [],
  } as const
}

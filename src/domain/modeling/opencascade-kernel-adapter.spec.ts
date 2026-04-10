import type { SketchSolverAdapter } from '@/contracts/solver/adapter'
import type {
  DeriveSketchRegionsRequest,
  DeriveSketchRegionsResponse,
  ProjectedSketchReferenceRecord,
  ProjectSketchExternalReferencesRequest,
  ProjectSketchExternalReferencesResponse,
  ResolveSketchReferenceRequest,
  ResolveSketchReferenceResponse,
  SolveSketchRequest,
  SolveSketchResponse,
  ValidateSketchRequest,
  ValidateSketchResponse,
} from '@/contracts/solver/schema'
import { SOLVER_SCHEMA_VERSION } from '@/contracts/solver/schema'
import type {
  BodySnapshotRecord,
  CommitSketchRequest,
  FeatureDefinition,
  GetDocumentSnapshotResponse,
  ModelingDiagnostic,
  SketchSnapshotRecord,
} from '@/contracts/modeling/schema'
import type {
  BodyId,
  EdgeId,
  DocumentId,
  FaceId,
  ProjectedGeometryId,
  RevisionId,
  SketchId,
} from '@/contracts/shared/ids'
import { CONTRACT_VERSION } from '@/contracts/shared/versioning'
import {
  EXTRUDE_FEATURE_SCHEMA_VERSION,
  FILLET_FEATURE_SCHEMA_VERSION,
  PLANE_FEATURE_SCHEMA_VERSION,
  REVOLVE_FEATURE_SCHEMA_VERSION,
  SHELL_FEATURE_SCHEMA_VERSION,
} from '@/contracts/shared/versioning'
import { OCC_CONTRACT_GAP_CODES } from '@/domain/modeling/occ/implementation-policy'
import {
  DEFAULT_MOCK_SOLVER_TOLERANCES,
  evaluateMockSketchDefinition,
} from '@/domain/solver/mock-sketch-solver-adapter'
import {
  OCC_KERNEL_PRIMARY_SKETCH_ID,
  createSeedSketchCommitRequest,
  createStandardPlaneDefinition,
} from '@/domain/modeling/opencascade-kernel-seed'
import { OpenCascadeKernelAdapter } from '@/domain/modeling/opencascade-kernel-adapter'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function createProjectedGeometryId(referenceId: string, ordinal: number): ProjectedGeometryId {
  return `projected_geometry_${referenceId}_${ordinal}` as ProjectedGeometryId
}

function projectReference(
  reference: ProjectSketchExternalReferencesRequest['references'][number],
): ProjectedSketchReferenceRecord {
  if (reference.reference.kind === 'constructionPlane') {
    return {
      referenceId: reference.referenceId,
      status: 'projected',
      geometry: [],
      diagnostics: [],
    }
  }

  if (reference.reference.source.kind === 'vertex') {
    return {
      referenceId: reference.referenceId,
      status: 'projected',
      geometry: [{
        geometryId: createProjectedGeometryId(reference.referenceId, 0),
        kind: 'point',
        position: [0, 0],
      }],
      diagnostics: [],
    }
  }

  if (reference.reference.source.kind === 'edge') {
    return {
      referenceId: reference.referenceId,
      status: 'projected',
      geometry: [{
        geometryId: createProjectedGeometryId(reference.referenceId, 0),
        kind: 'lineSegment',
        startPosition: [-2, 0],
        endPosition: [2, 0],
      }],
      diagnostics: [],
    }
  }

  return {
    referenceId: reference.referenceId,
    status: 'projected',
    geometry: [{
      geometryId: createProjectedGeometryId(reference.referenceId, 0),
      kind: 'circle',
      centerPosition: [0, 0],
      radius: 1,
    }],
    diagnostics: [],
  }
}

class DeterministicSketchSolverAdapter implements SketchSolverAdapter {
  async projectExternalReferences(
    request: ProjectSketchExternalReferencesRequest,
  ): Promise<ProjectSketchExternalReferencesResponse> {
    return {
      contractVersion: CONTRACT_VERSION,
      solverSchemaVersion: SOLVER_SCHEMA_VERSION,
      requestId: request.requestId,
      documentId: request.documentId,
      revisionId: request.revisionId,
      sketchId: request.sketchId,
      projectedReferences: request.references.map(projectReference),
      diagnostics: [],
    }
  }

  async validateSketch(request: ValidateSketchRequest): Promise<ValidateSketchResponse> {
    const evaluation = evaluateMockSketchDefinition({
      documentId: request.documentId,
      revisionId: request.revisionId,
      sketchId: request.sketchId,
      plane: request.plane,
      tolerances: request.tolerances,
      definition: request.definition,
      requestId: request.requestId,
    })

    return evaluation.validation
  }

  async solveSketch(request: SolveSketchRequest): Promise<SolveSketchResponse> {
    const evaluation = evaluateMockSketchDefinition({
      documentId: request.documentId,
      revisionId: request.revisionId,
      sketchId: request.sketchId,
      plane: request.plane,
      tolerances: request.tolerances,
      definition: request.definition,
      requestId: request.requestId,
    })

    return evaluation.solve
  }

  async deriveSketchRegions(
    request: DeriveSketchRegionsRequest,
  ): Promise<DeriveSketchRegionsResponse> {
    const evaluation = evaluateMockSketchDefinition({
      documentId: request.documentId,
      revisionId: request.revisionId,
      sketchId: request.sketchId,
      plane: createSeedSketchCommitRequest().plane.frame,
      tolerances: DEFAULT_MOCK_SOLVER_TOLERANCES,
      definition: request.definition,
      requestId: request.requestId,
    })

    return evaluation.regions
  }

  async resolveSketchReference(
    request: ResolveSketchReferenceRequest,
  ): Promise<ResolveSketchReferenceResponse> {
    void request
    throw new Error('OCC adapter tests do not exercise resolveSketchReference directly.')
  }
}

class ProjectedRegionLoopSketchSolverAdapter extends DeterministicSketchSolverAdapter {
  override async deriveSketchRegions(
    request: DeriveSketchRegionsRequest,
  ): Promise<DeriveSketchRegionsResponse> {
    const response = await super.deriveSketchRegions(request)
    const region = response.regions[0]
    const loop = region?.loops[0]
    const segment = loop?.segments[0]

    if (!region || !loop || !segment) {
      return response
    }

    const referenceId = request.definition.referenceIds[0] ?? 'ref_projected_gap'

    return {
      ...response,
      regions: [
        {
          ...region,
          loops: [
            {
              ...loop,
              segments: [
                {
                  ...segment,
                  source: {
                    kind: 'projectedGeometry',
                    reference: {
                      referenceId,
                      geometryId: createProjectedGeometryId(referenceId, 0),
                    },
                  },
                },
                ...loop.segments.slice(1),
              ],
            },
            ...region.loops.slice(1),
          ],
        },
        ...response.regions.slice(1),
      ],
    }
  }
}

function createAdapter(
  createSolverAdapter: () => SketchSolverAdapter = () => new DeterministicSketchSolverAdapter(),
) {
  return new OpenCascadeKernelAdapter({
    solverAdapter: createSolverAdapter(),
    solverAdapterFactory: () => createSolverAdapter(),
  })
}

function createSolverCorrelation(prefix: string) {
  return {
    requestId: `request_${prefix}_commit` as const,
    projectionRequestId: `request_${prefix}_project` as const,
    validationRequestId: `request_${prefix}_validate` as const,
    solveRequestId: `request_${prefix}_solve` as const,
    regionRequestId: `request_${prefix}_regions` as const,
  }
}

function createSketchCommitRequest(
  baseRevisionId: RevisionId,
  overrides: Partial<ReturnType<typeof createSeedSketchCommitRequest>> = {},
): CommitSketchRequest {
  const seed = createSeedSketchCommitRequest()
  const plane = overrides.plane ?? seed.plane

  return {
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace' as DocumentId,
    baseRevisionId,
    solverCorrelation: createSolverCorrelation(`request_${String(baseRevisionId)}_${overrides.sketchLabel ?? seed.sketchLabel}`),
    ...seed,
    ...overrides,
    plane,
    planeTarget: plane.support,
    planeKey: plane.key,
  }
}

async function commitSeedSketch(
  adapter: OpenCascadeKernelAdapter,
  baseRevisionId: RevisionId = 'rev_0001',
) {
  return adapter.commitSketch(createSketchCommitRequest(baseRevisionId))
}

function translateSeedDefinition(offsetX: number, offsetY: number) {
  const seed = createSeedSketchCommitRequest().definition

  return {
    ...seed,
    points: seed.points.map((point) => ({
      ...point,
      position: [point.position[0] + offsetX, point.position[1] + offsetY] as const,
    })),
  }
}

async function commitOffsetSketch(
  adapter: OpenCascadeKernelAdapter,
  baseRevisionId: RevisionId,
  options: {
    sketchLabel: string
    offsetX: number
    offsetY: number
    plane?: ReturnType<typeof createStandardPlaneDefinition>
  },
) {
  return adapter.commitSketch(createSketchCommitRequest(baseRevisionId, {
    sketchLabel: options.sketchLabel,
    plane: options.plane,
    definition: translateSeedDefinition(options.offsetX, options.offsetY),
  }))
}

function requirePrimarySketch(snapshot: GetDocumentSnapshotResponse['snapshot']): SketchSnapshotRecord {
  const sketch = snapshot.sketches.find((entry) => entry.sketchId === OCC_KERNEL_PRIMARY_SKETCH_ID)

  if (!sketch) {
    throw new Error('Primary committed sketch must exist in the snapshot.')
  }

  return sketch
}

function requireSketch(snapshot: GetDocumentSnapshotResponse['snapshot'], sketchId: SketchId) {
  const sketch = snapshot.sketches.find((entry) => entry.sketchId === sketchId)

  if (!sketch) {
    throw new Error(`Expected snapshot to contain sketch ${sketchId}.`)
  }

  return sketch
}

function requireBody(snapshot: GetDocumentSnapshotResponse['snapshot'], bodyId: BodyId): BodySnapshotRecord {
  const body = snapshot.bodies.find((entry) => entry.bodyId === bodyId)

  if (!body) {
    throw new Error(`Expected snapshot to contain body ${bodyId}.`)
  }

  return body
}

function hasErrorDiagnostics(diagnostics: readonly ModelingDiagnostic[]) {
  return diagnostics.some((diagnostic) => diagnostic.severity === 'error')
}

function assertNoErrorDiagnostics(diagnostics: readonly ModelingDiagnostic[], message: string) {
  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === 'error')

  if (errors.length > 0) {
    throw new Error(`${message}: ${errors.map((diagnostic) => `${diagnostic.code}=${diagnostic.message}`).join(' | ')}`)
  }
}

function topologySignature(body: BodySnapshotRecord) {
  return JSON.stringify(body.topology)
}

function renderGeometrySignature(
  snapshot: GetDocumentSnapshotResponse['snapshot'],
  bodyId: BodyId,
) {
  const records = snapshot.render.records
    .filter((record) => record.ownerBodyId === bodyId)
    .map((record) => ({
      id: record.id,
      geometry: record.geometry,
      binding: record.binding,
    }))

  return JSON.stringify(records)
}

function bodyRenderGeometryOnlySignature(
  snapshot: GetDocumentSnapshotResponse['snapshot'],
  bodyId: BodyId,
) {
  const records = snapshot.render.records
    .filter((record) => record.ownerBodyId === bodyId)
    .map((record) => JSON.stringify(record.geometry))
    .sort()

  return JSON.stringify(records)
}

function committedBodySignature(
  snapshot: GetDocumentSnapshotResponse['snapshot'],
  bodyId: BodyId,
) {
  return JSON.stringify({
    topology: requireBody(snapshot, bodyId).topology,
    render: renderGeometrySignature(snapshot, bodyId),
  })
}

function createExtrudeDefinition(sketch: SketchSnapshotRecord, distance: number): FeatureDefinition {
  const region = sketch.sketch.regions[0]

  if (!region) {
    throw new Error('Committed sketch must expose at least one derived region for extrude testing.')
  }

  return {
    kind: 'extrude',
    featureTypeVersion: EXTRUDE_FEATURE_SCHEMA_VERSION,
    parameters: {
      profile: {
        kind: 'region',
        sketchId: sketch.sketchId,
        regionId: region.regionId,
      },
      startExtent: { kind: 'profilePlane' },
      endExtent: { kind: 'blind', direction: 'positive', distance },
      depth: distance,
      direction: 'oneSided',
      operation: 'newBody',
      booleanScope: { kind: 'standalone' },
    },
  }
}

function createPlaneDefinitionFromConstruction(constructionId: `construction_${string}`): FeatureDefinition {
  return {
    kind: 'plane',
    featureTypeVersion: PLANE_FEATURE_SCHEMA_VERSION,
    parameters: {
      mode: 'coplanar',
      reference: {
        target: { kind: 'construction', constructionId },
      },
    },
  }
}

function createPlaneDefinitionFromFace(bodyId: BodyId, faceId: FaceId): FeatureDefinition {
  return {
    kind: 'plane',
    featureTypeVersion: PLANE_FEATURE_SCHEMA_VERSION,
    parameters: {
      mode: 'coplanar',
      reference: {
        target: { kind: 'face', bodyId, faceId },
      },
    },
  }
}

function createRevolveDefinition(
  sketch: SketchSnapshotRecord,
  axisBodyId: BodyId,
  axisEdgeId: EdgeId,
): FeatureDefinition {
  const region = sketch.sketch.regions[0]

  if (!region) {
    throw new Error('Committed sketch must expose a region for revolve testing.')
  }

  return {
    kind: 'revolve',
    featureTypeVersion: REVOLVE_FEATURE_SCHEMA_VERSION,
    parameters: {
      profile: {
        kind: 'region',
        sketchId: sketch.sketchId,
        regionId: region.regionId,
      },
      axis: {
        kind: 'edge',
        bodyId: axisBodyId,
        edgeId: axisEdgeId,
      },
      startAngle: 0,
      extent: { kind: 'angle', direction: 'counterClockwise', radians: Math.PI / 2 },
      angle: Math.PI / 2,
      operation: 'newBody',
      booleanScope: { kind: 'standalone' },
    },
  }
}

function createConstructionAxisRevolveDefinition(
  sketch: SketchSnapshotRecord,
  constructionId: `construction_${string}`,
): FeatureDefinition {
  const region = sketch.sketch.regions[0]

  if (!region) {
    throw new Error('Committed sketch must expose a region for revolve testing.')
  }

  return {
    kind: 'revolve',
    featureTypeVersion: REVOLVE_FEATURE_SCHEMA_VERSION,
    parameters: {
      profile: {
        kind: 'region',
        sketchId: sketch.sketchId,
        regionId: region.regionId,
      },
      axis: {
        kind: 'construction',
        constructionId,
      },
      startAngle: 0,
      extent: { kind: 'angle', direction: 'counterClockwise', radians: Math.PI / 2 },
      angle: Math.PI / 2,
      operation: 'newBody',
      booleanScope: { kind: 'standalone' },
    },
  }
}

function createFilletDefinition(bodyId: BodyId, edgeId: EdgeId, radius: number): FeatureDefinition {
  return {
    kind: 'fillet',
    featureTypeVersion: FILLET_FEATURE_SCHEMA_VERSION,
    parameters: {
      radius,
      edgeTargets: [{ kind: 'edge', bodyId, edgeId }],
    },
  }
}

function createShellDefinition(bodyId: BodyId, faceId: FaceId, thickness: number): FeatureDefinition {
  return {
    kind: 'shell',
    featureTypeVersion: SHELL_FEATURE_SCHEMA_VERSION,
    parameters: {
      bodyTarget: { kind: 'body', bodyId },
      faceTargets: [{ kind: 'face', bodyId, faceId }],
      thickness,
      operation: 'newBody',
      booleanScope: { kind: 'standalone' },
    },
  }
}

async function createExtrudeBody(
  adapter: OpenCascadeKernelAdapter,
  baseRevisionId: RevisionId,
  sketch: SketchSnapshotRecord,
  distance: number,
) {
  const created = await adapter.createFeature({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
    baseRevisionId,
    definition: createExtrudeDefinition(sketch, distance),
  })

  assert(created.revisionState.kind === 'accepted', 'Extrude create must be accepted.')
  assert(created.rebuildResult.kind === 'rebuilt', 'Extrude create must rebuild.')

  const createdBodyTarget = created.changedTargets.find((target) => target.kind === 'body')

  if (!createdBodyTarget || createdBodyTarget.kind !== 'body') {
    throw new Error('Extrude create must report a created body target.')
  }

  return {
    response: created,
    bodyId: createdBodyTarget.bodyId,
  }
}

async function findPreviewablePlanarFace(
  adapter: OpenCascadeKernelAdapter,
  revisionId: RevisionId,
  bodyId: BodyId,
) {
  const snapshot = await adapter.getDocumentSnapshot({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
  })
  const body = requireBody(snapshot.snapshot, bodyId)

  for (const faceId of body.topology.faceIds) {
    const preview = await adapter.evaluatePreview({
      contractVersion: CONTRACT_VERSION,
      documentId: 'doc_workspace',
      baseRevisionId: revisionId,
      previewId: `preview_plane_face_${faceId}`,
      definition: createPlaneDefinitionFromFace(bodyId, faceId),
    })

    if (!hasErrorDiagnostics(preview.diagnostics) && preview.render.records.length > 0) {
      return faceId
    }
  }

  throw new Error(`Expected body ${bodyId} to expose a planar face usable for plane-feature preview.`)
}

async function findPreviewableFilletEdge(
  adapter: OpenCascadeKernelAdapter,
  bodyId: BodyId,
) {
  const snapshot = await adapter.getDocumentSnapshot({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
  })
  const body = requireBody(snapshot.snapshot, bodyId)
  const edgeId = body.topology.edgeIds[0]

  if (!edgeId) {
    throw new Error(`Expected body ${bodyId} to expose at least one edge for fillet coverage.`)
  }

  return edgeId
}

async function findPreviewableRevolveAxisEdge(
  adapter: OpenCascadeKernelAdapter,
  revisionId: RevisionId,
  sketch: SketchSnapshotRecord,
  bodyId: BodyId,
) {
  const snapshot = await adapter.getDocumentSnapshot({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
  })
  const body = requireBody(snapshot.snapshot, bodyId)

  for (const edgeId of body.topology.edgeIds) {
    const preview = await adapter.evaluatePreview({
      contractVersion: CONTRACT_VERSION,
      documentId: 'doc_workspace',
      baseRevisionId: revisionId,
      previewId: `preview_revolve_edge_${edgeId}`,
      definition: createRevolveDefinition(sketch, bodyId, edgeId),
    })

    if (!hasErrorDiagnostics(preview.diagnostics) && preview.render.records.length > 0) {
      return edgeId
    }
  }

  throw new Error(`Expected body ${bodyId} to expose an edge-backed revolve axis.`)
}

async function testSnapshotFetchAndSketchCommit() {
  const adapter = createAdapter()
  const before = await adapter.getDocumentSnapshot({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
  })

  assert(before.snapshot.constructions.length === 3, 'Initial OCC snapshot must expose the three datum planes.')
  assert(before.snapshot.render.records.length > 0, 'Initial OCC snapshot must expose render export records.')

  const committed = await commitSeedSketch(adapter)

  assert(committed.revisionState.kind === 'accepted', 'Seed sketch commit must be accepted.')
  assert(committed.rebuildResult.kind === 'rebuilt', 'Accepted sketch commits must report rebuilt results.')

  const after = await adapter.getDocumentSnapshot({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
  })

  assert(after.snapshot.revisionId === committed.revisionId, 'Snapshot fetch must observe the committed sketch revision.')
  assert(
    after.snapshot.sketches.some((sketch) => sketch.sketchId === OCC_KERNEL_PRIMARY_SKETCH_ID),
    'Committed sketches must persist in later authoritative snapshots.',
  )
}

async function testPlaneFeatureCreateSupportsConstructionAndPlanarFaceReferences() {
  const adapter = createAdapter()
  const committed = await commitSeedSketch(adapter)

  if (committed.revisionState.kind !== 'accepted') {
    throw new Error('Seed sketch commit must succeed before plane coverage.')
  }

  const committedSnapshot = await adapter.getDocumentSnapshot({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
  })
  const sketch = requirePrimarySketch(committedSnapshot.snapshot)
  const constructionPlane = await adapter.createFeature({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
    baseRevisionId: committedSnapshot.snapshot.revisionId,
    definition: createPlaneDefinitionFromConstruction('construction_plane-xy'),
  })

  assert(constructionPlane.revisionState.kind === 'accepted', 'Construction-backed coplanar planes must create successfully.')
  assert(constructionPlane.rebuildResult.kind === 'rebuilt', 'Construction-backed plane create must rebuild.')
  assert(
    constructionPlane.changedTargets.some((target) => target.kind === 'construction'),
    'Plane create must report the produced construction target.',
  )

  const extrude = await createExtrudeBody(adapter, constructionPlane.revisionId, sketch, 12)
  const planarFaceId = await findPreviewablePlanarFace(adapter, extrude.response.revisionId, extrude.bodyId)
  const facePlane = await adapter.createFeature({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
    baseRevisionId: extrude.response.revisionId,
    definition: createPlaneDefinitionFromFace(extrude.bodyId, planarFaceId),
  })

  assert(facePlane.revisionState.kind === 'accepted', 'Planar-face-backed coplanar planes must create successfully.')
  assert(facePlane.rebuildResult.kind === 'rebuilt', 'Planar-face-backed plane create must rebuild.')
  assert(
    facePlane.changedTargets.some((target) => target.kind === 'construction'),
    'Face-backed plane create must report the produced construction target.',
  )
}

async function testExtrudePreviewCreateAndUpdateCommitGeometry() {
  const adapter = createAdapter()
  const committed = await commitSeedSketch(adapter)

  if (committed.revisionState.kind !== 'accepted') {
    throw new Error('Seed sketch commit must succeed before extrude coverage.')
  }

  const snapshot = await adapter.getDocumentSnapshot({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
  })
  const sketch = requirePrimarySketch(snapshot.snapshot)
  const preview = await adapter.evaluatePreview({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
    baseRevisionId: snapshot.snapshot.revisionId,
    previewId: 'preview_extrude_fresh',
    definition: createExtrudeDefinition(sketch, 12),
  })

  assert(preview.freshness.kind === 'fresh', 'Fresh extrude previews must report fresh freshness state.')
  assert(preview.render.records.length > 0, 'Extrude preview must return transient renderables.')
  assertNoErrorDiagnostics(preview.diagnostics, 'Extrude preview must not surface error diagnostics for valid input')

  const created = await adapter.createFeature({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
    baseRevisionId: snapshot.snapshot.revisionId,
    definition: createExtrudeDefinition(sketch, 12),
  })

  assert(created.revisionState.kind === 'accepted', 'Extrude create must be accepted.')
  assert(created.rebuildResult.kind === 'rebuilt', 'Extrude create must rebuild.')

  const createdBodyTarget = created.changedTargets.find((target) => target.kind === 'body')

  if (!createdBodyTarget || createdBodyTarget.kind !== 'body') {
    throw new Error('Extrude create must report the created body as a changed target.')
  }

  const createdSnapshot = await adapter.getDocumentSnapshot({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
  })
  const createdSignature = committedBodySignature(createdSnapshot.snapshot, createdBodyTarget.bodyId)
  const updated = await adapter.updateFeature({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
    baseRevisionId: created.revisionId,
    featureId: created.featureId,
    definition: createExtrudeDefinition(sketch, 20),
  })

  assert(updated.revisionState.kind === 'accepted', 'Extrude update must be accepted.')
  assert(updated.rebuildResult.kind === 'rebuilt', 'Accepted extrude update must rebuild.')
  assert(
    updated.changedTargets.some((target) => target.kind === 'body' && target.bodyId === createdBodyTarget.bodyId),
    'Extrude update must report the rebuilt body target.',
  )

  const updatedSnapshot = await adapter.getDocumentSnapshot({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
  })

  assert(
    committedBodySignature(updatedSnapshot.snapshot, createdBodyTarget.bodyId) !== createdSignature,
    'Extrude update must commit changed body topology into later snapshots.',
  )
}

async function testRevolvePreviewCreateAndConstructionAxisRejection() {
  const adapter = createAdapter()
  const committed = await commitSeedSketch(adapter)

  if (committed.revisionState.kind !== 'accepted') {
    throw new Error('Seed sketch commit must succeed before revolve coverage.')
  }

  const firstSnapshot = await adapter.getDocumentSnapshot({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
  })
  const axisSketch = requirePrimarySketch(firstSnapshot.snapshot)
  const axisBody = await createExtrudeBody(adapter, firstSnapshot.snapshot.revisionId, axisSketch, 12)
  const revolveSketchCommit = await commitOffsetSketch(adapter, axisBody.response.revisionId, {
    sketchLabel: 'Revolve Profile',
    offsetX: 0,
    offsetY: 0,
    plane: createStandardPlaneDefinition('xz'),
  })

  assert(revolveSketchCommit.revisionState.kind === 'accepted', 'Revolve profile sketch commit must be accepted.')

  const revolveSnapshot = await adapter.getDocumentSnapshot({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
  })
  const revolveSketch = requireSketch(revolveSnapshot.snapshot, revolveSketchCommit.sketchId)
  const axisEdgeId = await findPreviewableRevolveAxisEdge(
    adapter,
    revolveSnapshot.snapshot.revisionId,
    revolveSketch,
    axisBody.bodyId,
  )
  const preview = await adapter.evaluatePreview({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
    baseRevisionId: revolveSnapshot.snapshot.revisionId,
    previewId: 'preview_revolve_edge_axis',
    definition: createRevolveDefinition(revolveSketch, axisBody.bodyId, axisEdgeId),
  })

  assert(preview.freshness.kind === 'fresh', 'Fresh revolve previews must report fresh freshness state.')
  assert(preview.render.records.length > 0, 'Edge-backed revolve preview must return transient renderables.')
  assertNoErrorDiagnostics(preview.diagnostics, 'Edge-backed revolve preview must not emit error diagnostics')

  const created = await adapter.createFeature({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
    baseRevisionId: revolveSnapshot.snapshot.revisionId,
    definition: createRevolveDefinition(revolveSketch, axisBody.bodyId, axisEdgeId),
  })

  assert(created.revisionState.kind === 'accepted', 'Edge-backed revolve create must be accepted.')
  assert(created.rebuildResult.kind === 'rebuilt', 'Edge-backed revolve create must rebuild.')
  assert(
    created.changedTargets.some((target) => target.kind === 'body'),
    'Edge-backed revolve create must report a produced body target.',
  )

  const rejected = await adapter.createFeature({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
    baseRevisionId: created.revisionId,
    definition: createConstructionAxisRevolveDefinition(revolveSketch, 'construction_plane-xy'),
  })

  assert(rejected.revisionState.kind === 'rejected', 'Construction-axis revolve requests must reject explicitly.')
  assert(rejected.rebuildResult.kind === 'skipped', 'Rejected construction-axis revolve requests must skip rebuild.')
  assert(
    rejected.diagnostics.some((diagnostic) => diagnostic.code === OCC_CONTRACT_GAP_CODES.constructionRevolveAxisUnsupported),
    'Construction-axis revolve rejection must surface the contract-gap diagnostic code.',
  )
  assert(
    rejected.diagnostics.some((diagnostic) => diagnostic.detail?.kind === 'rebuildFailure'),
    'Construction-axis revolve rejection must surface structured diagnostics.',
  )
}

async function testFilletCreateAndUpdateMutateBodyTopology() {
  const adapter = createAdapter()
  const committed = await commitSeedSketch(adapter)

  if (committed.revisionState.kind !== 'accepted') {
    throw new Error('Seed sketch commit must succeed before fillet coverage.')
  }

  const committedSnapshot = await adapter.getDocumentSnapshot({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
  })
  const sketch = requirePrimarySketch(committedSnapshot.snapshot)
  const extrude = await createExtrudeBody(adapter, committedSnapshot.snapshot.revisionId, sketch, 12)
  const preFilletSnapshot = await adapter.getDocumentSnapshot({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
  })
  const preFilletSignature = committedBodySignature(preFilletSnapshot.snapshot, extrude.bodyId)
  const edgeId = await findPreviewableFilletEdge(adapter, extrude.bodyId)
  const created = await adapter.createFeature({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
    baseRevisionId: extrude.response.revisionId,
    definition: createFilletDefinition(extrude.bodyId, edgeId, 0.5),
  })

  assert(created.revisionState.kind === 'accepted', 'Fillet create must be accepted.')
  assert(created.rebuildResult.kind === 'rebuilt', 'Fillet create must rebuild.')

  const createdSnapshot = await adapter.getDocumentSnapshot({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
  })
  const createdSignature = committedBodySignature(createdSnapshot.snapshot, extrude.bodyId)

  assert(
    createdSignature !== preFilletSignature,
    'Fillet create must mutate the owning body topology in later snapshots.',
  )

  const updated = await adapter.updateFeature({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
    baseRevisionId: created.revisionId,
    featureId: created.featureId,
    definition: createFilletDefinition(extrude.bodyId, edgeId, 1),
  })

  assert(updated.revisionState.kind === 'accepted', 'Fillet update must be accepted.')
  assert(updated.rebuildResult.kind === 'rebuilt', 'Fillet update must rebuild.')

  const updatedSnapshot = await adapter.getDocumentSnapshot({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
  })

  assert(
    committedBodySignature(updatedSnapshot.snapshot, extrude.bodyId) !== createdSignature,
    'Fillet update must rebuild the body topology for the new radius.',
  )
}

async function testShellPreviewCreateUpdateAndSnapshotRoundTrip() {
  const adapter = createAdapter()
  const committed = await commitSeedSketch(adapter)

  if (committed.revisionState.kind !== 'accepted') {
    throw new Error('Seed sketch commit must succeed before shell coverage.')
  }

  const committedSnapshot = await adapter.getDocumentSnapshot({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
  })
  const sketch = requirePrimarySketch(committedSnapshot.snapshot)
  const extrude = await createExtrudeBody(adapter, committedSnapshot.snapshot.revisionId, sketch, 8)
  const extrudedSnapshot = await adapter.getDocumentSnapshot({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
  })
  const sourceBody = requireBody(extrudedSnapshot.snapshot, extrude.bodyId)
  const removableFaceId = sourceBody.topology.faceIds[0]

  if (!removableFaceId) {
    throw new Error('Extruded source body must expose at least one face for shell coverage.')
  }

  const preview = await adapter.evaluatePreview({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
    baseRevisionId: extrudedSnapshot.snapshot.revisionId,
    previewId: 'preview_shell_1',
    definition: createShellDefinition(extrude.bodyId, removableFaceId, 0.75),
  })

  assert(preview.freshness.kind === 'fresh', 'Fresh shell previews must report fresh freshness state.')
  assert(preview.render.records.length > 0, 'Shell preview must return transient renderables.')
  assertNoErrorDiagnostics(preview.diagnostics, 'Shell preview must not emit error diagnostics.')

  const created = await adapter.createFeature({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
    baseRevisionId: extrudedSnapshot.snapshot.revisionId,
    definition: createShellDefinition(extrude.bodyId, removableFaceId, 0.75),
  })

  assert(created.revisionState.kind === 'accepted', 'Shell create must be accepted.')
  assert(created.rebuildResult.kind === 'rebuilt', 'Shell create must rebuild.')
  assert(
    created.changedTargets.some((target) => target.kind === 'body'),
    'Shell create must report a produced body target.',
  )

  const createdSnapshot = await adapter.getDocumentSnapshot({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
  })
  const createdFeature = createdSnapshot.snapshot.features.find((feature) => feature.featureId === created.featureId)
  assert(createdFeature?.definition.kind === 'shell', 'Shell create must serialize through feature snapshots with the shell contract kind.')

  const updated = await adapter.updateFeature({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
    baseRevisionId: created.revisionId,
    featureId: created.featureId,
    definition: createShellDefinition(extrude.bodyId, removableFaceId, 1.25),
  })

  assert(updated.revisionState.kind === 'accepted', 'Shell update must be accepted.')
  assert(updated.rebuildResult.kind === 'rebuilt', 'Shell update must rebuild.')
}

async function testDeleteFeatureRebuildsSnapshotAndResolveReferenceInvalidatesMissingRefs() {
  const adapter = createAdapter()
  const committed = await commitSeedSketch(adapter)

  if (committed.revisionState.kind !== 'accepted') {
    throw new Error('Seed sketch commit must succeed before delete coverage.')
  }

  const committedSnapshot = await adapter.getDocumentSnapshot({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
  })
  const sketch = requirePrimarySketch(committedSnapshot.snapshot)
  const created = await adapter.createFeature({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
    baseRevisionId: committedSnapshot.snapshot.revisionId,
    definition: createExtrudeDefinition(sketch, 12),
  })

  assert(created.revisionState.kind === 'accepted', 'Extrude create must be accepted.')
  assert(created.rebuildResult.kind === 'rebuilt', 'Accepted extrude create must rebuild.')

  const createdBodyTarget = created.changedTargets.find((target) => target.kind === 'body')

  if (!createdBodyTarget || createdBodyTarget.kind !== 'body') {
    throw new Error('Extrude create must report the created body as a changed target.')
  }

  const deleted = await adapter.deleteFeature({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
    baseRevisionId: created.revisionId,
    featureId: created.featureId,
  })

  assert(deleted.revisionState.kind === 'accepted', 'Extrude delete must be accepted.')
  assert(deleted.rebuildResult.kind === 'rebuilt', 'Accepted feature deletes must rebuild the OCC snapshot.')
  assert(
    deleted.rebuildResult.invalidatedTargets.some(
      (target) => target.kind === 'body' && target.bodyId === createdBodyTarget.bodyId,
    ),
    'Deleting the extrude must report the removed body as invalidated.',
  )

  const deletedSnapshot = await adapter.getDocumentSnapshot({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
  })

  assert(
    deletedSnapshot.snapshot.features.every((feature) => feature.featureId !== created.featureId),
    'Deleted features must be removed from later snapshots.',
  )
  assert(
    deletedSnapshot.snapshot.bodies.every((body) => body.bodyId !== createdBodyTarget.bodyId),
    'Deleting a body-producing feature must rebuild later snapshots without the removed body.',
  )

  const resolved = await adapter.resolveReference({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
    target: createdBodyTarget,
  })

  assert(
    resolved.resolution.invalidation?.target.kind === 'body'
    && resolved.resolution.invalidation.target.bodyId === createdBodyTarget.bodyId,
    'Deleted bodies must resolve as explicit invalidations instead of silently remapping.',
  )
  assert(resolved.diagnostics.length > 0, 'Invalidated reference resolution must emit machine-readable diagnostics.')
}

async function testReorderFeatureAndConflictHandling() {
  const adapter = createAdapter()
  const committed = await commitSeedSketch(adapter)

  if (committed.revisionState.kind !== 'accepted') {
    throw new Error('Seed sketch commit must succeed before reorder coverage.')
  }

  const firstPlane = await adapter.createFeature({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
    baseRevisionId: committed.revisionId,
    definition: createPlaneDefinitionFromConstruction('construction_plane-xy'),
  })
  const secondPlane = await adapter.createFeature({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
    baseRevisionId: firstPlane.revisionId,
    definition: createPlaneDefinitionFromConstruction('construction_plane-yz'),
  })
  const reordered = await adapter.reorderFeature({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
    baseRevisionId: secondPlane.revisionId,
    featureId: secondPlane.featureId,
    beforeFeatureId: firstPlane.featureId,
  })

  assert(reordered.revisionState.kind === 'accepted', 'Feature reorder must be accepted.')
  assert(reordered.rebuildResult.kind === 'rebuilt', 'Accepted feature reorders must rebuild the OCC snapshot.')

  const snapshot = await adapter.getDocumentSnapshot({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
  })
  const planeFeatureOrder = snapshot.snapshot.features
    .filter((feature) => feature.definition.kind === 'plane')
    .map((feature) => feature.featureId)

  assert(
    planeFeatureOrder[0] === secondPlane.featureId && planeFeatureOrder[1] === firstPlane.featureId,
    'Feature reorder must persist the new feature order in later snapshots.',
  )

  const conflict = await adapter.createFeature({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
    baseRevisionId: committed.revisionId,
    definition: createPlaneDefinitionFromConstruction('construction_plane-xz'),
  })

  assert(conflict.revisionState.kind === 'conflict', 'Stale base revisions must return explicit conflicts.')
  assert(
    conflict.rebuildResult.kind === 'skipped' && conflict.rebuildResult.reasonCode === 'revisionConflict',
    'Conflicts must skip rebuilds explicitly.',
  )
}

async function testPreviewFreshness() {
  const adapter = createAdapter()
  const committed = await commitSeedSketch(adapter)

  if (committed.revisionState.kind !== 'accepted') {
    throw new Error('Seed sketch commit must succeed before preview coverage.')
  }

  const freshPreview = await adapter.evaluatePreview({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
    baseRevisionId: committed.revisionId,
    previewId: 'preview_plane_fresh',
    definition: createPlaneDefinitionFromConstruction('construction_plane-xy'),
  })

  assert(freshPreview.freshness.kind === 'fresh', 'Matching preview revisions must report fresh preview state.')
  assert(freshPreview.render.records.length > 0, 'Valid plane previews must return transient renderables.')

  const mutated = await adapter.createFeature({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
    baseRevisionId: committed.revisionId,
    definition: createPlaneDefinitionFromConstruction('construction_plane-yz'),
  })
  const stalePreview = await adapter.evaluatePreview({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
    baseRevisionId: committed.revisionId,
    previewId: 'preview_plane_stale',
    definition: createPlaneDefinitionFromConstruction('construction_plane-xz'),
  })

  assert(mutated.revisionState.kind === 'accepted', 'Preview staleness coverage requires an intervening accepted mutation.')
  assert(stalePreview.freshness.kind === 'stale', 'Stale preview requests must report stale freshness.')
  assert(
    stalePreview.freshness.kind === 'stale' && stalePreview.freshness.currentRevisionId === stalePreview.revisionId,
    'Stale previews must report the observed current revision explicitly.',
  )
}

async function testConstructionPlaneSnapshotsSurfaceTheDocumentedGap() {
  const adapter = createAdapter()
  const committed = await commitSeedSketch(adapter)

  if (committed.revisionState.kind !== 'accepted') {
    throw new Error('Seed sketch commit must succeed before construction snapshot gap coverage.')
  }

  const created = await adapter.createFeature({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
    baseRevisionId: committed.revisionId,
    definition: createPlaneDefinitionFromConstruction('construction_plane-xy'),
  })

  assert(created.revisionState.kind === 'accepted', 'Plane feature create must succeed before inspecting snapshot gap diagnostics.')

  const snapshot = await adapter.getDocumentSnapshot({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
  })
  const featureConstruction = snapshot.snapshot.constructions.find((construction) =>
    construction.ownerFeatureId === created.featureId,
  )

  assert(featureConstruction != null, 'Plane feature snapshots must include the produced construction row.')
  assert(
    !Object.prototype.hasOwnProperty.call(featureConstruction, 'frame'),
    'Construction snapshots must not smuggle internal plane geometry through the public contract.',
  )
  assert(
    snapshot.snapshot.diagnostics.some((diagnostic) =>
      diagnostic.code === OCC_CONTRACT_GAP_CODES.constructionPlaneGeometryUnavailable
      && diagnostic.target?.kind === 'construction'
      && diagnostic.target.constructionId === featureConstruction.constructionId,
    ),
    'Feature-authored construction snapshots must surface the documented reconstruction gap explicitly.',
  )
}

async function testCommitSketchRejectsUnknownExplicitSketchId() {
  const adapter = createAdapter()
  const seed = createSeedSketchCommitRequest()
  const rejected = await adapter.commitSketch({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
    baseRevisionId: 'rev_0001',
    solverCorrelation: createSolverCorrelation('request_commit_missing_sketch'),
    ...seed,
    sketchId: 'sketch_missing',
  })

  assert(rejected.revisionState.kind === 'rejected', 'Unknown explicit sketch IDs must reject instead of creating a new sketch.')
  assert(
    rejected.diagnostics.some((diagnostic) => diagnostic.code === 'occ-missing-sketch'),
    'Unknown explicit sketch IDs must report a specific missing-sketch diagnostic.',
  )
}

async function testProjectedGeometryRegionLoopsRejectAsUnsupported() {
  const adapter = createAdapter(() => new ProjectedRegionLoopSketchSolverAdapter())
  const committed = await commitSeedSketch(adapter)

  if (committed.revisionState.kind !== 'accepted') {
    throw new Error('Projected-loop sketch commit must succeed before downstream unsupported-geometry coverage.')
  }

  const snapshot = await adapter.getDocumentSnapshot({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
  })
  const sketch = requirePrimarySketch(snapshot.snapshot)
  const rejected = await adapter.createFeature({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
    baseRevisionId: snapshot.snapshot.revisionId,
    definition: createExtrudeDefinition(sketch, 12),
  })

  assert(rejected.revisionState.kind === 'rejected', 'Projected-geometry region loops must reject downstream profile-based features.')
  assert(
    rejected.diagnostics.some((diagnostic) =>
      diagnostic.code === OCC_CONTRACT_GAP_CODES.projectedRegionGeometryUnavailable,
    ),
    'Projected-geometry loop rejection must surface the structured contract-gap diagnostic code.',
  )
}

async function testDownstreamInvalidReferencesRejectWithStructuredDiagnostics() {
  const adapter = createAdapter()
  const committed = await commitSeedSketch(adapter)

  if (committed.revisionState.kind !== 'accepted') {
    throw new Error('Seed sketch commit must succeed before downstream invalidation coverage.')
  }

  const committedSnapshot = await adapter.getDocumentSnapshot({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
  })
  const sketch = requirePrimarySketch(committedSnapshot.snapshot)
  const extrude = await adapter.createFeature({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
    baseRevisionId: committedSnapshot.snapshot.revisionId,
    definition: createExtrudeDefinition(sketch, 12),
  })

  if (extrude.revisionState.kind !== 'accepted') {
    throw new Error('Extrude create must succeed before testing downstream invalidation handling.')
  }

  const bodyTarget = extrude.changedTargets.find((target) => target.kind === 'body')

  if (!bodyTarget || bodyTarget.kind !== 'body') {
    throw new Error('Extrude must produce a body target for downstream invalidation coverage.')
  }

  const deleted = await adapter.deleteFeature({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
    baseRevisionId: extrude.revisionId,
    featureId: extrude.featureId,
  })

  if (deleted.revisionState.kind !== 'accepted') {
    throw new Error('Extrude delete must succeed before testing stale downstream refs.')
  }

  const consumer = await adapter.createFeature({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
    baseRevisionId: deleted.revisionId,
    definition: {
      kind: 'extrude',
      featureTypeVersion: EXTRUDE_FEATURE_SCHEMA_VERSION,
      parameters: {
        profile: {
          kind: 'region',
          sketchId: sketch.sketchId,
          regionId: sketch.sketch.regions[0]!.regionId,
        },
        startExtent: { kind: 'profilePlane' },
        endExtent: { kind: 'blind', direction: 'positive', distance: 6 },
        depth: 6,
        direction: 'oneSided',
        operation: 'join',
        booleanScope: { kind: 'targetBody', bodyId: bodyTarget.bodyId },
      },
    },
  })

  assert(consumer.revisionState.kind === 'rejected', 'Features referencing deleted body targets must reject.')
  assert(
    consumer.diagnostics.some((diagnostic) => diagnostic.detail?.kind === 'invalidReference'),
    'Downstream invalid body refs must surface structured invalidReference diagnostics.',
  )
  assert(
    consumer.rebuildResult.invalidatedTargets.length === 0,
    'Rejected rebuilds must not claim committed invalidated targets.',
  )
}

async function testMultiBodyBooleanPolicyJoinUsesFirstTargetIdentity() {
  const adapter = createAdapter()
  const firstSketchCommit = await commitSeedSketch(adapter)

  if (firstSketchCommit.revisionState.kind !== 'accepted') {
    throw new Error('Initial sketch commit must succeed before multi-body join coverage.')
  }

  const secondSketchCommit = await commitOffsetSketch(adapter, firstSketchCommit.revisionId, {
    sketchLabel: 'Sketch 2',
    offsetX: 4,
    offsetY: 0,
  })

  assert(secondSketchCommit.revisionState.kind === 'accepted', 'Second sketch commit must be accepted for multi-body join coverage.')

  const sketchSnapshot = await adapter.getDocumentSnapshot({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
  })
  const firstSketch = requirePrimarySketch(sketchSnapshot.snapshot)
  const secondSketch = requireSketch(sketchSnapshot.snapshot, secondSketchCommit.sketchId)
  const bodyA = await createExtrudeBody(adapter, sketchSnapshot.snapshot.revisionId, firstSketch, 6)
  const bodyB = await createExtrudeBody(adapter, bodyA.response.revisionId, secondSketch, 6)
  const beforeJoinSnapshot = await adapter.getDocumentSnapshot({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
  })
  const bodyABeforeSignature = committedBodySignature(beforeJoinSnapshot.snapshot, bodyA.bodyId)
  const bodyBBeforeSignature = committedBodySignature(beforeJoinSnapshot.snapshot, bodyB.bodyId)
  const region = firstSketch.sketch.regions[0]

  if (!region) {
    throw new Error('Expected the first sketch to expose a region for multi-body join coverage.')
  }

  const joined = await adapter.createFeature({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
    baseRevisionId: bodyB.response.revisionId,
    definition: {
      kind: 'extrude',
      featureTypeVersion: EXTRUDE_FEATURE_SCHEMA_VERSION,
      parameters: {
        profile: {
          kind: 'region',
          sketchId: firstSketch.sketchId,
          regionId: region.regionId,
        },
        startExtent: { kind: 'profilePlane' },
        endExtent: { kind: 'blind', direction: 'positive', distance: 1 },
        depth: 1,
        direction: 'oneSided',
        operation: 'join',
        booleanScope: { kind: 'targetBodies', bodyIds: [bodyB.bodyId, bodyA.bodyId] },
      },
    },
  })

  assert(joined.revisionState.kind === 'accepted', 'Sequential multi-body joins should accept the documented policy input.')
  assert(joined.rebuildResult.kind === 'rebuilt', 'Accepted sequential multi-body joins must rebuild.')

  const afterJoinSnapshot = await adapter.getDocumentSnapshot({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
  })
  const joinedBodySignature = committedBodySignature(afterJoinSnapshot.snapshot, bodyB.bodyId)

  assert(
    afterJoinSnapshot.snapshot.bodies.some((body) => body.bodyId === bodyB.bodyId),
    'Sequential joins must preserve the first supplied target body id.',
  )
  assert(
    afterJoinSnapshot.snapshot.bodies.every((body) => body.bodyId !== bodyA.bodyId),
    'Sequential joins must collapse later supplied target bodies into the first target body row.',
  )
  assert(
    joinedBodySignature !== bodyBBeforeSignature,
    'Sequential joins must change the surviving first target body geometry/topology.',
  )
  assert(
    joinedBodySignature !== bodyABeforeSignature,
    'Sequential joins must produce a merged surviving body instead of leaving the removed later target unchanged.',
  )
}

async function testMultiBodyBooleanPolicyUsesPerTargetCutBehavior() {
  const adapter = createAdapter()
  const firstSketchCommit = await commitSeedSketch(adapter)

  if (firstSketchCommit.revisionState.kind !== 'accepted') {
    throw new Error('Initial sketch commit must succeed before multi-body cut coverage.')
  }

  const secondSketchCommit = await commitOffsetSketch(adapter, firstSketchCommit.revisionId, {
    sketchLabel: 'Sketch 2',
    offsetX: 20,
    offsetY: 0,
  })

  assert(secondSketchCommit.revisionState.kind === 'accepted', 'Second sketch commit must be accepted for multi-body cut coverage.')

  const sketchSnapshot = await adapter.getDocumentSnapshot({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
  })
  const firstSketch = requirePrimarySketch(sketchSnapshot.snapshot)
  const secondSketch = requireSketch(sketchSnapshot.snapshot, secondSketchCommit.sketchId)
  const bodyA = await createExtrudeBody(adapter, sketchSnapshot.snapshot.revisionId, firstSketch, 6)
  const bodyB = await createExtrudeBody(adapter, bodyA.response.revisionId, secondSketch, 6)
  const beforeCutSnapshot = await adapter.getDocumentSnapshot({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
  })
  const bodyABeforeSignature = topologySignature(requireBody(beforeCutSnapshot.snapshot, bodyA.bodyId))
  const bodyBBeforeGeometry = bodyRenderGeometryOnlySignature(beforeCutSnapshot.snapshot, bodyB.bodyId)
  const region = firstSketch.sketch.regions[0]

  if (!region) {
    throw new Error('Expected the first sketch to expose a region for multi-body cut coverage.')
  }

  const cut = await adapter.createFeature({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
    baseRevisionId: bodyB.response.revisionId,
    definition: {
      kind: 'extrude',
      featureTypeVersion: EXTRUDE_FEATURE_SCHEMA_VERSION,
      parameters: {
        profile: {
          kind: 'region',
          sketchId: firstSketch.sketchId,
          regionId: region.regionId,
        },
        startExtent: { kind: 'profilePlane' },
        endExtent: { kind: 'blind', direction: 'positive', distance: 1 },
        depth: 1,
        direction: 'oneSided',
        operation: 'cut',
        booleanScope: { kind: 'targetBodies', bodyIds: [bodyA.bodyId, bodyB.bodyId] },
      },
    },
  })

  assert(cut.revisionState.kind === 'accepted', 'Multi-body cut should accept the documented per-target policy input.')
  assert(cut.rebuildResult.kind === 'rebuilt', 'Accepted multi-body cut must rebuild.')

  const afterCutSnapshot = await adapter.getDocumentSnapshot({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
  })
  const bodyAAfterCut = requireBody(afterCutSnapshot.snapshot, bodyA.bodyId)

  assert(
    topologySignature(bodyAAfterCut) !== bodyABeforeSignature,
    'Per-target multi-body cut must modify the overlapping target body.',
  )
  assert(
    bodyRenderGeometryOnlySignature(afterCutSnapshot.snapshot, bodyB.bodyId) === bodyBBeforeGeometry,
    'Per-target multi-body cut must preserve unaffected target body geometry exactly.',
  )
}

async function testMultiBodyBooleanPolicyIntersectDropsEmptyTargets() {
  const adapter = createAdapter()
  const firstSketchCommit = await commitSeedSketch(adapter)

  if (firstSketchCommit.revisionState.kind !== 'accepted') {
    throw new Error('Initial sketch commit must succeed before multi-body intersect coverage.')
  }

  const secondSketchCommit = await commitOffsetSketch(adapter, firstSketchCommit.revisionId, {
    sketchLabel: 'Sketch 2',
    offsetX: 20,
    offsetY: 0,
  })

  assert(secondSketchCommit.revisionState.kind === 'accepted', 'Second sketch commit must be accepted for multi-body intersect coverage.')

  const sketchSnapshot = await adapter.getDocumentSnapshot({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
  })
  const firstSketch = requirePrimarySketch(sketchSnapshot.snapshot)
  const secondSketch = requireSketch(sketchSnapshot.snapshot, secondSketchCommit.sketchId)
  const bodyA = await createExtrudeBody(adapter, sketchSnapshot.snapshot.revisionId, firstSketch, 6)
  const bodyB = await createExtrudeBody(adapter, bodyA.response.revisionId, secondSketch, 6)
  const beforeIntersectSnapshot = await adapter.getDocumentSnapshot({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
  })
  const bodyABeforeSignature = committedBodySignature(beforeIntersectSnapshot.snapshot, bodyA.bodyId)
  const bodyBBeforeSignature = committedBodySignature(beforeIntersectSnapshot.snapshot, bodyB.bodyId)
  const region = firstSketch.sketch.regions[0]

  if (!region) {
    throw new Error('Expected the first sketch to expose a region for multi-body intersect coverage.')
  }

  const intersected = await adapter.createFeature({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
    baseRevisionId: bodyB.response.revisionId,
    definition: {
      kind: 'extrude',
      featureTypeVersion: EXTRUDE_FEATURE_SCHEMA_VERSION,
      parameters: {
        profile: {
          kind: 'region',
          sketchId: firstSketch.sketchId,
          regionId: region.regionId,
        },
        startExtent: { kind: 'profilePlane' },
        endExtent: { kind: 'blind', direction: 'positive', distance: 1 },
        depth: 1,
        direction: 'oneSided',
        operation: 'intersect',
        booleanScope: { kind: 'targetBodies', bodyIds: [bodyA.bodyId, bodyB.bodyId] },
      },
    },
  })

  assert(intersected.revisionState.kind === 'accepted', 'Per-target multi-body intersects should accept the documented policy input.')
  assert(intersected.rebuildResult.kind === 'rebuilt', 'Accepted per-target multi-body intersects must rebuild.')

  const afterIntersectSnapshot = await adapter.getDocumentSnapshot({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
  })
  const intersectedBodySignature = committedBodySignature(afterIntersectSnapshot.snapshot, bodyA.bodyId)

  assert(
    afterIntersectSnapshot.snapshot.bodies.some((body) => body.bodyId === bodyA.bodyId),
    'Per-target intersects must preserve the overlapping target body id.',
  )
  assert(
    afterIntersectSnapshot.snapshot.bodies.every((body) => body.bodyId !== bodyB.bodyId),
    'Per-target intersects must drop target bodies whose solid result is empty.',
  )
  assert(
    intersectedBodySignature !== bodyABeforeSignature,
    'Per-target intersects must change the surviving overlapping target body geometry/topology.',
  )
  assert(
    intersectedBodySignature !== bodyBBeforeSignature,
    'Per-target intersects must preserve the surviving target identity instead of reusing the removed empty target body.',
  )
}

async function testUnknownPrefixedRebuildErrorsFallbackToOccRebuildFailure() {
  const adapter = createAdapter()
  const committed = await commitSeedSketch(adapter)

  if (committed.revisionState.kind !== 'accepted') {
    throw new Error('Initial sketch commit must succeed before rebuild failure fallback coverage.')
  }

  const patched = adapter as unknown as {
    buildNextAuthoringState: (runtimeState: unknown, input: unknown) => unknown
  }
  const originalBuildNextAuthoringState = patched.buildNextAuthoringState
  patched.buildNextAuthoringState = () => {
    throw new Error('fake-code: preview boom')
  }

  try {
    const preview = await adapter.evaluatePreview({
      contractVersion: CONTRACT_VERSION,
      documentId: 'doc_workspace',
      baseRevisionId: committed.revisionId,
      previewId: 'preview_unknown_rebuild_prefix',
      definition: createPlaneDefinitionFromConstruction('construction_plane-xy'),
    })

    assert(
      preview.diagnostics.some((diagnostic) => diagnostic.code === 'occ-rebuild-failure'),
      'Unknown prefixed rebuild errors must downgrade to occ-rebuild-failure.',
    )
  } finally {
    patched.buildNextAuthoringState = originalBuildNextAuthoringState
  }
}

await testSnapshotFetchAndSketchCommit()
await testPlaneFeatureCreateSupportsConstructionAndPlanarFaceReferences()
await testExtrudePreviewCreateAndUpdateCommitGeometry()
await testRevolvePreviewCreateAndConstructionAxisRejection()
await testFilletCreateAndUpdateMutateBodyTopology()
await testShellPreviewCreateUpdateAndSnapshotRoundTrip()
await testDeleteFeatureRebuildsSnapshotAndResolveReferenceInvalidatesMissingRefs()
await testReorderFeatureAndConflictHandling()
await testPreviewFreshness()
await testConstructionPlaneSnapshotsSurfaceTheDocumentedGap()
await testCommitSketchRejectsUnknownExplicitSketchId()
await testProjectedGeometryRegionLoopsRejectAsUnsupported()
await testDownstreamInvalidReferencesRejectWithStructuredDiagnostics()
await testMultiBodyBooleanPolicyJoinUsesFirstTargetIdentity()
await testMultiBodyBooleanPolicyUsesPerTargetCutBehavior()
await testMultiBodyBooleanPolicyIntersectDropsEmptyTargets()
await testUnknownPrefixedRebuildErrorsFallbackToOccRebuildFailure()

console.log('OCC phase 8 adapter tests passed.')

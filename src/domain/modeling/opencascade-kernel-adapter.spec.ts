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
  FeatureDefinition,
  GetDocumentSnapshotResponse,
  SketchSnapshotRecord,
} from '@/contracts/modeling/schema'
import type { ProjectedGeometryId } from '@/contracts/shared/ids'
import { CONTRACT_VERSION } from '@/contracts/shared/versioning'
import {
  EXTRUDE_FEATURE_SCHEMA_VERSION,
  PLANE_FEATURE_SCHEMA_VERSION,
} from '@/contracts/shared/versioning'
import {
  DEFAULT_MOCK_SOLVER_TOLERANCES,
  evaluateMockSketchDefinition,
} from '@/domain/solver/mock-sketch-solver-adapter'
import {
  OCC_KERNEL_PRIMARY_SKETCH_ID,
  createSeedSketchCommitRequest,
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
    throw new Error('Phase 7 adapter tests do not exercise resolveSketchReference directly.')
  }
}

function createAdapter() {
  return new OpenCascadeKernelAdapter({
    solverAdapter: new DeterministicSketchSolverAdapter(),
    solverAdapterFactory: () => new DeterministicSketchSolverAdapter(),
  })
}

async function commitSeedSketch(adapter: OpenCascadeKernelAdapter) {
  const seed = createSeedSketchCommitRequest()

  return adapter.commitSketch({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
    baseRevisionId: 'rev_0001',
    solverCorrelation: {
      requestId: 'request_commit_seed',
      projectionRequestId: 'request_commit_seed:project',
      validationRequestId: 'request_commit_seed:validate',
      solveRequestId: 'request_commit_seed:solve',
      regionRequestId: 'request_commit_seed:regions',
    },
    ...seed,
  })
}

function requirePrimarySketch(snapshot: GetDocumentSnapshotResponse['snapshot']): SketchSnapshotRecord {
  const sketch = snapshot.sketches.find((entry) => entry.sketchId === OCC_KERNEL_PRIMARY_SKETCH_ID)

  if (!sketch) {
    throw new Error('Primary committed sketch must exist in the snapshot.')
  }

  return sketch
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

async function testCreateUpdateDeleteAndResolveReference() {
  const adapter = createAdapter()
  const committed = await commitSeedSketch(adapter)

  if (committed.revisionState.kind !== 'accepted') {
    throw new Error('Seed sketch commit must succeed before feature mutation coverage.')
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

  const updated = await adapter.updateFeature({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
    baseRevisionId: created.revisionId,
    featureId: created.featureId,
    definition: createExtrudeDefinition(sketch, 20),
  })

  assert(updated.revisionState.kind === 'accepted', 'Extrude update must be accepted.')
  assert(updated.rebuildResult.kind === 'rebuilt', 'Accepted extrude update must rebuild.')

  const deleted = await adapter.deleteFeature({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
    baseRevisionId: updated.revisionId,
    featureId: created.featureId,
  })

  assert(deleted.revisionState.kind === 'accepted', 'Extrude delete must be accepted.')
  assert(
    deleted.rebuildResult.invalidatedTargets.some(
      (target) => target.kind === 'body' && target.bodyId === createdBodyTarget.bodyId,
    ),
    'Deleting the extrude must report the removed body as invalidated.',
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
    definition: {
      kind: 'plane',
      featureTypeVersion: PLANE_FEATURE_SCHEMA_VERSION,
      parameters: {
        mode: 'coplanar',
        reference: {
          target: { kind: 'construction', constructionId: 'construction_plane-xy' },
        },
      },
    },
  })

  const secondPlane = await adapter.createFeature({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
    baseRevisionId: firstPlane.revisionId,
    definition: {
      kind: 'plane',
      featureTypeVersion: PLANE_FEATURE_SCHEMA_VERSION,
      parameters: {
        mode: 'coplanar',
        reference: {
          target: { kind: 'construction', constructionId: 'construction_plane-yz' },
        },
      },
    },
  })

  const reordered = await adapter.reorderFeature({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
    baseRevisionId: secondPlane.revisionId,
    featureId: secondPlane.featureId,
    beforeFeatureId: firstPlane.featureId,
  })

  assert(reordered.revisionState.kind === 'accepted', 'Feature reorder must be accepted.')

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
    definition: {
      kind: 'plane',
      featureTypeVersion: PLANE_FEATURE_SCHEMA_VERSION,
      parameters: {
        mode: 'coplanar',
        reference: {
          target: { kind: 'construction', constructionId: 'construction_plane-xz' },
        },
      },
    },
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
    definition: {
      kind: 'plane',
      featureTypeVersion: PLANE_FEATURE_SCHEMA_VERSION,
      parameters: {
        mode: 'coplanar',
        reference: {
          target: { kind: 'construction', constructionId: 'construction_plane-xy' },
        },
      },
    },
  })

  assert(freshPreview.freshness.kind === 'fresh', 'Matching preview revisions must report fresh preview state.')
  assert(freshPreview.render.records.length > 0, 'Valid plane previews must return transient renderables.')

  const mutated = await adapter.createFeature({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
    baseRevisionId: committed.revisionId,
    definition: {
      kind: 'plane',
      featureTypeVersion: PLANE_FEATURE_SCHEMA_VERSION,
      parameters: {
        mode: 'coplanar',
        reference: {
          target: { kind: 'construction', constructionId: 'construction_plane-yz' },
        },
      },
    },
  })

  const stalePreview = await adapter.evaluatePreview({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
    baseRevisionId: committed.revisionId,
    previewId: 'preview_plane_stale',
    definition: {
      kind: 'plane',
      featureTypeVersion: PLANE_FEATURE_SCHEMA_VERSION,
      parameters: {
        mode: 'coplanar',
        reference: {
          target: { kind: 'construction', constructionId: 'construction_plane-xz' },
        },
      },
    },
  })

  assert(mutated.revisionState.kind === 'accepted', 'Preview staleness coverage requires an intervening accepted mutation.')
  assert(stalePreview.freshness.kind === 'stale', 'Stale preview requests must report stale freshness.')
  assert(
    stalePreview.freshness.kind === 'stale' && stalePreview.freshness.currentRevisionId === stalePreview.revisionId,
    'Stale previews must report the observed current revision explicitly.',
  )
}

async function testCommitSketchRejectsUnknownExplicitSketchId() {
  const adapter = createAdapter()
  const seed = createSeedSketchCommitRequest()

  const rejected = await adapter.commitSketch({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
    baseRevisionId: 'rev_0001',
    solverCorrelation: {
      requestId: 'request_commit_missing_sketch',
      projectionRequestId: 'request_commit_missing_sketch_project',
      validationRequestId: 'request_commit_missing_sketch_validate',
      solveRequestId: 'request_commit_missing_sketch_solve',
      regionRequestId: 'request_commit_missing_sketch_regions',
    },
    ...seed,
    sketchId: 'sketch_missing',
  })

  assert(rejected.revisionState.kind === 'rejected', 'Unknown explicit sketch IDs must reject instead of creating a new sketch.')
  assert(
    rejected.diagnostics.some((diagnostic) => diagnostic.code === 'occ-missing-sketch'),
    'Unknown explicit sketch IDs must report a specific missing-sketch diagnostic.',
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
    throw new Error('Extrude must produce a body target for fillet downstream invalidation coverage.')
  }

  // Delete the extrude so its body and edges disappear
  const deleted = await adapter.deleteFeature({
    contractVersion: CONTRACT_VERSION,
    documentId: 'doc_workspace',
    baseRevisionId: extrude.revisionId,
    featureId: extrude.featureId,
  })

  if (deleted.revisionState.kind !== 'accepted') {
    throw new Error('Extrude delete must succeed before testing stale downstream refs.')
  }

  // Creating a join extrude against the now-deleted body must reject
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

await testSnapshotFetchAndSketchCommit()
await testCreateUpdateDeleteAndResolveReference()
await testReorderFeatureAndConflictHandling()
await testPreviewFreshness()
await testCommitSketchRejectsUnknownExplicitSketchId()
await testDownstreamInvalidReferencesRejectWithStructuredDiagnostics()

console.log('OCC phase 7 adapter tests passed.')

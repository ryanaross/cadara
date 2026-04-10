import type { SketchSolverAdapter } from '@/contracts/solver/adapter'
import {
  SOLVER_SCHEMA_VERSION,
  type DeriveSketchRegionsRequest,
  type DeriveSketchRegionsResponse,
  type ProjectedSketchReferenceRecord,
  type ProjectSketchExternalReferencesRequest,
  type ProjectSketchExternalReferencesResponse,
  type ResolveSketchReferenceRequest,
  type ResolveSketchReferenceResponse,
  type SketchSolverResponseBase,
  type SolveSketchRequest,
  type SolveSketchResponse,
  type ValidateSketchRequest,
  type ValidateSketchResponse,
} from '@/contracts/solver/schema'
import {
  solveSketchDefinitionCore,
  validateSketchDefinitionCore,
  type ProjectedSketchGeometryRef,
  type RegionLoopRecord,
  type RegionRecord,
  type SketchDefinition,
  type SketchPoint2D,
  type SketchSolveDiagnostic,
  type SolvedSketchSnapshot,
} from '@/contracts/sketch'
import type {
  DocumentId,
  ProjectedGeometryId,
  ReferenceId,
  RegionId,
  RegionLoopId,
  RevisionId,
  SketchId,
} from '@/contracts/shared/ids'
import { CONTRACT_VERSION } from '@/contracts/shared/versioning'

export interface SketchConstraintSolverAdapterOptions {
  documentId: DocumentId
  revisionId: RevisionId
}

const DEFAULT_OPTIONS: SketchConstraintSolverAdapterOptions = {
  documentId: 'doc_workspace',
  revisionId: 'rev_0001',
}

function makeResponseBase(
  request:
    | ProjectSketchExternalReferencesRequest
    | ValidateSketchRequest
    | SolveSketchRequest
    | DeriveSketchRegionsRequest
    | ResolveSketchReferenceRequest,
): SketchSolverResponseBase {
  return {
    contractVersion: CONTRACT_VERSION,
    solverSchemaVersion: SOLVER_SCHEMA_VERSION,
    requestId: request.requestId,
    documentId: request.documentId,
    revisionId: request.revisionId,
    sketchId: request.sketchId,
  }
}

function makeDiagnostic(
  code: string,
  severity: SketchSolveDiagnostic['severity'],
  message: string,
  target: SketchSolveDiagnostic['target'],
): SketchSolveDiagnostic {
  return { code, severity, message, target }
}

function createProjectedGeometryId(referenceId: ReferenceId, ordinal: number): ProjectedGeometryId {
  return `projected_geometry_${referenceId}_${ordinal}` as ProjectedGeometryId
}

function projectReference(
  reference: ProjectSketchExternalReferencesRequest['references'][number],
): Omit<ProjectedSketchReferenceRecord, 'referenceId'> {
  if (reference.reference.kind === 'constructionPlane') {
    return {
      status: 'projected',
      geometry: [],
      diagnostics: [],
    }
  }

  if (reference.reference.source.kind === 'vertex') {
    return {
      status: 'projected',
      geometry: [{
        geometryId: createProjectedGeometryId(reference.referenceId, 0),
        kind: 'point',
        position: [0, 0] as SketchPoint2D,
      }],
      diagnostics: [],
    }
  }

  if (reference.reference.source.kind === 'edge') {
    return {
      status: 'projected',
      geometry: [{
        geometryId: createProjectedGeometryId(reference.referenceId, 0),
        kind: 'lineSegment',
        startPosition: [-2, 0] as SketchPoint2D,
        endPosition: [2, 0] as SketchPoint2D,
      }],
      diagnostics: [],
    }
  }

  return {
    status: 'projected',
    geometry: [{
      geometryId: createProjectedGeometryId(reference.referenceId, 0),
      kind: 'circle',
      centerPosition: [0, 0] as SketchPoint2D,
      radius: 1,
    }],
    diagnostics: [],
  }
}

function createRegionId(sketchId: SketchId, ordinal: number): RegionId {
  const suffix = sketchId.startsWith('sketch_') ? sketchId.slice('sketch_'.length) : sketchId
  return (ordinal === 0 ? `region_${suffix}-outer` : `region_${suffix}-loop-${ordinal + 1}`) as RegionId
}

function createRegionLoopId(regionId: RegionId, ordinal: number): RegionLoopId {
  return `region_loop_${regionId}_${ordinal}` as RegionLoopId
}

function deriveClosedLineLoops(definition: SketchDefinition) {
  const lineEntities = definition.entities.filter(
    (entity): entity is Extract<SketchDefinition['entities'][number], { kind: 'lineSegment' }> =>
      entity.kind === 'lineSegment' && !entity.isConstruction,
  )
  const remaining = [...lineEntities]
  const loops: Array<{ boundaryEntityIds: string[]; boundaryPointIds: string[] }> = []

  while (remaining.length > 0) {
    const first = remaining.shift()
    if (!first) {
      break
    }

    const boundaryEntityIds = [first.entityId]
    const boundaryPointIds = [first.startPointId, first.endPointId]
    let currentPointId = first.endPointId
    let closed = first.endPointId === first.startPointId

    while (!closed) {
      const nextIndex = remaining.findIndex((candidate) => candidate.startPointId === currentPointId)
      if (nextIndex < 0) {
        break
      }

      const [next] = remaining.splice(nextIndex, 1)
      if (!next) {
        break
      }
      boundaryEntityIds.push(next.entityId)
      boundaryPointIds.push(next.endPointId)
      currentPointId = next.endPointId
      closed = currentPointId === boundaryPointIds[0]
    }

    if (closed && boundaryEntityIds.length >= 3) {
      loops.push({
        boundaryEntityIds,
        boundaryPointIds: boundaryPointIds.slice(0, -1),
      })
    }
  }

  return loops
}

function deriveRegions(
  documentId: DocumentId,
  revisionId: RevisionId,
  sketchId: SketchId,
  solvedSnapshot: SolvedSketchSnapshot,
  definition: SketchDefinition,
) {
  if (solvedSnapshot.status.solveState === 'failed' || solvedSnapshot.status.solveState === 'notEvaluated') {
    return {
      regions: [] as RegionRecord[],
      diagnostics: [
        makeDiagnostic(
          'regions-unavailable',
          'warning',
          'Closed regions are unavailable until the sketch reaches a usable solved state.',
          null,
        ),
      ],
    }
  }

  const loops = deriveClosedLineLoops(definition)
  const regions = loops.map((loop, index) => {
    const regionId = createRegionId(sketchId, index)
    const loopRecord: RegionLoopRecord = {
      loopId: createRegionLoopId(regionId, 0),
      role: 'outer',
      orientation: 'counterClockwise',
      segments: loop.boundaryEntityIds.map((entityId, segmentIndex) => ({
        source: { kind: 'entity', entityId: entityId as never },
        startPointId: (loop.boundaryPointIds[segmentIndex] as never) ?? null,
        endPointId: (loop.boundaryPointIds[(segmentIndex + 1) % loop.boundaryPointIds.length] as never) ?? null,
      })),
      boundaryPointIds: loop.boundaryPointIds as never,
      isClosed: true,
    }

    return {
      ownerDocumentId: documentId,
      ownerRevisionId: revisionId,
      ownerFeatureId: null,
      ownerSketchId: sketchId,
      ownerBodyId: null,
      regionId,
      label: index === 0 ? 'Outer region' : `Loop region ${index + 1}`,
      target: { kind: 'region', sketchId, regionId },
      sourceSketch: { kind: 'sketch', sketchId },
      loops: [loopRecord],
      isClosed: true,
    } satisfies RegionRecord
  })

  return { regions, diagnostics: [] as SketchSolveDiagnostic[] }
}

function assertSupportedRequest(
  request:
    | ProjectSketchExternalReferencesRequest
    | ValidateSketchRequest
    | SolveSketchRequest
    | DeriveSketchRegionsRequest
    | ResolveSketchReferenceRequest,
  options: SketchConstraintSolverAdapterOptions,
) {
  if (request.contractVersion !== CONTRACT_VERSION) {
    throw new Error(`Unsupported contract version ${request.contractVersion}; expected ${CONTRACT_VERSION}.`)
  }

  if (request.solverSchemaVersion !== SOLVER_SCHEMA_VERSION) {
    throw new Error(`Unsupported solver schema version ${request.solverSchemaVersion}; expected ${SOLVER_SCHEMA_VERSION}.`)
  }

  if (request.documentId !== options.documentId || request.revisionId !== options.revisionId) {
    throw new Error(
      `Solver request targeted ${request.documentId}@${request.revisionId}, but the runtime is configured for ${options.documentId}@${options.revisionId}.`,
    )
  }
}

export class SketchConstraintSolverAdapter implements SketchSolverAdapter {
  private readonly options: SketchConstraintSolverAdapterOptions

  constructor(options: Partial<SketchConstraintSolverAdapterOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  async projectExternalReferences(
    request: ProjectSketchExternalReferencesRequest,
  ): Promise<ProjectSketchExternalReferencesResponse> {
    assertSupportedRequest(request, this.options)
    return {
      ...makeResponseBase(request),
      projectedReferences: request.references.map((reference) => ({
        referenceId: reference.referenceId,
        ...projectReference(reference),
      })),
      diagnostics: [],
    }
  }

  async validateSketch(request: ValidateSketchRequest): Promise<ValidateSketchResponse> {
    assertSupportedRequest(request, this.options)
    const validation = validateSketchDefinitionCore({
      definition: request.definition,
      tolerances: request.tolerances,
    })
    return {
      ...makeResponseBase(request),
      isValid: validation.isValid,
      diagnostics: validation.diagnostics,
    }
  }

  async solveSketch(request: SolveSketchRequest): Promise<SolveSketchResponse> {
    assertSupportedRequest(request, this.options)
    const solved = solveSketchDefinitionCore({
      definition: request.definition,
      tolerances: request.tolerances,
      partialSolvePolicy: request.partialSolvePolicy,
    })
    const derived = deriveRegions(
      request.documentId,
      request.revisionId,
      request.sketchId,
      solved.solvedSnapshot,
      request.definition,
    )

    return {
      ...makeResponseBase(request),
      status: solved.status,
      solvedSnapshot: solved.solvedSnapshot,
      derivedRegions: derived.regions,
      diagnostics: solved.diagnostics,
    }
  }

  async deriveSketchRegions(
    request: DeriveSketchRegionsRequest,
  ): Promise<DeriveSketchRegionsResponse> {
    assertSupportedRequest(request, this.options)
    const derived = deriveRegions(
      request.documentId,
      request.revisionId,
      request.sketchId,
      request.solvedSnapshot,
      request.definition,
    )
    return {
      ...makeResponseBase(request),
      regions: derived.regions,
      diagnostics: derived.diagnostics,
    }
  }

  async resolveSketchReference(
    request: ResolveSketchReferenceRequest,
  ): Promise<ResolveSketchReferenceResponse> {
    assertSupportedRequest(request, this.options)
    const base = makeResponseBase(request)

    if ('referenceId' in request.target && 'geometryId' in request.target) {
      const target: ProjectedSketchGeometryRef = request.target
      const exists = request.definition.references.some((reference) => reference.referenceId === target.referenceId)
      return {
        ...base,
        resolution: {
          target,
          label: `Projected geometry ${target.geometryId}`,
          isValid: exists,
          invalidationReason: exists ? null : 'missingProjectedGeometry',
        },
        diagnostics: [],
      }
    }

    switch (request.target.kind) {
      case 'sketch':
        return {
          ...base,
          resolution: {
            target: request.target,
            label: request.target.sketchId === request.sketchId ? 'Solved sketch' : 'Unknown sketch',
            isValid: request.target.sketchId === request.sketchId,
            invalidationReason: request.target.sketchId === request.sketchId ? null : 'missingSketch',
          },
          diagnostics: [],
        }
      case 'sketchEntity': {
        const target = request.target
        const entity = request.definition.entities.find((record) => record.entityId === target.entityId)
        return {
          ...base,
          resolution: {
            target,
            label: entity?.label ?? 'Unknown sketch entity',
            isValid: Boolean(entity),
            invalidationReason: entity ? null : 'missingEntity',
          },
          diagnostics: [],
        }
      }
      case 'sketchPoint': {
        const target = request.target
        const point = request.definition.points.find((record) => record.pointId === target.pointId)
        return {
          ...base,
          resolution: {
            target,
            label: point?.label ?? 'Unknown sketch point',
            isValid: Boolean(point),
            invalidationReason: point ? null : 'missingPoint',
          },
          diagnostics: [],
        }
      }
      case 'region': {
        const target = request.target
        const region = request.regions.find((record) => record.regionId === target.regionId)
        return {
          ...base,
          resolution: {
            target,
            label: region?.label ?? 'Unknown region',
            isValid: Boolean(region),
            invalidationReason: region ? null : 'missingRegion',
          },
          diagnostics: [],
        }
      }
    }
  }
}

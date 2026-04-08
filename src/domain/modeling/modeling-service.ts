import type { ModelingKernelAdapter } from '@/domain/modeling/kernel-adapter'
import type {
  BodyId,
  ConstructionId,
  DocumentId,
  EdgeId,
  FaceId,
  FeatureId,
  FeatureTreeNodeId,
  ObjectTreeNodeId,
  PickId,
  PrimitiveRef,
  RenderableId,
  RevisionId,
  SketchId,
  SketchPrimitiveId,
  SnapshotEntityId,
  VertexId,
} from '@/domain/editor/schema'
import { getPrimitiveRefLabel as formatPrimitiveRefLabel } from '@/domain/editor/schema'
import { primitiveRefEquals } from '@/domain/editor/schema'
import type {
  BodySnapshotRecord,
  CommitSketchResponse,
  CommitSketchRequest,
  ConstructionSnapshotRecord,
  CreateFeatureResponse,
  CreateFeatureRequest,
  DeleteFeatureResponse,
  DeleteFeatureRequest,
  DocumentSnapshot,
  EvaluatePreviewRequest,
  EvaluatePreviewResponse,
  FeatureSnapshotRecord,
  GetDocumentSnapshotResponse,
  PreviewId,
  GetDocumentSnapshotRequest,
  InvalidReferenceDetailPayload,
  ModelingDiagnostic,
  ModelingDiagnosticDetail,
  MutationRevisionState,
  ObjectTreeNodeRecord,
  PreviewFreshness,
  ReferenceRecord,
  RenderableEntityRecord,
  ResolvedReferenceRecord,
  ResolveReferenceRequest,
  ResolveReferenceResponse,
  SketchSnapshotRecord,
  SnapshotEntityRecord,
  UpdateFeatureResponse,
  UpdateFeatureRequest,
} from '@/domain/modeling/schema'
import type { DurableRef } from '@/contracts/shared/references'
import type { SketchEntityId } from '@/contracts/shared/ids'

export interface ModelingService {
  readonly currentDocumentId: DocumentId
  getCurrentDocumentSnapshot(): Promise<DocumentSnapshot>
  commitSketch(input: ModelingCommitSketchInput): Promise<ModelingCommitSketchResult>
  createFeature(input: ModelingCreateFeatureInput): Promise<ModelingFeatureMutationResult>
  updateFeature(input: ModelingUpdateFeatureInput): Promise<ModelingFeatureMutationResult>
  deleteFeature(input: ModelingDeleteFeatureInput): Promise<ModelingDeleteFeatureResult>
  evaluatePreview(input: ModelingEvaluatePreviewInput): Promise<ModelingPreviewResult>
  resolveReference(target: PrimitiveRef): Promise<ModelingResolvedReferenceResult>
}

export interface ModelingServiceOptions {
  currentDocumentId: DocumentSnapshot['documentId']
}

export interface ModelingFeatureMutationResult {
  revisionId: DocumentSnapshot['revisionId']
  featureId: FeatureId
  revisionState: MutationRevisionState
  changedTargets: PrimitiveRef[]
  diagnostics: ModelingDiagnostic[]
}

export interface ModelingDeleteFeatureResult {
  revisionId: DocumentSnapshot['revisionId']
  deletedFeatureId: FeatureId
  revisionState: MutationRevisionState
  changedTargets: PrimitiveRef[]
  diagnostics: ModelingDiagnostic[]
}

export interface ModelingCommitSketchResult {
  revisionId: DocumentSnapshot['revisionId']
  sketchId: SketchId
  revisionState: MutationRevisionState
  changedTargets: PrimitiveRef[]
  diagnostics: ModelingDiagnostic[]
}

export type ModelingCreateFeatureInput = Omit<CreateFeatureRequest, 'contractVersion' | 'documentId'>
export type ModelingUpdateFeatureInput = Omit<UpdateFeatureRequest, 'contractVersion' | 'documentId'>
export type ModelingDeleteFeatureInput = Omit<DeleteFeatureRequest, 'contractVersion' | 'documentId'>
export type ModelingCommitSketchInput = Omit<CommitSketchRequest, 'contractVersion' | 'documentId'>
export type ModelingEvaluatePreviewInput = Omit<
  EvaluatePreviewRequest,
  'contractVersion' | 'documentId'
>

export interface ModelingPreviewResult {
  revisionId: DocumentSnapshot['revisionId']
  previewId: EvaluatePreviewResponse['previewId']
  renderables: RenderableEntityRecord[]
  freshness: PreviewFreshness
  stale: boolean
  diagnostics: ModelingDiagnostic[]
}

export interface ModelingResolvedReferenceResult {
  resolution: ResolvedReferenceRecord
  diagnostics: ModelingDiagnostic[]
}

const CONTRACT_VERSION = 'modeling-contract/v1alpha1' as const
const SNAPSHOT_SCHEMA_VERSION = 'document-snapshot/v1alpha1' as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function assertDocumentId(value: unknown): DocumentId {
  if (!isString(value)) {
    throw new Error('Invalid document ID payload.')
  }

  return value as DocumentId
}

function assertRevisionId(value: unknown): RevisionId {
  if (!isString(value)) {
    throw new Error('Invalid revision ID payload.')
  }

  return value as RevisionId
}

function assertFeatureId(value: unknown): FeatureId {
  if (!isString(value)) {
    throw new Error('Invalid feature ID payload.')
  }

  return value as FeatureId
}

function assertSketchId(value: unknown): SketchId {
  if (!isString(value)) {
    throw new Error('Invalid sketch ID payload.')
  }

  return value as SketchId
}

function assertBodyId(value: unknown): BodyId {
  if (!isString(value)) {
    throw new Error('Invalid body ID payload.')
  }

  return value as BodyId
}

function assertSketchPrimitiveId(value: unknown): SketchPrimitiveId {
  if (!isString(value)) {
    throw new Error('Invalid sketch primitive ID payload.')
  }

  return value as SketchPrimitiveId
}

function assertPrimitiveRef(value: unknown): PrimitiveRef {
  if (!isRecord(value) || !isString(value.kind)) {
    throw new Error('Invalid primitive reference payload.')
  }

  switch (value.kind) {
    case 'body':
      if (isString(value.bodyId)) {
        return { kind: 'body', bodyId: value.bodyId as BodyId }
      }
      break
    case 'face':
      if (isString(value.bodyId) && isString(value.faceId)) {
        return { kind: 'face', bodyId: value.bodyId as BodyId, faceId: value.faceId as FaceId }
      }
      break
    case 'edge':
      if (isString(value.bodyId) && isString(value.edgeId)) {
        return { kind: 'edge', bodyId: value.bodyId as BodyId, edgeId: value.edgeId as EdgeId }
      }
      break
    case 'vertex':
      if (isString(value.bodyId) && isString(value.vertexId)) {
        return { kind: 'vertex', bodyId: value.bodyId as BodyId, vertexId: value.vertexId as VertexId }
      }
      break
    case 'sketch':
      if (isString(value.sketchId)) {
        return { kind: 'sketch', sketchId: value.sketchId as SketchId }
      }
      break
    case 'sketchEntity':
      if (isString(value.sketchId) && isString(value.entityId)) {
        return {
          kind: 'sketchEntity',
          sketchId: value.sketchId as SketchId,
          entityId: value.entityId as SketchEntityId,
        }
      }
      break
    case 'feature':
      if (isString(value.featureId)) {
        return { kind: 'feature', featureId: value.featureId as FeatureId }
      }
      break
    case 'construction':
      if (isString(value.constructionId)) {
        return { kind: 'construction', constructionId: value.constructionId as ConstructionId }
      }
      break
  }

  throw new Error('Invalid primitive reference payload.')
}

function assertDurableRef(value: unknown): DurableRef {
  return assertPrimitiveRef(value)
}

function normalizeDiagnostics(value: unknown): ModelingDiagnostic[] {
  if (!Array.isArray(value)) {
    throw new Error('Invalid diagnostics payload.')
  }

  return value.map((entry) => {
    if (
      !isRecord(entry) ||
      !isString(entry.code) ||
      !isString(entry.message) ||
      (entry.severity !== 'info' && entry.severity !== 'warning' && entry.severity !== 'error')
    ) {
      throw new Error('Invalid diagnostic record.')
    }

    return {
      code: entry.code,
      severity: entry.severity,
      message: entry.message,
      target: entry.target == null ? null : assertPrimitiveRef(entry.target),
      detail: entry.detail == null ? null : normalizeDiagnosticDetail(entry.detail),
    }
  })
}

function normalizeInvalidReferenceDetail(value: unknown): InvalidReferenceDetailPayload {
  if (!isRecord(value) || !isString(value.reason)) {
    throw new Error('Invalid invalid reference detail payload.')
  }

  return {
    reason: value.reason,
    target: assertPrimitiveRef(value.target),
    ownerFeatureId: value.ownerFeatureId === null ? null : assertFeatureId(value.ownerFeatureId),
    ownerSketchId: value.ownerSketchId === null ? null : assertSketchId(value.ownerSketchId),
    sourceTarget: value.sourceTarget === null ? null : assertPrimitiveRef(value.sourceTarget),
  }
}

function normalizeDiagnosticDetail(value: unknown): ModelingDiagnosticDetail {
  if (!isRecord(value) || !isString(value.kind)) {
    throw new Error('Invalid diagnostic detail payload.')
  }

  switch (value.kind) {
    case 'invalidReference':
      return {
        kind: 'invalidReference',
        reference: normalizeInvalidReferenceDetail(value.reference),
      }
    case 'revisionConflict':
      return {
        kind: 'revisionConflict',
        expectedRevisionId: assertRevisionId(value.expectedRevisionId),
        actualRevisionId: assertRevisionId(value.actualRevisionId),
      }
    case 'stalePreview':
      return {
        kind: 'stalePreview',
        previewId: value.previewId as PreviewId,
        requestedRevisionId: assertRevisionId(value.requestedRevisionId),
        currentRevisionId: assertRevisionId(value.currentRevisionId),
      }
    case 'rebuildFailure':
      if (!Array.isArray(value.affectedFeatureIds) || !Array.isArray(value.affectedTargets)) {
        throw new Error('Invalid rebuild failure detail payload.')
      }

      return {
        kind: 'rebuildFailure',
        affectedFeatureIds: value.affectedFeatureIds.map((featureId) => assertFeatureId(featureId)),
        affectedTargets: value.affectedTargets.map((target) => assertPrimitiveRef(target)),
      }
    default:
      throw new Error('Invalid diagnostic detail kind.')
  }
}

function normalizeRevisionState(value: unknown): MutationRevisionState {
  if (!isRecord(value) || !isString(value.kind)) {
    throw new Error('Invalid revision state payload.')
  }

  switch (value.kind) {
    case 'accepted':
      return {
        kind: 'accepted',
        baseRevisionId: assertRevisionId(value.baseRevisionId),
      }
    case 'conflict':
      return {
        kind: 'conflict',
        expectedRevisionId: assertRevisionId(value.expectedRevisionId),
        actualRevisionId: assertRevisionId(value.actualRevisionId),
      }
    default:
      throw new Error('Invalid revision state kind.')
  }
}

function normalizePreviewFreshness(value: unknown): PreviewFreshness {
  if (!isRecord(value) || !isString(value.kind)) {
    throw new Error('Invalid preview freshness payload.')
  }

  switch (value.kind) {
    case 'fresh':
      return {
        kind: 'fresh',
        baseRevisionId: assertRevisionId(value.baseRevisionId),
      }
    case 'stale':
      return {
        kind: 'stale',
        requestedRevisionId: assertRevisionId(value.requestedRevisionId),
        currentRevisionId: assertRevisionId(value.currentRevisionId),
      }
    default:
      throw new Error('Invalid preview freshness kind.')
  }
}

function normalizeFeatureTree(value: unknown): DocumentSnapshot['featureTree'] {
  if (!Array.isArray(value)) {
    throw new Error('Invalid feature tree payload.')
  }

  return value.map((entry) => {
    if (
      !isRecord(entry) ||
      !isString(entry.id) ||
      !isString(entry.label) ||
      !isString(entry.description) ||
      (entry.kind !== 'plane' && entry.kind !== 'sketch' && entry.kind !== 'feature')
    ) {
      throw new Error('Invalid feature tree record.')
    }

    return {
      id: entry.id as FeatureTreeNodeId,
      label: entry.label,
      description: entry.description,
      kind: entry.kind,
      target: assertDurableRef(entry.target),
      ownerFeatureId: entry.ownerFeatureId === null ? null : assertFeatureId(entry.ownerFeatureId),
      ownerSketchId: entry.ownerSketchId === null ? null : assertSketchId(entry.ownerSketchId),
      sourceFeatureId: entry.sourceFeatureId === null ? null : assertFeatureId(entry.sourceFeatureId),
    }
  })
}

function normalizeObjects(value: unknown): ObjectTreeNodeRecord[] {
  if (!Array.isArray(value)) {
    throw new Error('Invalid object tree payload.')
  }

  return value.map((entry) => {
    if (
      !isRecord(entry) ||
      !isString(entry.id) ||
      !isString(entry.label) ||
      !isString(entry.description) ||
      (entry.kind !== 'body' && entry.kind !== 'construction')
    ) {
      throw new Error('Invalid object tree record.')
    }

    return {
      id: entry.id as ObjectTreeNodeId,
      label: entry.label,
      description: entry.description,
      kind: entry.kind,
      target: assertDurableRef(entry.target),
      ownerBodyId: entry.ownerBodyId === null ? null : assertBodyId(entry.ownerBodyId),
      ownerFeatureId: entry.ownerFeatureId === null ? null : assertFeatureId(entry.ownerFeatureId),
    }
  })
}

function normalizeOwnership(value: unknown) {
  if (!isRecord(value)) {
    throw new Error('Invalid ownership payload.')
  }

  return {
    ownerDocumentId: assertDocumentId(value.ownerDocumentId),
    ownerRevisionId: assertRevisionId(value.ownerRevisionId),
    ownerFeatureId: value.ownerFeatureId === null ? null : assertFeatureId(value.ownerFeatureId),
    ownerSketchId: value.ownerSketchId === null ? null : assertSketchId(value.ownerSketchId),
    ownerBodyId: value.ownerBodyId === null ? null : assertBodyId(value.ownerBodyId),
  }
}

function normalizeReferences(value: unknown): ReferenceRecord[] {
  if (!Array.isArray(value)) {
    throw new Error('Invalid reference payload.')
  }

  return value.map((entry) => {
    if (
      !isRecord(entry) ||
      !isString(entry.id) ||
      !isString(entry.label) ||
      !(entry.ownerFeatureId === null || isString(entry.ownerFeatureId))
    ) {
      throw new Error('Invalid reference record.')
    }

    return {
      id: entry.id as ReferenceRecord['id'],
      label: entry.label,
      target: assertPrimitiveRef(entry.target),
      ownerFeatureId: entry.ownerFeatureId as FeatureId | null,
      ownerSketchId: entry.ownerSketchId === null ? null : assertSketchId(entry.ownerSketchId),
      invalidation: entry.invalidation === null ? null : normalizeInvalidReferenceDetail(entry.invalidation),
    }
  })
}

function normalizeRenderables(value: unknown): RenderableEntityRecord[] {
  if (!Array.isArray(value)) {
    throw new Error('Invalid renderable payload.')
  }

  return value.map((entry) => {
    if (
      !isRecord(entry) ||
      !isString(entry.id) ||
      !isString(entry.label) ||
      (entry.topology !== 'face' && entry.topology !== 'edge' && entry.topology !== 'vertex') ||
      !isRecord(entry.pickBinding) ||
      !isString(entry.pickBinding.pickId) ||
      (entry.pickBinding.topology !== 'face' &&
        entry.pickBinding.topology !== 'edge' &&
        entry.pickBinding.topology !== 'vertex') ||
      !isRecord(entry.geometry) ||
      !isString(entry.geometry.kind)
    ) {
      throw new Error('Invalid renderable record.')
    }

    const geometry: RenderableEntityRecord['geometry'] = (() => {
      switch (entry.geometry.kind) {
        case 'planarFace': {
          if (
            !Array.isArray(entry.geometry.center) ||
            entry.geometry.center.length !== 3 ||
            !Array.isArray(entry.geometry.size) ||
            entry.geometry.size.length !== 2 ||
            (entry.geometry.normalAxis !== 'x' &&
              entry.geometry.normalAxis !== 'y' &&
              entry.geometry.normalAxis !== 'z')
          ) {
            throw new Error('Invalid planar face geometry payload.')
          }

          return {
            kind: 'planarFace' as const,
            center: entry.geometry.center.map((component) => {
              if (typeof component !== 'number') {
                throw new Error('Invalid planar face center payload.')
              }

              return component
            }) as [number, number, number],
            size: entry.geometry.size.map((component) => {
              if (typeof component !== 'number') {
                throw new Error('Invalid planar face size payload.')
              }

              return component
            }) as [number, number],
            normalAxis: entry.geometry.normalAxis as 'x' | 'y' | 'z',
          }
        }
        case 'polyline': {
          if (!Array.isArray(entry.geometry.points)) {
            throw new Error('Invalid polyline geometry payload.')
          }

          return {
            kind: 'polyline' as const,
            points: entry.geometry.points.map((point) => {
              if (
                !Array.isArray(point) ||
                point.length !== 3 ||
                point.some((component) => typeof component !== 'number')
              ) {
                throw new Error('Invalid polyline point payload.')
              }

              return point as [number, number, number]
            }),
          }
        }
        case 'pointMarker': {
          if (
            !Array.isArray(entry.geometry.position) ||
            entry.geometry.position.length !== 3 ||
            entry.geometry.position.some((component) => typeof component !== 'number') ||
            typeof entry.geometry.radius !== 'number'
          ) {
            throw new Error('Invalid point marker geometry payload.')
          }

          return {
            kind: 'pointMarker' as const,
            position: entry.geometry.position as [number, number, number],
            radius: entry.geometry.radius,
          }
        }
        default:
          throw new Error('Invalid renderable geometry kind.')
      }
    })()

    const target = assertPrimitiveRef(entry.target)
    const pickTarget = assertPrimitiveRef(entry.pickBinding.target)

    if (!primitiveRefEquals(target, pickTarget)) {
      throw new Error('Renderable pick target must match renderable target.')
    }

    if (entry.topology !== entry.pickBinding.topology) {
      throw new Error('Renderable pick topology must match renderable topology.')
    }

    return {
      id: entry.id as RenderableId,
      label: entry.label,
      target,
      ownerBodyId: entry.ownerBodyId === null ? null : assertBodyId(entry.ownerBodyId),
      ownerFeatureId: entry.ownerFeatureId === null ? null : assertFeatureId(entry.ownerFeatureId),
      topology: entry.topology,
      pickBinding: {
        pickId: entry.pickBinding.pickId as PickId,
        target,
        topology: entry.pickBinding.topology,
      },
      geometry,
    }
  })
}

function normalizeSketches(value: unknown): SketchSnapshotRecord[] {
  if (!Array.isArray(value)) {
    throw new Error('Invalid sketch snapshot payload.')
  }

  return value.map((entry) => {
    if (!isRecord(entry) || !isString(entry.sketchId) || !isString(entry.label)) {
      throw new Error('Invalid sketch snapshot record.')
    }

    if (!Array.isArray(entry.primitiveIds) || !Array.isArray(entry.primitives)) {
      throw new Error('Invalid sketch primitive payload.')
    }

    return {
      ...normalizeOwnership(entry),
      sketchId: assertSketchId(entry.sketchId),
      label: entry.label,
      planeTarget: assertDurableRef(entry.planeTarget),
      planeKey:
        entry.planeKey === 'xy' || entry.planeKey === 'yz' || entry.planeKey === 'xz'
          ? entry.planeKey
          : (() => {
              throw new Error('Invalid sketch plane key payload.')
            })(),
      primitiveIds: entry.primitiveIds.map((primitiveId) => assertSketchPrimitiveId(primitiveId)),
      primitives: entry.primitives.map((primitive) => {
        if (
          !isRecord(primitive) ||
          !isString(primitive.primitiveId) ||
          !isString(primitive.label) ||
          (primitive.kind !== 'line' &&
            primitive.kind !== 'circle' &&
            primitive.kind !== 'arc' &&
            primitive.kind !== 'point' &&
            primitive.kind !== 'profile')
        ) {
          throw new Error('Invalid sketch primitive record.')
        }

        return {
          primitiveId: assertSketchPrimitiveId(primitive.primitiveId),
          entityId:
            typeof primitive.entityId === 'string'
              ? (primitive.entityId as SketchSnapshotRecord['primitives'][number]['entityId'])
              : (() => {
                  throw new Error('Invalid sketch primitive entity ID payload.')
                })(),
          label: primitive.label,
          kind: primitive.kind,
          target: assertPrimitiveRef(
            primitive.target,
          ) as SketchSnapshotRecord['primitives'][number]['target'],
          geometry: primitive.geometry as SketchSnapshotRecord['primitives'][number]['geometry'],
        }
      }),
    }
  })
}

function normalizeFeatures(value: unknown): FeatureSnapshotRecord[] {
  if (!Array.isArray(value)) {
    throw new Error('Invalid feature snapshot payload.')
  }

  return value.map((entry) => {
    if (
      !isRecord(entry) ||
      !isString(entry.featureId) ||
      !isString(entry.label) ||
      !isString(entry.featureType) ||
      entry.featureTypeVersion !== 'feature-type/v1alpha1' ||
      !isRecord(entry.parameterPayload) ||
      !Array.isArray(entry.consumedTargets) ||
      !Array.isArray(entry.producedTargets)
    ) {
      throw new Error('Invalid feature snapshot record.')
    }

    return {
      ...normalizeOwnership(entry),
      featureId: assertFeatureId(entry.featureId),
      label: entry.label,
      featureType: entry.featureType as FeatureSnapshotRecord['featureType'],
      featureTypeVersion: entry.featureTypeVersion,
      parameterPayload: entry.parameterPayload as unknown as FeatureSnapshotRecord['parameterPayload'],
      consumedTargets: entry.consumedTargets.map((target) => assertPrimitiveRef(target)),
      producedTargets: entry.producedTargets.map((target) => assertDurableRef(target)),
    }
  })
}

function normalizeBodies(value: unknown): BodySnapshotRecord[] {
  if (!Array.isArray(value)) {
    throw new Error('Invalid body snapshot payload.')
  }

  return value.map((entry) => {
    if (
      !isRecord(entry) ||
      !isString(entry.bodyId) ||
      !isString(entry.label) ||
      !isRecord(entry.topology) ||
      !Array.isArray(entry.topology.faceIds) ||
      !Array.isArray(entry.topology.edgeIds) ||
      !Array.isArray(entry.topology.vertexIds)
    ) {
      throw new Error('Invalid body snapshot record.')
    }

    return {
      ...normalizeOwnership(entry),
      bodyId: assertBodyId(entry.bodyId),
      label: entry.label,
      topology: {
        faceIds: entry.topology.faceIds.map((faceId) => {
          if (!isString(faceId)) {
            throw new Error('Invalid face ID payload.')
          }

          return faceId as BodySnapshotRecord['topology']['faceIds'][number]
        }),
        edgeIds: entry.topology.edgeIds.map((edgeId) => {
          if (!isString(edgeId)) {
            throw new Error('Invalid edge ID payload.')
          }

          return edgeId as BodySnapshotRecord['topology']['edgeIds'][number]
        }),
        vertexIds: entry.topology.vertexIds.map((vertexId) => {
          if (!isString(vertexId)) {
            throw new Error('Invalid vertex ID payload.')
          }

          return vertexId as BodySnapshotRecord['topology']['vertexIds'][number]
        }),
      },
    }
  })
}

function normalizeConstructions(value: unknown): ConstructionSnapshotRecord[] {
  if (!Array.isArray(value)) {
    throw new Error('Invalid construction snapshot payload.')
  }

  return value.map((entry) => {
    if (
      !isRecord(entry) ||
      !isString(entry.constructionId) ||
      !isString(entry.label) ||
      entry.constructionType !== 'plane'
    ) {
      throw new Error('Invalid construction snapshot record.')
    }

    return {
      ...normalizeOwnership(entry),
      constructionId: entry.constructionId as ConstructionSnapshotRecord['constructionId'],
      label: entry.label,
      constructionType: entry.constructionType,
      target: assertDurableRef(entry.target),
    }
  })
}

function normalizeEntities(value: unknown): SnapshotEntityRecord[] {
  if (!Array.isArray(value)) {
    throw new Error('Invalid snapshot entity payload.')
  }

  return value.map((entry) => {
    if (
      !isRecord(entry) ||
      !isString(entry.id) ||
      !isString(entry.label) ||
      !Array.isArray(entry.relatedTargets) ||
      !Array.isArray(entry.consumedByFeatureIds)
    ) {
      throw new Error('Invalid snapshot entity record.')
    }

    return {
      ...normalizeOwnership(entry),
      id: entry.id as SnapshotEntityId,
      label: entry.label,
      target: assertPrimitiveRef(entry.target),
      relatedTargets: entry.relatedTargets.map((target) => assertPrimitiveRef(target)),
      consumedByFeatureIds: entry.consumedByFeatureIds.map((featureId) => assertFeatureId(featureId)),
    }
  })
}

function normalizeChangedTargets(value: unknown): PrimitiveRef[] {
  if (!Array.isArray(value)) {
    throw new Error('Invalid changed target payload.')
  }

  return value.map((entry) => assertPrimitiveRef(entry))
}

function normalizeResolution(value: unknown): ResolvedReferenceRecord {
  if (!isRecord(value) || !isString(value.label)) {
    throw new Error('Invalid reference resolution payload.')
  }

  return {
    label: value.label,
    target: assertPrimitiveRef(value.target),
    ownerDocumentId: assertDocumentId(value.ownerDocumentId),
    ownerRevisionId: assertRevisionId(value.ownerRevisionId),
    ownerFeatureId: value.ownerFeatureId === null ? null : assertFeatureId(value.ownerFeatureId),
    ownerSketchId: value.ownerSketchId === null ? null : assertSketchId(value.ownerSketchId),
    ownerBodyId: value.ownerBodyId === null ? null : assertBodyId(value.ownerBodyId),
    invalidation: value.invalidation === null ? null : normalizeInvalidReferenceDetail(value.invalidation),
  }
}

function normalizeSnapshot(snapshot: GetDocumentSnapshotResponse['snapshot']): DocumentSnapshot {
  if (
    snapshot.contractVersion !== CONTRACT_VERSION ||
    snapshot.schemaVersion !== SNAPSHOT_SCHEMA_VERSION ||
    !isString(snapshot.documentId) ||
    !isString(snapshot.revisionId)
  ) {
    throw new Error('Snapshot header is invalid.')
  }

  return {
    contractVersion: CONTRACT_VERSION,
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    documentId: snapshot.documentId as DocumentSnapshot['documentId'],
    revisionId: snapshot.revisionId as DocumentSnapshot['revisionId'],
    featureTree: normalizeFeatureTree(snapshot.featureTree),
    objects: normalizeObjects(snapshot.objects),
    features: normalizeFeatures(snapshot.features),
    sketches: normalizeSketches(snapshot.sketches),
    bodies: normalizeBodies(snapshot.bodies),
    constructions: normalizeConstructions(snapshot.constructions),
    entities: normalizeEntities(snapshot.entities),
    references: normalizeReferences(snapshot.references),
    diagnostics: normalizeDiagnostics(snapshot.diagnostics),
    renderables: normalizeRenderables(snapshot.renderables),
  }
}

function buildDocumentRequest(documentId: DocumentSnapshot['documentId']): GetDocumentSnapshotRequest {
  return {
    contractVersion: CONTRACT_VERSION,
    documentId,
  }
}

function normalizeFeatureMutationResponse(
  response: CreateFeatureResponse | UpdateFeatureResponse,
  expectedDocumentId: DocumentId,
): ModelingFeatureMutationResult {
  if (response.contractVersion !== CONTRACT_VERSION) {
    throw new Error('Invalid feature mutation response header.')
  }

  if (assertDocumentId(response.documentId) !== expectedDocumentId) {
    throw new Error('Feature mutation response document ID does not match the active document.')
  }

  return {
    revisionId: assertRevisionId(response.revisionId),
    featureId: assertFeatureId(response.featureId),
    revisionState: normalizeRevisionState(response.revisionState),
    changedTargets: normalizeChangedTargets(response.changedTargets),
    diagnostics: normalizeDiagnostics(response.diagnostics),
  }
}

function normalizeDeleteFeatureResponse(
  response: DeleteFeatureResponse,
  expectedDocumentId: DocumentId,
): ModelingDeleteFeatureResult {
  if (response.contractVersion !== CONTRACT_VERSION) {
    throw new Error('Invalid delete feature response header.')
  }

  if (assertDocumentId(response.documentId) !== expectedDocumentId) {
    throw new Error('Delete feature response document ID does not match the active document.')
  }

  return {
    revisionId: assertRevisionId(response.revisionId),
    deletedFeatureId: assertFeatureId(response.deletedFeatureId),
    revisionState: normalizeRevisionState(response.revisionState),
    changedTargets: normalizeChangedTargets(response.changedTargets),
    diagnostics: normalizeDiagnostics(response.diagnostics),
  }
}

function normalizeCommitSketchResponse(
  response: CommitSketchResponse,
  expectedDocumentId: DocumentId,
): ModelingCommitSketchResult {
  if (response.contractVersion !== CONTRACT_VERSION) {
    throw new Error('Invalid commit sketch response header.')
  }

  if (assertDocumentId(response.documentId) !== expectedDocumentId) {
    throw new Error('Commit sketch response document ID does not match the active document.')
  }

  return {
    revisionId: assertRevisionId(response.revisionId),
    sketchId: assertSketchId(response.sketchId),
    revisionState: normalizeRevisionState(response.revisionState),
    changedTargets: normalizeChangedTargets(response.changedTargets),
    diagnostics: normalizeDiagnostics(response.diagnostics),
  }
}

function normalizePreviewResponse(
  response: EvaluatePreviewResponse,
  expectedDocumentId: DocumentId,
): ModelingPreviewResult {
  if (response.contractVersion !== CONTRACT_VERSION) {
    throw new Error('Invalid preview response header.')
  }

  if (assertDocumentId(response.documentId) !== expectedDocumentId) {
    throw new Error('Preview response document ID does not match the active document.')
  }

  return {
    revisionId: assertRevisionId(response.revisionId),
    previewId: response.previewId as PreviewId,
    renderables: normalizeRenderables(response.renderables),
    freshness: normalizePreviewFreshness(response.freshness),
    stale: normalizePreviewFreshness(response.freshness).kind === 'stale',
    diagnostics: normalizeDiagnostics(response.diagnostics),
  }
}

function normalizeResolvedReference(
  response: ResolveReferenceResponse,
): ModelingResolvedReferenceResult {
  if (response.contractVersion !== CONTRACT_VERSION) {
    throw new Error('Invalid reference resolution response header.')
  }

  return {
    resolution: normalizeResolution(response.resolution),
    diagnostics: normalizeDiagnostics(response.diagnostics),
  }
}

function assertMutationBase(input: {
  baseRevisionId: RevisionId
  consumedTargets?: PrimitiveRef[]
}) {
  assertRevisionId(input.baseRevisionId)

  if (input.consumedTargets) {
    input.consumedTargets.forEach((target) => {
      assertPrimitiveRef(target)
    })
  }
}

function normalizeCreateFeatureInput(
  input: ModelingCreateFeatureInput,
  documentId: DocumentId,
): CreateFeatureRequest {
  assertMutationBase(input)

  return {
    ...input,
    contractVersion: CONTRACT_VERSION,
    documentId,
  }
}

function normalizeCommitSketchInput(
  input: ModelingCommitSketchInput,
  documentId: DocumentId,
): CommitSketchRequest {
  assertMutationBase(input)

  return {
    ...input,
    contractVersion: CONTRACT_VERSION,
    documentId,
  }
}

function normalizeUpdateFeatureInput(
  input: ModelingUpdateFeatureInput,
  documentId: DocumentId,
): UpdateFeatureRequest {
  assertMutationBase(input)

  return {
    ...input,
    contractVersion: CONTRACT_VERSION,
    documentId,
  }
}

function normalizeDeleteFeatureInput(
  input: ModelingDeleteFeatureInput,
  documentId: DocumentId,
): DeleteFeatureRequest {
  assertMutationBase(input)

  return {
    ...input,
    contractVersion: CONTRACT_VERSION,
    documentId,
  }
}

function normalizePreviewInput(
  input: ModelingEvaluatePreviewInput,
  documentId: DocumentId,
): EvaluatePreviewRequest {
  assertMutationBase(input)

  return {
    ...input,
    contractVersion: CONTRACT_VERSION,
    documentId,
  }
}

function normalizeResolveReferenceInput(
  target: PrimitiveRef,
  documentId: DocumentId,
): ResolveReferenceRequest {
  return {
    contractVersion: CONTRACT_VERSION,
    documentId,
    target: assertDurableRef(target),
  }
}

function normalizeCurrentDocumentId(value: DocumentSnapshot['documentId']): DocumentId {
  return assertDocumentId(value)
}

function getResolutionLabel(resolution: ResolvedReferenceRecord) {
  return resolution.label || formatPrimitiveRefLabel(resolution.target)
}

export function createModelingService(
  adapter: ModelingKernelAdapter,
  options: ModelingServiceOptions,
): ModelingService {
  const currentDocumentId = normalizeCurrentDocumentId(options.currentDocumentId)

  return {
    currentDocumentId,
    async getCurrentDocumentSnapshot() {
      const response = await adapter.getDocumentSnapshot(buildDocumentRequest(currentDocumentId))
      return normalizeSnapshot(response.snapshot)
    },
    async commitSketch(input) {
      const response = await adapter.commitSketch(
        normalizeCommitSketchInput(input, currentDocumentId),
      )

      return normalizeCommitSketchResponse(response, currentDocumentId)
    },
    async createFeature(input) {
      const response = await adapter.createFeature(normalizeCreateFeatureInput(input, currentDocumentId))

      return normalizeFeatureMutationResponse(response, currentDocumentId)
    },
    async updateFeature(input) {
      const response = await adapter.updateFeature(normalizeUpdateFeatureInput(input, currentDocumentId))

      return normalizeFeatureMutationResponse(response, currentDocumentId)
    },
    async deleteFeature(input) {
      const response = await adapter.deleteFeature(normalizeDeleteFeatureInput(input, currentDocumentId))

      return normalizeDeleteFeatureResponse(response, currentDocumentId)
    },
    async evaluatePreview(input) {
      const response = await adapter.evaluatePreview(normalizePreviewInput(input, currentDocumentId))

      return normalizePreviewResponse(response, currentDocumentId)
    },
    async resolveReference(target) {
      const response = await adapter.resolveReference(
        normalizeResolveReferenceInput(target, currentDocumentId),
      )

      const normalized = normalizeResolvedReference(response)
      return {
        ...normalized,
        resolution: {
          ...normalized.resolution,
          label: getResolutionLabel(normalized.resolution),
        },
      }
    },
  }
}

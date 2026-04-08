import type { ModelingKernelAdapter } from '@/domain/modeling/kernel-adapter'
import type {
  BodyId,
  ConstructionId,
  DocumentId,
  EdgeId,
  FaceId,
  FeatureId,
  PrimitiveRef,
  RevisionId,
  SketchId,
  SketchPrimitiveId,
  VertexId,
} from '@/domain/editor/schema'
import { getPrimitiveRefLabel as formatPrimitiveRefLabel } from '@/domain/editor/schema'
import type {
  BodySnapshotRecord,
  ConstructionSnapshotRecord,
  CreateFeatureRequest,
  DeleteFeatureRequest,
  DocumentSnapshot,
  EvaluatePreviewRequest,
  EvaluatePreviewResponse,
  FeatureSnapshotRecord,
  PreviewId,
  GetDocumentSnapshotRequest,
  ModelingDiagnostic,
  ObjectTreeNodeRecord,
  ReferenceRecord,
  RenderableEntityRecord,
  ResolvedReferenceRecord,
  SketchSnapshotRecord,
  SnapshotEntityRecord,
  UpdateFeatureRequest,
} from '@/domain/modeling/schema'

export interface ModelingService {
  getCurrentDocumentSnapshot(): Promise<DocumentSnapshot>
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
  changedTargets: PrimitiveRef[]
  diagnostics: ModelingDiagnostic[]
}

export interface ModelingDeleteFeatureResult {
  revisionId: DocumentSnapshot['revisionId']
  deletedFeatureId: FeatureId
  changedTargets: PrimitiveRef[]
  diagnostics: ModelingDiagnostic[]
}

export type ModelingCreateFeatureInput = Omit<CreateFeatureRequest, 'contractVersion' | 'documentId'>
export type ModelingUpdateFeatureInput = Omit<UpdateFeatureRequest, 'contractVersion' | 'documentId'>
export type ModelingDeleteFeatureInput = Omit<DeleteFeatureRequest, 'contractVersion' | 'documentId'>
export type ModelingEvaluatePreviewInput = Omit<
  EvaluatePreviewRequest,
  'contractVersion' | 'documentId'
>

export interface ModelingPreviewResult {
  revisionId: DocumentSnapshot['revisionId']
  previewId: EvaluatePreviewResponse['previewId']
  renderables: RenderableEntityRecord[]
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
    case 'sketchPrimitive':
      if (isString(value.sketchId) && isString(value.primitiveId)) {
        return {
          kind: 'sketchPrimitive',
          sketchId: value.sketchId as SketchId,
          primitiveId: value.primitiveId as SketchPrimitiveId,
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
    }
  })
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
      id: entry.id,
      label: entry.label,
      description: entry.description,
      kind: entry.kind,
      target: assertPrimitiveRef(entry.target),
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
      id: entry.id,
      label: entry.label,
      description: entry.description,
      kind: entry.kind,
      target: assertPrimitiveRef(entry.target),
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
      invalidationReason:
        entry.invalidationReason === null
          ? null
          : isString(entry.invalidationReason)
            ? entry.invalidationReason
            : (() => {
                throw new Error('Invalid reference invalidation payload.')
              })(),
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
      (entry.topology !== 'face' && entry.topology !== 'edge' && entry.topology !== 'vertex')
    ) {
      throw new Error('Invalid renderable record.')
    }

    return {
      id: entry.id,
      label: entry.label,
      target: assertPrimitiveRef(entry.target),
      ownerBodyId: entry.ownerBodyId === null ? null : assertBodyId(entry.ownerBodyId),
      ownerFeatureId: entry.ownerFeatureId === null ? null : assertFeatureId(entry.ownerFeatureId),
      topology: entry.topology,
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
      planeTarget: assertPrimitiveRef(entry.planeTarget),
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
          label: primitive.label,
          kind: primitive.kind,
          target: assertPrimitiveRef(primitive.target),
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
      !Array.isArray(entry.consumedTargets) ||
      !Array.isArray(entry.producedTargets)
    ) {
      throw new Error('Invalid feature snapshot record.')
    }

    return {
      ...normalizeOwnership(entry),
      featureId: assertFeatureId(entry.featureId),
      label: entry.label,
      featureType: entry.featureType,
      featureTypeVersion: entry.featureTypeVersion,
      consumedTargets: entry.consumedTargets.map((target) => assertPrimitiveRef(target)),
      producedTargets: entry.producedTargets.map((target) => assertPrimitiveRef(target)),
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
      target: assertPrimitiveRef(entry.target),
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
      id: entry.id,
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
    invalidationReason:
      value.invalidationReason === null
        ? null
        : isString(value.invalidationReason)
          ? value.invalidationReason
          : (() => {
              throw new Error('Invalid invalidation reason payload.')
            })(),
  }
}

function normalizeSnapshot(snapshot: unknown): DocumentSnapshot {
  if (!isRecord(snapshot)) {
    throw new Error('Invalid snapshot payload.')
  }

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
  response: unknown,
  expectedDocumentId: DocumentId,
): ModelingFeatureMutationResult {
  if (
    !isRecord(response) ||
    response.contractVersion !== CONTRACT_VERSION ||
    !isString(response.documentId)
  ) {
    throw new Error('Invalid feature mutation response header.')
  }

  if (assertDocumentId(response.documentId) !== expectedDocumentId) {
    throw new Error('Feature mutation response document ID does not match the active document.')
  }

  return {
    revisionId: assertRevisionId(response.revisionId),
    featureId: assertFeatureId(response.featureId),
    changedTargets: normalizeChangedTargets(response.changedTargets),
    diagnostics: normalizeDiagnostics(response.diagnostics),
  }
}

function normalizeDeleteFeatureResponse(
  response: unknown,
  expectedDocumentId: DocumentId,
): ModelingDeleteFeatureResult {
  if (
    !isRecord(response) ||
    response.contractVersion !== CONTRACT_VERSION ||
    !isString(response.documentId)
  ) {
    throw new Error('Invalid delete feature response header.')
  }

  if (assertDocumentId(response.documentId) !== expectedDocumentId) {
    throw new Error('Delete feature response document ID does not match the active document.')
  }

  return {
    revisionId: assertRevisionId(response.revisionId),
    deletedFeatureId: assertFeatureId(response.deletedFeatureId),
    changedTargets: normalizeChangedTargets(response.changedTargets),
    diagnostics: normalizeDiagnostics(response.diagnostics),
  }
}

function normalizePreviewResponse(
  response: unknown,
  expectedDocumentId: DocumentId,
): ModelingPreviewResult {
  if (
    !isRecord(response) ||
    response.contractVersion !== CONTRACT_VERSION ||
    !isString(response.documentId) ||
    !isString(response.previewId)
  ) {
    throw new Error('Invalid preview response header.')
  }

  if (assertDocumentId(response.documentId) !== expectedDocumentId) {
    throw new Error('Preview response document ID does not match the active document.')
  }

  return {
    revisionId: assertRevisionId(response.revisionId),
    previewId: response.previewId as PreviewId,
    renderables: normalizeRenderables(response.renderables),
    diagnostics: normalizeDiagnostics(response.diagnostics),
  }
}

function normalizeResolvedReference(response: unknown): ModelingResolvedReferenceResult {
  if (!isRecord(response) || response.contractVersion !== CONTRACT_VERSION) {
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
): GetDocumentSnapshotRequest & { target: PrimitiveRef } {
  return {
    contractVersion: CONTRACT_VERSION,
    documentId,
    target: assertPrimitiveRef(target),
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
    async getCurrentDocumentSnapshot() {
      const response = await adapter.getDocumentSnapshot(buildDocumentRequest(currentDocumentId))
      return normalizeSnapshot(response.snapshot)
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

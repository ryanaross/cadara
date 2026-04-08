import { getPrimitiveRefKey } from '@/domain/editor/schema'
import type { PrimitiveRef } from '@/domain/editor/schema'
import type {
  DocumentSnapshot,
  FeatureSnapshotRecord,
  SnapshotEntityRecord,
} from '@/contracts/modeling/schema'
import type { SelectionTargetCatalog } from '@/domain/editor/schema'

export interface DocumentSelectionDetail {
  label: string
  kindLabel: string
  ownerLabel: string
  relatedLabels: string[]
}

function getFeatureLabel(snapshot: DocumentSnapshot, featureId: DocumentSelectionDetail['label']) {
  return snapshot.features.find((feature) => feature.featureId === featureId)?.label ?? null
}

function getSketchLabel(snapshot: DocumentSnapshot, sketchId: DocumentSelectionDetail['label']) {
  return snapshot.sketches.find((sketch) => sketch.sketchId === sketchId)?.label ?? null
}

function getBodyLabel(snapshot: DocumentSnapshot, bodyId: DocumentSelectionDetail['label']) {
  return snapshot.bodies.find((body) => body.bodyId === bodyId)?.label ?? null
}

export function getEntityRecordForTarget(snapshot: DocumentSnapshot, target: PrimitiveRef) {
  const targetKey = getPrimitiveRefKey(target)
  return snapshot.entities.find((entity) => getPrimitiveRefKey(entity.target) === targetKey) ?? null
}

function getOwnerLabel(snapshot: DocumentSnapshot, entity: SnapshotEntityRecord) {
  if (entity.ownerFeatureId) {
    return getFeatureLabel(snapshot, entity.ownerFeatureId) ?? entity.ownerFeatureId
  }

  if (entity.ownerSketchId) {
    return getSketchLabel(snapshot, entity.ownerSketchId) ?? entity.ownerSketchId
  }

  if (entity.ownerBodyId) {
    return getBodyLabel(snapshot, entity.ownerBodyId) ?? entity.ownerBodyId
  }

  return 'Document root'
}

export function getSelectionDetail(
  snapshot: DocumentSnapshot,
  target: PrimitiveRef,
): DocumentSelectionDetail {
  const entity = getEntityRecordForTarget(snapshot, target)

  if (!entity) {
    throw new Error(`Selection target ${getPrimitiveRefKey(target)} is missing from snapshot.entities.`)
  }

  return {
    label: entity.label,
    kindLabel: entity.target.kind,
    ownerLabel: getOwnerLabel(snapshot, entity),
    relatedLabels: entity.relatedTargets.map((relatedTarget) => {
      const relatedEntity = getEntityRecordForTarget(snapshot, relatedTarget)

      if (!relatedEntity) {
        throw new Error(
          `Related target ${getPrimitiveRefKey(relatedTarget)} is missing from snapshot.entities.`,
        )
      }

      return relatedEntity.label
    }),
  }
}

export function getFeatureSnapshot(
  snapshot: DocumentSnapshot,
  featureId: FeatureSnapshotRecord['featureId'],
) {
  return snapshot.features.find((feature) => feature.featureId === featureId) ?? null
}

export function buildSelectionTargetCatalog(snapshot: DocumentSnapshot): SelectionTargetCatalog {
  return {
    existingSketchKeys: [
      ...snapshot.sketches.map((sketch) => getPrimitiveRefKey({ kind: 'sketch', sketchId: sketch.sketchId })),
      ...snapshot.sketches.flatMap((sketch) =>
        sketch.sketch.regions.map((region) => getPrimitiveRefKey(region.target)),
      ),
    ],
    constructionPlaneKeys: snapshot.constructions
      .filter((construction) => construction.constructionType === 'plane')
      .map((construction) => getPrimitiveRefKey(construction.target)),
    planarFaceKeys: snapshot.renderables
      .filter((renderable) => renderable.topology === 'face' && renderable.geometry.kind === 'planarFace')
      .map((renderable) => getPrimitiveRefKey(renderable.target)),
  }
}

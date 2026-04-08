import { getPrimitiveRefKey } from '@/domain/editor/schema'
import type { PrimitiveRef } from '@/domain/editor/schema'
import type {
  DocumentSnapshot,
  SnapshotEntityRecord,
} from '@/domain/modeling/schema'

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

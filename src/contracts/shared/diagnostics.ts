import type { BodyId, DocumentId, FeatureId, RevisionId, SketchId } from '@/contracts/shared/ids'

/**
 * Ownership metadata attached to durable references and snapshot records.
 */
export interface OwnershipRecord {
  ownerDocumentId: DocumentId
  ownerRevisionId: RevisionId
  ownerFeatureId: FeatureId | null
  ownerSketchId: SketchId | null
  ownerBodyId: BodyId | null
}


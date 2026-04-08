import type { PrimitiveRef, RevisionId } from '@/domain/editor/schema'
import {
  createNewSketchSession,
  createSketchSessionFromSnapshot,
  getSketchSessionRenderables,
  type SketchSessionState,
} from '@/domain/editor/sketch-session'
import type { DocumentSnapshot } from '@/domain/modeling/schema'
import type {
  ModelingCommitSketchResult,
  ModelingService,
} from '@/domain/modeling/modeling-service'

export function openSketchSessionFromSelection(
  selection: PrimitiveRef[],
  snapshot: DocumentSnapshot | null,
): SketchSessionState | null {
  const primary = selection[0]

  if (!primary) {
    return null
  }

  if (primary.kind === 'sketch' && snapshot) {
    const sketch = snapshot.sketches.find((entry) => entry.sketchId === primary.sketchId)
    return sketch ? createSketchSessionFromSnapshot(sketch) : null
  }

  if (primary.kind === 'construction') {
    return createNewSketchSession(primary)
  }

  return null
}

export function canStartSketchFromTarget(target: PrimitiveRef, snapshot: DocumentSnapshot | null) {
  if (target.kind === 'construction') {
    return true
  }

  if (target.kind !== 'sketch' || !snapshot) {
    return false
  }

  return snapshot.sketches.some((entry) => entry.sketchId === target.sketchId)
}

export async function commitActiveSketchSession(input: {
  modelingService: ModelingService
  session: SketchSessionState
  baseRevisionId: RevisionId
}): Promise<ModelingCommitSketchResult | null> {
  if (!input.session.commitRequest) {
    return null
  }

  const result = await input.modelingService.commitSketch({
    baseRevisionId: input.baseRevisionId,
    ...input.session.commitRequest,
  })

  if (result.revisionState.kind === 'conflict') {
    return result
  }

  return result
}

export function mergeSketchRenderables(
  documentRenderables: DocumentSnapshot['renderables'],
  session: SketchSessionState | null,
) {
  if (!session) {
    return documentRenderables
  }

  return [...documentRenderables, ...getSketchSessionRenderables(session)]
}

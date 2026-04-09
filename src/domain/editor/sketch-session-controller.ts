import type { PrimitiveRef, RevisionId } from '@/domain/editor/schema'
import {
  createNewSketchSession,
  createSketchSessionFromSnapshot,
  getSketchSessionDisplayRenderables,
  type SketchSessionDisplayRenderable,
  type SketchSessionState,
} from '@/domain/editor/sketch-session'
import type { DocumentSnapshot } from '@/contracts/modeling/schema'
import type { RenderableEntityRecord } from '@/contracts/render/schema'
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
    const sketch = snapshot.document.sketches.find((entry) => entry.sketchId === primary.sketchId)
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

  return snapshot.document.sketches.some((entry) => entry.sketchId === target.sketchId)
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
    solverCorrelation: null,
  })

  if (result.revisionState.kind === 'conflict') {
    return result
  }

  return result
}

export function mergeSketchRenderables(
  documentRenderables: RenderableEntityRecord[],
  session: SketchSessionState | null,
) {
  if (!session) {
    return {
      documentRenderables,
      sketchDisplayRenderables: [],
    }
  }

  return {
    documentRenderables,
    sketchDisplayRenderables: getSketchSessionDisplayRenderables(session),
  }
}

export type MergedSketchRenderables = {
  documentRenderables: RenderableEntityRecord[]
  sketchDisplayRenderables: SketchSessionDisplayRenderable[]
}

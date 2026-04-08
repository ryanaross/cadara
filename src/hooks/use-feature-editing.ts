import { useEffect, useMemo, useRef, useState } from 'react'

import {
  buildExtrudeConsumedTargets,
  buildExtrudeParameterPayload,
  hydrateExtrudeFeatureEditSession,
} from '@/domain/editor/feature-editing'
import type { RevisionId } from '@/domain/editor/schema'
import { getPrimitiveRefKey } from '@/domain/editor/schema'
import type { FeatureSnapshotRecord, RenderableEntityRecord } from '@/domain/modeling/schema'
import { useEditorState } from '@/hooks/use-editor-state'
import { useModelingService } from '@/hooks/use-modeling-service'

export function useFeatureEditing(
  snapshotRevisionId: RevisionId | null,
  featureSnapshot: FeatureSnapshotRecord | null,
) {
  const modelingService = useModelingService()
  const {
    state: { activeEditSession, activeCommand },
    dispatch,
  } = useEditorState()
  const [previewRenderables, setPreviewRenderables] = useState<RenderableEntityRecord[] | null>(null)
  const previewRequestKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!featureSnapshot || activeCommand?.toolId !== 'extrude' || activeEditSession) {
      return
    }

    const session = hydrateExtrudeFeatureEditSession(featureSnapshot)

    if (!session) {
      return
    }

    dispatch({
      type: 'beginFeatureEdit',
      featureId: featureSnapshot.featureId,
      featureType: 'extrude',
      draft: session.draft,
    })
  }, [activeCommand?.toolId, activeEditSession, dispatch, featureSnapshot])

  const previewInput = useMemo(() => {
    if (!activeEditSession || activeEditSession.featureType !== 'extrude' || !snapshotRevisionId) {
      return null
    }

    const parameterPayload = buildExtrudeParameterPayload(activeEditSession.draft)

    if (!parameterPayload) {
      return {
        kind: 'invalid' as const,
        diagnostics: [
          {
            code: 'feature-preview-missing-profile',
            severity: 'warning' as const,
            message: 'Select a sketch, sketch profile, or planar face before previewing extrude.',
            target: null,
            detail: null,
          },
        ],
      }
    }

    const consumedTargets = buildExtrudeConsumedTargets(activeEditSession.draft)

    return {
      kind: 'valid' as const,
      requestKey: JSON.stringify({
        revisionId: snapshotRevisionId,
        previewId: activeEditSession.previewId,
        featureType: activeEditSession.featureType,
        featureId: activeEditSession.featureId,
        depth: parameterPayload.depth,
        direction: parameterPayload.direction,
        operation: parameterPayload.operation,
        consumedTargets: consumedTargets.map((target) => getPrimitiveRefKey(target)),
      }),
      request: {
        baseRevisionId: snapshotRevisionId,
        previewId: activeEditSession.previewId,
        featureType: activeEditSession.featureType,
        featureTypeVersion: activeEditSession.featureTypeVersion,
        parameterPayload,
        consumedTargets,
      },
      profileTarget: parameterPayload.profileTarget,
    }
  }, [activeEditSession, snapshotRevisionId])

  useEffect(() => {
    if (!activeEditSession || activeEditSession.featureType !== 'extrude') {
      previewRequestKeyRef.current = null
      setPreviewRenderables(null)
      return
    }

    if (!previewInput) {
      return
    }

    if (previewInput.kind === 'invalid') {
      previewRequestKeyRef.current = null
      setPreviewRenderables(null)
      dispatch({
        type: 'setFeatureEditDiagnostics',
        diagnostics: previewInput.diagnostics,
      })
      return
    }

    if (previewRequestKeyRef.current === previewInput.requestKey) {
      return
    }

    let cancelled = false
    previewRequestKeyRef.current = previewInput.requestKey

    dispatch({ type: 'setFeatureEditStatus', status: 'previewing' })

    modelingService
      .evaluatePreview(previewInput.request)
      .then((result) => {
        if (cancelled) {
          return
        }

        if (result.stale) {
          setPreviewRenderables(null)
          dispatch({
            type: 'setFeatureEditDiagnostics',
            diagnostics: result.diagnostics,
            revisionId: result.revisionId,
          })
          dispatch({ type: 'setFeatureEditStatus', status: 'idle' })
          return
        }

        setPreviewRenderables(result.renderables)
        dispatch({
          type: 'setFeatureEditDiagnostics',
          diagnostics: result.diagnostics,
          revisionId: result.revisionId,
        })
        dispatch({ type: 'markFeaturePreviewReady', revisionId: result.revisionId })
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return
        }

        setPreviewRenderables(null)
        dispatch({
          type: 'setFeatureEditDiagnostics',
          diagnostics: [
            {
              code: 'feature-preview-failed',
              severity: 'error',
              message: error instanceof Error ? error.message : 'Feature preview failed.',
              target: previewInput.profileTarget,
              detail: null,
            },
          ],
        })
        dispatch({ type: 'setFeatureEditStatus', status: 'idle' })
      })

    return () => {
      cancelled = true
    }
  }, [
    dispatch,
    modelingService,
    previewInput,
    activeEditSession,
  ])

  return {
    previewRenderables,
    async commitFeature() {
      if (!activeEditSession || activeEditSession.featureType !== 'extrude' || !snapshotRevisionId) {
        return null
      }

      const parameterPayload = buildExtrudeParameterPayload(activeEditSession.draft)

      if (!parameterPayload) {
        dispatch({
          type: 'setFeatureEditDiagnostics',
          diagnostics: [
            {
              code: 'feature-commit-missing-profile',
              severity: 'error',
              message: 'Extrude requires an explicit profile target.',
              target: null,
              detail: null,
            },
          ],
        })
        return null
      }

      dispatch({ type: 'setFeatureEditStatus', status: 'submitting' })

      const input = {
        baseRevisionId: snapshotRevisionId,
        featureTypeVersion: activeEditSession.featureTypeVersion,
        parameterPayload,
        consumedTargets: buildExtrudeConsumedTargets(activeEditSession.draft),
      }

      const result =
        await (async () => {
          try {
            return activeEditSession.mode === 'edit' && activeEditSession.featureId
              ? await modelingService.updateFeature({
                  ...input,
                  featureId: activeEditSession.featureId,
                })
              : await modelingService.createFeature({
                  ...input,
                  featureType: activeEditSession.featureType,
                })
          } catch (error: unknown) {
            dispatch({
              type: 'setFeatureEditDiagnostics',
              diagnostics: [
                {
                  code: 'feature-commit-failed',
                  severity: 'error',
                  message: error instanceof Error ? error.message : 'Feature commit failed.',
                  target: activeEditSession.draft.profileTarget,
                  detail: null,
                },
              ],
            })
            dispatch({ type: 'setFeatureEditStatus', status: 'idle' })
            throw error
          }
        })()

      if (result.revisionState.kind === 'conflict') {
        dispatch({
          type: 'setFeatureEditDiagnostics',
          diagnostics: result.diagnostics,
          revisionId: result.revisionId,
        })
        dispatch({ type: 'setFeatureEditStatus', status: 'idle' })
        return null
      }

      dispatch({
        type: 'setFeatureEditDiagnostics',
        diagnostics: result.diagnostics,
        revisionId: result.revisionId,
      })
      dispatch({ type: 'markFeatureCommitted', revisionId: result.revisionId })
      previewRequestKeyRef.current = null
      setPreviewRenderables(null)

      return result
    },
    cancelFeature() {
      previewRequestKeyRef.current = null
      setPreviewRenderables(null)
      dispatch({ type: 'endEditSession' })
    },
  }
}

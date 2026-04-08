import type { ToolId } from '@/domain/tools/tool-registry'
import type { ToolbarMode } from '@/domain/tools/schema'
import type { DurableRef } from '@/contracts/shared/references'

export type {
  BodyId,
  CommandSessionId,
  ConstructionId,
  ConstraintId,
  DimensionId,
  DocumentId,
  EdgeId,
  FaceId,
  FeatureId,
  FeatureInstanceId,
  FeatureTreeNodeId,
  LoopId,
  ObjectTreeNodeId,
  PickId,
  PreviewId,
  ReferenceId,
  RenderableId,
  RegionId,
  RequestId,
  RevisionId,
  SketchEntityId,
  SketchId,
  SketchPointId,
  SnapshotEntityId,
  VertexId,
} from '@/contracts/shared/ids'

export type PrimitiveRef = DurableRef

export type SelectionTarget = PrimitiveRef

export type SelectionSemantic =
  | 'body'
  | 'face'
  | 'edge'
  | 'vertex'
  | 'constructionPlane'
  | 'existingSketch'
  | 'sketchEntity'
  | 'planarFace'
  | 'planarReference'

export interface CommandTargetSlot {
  id: string
  label: string
  description: string
  acceptedKinds: readonly PrimitiveRef['kind'][]
  acceptedSemantics: readonly SelectionSemantic[]
}

export interface CommandTargetRequirement {
  id: string
  label: string
  description: string
  slots: readonly CommandTargetSlot[]
}

export type SelectionFilterKind =
  | 'all'
  | 'sketchSession'
  | 'sketchStart'
  | 'extrudeProfile'
  | 'filletEdges'
  | 'planeReferences'

export interface SelectionFilter {
  kind: SelectionFilterKind
  allowedKinds: readonly PrimitiveRef['kind'][]
  label: string
  requirements: readonly CommandTargetRequirement[]
}

export interface SelectionTargetCatalog {
  existingSketchKeys: readonly string[]
  constructionPlaneKeys: readonly string[]
  planarFaceKeys: readonly string[]
}

export interface CommandPreview {
  kind: 'selection' | 'sketch'
  label: string
  target: PrimitiveRef | null
}

export const defaultSelectionFilter: SelectionFilter = {
  kind: 'all',
  allowedKinds: ['body', 'face', 'edge', 'vertex', 'sketch', 'sketchEntity', 'feature', 'construction'],
  label: 'All selectable geometry',
  requirements: [
    {
      id: 'all-geometry',
      label: 'General selection',
      description: 'Bodies, topology, sketches, features, and construction references are selectable.',
      slots: [
        {
          id: 'general-selection',
          label: 'General selection',
          description: 'Select any single durable target.',
          acceptedKinds: ['body', 'face', 'edge', 'vertex', 'sketch', 'sketchEntity', 'feature', 'construction'],
          acceptedSemantics: [
            'body',
            'face',
            'edge',
            'vertex',
            'constructionPlane',
            'existingSketch',
            'sketchEntity',
          ],
        },
      ],
    },
  ],
}

export const sketchSelectionFilter: SelectionFilter = {
  kind: 'sketchSession',
  allowedKinds: ['construction', 'sketch', 'sketchEntity'],
  label: 'Sketch references',
  requirements: [
    {
      id: 'sketch-references',
      label: 'Sketch references',
      description: 'Select sketch geometry or the owning sketch plane while editing a sketch.',
      slots: [
        {
          id: 'sketch-reference',
          label: 'Sketch reference',
          description: 'Select the sketch plane, sketch, or sketch primitive.',
          acceptedKinds: ['construction', 'sketch', 'sketchEntity'],
          acceptedSemantics: ['constructionPlane', 'existingSketch', 'sketchEntity'],
        },
      ],
    },
  ],
}

export const sketchStartSelectionFilter: SelectionFilter = {
  kind: 'sketchStart',
  allowedKinds: ['construction', 'sketch'],
  label: 'Sketch planes or sketches',
  requirements: [
    {
      id: 'sketch-plane',
      label: 'Sketch plane',
      description: 'Start a sketch from a construction plane or reopen an existing sketch.',
      slots: [
        {
          id: 'sketch-start-target',
          label: 'Sketch start target',
          description: 'Select one construction plane or one existing sketch.',
          acceptedKinds: ['construction', 'sketch'],
          acceptedSemantics: ['constructionPlane', 'existingSketch'],
        },
      ],
    },
  ],
}

export const extrudeSelectionFilter: SelectionFilter = {
  kind: 'extrudeProfile',
  allowedKinds: ['region', 'face'],
  label: 'Extrude profiles or planar faces',
  requirements: [
    {
      id: 'extrude-profile',
      label: 'Extrude seed',
      description: 'Extrude accepts one explicit derived sketch region or one planar face.',
      slots: [
        {
          id: 'extrude-seed',
          label: 'Extrude seed',
          description: 'Select one derived sketch region or one planar face.',
          acceptedKinds: ['region', 'face'],
          acceptedSemantics: ['planarFace'],
        },
      ],
    },
  ],
}

export const filletSelectionFilter: SelectionFilter = {
  kind: 'filletEdges',
  allowedKinds: ['edge'],
  label: 'Fillet edges',
  requirements: [
    {
      id: 'fillet-edge',
      label: 'Edge target',
      description: 'Fillet currently accepts edge references only.',
      slots: [
        {
          id: 'fillet-edge',
          label: 'Edge target',
          description: 'Select one edge reference.',
          acceptedKinds: ['edge'],
          acceptedSemantics: ['edge'],
        },
      ],
    },
  ],
}

export const planeSelectionFilter: SelectionFilter = {
  kind: 'planeReferences',
  allowedKinds: ['construction', 'face'],
  label: 'Plane references',
  requirements: [
    {
      id: 'plane-planar-reference',
      label: 'Single planar reference',
      description: 'Plane creation accepts one planar face or one construction plane in the current contract.',
      slots: [
        {
          id: 'plane-reference-primary',
          label: 'Primary planar reference',
          description: 'Select a construction plane or planar face.',
          acceptedKinds: ['construction', 'face'],
          acceptedSemantics: ['planarReference'],
        },
      ],
    },
  ],
}

export function getPrimitiveRefLabel(target: PrimitiveRef) {
  switch (target.kind) {
    case 'body':
      return target.bodyId
    case 'face':
      return `${target.bodyId}.${target.faceId}`
    case 'edge':
      return `${target.bodyId}.${target.edgeId}`
    case 'vertex':
      return `${target.bodyId}.${target.vertexId}`
    case 'loop':
      return `${target.bodyId}.${target.loopId}`
    case 'sketch':
      return target.sketchId
    case 'sketchEntity':
      return `${target.sketchId}.${target.entityId}`
    case 'sketchPoint':
      return `${target.sketchId}.${target.pointId}`
    case 'feature':
      return target.featureId
    case 'construction':
      return target.constructionId
    case 'region':
      return `${target.sketchId}.${target.regionId}`
  }
}

export function getPrimitiveRefKey(target: PrimitiveRef) {
  switch (target.kind) {
    case 'body':
      return `body:${target.bodyId}`
    case 'face':
      return `face:${target.bodyId}:${target.faceId}`
    case 'edge':
      return `edge:${target.bodyId}:${target.edgeId}`
    case 'vertex':
      return `vertex:${target.bodyId}:${target.vertexId}`
    case 'loop':
      return `loop:${target.bodyId}:${target.loopId}`
    case 'sketch':
      return `sketch:${target.sketchId}`
    case 'sketchEntity':
      return `sketchEntity:${target.sketchId}:${target.entityId}`
    case 'sketchPoint':
      return `sketchPoint:${target.sketchId}:${target.pointId}`
    case 'feature':
      return `feature:${target.featureId}`
    case 'construction':
      return `construction:${target.constructionId}`
    case 'region':
      return `region:${target.sketchId}:${target.regionId}`
  }
}

export function primitiveRefEquals(left: PrimitiveRef, right: PrimitiveRef) {
  return getPrimitiveRefKey(left) === getPrimitiveRefKey(right)
}

export function getDefaultSelectionFilterForMode(mode: ToolbarMode): SelectionFilter {
  return mode === 'sketch' ? sketchSelectionFilter : defaultSelectionFilter
}

export function getSelectionFilterForCommand(
  toolId: ToolId,
  mode: ToolbarMode,
): SelectionFilter {
  switch (toolId) {
    case 'sketch':
      return sketchStartSelectionFilter
    case 'extrude':
      return extrudeSelectionFilter
    case 'fillet':
      return filletSelectionFilter
    case 'plane':
      return planeSelectionFilter
    default:
      return getDefaultSelectionFilterForMode(mode)
  }
}

export function selectionFilterAllowsTarget(
  filter: SelectionFilter | null,
  selection: PrimitiveRef[],
  target: PrimitiveRef,
  catalog: SelectionTargetCatalog | null,
) {
  return resolveSelectionCandidate(filter, selection, target, catalog).accepted
}

function getTargetSemantics(
  target: PrimitiveRef,
  catalog: SelectionTargetCatalog | null,
): SelectionSemantic[] {
  const semantics: SelectionSemantic[] = []

  switch (target.kind) {
    case 'body':
      semantics.push('body')
      break
    case 'face':
      semantics.push('face')
      if (catalog && catalog.planarFaceKeys.includes(getPrimitiveRefKey(target))) {
        semantics.push('planarFace', 'planarReference')
      }
      break
    case 'edge':
      semantics.push('edge')
      break
    case 'vertex':
      semantics.push('vertex')
      break
    case 'construction':
      if (catalog && catalog.constructionPlaneKeys.includes(getPrimitiveRefKey(target))) {
        semantics.push('constructionPlane', 'planarReference')
      }
      break
    case 'sketch':
      if (catalog && catalog.existingSketchKeys.includes(getPrimitiveRefKey(target))) {
        semantics.push('existingSketch')
      }
      break
    case 'region':
      semantics.push('existingSketch')
      break
    case 'sketchEntity':
      semantics.push('sketchEntity')
      break
    default:
      break
  }

  return semantics
}

function slotAcceptsTarget(
  slot: CommandTargetSlot,
  target: PrimitiveRef,
  catalog: SelectionTargetCatalog | null,
) {
  if (!slot.acceptedKinds.includes(target.kind)) {
    return false
  }

  const semantics = getTargetSemantics(target, catalog)
  return slot.acceptedSemantics.some((semantic) => semantics.includes(semantic))
}

function matchesRequirementPrefix(
  requirement: CommandTargetRequirement,
  selection: PrimitiveRef[],
  catalog: SelectionTargetCatalog | null,
) {
  if (selection.length > requirement.slots.length) {
    return false
  }

  return selection.every((target, index) => {
    const slot = requirement.slots[index]
    return slot ? slotAcceptsTarget(slot, target, catalog) : false
  })
}

function requirementAllowsDistinctAppend(
  requirement: CommandTargetRequirement,
  selection: PrimitiveRef[],
  target: PrimitiveRef,
) {
  if (selection.length === 0 || requirement.slots.length <= 1) {
    return true
  }

  return !selection.some((entry) => primitiveRefEquals(entry, target))
}

export function resolveSelectionCandidate(
  filter: SelectionFilter | null,
  selection: PrimitiveRef[],
  target: PrimitiveRef,
  catalog: SelectionTargetCatalog | null,
) {
  if (filter === null) {
    return {
      accepted: true,
      nextSelection: [target],
      requirement: null,
    }
  }

  if (!filter.allowedKinds.includes(target.kind)) {
    return {
      accepted: false,
      nextSelection: selection,
      requirement: null,
    }
  }

  const extendMatch = filter.requirements.find((requirement) => {
    if (!matchesRequirementPrefix(requirement, selection, catalog)) {
      return false
    }

    const slot = requirement.slots[selection.length]
    return (
      slot !== undefined &&
      requirementAllowsDistinctAppend(requirement, selection, target) &&
      slotAcceptsTarget(slot, target, catalog)
    )
  })

  if (extendMatch) {
    return {
      accepted: true,
      nextSelection: [...selection, target],
      requirement: extendMatch,
    }
  }

  const blockedByActiveRequirement = filter.requirements.some((requirement) => {
    if (!matchesRequirementPrefix(requirement, selection, catalog)) {
      return false
    }

    const slot = requirement.slots[selection.length]

    if (!slot) {
      return false
    }

    if (!slotAcceptsTarget(slot, target, catalog)) {
      return false
    }

    return !requirementAllowsDistinctAppend(requirement, selection, target)
  })

  if (blockedByActiveRequirement) {
    return {
      accepted: false,
      nextSelection: selection,
      requirement: null,
    }
  }

  const replaceMatch = filter.requirements.find((requirement) => {
    const slot = requirement.slots[0]
    return slot ? slotAcceptsTarget(slot, target, catalog) : false
  })

  if (replaceMatch) {
    return {
      accepted: true,
      nextSelection: [target],
      requirement: replaceMatch,
    }
  }

  return {
    accepted: false,
    nextSelection: selection,
    requirement: null,
  }
}

export function getSelectionFilterRejectionLabel(
  filter: SelectionFilter | null,
  target: PrimitiveRef,
) {
  if (filter === null) {
    return `${getPrimitiveRefLabel(target)} is not selectable.`
  }

  const requirementLabels = filter.requirements.map((requirement) => requirement.label.toLowerCase())
  const expectedLabel =
    requirementLabels.length > 0 ? requirementLabels.join(' or ') : filter.label.toLowerCase()

  return `${target.kind} is filtered out. Expected ${expectedLabel}.`
}

export function getSelectionPreviewLabel(
  filter: SelectionFilter | null,
  target: PrimitiveRef,
  interaction: 'hover' | 'select',
) {
  const verb = interaction === 'hover' ? 'Hovering' : 'Selected'

  if (!filter || filter.kind === 'all') {
    return `${verb} ${getPrimitiveRefLabel(target)}`
  }

  const noun =
    filter.kind === 'extrudeProfile'
      ? 'extrude profile'
      : filter.kind === 'filletEdges'
        ? 'fillet edge'
        : filter.kind === 'planeReferences'
          ? 'plane reference'
          : filter.kind === 'sketchStart'
            ? 'sketch reference'
            : 'selection'

  return `${verb} ${noun} ${getPrimitiveRefLabel(target)}`
}

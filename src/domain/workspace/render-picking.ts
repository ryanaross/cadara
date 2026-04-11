import * as THREE from 'three'

import {
  getPrimitiveRefKey,
  primitiveRefEquals,
  type PrimitiveRef,
} from '@/domain/editor/schema'
import type { RenderableEntityRecord } from '@/contracts/render/schema'
import type { SketchSessionDisplayRenderable } from '@/domain/editor/sketch-session'

export interface WorkspaceRenderScene {
  group: THREE.Group
  pickables: THREE.Object3D[]
  targetToObjects: Map<string, THREE.Object3D[]>
  pickIdToRenderable: Map<string, RenderableEntityRecord>
}

export interface SketchDisplayScene {
  group: THREE.Group
  pickables: THREE.Object3D[]
  targetToObjects: Map<string, THREE.Object3D[]>
}

const MARKER_SPHERE_GEOMETRY = new THREE.SphereGeometry(1, 12, 12)
const PICK_PROXY_SPHERE_GEOMETRY = new THREE.SphereGeometry(1, 16, 16)
const SEEDED_DATUM_CONSTRUCTION_IDS = new Set([
  'construction_plane-xy',
  'construction_plane-yz',
  'construction_plane-xz',
])
const VISIBLE_MARKER_SCALE_FACTOR = 0.44
const MARKER_PICK_SCALE_FACTOR = 1.45

const SURFACE_COLORS = {
  bodyFace: 0xf1eee4,
  planarFace: 0xf1eee4,
  region: 0x93dff2,
  featureEdge: 0x86b6da,
  featureVertex: 0x86b6da,
  sketchCurve: 0x8db7d6,
  sketchPoint: 0x8db7d6,
  construction: 0xb6d6ff,
} as const

interface RenderObjectBundle {
  root: THREE.Object3D
  highlightObjects: THREE.Object3D[]
}

export function buildWorkspaceRenderScene(renderables: RenderableEntityRecord[]): WorkspaceRenderScene {
  const group = new THREE.Group()
  const pickables: THREE.Object3D[] = []
  const targetToObjects = new Map<string, THREE.Object3D[]>()
  const pickIdToRenderable = new Map<string, RenderableEntityRecord>()

  for (const renderable of renderables) {
    const object = createObjectForRenderable(renderable)
    bindRenderableObject(object.root, renderable.binding.pickId, renderable.binding.target, renderable.binding.semanticClass)
    group.add(object.root)
    pickables.push(object.root)
    pickIdToRenderable.set(renderable.binding.pickId, renderable)

    const targetKey = getPrimitiveRefKey(renderable.binding.target)
    const targetObjects = targetToObjects.get(targetKey) ?? []
    targetObjects.push(...object.highlightObjects)
    targetToObjects.set(targetKey, targetObjects)
  }

  return {
    group,
    pickables,
    targetToObjects,
    pickIdToRenderable,
  }
}

export function buildSketchDisplayGroup(renderables: SketchSessionDisplayRenderable[]): SketchDisplayScene {
  const group = new THREE.Group()
  const pickables: THREE.Object3D[] = []
  const targetToObjects = new Map<string, THREE.Object3D[]>()

  for (const renderable of renderables) {
    const object = createDisplayObject(renderable)
    if (renderable.target) {
      bindRenderableObject(
        object.root,
        null,
        renderable.target,
        renderable.geometry.kind === 'marker' ? 'sketchPoint' : 'sketchCurve',
      )
      const targetKey = getPrimitiveRefKey(renderable.target)
      const targetObjects = targetToObjects.get(targetKey) ?? []
      targetObjects.push(...object.highlightObjects)
      targetToObjects.set(targetKey, targetObjects)
      pickables.push(object.root)
    }
    group.add(object.root)
  }

  return {
    group,
    pickables,
    targetToObjects,
  }
}

function createDisplayObject(renderable: SketchSessionDisplayRenderable) {
  switch (renderable.geometry.kind) {
    case 'mesh':
      return createDisplayFaceObject(renderable)
    case 'polyline':
      return createDisplayEdgeObject(renderable)
    case 'marker':
      return createDisplayMarkerObject(renderable)
  }
}

function createObjectForRenderable(renderable: RenderableEntityRecord) {
  switch (renderable.geometry.kind) {
    case 'mesh':
      return createMeshObject(renderable)
    case 'polyline':
      return createPolylineObject(renderable)
    case 'marker':
      return createMarkerObject(renderable)
  }
}

function createMeshObject(renderable: RenderableEntityRecord) {
  const geometryData = renderable.geometry.kind === 'mesh' ? renderable.geometry : null

  if (!geometryData) {
    throw new Error(`Renderable ${renderable.id} is missing mesh geometry.`)
  }

  const geometry = new THREE.BufferGeometry()
  const flattenedPositions = geometryData.vertexPositions.flat()
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(flattenedPositions, 3),
  )
  geometry.setIndex(geometryData.triangleIndices.flat())
  if (geometryData.vertexNormals) {
    geometry.setAttribute(
      'normal',
      new THREE.Float32BufferAttribute(geometryData.vertexNormals.flat(), 3),
    )
  } else {
    geometry.computeVertexNormals()
  }
  const material = isSeededDatumPlaneRenderable(renderable)
    ? new THREE.MeshStandardMaterial({
        color: 0x9ea8b5,
        transparent: true,
        opacity: 0.12,
        side: THREE.DoubleSide,
        metalness: 0.02,
        roughness: 0.96,
        emissive: 0x000000,
        emissiveIntensity: 0,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      })
    : new THREE.MeshStandardMaterial({
        color: getRenderableBaseColor(renderable.binding.semanticClass),
        transparent: renderable.binding.semanticClass === 'region',
        opacity: getBaseMeshOpacity(renderable.binding.semanticClass),
        side: THREE.DoubleSide,
        metalness: renderable.binding.semanticClass === 'region' ? 0.02 : 0.02,
        roughness: renderable.binding.semanticClass === 'region' ? 0.9 : 0.76,
        emissive: renderable.binding.semanticClass === 'region' ? 0x10252d : 0x343028,
        emissiveIntensity: renderable.binding.semanticClass === 'region' ? 0.08 : 0.08,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.renderOrder = isSeededDatumPlaneRenderable(renderable) ? 1 : 2
  return {
    root: mesh,
    highlightObjects: [mesh],
  } satisfies RenderObjectBundle
}

function createPolylineObject(renderable: RenderableEntityRecord) {
  const geometryData = renderable.geometry.kind === 'polyline' ? renderable.geometry : null

  if (!geometryData) {
    throw new Error(`Renderable ${renderable.id} is missing polyline geometry.`)
  }

  const points = geometryData.points.map((point) => new THREE.Vector3(point[0], point[1], point[2]))
  const displayPoints = geometryData.isClosed && points.length > 0 ? [...points, points[0].clone()] : points
  const geometry = new THREE.BufferGeometry().setFromPoints(displayPoints)
  const material = isSeededDatumPlaneRenderable(renderable)
    ? new THREE.LineBasicMaterial({
        color: 0x7f8a98,
        transparent: true,
        opacity: 0.4,
      })
    : new THREE.LineBasicMaterial({
        color: getRenderableBaseColor(renderable.binding.semanticClass),
        transparent: true,
        opacity: 0.95,
      })
  const line = new THREE.Line(geometry, material)
  line.renderOrder = isSeededDatumPlaneRenderable(renderable) ? 2 : 3
  line.material.depthTest = true
  line.material.depthWrite = false

  if (isSeededDatumPlaneRenderable(renderable)) {
    return {
      root: line,
      highlightObjects: [line],
    } satisfies RenderObjectBundle
  }

  return {
    root: line,
    highlightObjects: [line],
  } satisfies RenderObjectBundle
}

function createMarkerObject(renderable: RenderableEntityRecord) {
  const geometryData = renderable.geometry.kind === 'marker' ? renderable.geometry : null

  if (!geometryData) {
    throw new Error(`Renderable ${renderable.id} is missing marker geometry.`)
  }

  const material = new THREE.MeshStandardMaterial({
    color: getRenderableBaseColor(renderable.binding.semanticClass),
    metalness: 0.08,
    roughness: 0.34,
    emissive: 0x1c3245,
    emissiveIntensity: 0.12,
  })
  const mesh = new THREE.Mesh(MARKER_SPHERE_GEOMETRY, material)
  mesh.position.set(geometryData.position[0], geometryData.position[1], geometryData.position[2])
  mesh.scale.setScalar(getVisibleMarkerRadius(geometryData.displayRadius))
  mesh.renderOrder = 4
  mesh.material.depthTest = true
  mesh.material.depthWrite = false

  const group = new THREE.Group()
  group.add(mesh)
  group.add(createMarkerPickProxy(geometryData.position, geometryData.displayRadius))

  return {
    root: group,
    highlightObjects: [mesh],
  } satisfies RenderObjectBundle
}

function createDisplayFaceObject(renderable: SketchSessionDisplayRenderable) {
  const geometryData = renderable.geometry.kind === 'mesh' ? renderable.geometry : null

  if (!geometryData) {
    throw new Error(`Display renderable ${renderable.id} is missing mesh geometry.`)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(geometryData.vertexPositions.flat(), 3))
  geometry.setIndex(geometryData.triangleIndices.flat())
  if (geometryData.vertexNormals) {
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(geometryData.vertexNormals.flat(), 3))
  } else {
    geometry.computeVertexNormals()
  }
  const material = new THREE.MeshStandardMaterial({
    color: SURFACE_COLORS.sketchCurve,
    transparent: true,
    opacity: 0.24,
    side: THREE.DoubleSide,
    metalness: 0.08,
    roughness: 0.58,
    emissive: 0x214566,
    emissiveIntensity: 0.18,
  })

  const mesh = new THREE.Mesh(geometry, material)
  return {
    root: mesh,
    highlightObjects: [mesh],
  } satisfies RenderObjectBundle
}

function createDisplayEdgeObject(renderable: SketchSessionDisplayRenderable) {
  const geometryData = renderable.geometry.kind === 'polyline' ? renderable.geometry : null

  if (!geometryData) {
    throw new Error(`Display renderable ${renderable.id} is missing polyline geometry.`)
  }

  const points = geometryData.points.map((point) => new THREE.Vector3(point[0], point[1], point[2]))
  const displayPoints = geometryData.isClosed && points.length > 0 ? [...points, points[0].clone()] : points
  const geometry = new THREE.BufferGeometry().setFromPoints(displayPoints)
  const material = new THREE.LineBasicMaterial({
    color: SURFACE_COLORS.sketchCurve,
    transparent: true,
    opacity: 0.95,
  })

  const line = new THREE.Line(geometry, material)
  line.renderOrder = 3
  line.material.depthTest = true
  line.material.depthWrite = false

  return {
    root: line,
    highlightObjects: [line],
  } satisfies RenderObjectBundle
}

function createDisplayMarkerObject(renderable: SketchSessionDisplayRenderable) {
  const geometryData = renderable.geometry.kind === 'marker' ? renderable.geometry : null

  if (!geometryData) {
    throw new Error(`Display renderable ${renderable.id} is missing marker geometry.`)
  }

  const material = new THREE.MeshStandardMaterial({
    color: SURFACE_COLORS.sketchPoint,
    metalness: 0.08,
    roughness: 0.34,
    emissive: 0x1c3245,
    emissiveIntensity: 0.16,
  })
  const mesh = new THREE.Mesh(MARKER_SPHERE_GEOMETRY, material)
  mesh.position.set(geometryData.position[0], geometryData.position[1], geometryData.position[2])
  mesh.scale.setScalar(getVisibleMarkerRadius(geometryData.displayRadius))
  mesh.renderOrder = 4
  mesh.material.depthTest = true
  mesh.material.depthWrite = false

  const group = new THREE.Group()
  group.add(mesh)
  group.add(createMarkerPickProxy(geometryData.position, geometryData.displayRadius))

  return {
    root: group,
    highlightObjects: [mesh],
  } satisfies RenderObjectBundle
}

export function resolvePickTarget(
  intersections: THREE.Intersection<THREE.Object3D>[],
  pickIdToRenderable: Map<string, RenderableEntityRecord>,
  acceptsTarget: ((target: PrimitiveRef) => boolean) | null = null,
) {
  const resolvedHits = intersections
    .map((intersection) => {
      const pickId = getBoundPickId(intersection.object)

      if (!pickId) {
        return null
      }

      const renderable = pickIdToRenderable.get(pickId)

      if (!renderable) {
        return null
      }

      return {
        intersection,
        pickId,
        target: renderable.binding.target,
        renderable,
      }
    })
    .filter((hit): hit is NonNullable<typeof hit> => hit !== null)
    .sort((left, right) => {
      const semanticRankDelta = getInteractionSortRank(left.renderable) - getInteractionSortRank(right.renderable)

      if (semanticRankDelta !== 0) {
        return semanticRankDelta
      }

      const priorityDelta = left.renderable.binding.pickPriority - right.renderable.binding.pickPriority

      if (priorityDelta !== 0) {
        return priorityDelta
      }

      return left.intersection.distance - right.intersection.distance
    })

  const nearestOccludingFaceDistance = resolvedHits.reduce<number | null>((nearest, hit) => {
    if (!isOccludingFaceRenderable(hit.renderable)) {
      return nearest
    }

    return nearest === null ? hit.intersection.distance : Math.min(nearest, hit.intersection.distance)
  }, null)

  for (const hit of resolvedHits) {
    if (
      nearestOccludingFaceDistance !== null
      && isWireRenderable(hit.renderable)
      && hit.intersection.distance - nearestOccludingFaceDistance > 0.01
    ) {
      continue
    }

    if (acceptsTarget && !acceptsTarget(hit.target)) {
      continue
    }

    return {
      pickId: hit.pickId,
      target: hit.target,
      renderable: hit.renderable,
    }
  }

  return null
}

export function updateWorkspaceHighlight(
  targetToObjects: Map<string, THREE.Object3D[]>,
  selection: PrimitiveRef[],
  hoverTarget: PrimitiveRef | null,
) {
  for (const objects of targetToObjects.values()) {
    for (const object of objects) {
      const material = getObjectMaterial(object)
      const semanticClass = getBoundSemanticClass(object)

      if (!material || !semanticClass) {
        continue
      }

      const target = getBoundTarget(object)

      if (!target) {
        continue
      }

      const isSelected = selection.some((entry) => primitiveRefEquals(entry, target))
      const isHovered = hoverTarget !== null && primitiveRefEquals(hoverTarget, target)
      applyRenderableState(material, semanticClass, isSelected || isHovered, isSelected)
    }
  }
}

function applyRenderableState(
  material: THREE.Material | THREE.Material[] | THREE.LineBasicMaterial,
  semanticClass: RenderableEntityRecord['binding']['semanticClass'],
  isActive: boolean,
  isSelected: boolean,
) {
  const materials = Array.isArray(material) ? material : [material]

  for (const entry of materials) {
    if (
      !(entry instanceof THREE.MeshStandardMaterial)
      && !(entry instanceof THREE.LineBasicMaterial)
    ) {
      continue
    }

    const color = getHighlightColor(semanticClass, isActive, isSelected)

    entry.color.setHex(color)

    if (entry instanceof THREE.MeshStandardMaterial) {
      entry.emissive.setHex(isSelected ? 0x2f6b91 : isActive ? 0xa85a16 : semanticClass === 'region' ? 0x10252d : 0x000000)
      entry.emissiveIntensity = isSelected ? 0.32 : isActive ? 0.24 : semanticClass === 'region' ? 0.08 : 0
      entry.opacity = semanticClass === 'construction'
        ? (isSelected ? 0.28 : isActive ? 0.2 : 0.12)
        : semanticClass === 'region'
          ? (isSelected ? 0.44 : isActive ? 0.34 : 0.22)
          : isFaceSemanticClass(semanticClass)
            ? 1
          : 1
    } else {
      entry.opacity = semanticClass === 'construction'
        ? (isSelected ? 0.85 : isActive ? 0.62 : 0.4)
        : isSelected ? 1 : isActive ? 0.98 : 0.94
    }
  }
}

function getRenderableBaseColor(semanticClass: RenderableEntityRecord['binding']['semanticClass']) {
  switch (semanticClass) {
    case 'bodyFace':
      return SURFACE_COLORS.bodyFace
    case 'planarFace':
      return SURFACE_COLORS.planarFace
    case 'region':
      return SURFACE_COLORS.region
    case 'featureEdge':
      return SURFACE_COLORS.featureEdge
    case 'featureVertex':
      return SURFACE_COLORS.featureVertex
    case 'sketchCurve':
      return SURFACE_COLORS.sketchCurve
    case 'sketchPoint':
      return SURFACE_COLORS.sketchPoint
    case 'construction':
      return SURFACE_COLORS.construction
  }
}

function getHighlightColor(
  semanticClass: RenderableEntityRecord['binding']['semanticClass'],
  isActive: boolean,
  isSelected: boolean,
) {
  if (isSelected) {
    return isWireSemanticClass(semanticClass) ? 0xf4fbff : 0xf7f4ec
  }

  if (isActive) {
    if (semanticClass === 'construction') {
      return 0xe7f2ff
    }

    if (semanticClass === 'region') {
      return 0xa7e4ef
    }

    if (isWireSemanticClass(semanticClass)) {
      return 0xf0a14a
    }

    return 0xf7c78c
  }

  return getRenderableBaseColor(semanticClass)
}

function isSeededDatumPlaneRenderable(renderable: RenderableEntityRecord) {
  return renderable.binding.target.kind === 'construction'
    && SEEDED_DATUM_CONSTRUCTION_IDS.has(renderable.binding.target.constructionId)
}

function isConstructionRenderable(renderable: RenderableEntityRecord) {
  return renderable.binding.semanticClass === 'construction'
}

function isWireRenderable(renderable: RenderableEntityRecord) {
  return renderable.binding.semanticClass === 'featureEdge'
    || renderable.binding.semanticClass === 'featureVertex'
    || renderable.binding.semanticClass === 'sketchCurve'
    || renderable.binding.semanticClass === 'sketchPoint'
}

function isOccludingFaceRenderable(renderable: RenderableEntityRecord) {
  return renderable.binding.semanticClass === 'bodyFace' || renderable.binding.semanticClass === 'planarFace'
}

function getInteractionSortRank(renderable: RenderableEntityRecord) {
  switch (renderable.binding.semanticClass) {
    case 'featureVertex':
    case 'sketchPoint':
      return 0
    case 'featureEdge':
    case 'sketchCurve':
      return 1
    case 'bodyFace':
    case 'planarFace':
      return 2
    case 'region':
      return 3
    case 'construction':
      return 4
  }
}

function isFaceSemanticClass(semanticClass: RenderableEntityRecord['binding']['semanticClass']) {
  return semanticClass === 'bodyFace' || semanticClass === 'planarFace' || semanticClass === 'region'
}

function isWireSemanticClass(semanticClass: RenderableEntityRecord['binding']['semanticClass']) {
  return semanticClass === 'featureEdge'
    || semanticClass === 'featureVertex'
    || semanticClass === 'sketchCurve'
    || semanticClass === 'sketchPoint'
}

function getBaseMeshOpacity(semanticClass: RenderableEntityRecord['binding']['semanticClass']) {
  return semanticClass === 'region' ? 0.22 : 1
}

function getObjectMaterial(object: THREE.Object3D) {
  if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
    return object.material
  }

  return null
}

function bindRenderableObject(
  object: THREE.Object3D,
  pickId: string | null,
  target: PrimitiveRef,
  semanticClass: RenderableEntityRecord['binding']['semanticClass'],
) {
  object.userData.target = target
  object.userData.semanticClass = semanticClass

  if (pickId !== null) {
    object.userData.pickId = pickId
  }
}

function getBoundPickId(object: THREE.Object3D) {
  return findBoundValue<string>(object, 'pickId')
}

export function getBoundTarget(object: THREE.Object3D) {
  return findBoundValue<PrimitiveRef>(object, 'target')
}

function getBoundSemanticClass(object: THREE.Object3D) {
  return findBoundValue<RenderableEntityRecord['binding']['semanticClass']>(object, 'semanticClass')
}

function findBoundValue<T>(object: THREE.Object3D, key: string) {
  let current: THREE.Object3D | null = object

  while (current) {
    const value = current.userData[key] as T | undefined

    if (value !== undefined) {
      return value
    }

    current = current.parent
  }

  return undefined
}

function createMarkerPickProxy(position: readonly [number, number, number], displayRadius: number) {
  const material = createInvisiblePickMaterial()
  const mesh = new THREE.Mesh(PICK_PROXY_SPHERE_GEOMETRY, material)
  mesh.position.set(position[0], position[1], position[2])
  mesh.scale.setScalar(Math.max(displayRadius * MARKER_PICK_SCALE_FACTOR, displayRadius, Number.EPSILON))
  return mesh
}

function createInvisiblePickMaterial() {
  const material = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
  })
  material.colorWrite = false
  return material
}

function getVisibleMarkerRadius(displayRadius: number) {
  return Math.max(displayRadius * VISIBLE_MARKER_SCALE_FACTOR, Number.EPSILON)
}

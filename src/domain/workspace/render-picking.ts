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

const MARKER_SPHERE_GEOMETRY = new THREE.SphereGeometry(1, 12, 12)
const SEEDED_DATUM_CONSTRUCTION_IDS = new Set([
  'construction_plane-xy',
  'construction_plane-yz',
  'construction_plane-xz',
])

const SURFACE_COLORS = {
  bodyFace: 0x6f89aa,
  planarFace: 0x6f89aa,
  region: 0x89b8ff,
  featureEdge: 0x9fc7ff,
  featureVertex: 0xe8f3ff,
  sketchCurve: 0x7cbcff,
  sketchPoint: 0xe8f3ff,
  construction: 0xb6d6ff,
} as const

export function buildWorkspaceRenderScene(renderables: RenderableEntityRecord[]): WorkspaceRenderScene {
  const group = new THREE.Group()
  const pickables: THREE.Object3D[] = []
  const targetToObjects = new Map<string, THREE.Object3D[]>()
  const pickIdToRenderable = new Map<string, RenderableEntityRecord>()

  for (const renderable of renderables) {
    const object = createObjectForRenderable(renderable)
    object.userData.pickId = renderable.binding.pickId
    object.userData.target = renderable.binding.target
    object.userData.semanticClass = renderable.binding.semanticClass
    group.add(object)
    pickables.push(object)
    pickIdToRenderable.set(renderable.binding.pickId, renderable)

    const targetKey = getPrimitiveRefKey(renderable.binding.target)
    const targetObjects = targetToObjects.get(targetKey) ?? []
    targetObjects.push(object)
    targetToObjects.set(targetKey, targetObjects)
  }

  return {
    group,
    pickables,
    targetToObjects,
    pickIdToRenderable,
  }
}

export function buildSketchDisplayGroup(renderables: SketchSessionDisplayRenderable[]) {
  const group = new THREE.Group()

  for (const renderable of renderables) {
    const object = createDisplayObject(renderable)
    group.add(object)
  }

  return group
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

  if (geometryData.vertexNormals) {
    geometry.setAttribute(
      'normal',
      new THREE.Float32BufferAttribute(geometryData.vertexNormals.flat(), 3),
    )
  } else {
    geometry.computeVertexNormals()
  }

  geometry.setIndex(geometryData.triangleIndices.flat())
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
        transparent: true,
        opacity: 0.86,
        side: THREE.DoubleSide,
        metalness: 0.12,
        roughness: 0.72,
        emissive: 0x07111d,
        emissiveIntensity: 0.18,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -2,
      })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.renderOrder = isSeededDatumPlaneRenderable(renderable) ? 1 : 2
  return mesh
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
  return line
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
    emissive: 0x2559a8,
    emissiveIntensity: 0.18,
  })
  const mesh = new THREE.Mesh(MARKER_SPHERE_GEOMETRY, material)
  mesh.position.set(geometryData.position[0], geometryData.position[1], geometryData.position[2])
  mesh.scale.setScalar(Math.max(geometryData.displayRadius, Number.EPSILON))
  mesh.renderOrder = 4
  return mesh
}

function createDisplayFaceObject(renderable: SketchSessionDisplayRenderable) {
  const geometryData = renderable.geometry.kind === 'mesh' ? renderable.geometry : null

  if (!geometryData) {
    throw new Error(`Display renderable ${renderable.id} is missing mesh geometry.`)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(geometryData.vertexPositions.flat(), 3))

  if (geometryData.vertexNormals) {
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(geometryData.vertexNormals.flat(), 3))
  } else {
    geometry.computeVertexNormals()
  }

  geometry.setIndex(geometryData.triangleIndices.flat())
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

  return new THREE.Mesh(geometry, material)
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
    color: 0x7cbcff,
    transparent: true,
    opacity: 0.95,
  })

  return new THREE.Line(geometry, material)
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
    emissive: 0x2559a8,
    emissiveIntensity: 0.28,
  })
  const mesh = new THREE.Mesh(MARKER_SPHERE_GEOMETRY, material)
  mesh.position.set(geometryData.position[0], geometryData.position[1], geometryData.position[2])
  mesh.scale.setScalar(Math.max(geometryData.displayRadius, Number.EPSILON))
  return mesh
}

export function resolvePickTarget(
  intersections: THREE.Intersection<THREE.Object3D>[],
  pickIdToRenderable: Map<string, RenderableEntityRecord>,
) {
  const resolvedHits = intersections
    .map((intersection) => {
      const pickId = intersection.object.userData.pickId as string | undefined

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
      const priorityDelta = left.renderable.binding.pickPriority - right.renderable.binding.pickPriority

      if (priorityDelta !== 0) {
        return priorityDelta
      }

      return left.intersection.distance - right.intersection.distance
    })

  for (const hit of resolvedHits) {
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
      const semanticClass = object.userData.semanticClass as RenderableEntityRecord['binding']['semanticClass'] | undefined

      if (!material || !semanticClass) {
        continue
      }

      const target = object.userData.target as PrimitiveRef | undefined

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
      entry.emissive.setHex(isSelected ? 0x3c8dff : isActive ? 0x1e4f87 : 0x07111d)
      entry.emissiveIntensity = isSelected ? 0.48 : isActive ? 0.3 : 0.18
      entry.opacity = semanticClass === 'construction'
        ? (isSelected ? 0.28 : isActive ? 0.2 : 0.12)
        : isFaceSemanticClass(semanticClass)
          ? (isActive ? 0.98 : 0.86)
          : 1
    } else {
      entry.opacity = semanticClass === 'construction'
        ? (isSelected ? 0.85 : isActive ? 0.62 : 0.4)
        : isSelected ? 1 : isActive ? 0.98 : 0.9
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
    return 0xf2fbff
  }

  if (isActive) {
    if (semanticClass === 'construction') {
      return 0xe7f2ff
    }

    if (semanticClass === 'region') {
      return 0xdcecff
    }

    if (semanticClass === 'sketchCurve' || semanticClass === 'featureEdge') {
      return 0xc7e1ff
    }

    if (semanticClass === 'sketchPoint' || semanticClass === 'featureVertex') {
      return 0xffffff
    }

    return 0x79b3ff
  }

  return getRenderableBaseColor(semanticClass)
}

function isSeededDatumPlaneRenderable(renderable: RenderableEntityRecord) {
  return renderable.binding.target.kind === 'construction'
    && SEEDED_DATUM_CONSTRUCTION_IDS.has(renderable.binding.target.constructionId)
}

function isFaceSemanticClass(semanticClass: RenderableEntityRecord['binding']['semanticClass']) {
  return semanticClass === 'bodyFace' || semanticClass === 'planarFace' || semanticClass === 'region'
}

function getObjectMaterial(object: THREE.Object3D) {
  if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
    return object.material
  }

  return null
}

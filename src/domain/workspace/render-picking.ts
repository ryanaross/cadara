import * as THREE from 'three'

import {
  getPrimitiveRefKey,
  primitiveRefEquals,
  type PrimitiveRef,
} from '@/domain/editor/schema'
import type { RenderableEntityRecord } from '@/contracts/modeling/schema'

export interface WorkspaceRenderScene {
  group: THREE.Group
  pickables: THREE.Object3D[]
  targetToObjects: Map<string, THREE.Object3D[]>
  pickIdToRenderable: Map<string, RenderableEntityRecord>
}

const TOPOLOGY_PICK_PRIORITY: Record<RenderableEntityRecord['topology'], number> = {
  vertex: 0,
  edge: 1,
  face: 2,
}

const SURFACE_COLORS = {
  base: 0x6f89aa,
  active: 0x79b3ff,
  edge: 0x9fc7ff,
  point: 0xe8f3ff,
} as const

export function buildWorkspaceRenderScene(renderables: RenderableEntityRecord[]): WorkspaceRenderScene {
  const group = new THREE.Group()
  const pickables: THREE.Object3D[] = []
  const targetToObjects = new Map<string, THREE.Object3D[]>()
  const pickIdToRenderable = new Map<string, RenderableEntityRecord>()

  for (const renderable of renderables) {
    const object = createObjectForRenderable(renderable)
    object.userData.pickId = renderable.pickBinding.pickId
    object.userData.target = renderable.target
    group.add(object)
    pickables.push(object)
    pickIdToRenderable.set(renderable.pickBinding.pickId, renderable)

    const targetKey = getPrimitiveRefKey(renderable.target)
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

function createObjectForRenderable(renderable: RenderableEntityRecord) {
  switch (renderable.geometry.kind) {
    case 'planarFace':
      return createFaceObject(renderable)
    case 'polyline':
      return createEdgeObject(renderable)
    case 'pointMarker':
      return createVertexObject(renderable)
  }
}

function createFaceObject(renderable: RenderableEntityRecord) {
  const geometryData = renderable.geometry.kind === 'planarFace' ? renderable.geometry : null

  if (!geometryData) {
    throw new Error(`Renderable ${renderable.id} is missing planar face geometry.`)
  }

  const geometry = new THREE.PlaneGeometry(geometryData.size[0], geometryData.size[1])
  const material = new THREE.MeshStandardMaterial({
    color: SURFACE_COLORS.base,
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
  applyAxisOrientation(mesh, geometryData.normalAxis)
  mesh.position.set(geometryData.center[0], geometryData.center[1], geometryData.center[2])
  mesh.renderOrder = 2
  return mesh
}

function createEdgeObject(renderable: RenderableEntityRecord) {
  const geometryData = renderable.geometry.kind === 'polyline' ? renderable.geometry : null

  if (!geometryData) {
    throw new Error(`Renderable ${renderable.id} is missing polyline geometry.`)
  }

  const curve = new THREE.CatmullRomCurve3(
    geometryData.points.map((point) => new THREE.Vector3(point[0], point[1], point[2])),
  )
  const geometry = new THREE.TubeGeometry(curve, 24, 0.08, 10, false)
  const material = new THREE.MeshStandardMaterial({
    color: SURFACE_COLORS.edge,
    metalness: 0.08,
    roughness: 0.38,
    emissive: 0x234774,
    emissiveIntensity: 0.28,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -4,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.renderOrder = 3
  return mesh
}

function createVertexObject(renderable: RenderableEntityRecord) {
  const geometryData = renderable.geometry.kind === 'pointMarker' ? renderable.geometry : null

  if (!geometryData) {
    throw new Error(`Renderable ${renderable.id} is missing point marker geometry.`)
  }

  const geometry = new THREE.SphereGeometry(geometryData.radius, 24, 24)
  const material = new THREE.MeshStandardMaterial({
    color: SURFACE_COLORS.point,
    metalness: 0.1,
    roughness: 0.26,
    emissive: 0x2f7fe8,
    emissiveIntensity: 0.34,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(geometryData.position[0], geometryData.position[1], geometryData.position[2])
  mesh.renderOrder = 4
  return mesh
}

function applyAxisOrientation(mesh: THREE.Mesh, axis: 'x' | 'y' | 'z') {
  if (axis === 'x') {
    mesh.rotation.y = Math.PI / 2
    return
  }

  if (axis === 'y') {
    mesh.rotation.x = Math.PI / 2
    return
  }
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
        target: renderable.pickBinding.target,
        renderable,
      }
    })
    .filter((hit): hit is NonNullable<typeof hit> => hit !== null)
    .sort((left, right) => {
      const priorityDelta =
        TOPOLOGY_PICK_PRIORITY[left.renderable.topology] -
        TOPOLOGY_PICK_PRIORITY[right.renderable.topology]

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
      const material = object instanceof THREE.Mesh ? object.material : null

      if (!material) {
        continue
      }

      const target = object.userData.target as PrimitiveRef | undefined

      if (!target) {
        continue
      }

      const isSelected = selection.some((entry) => primitiveRefEquals(entry, target))
      const isHovered = hoverTarget !== null && primitiveRefEquals(hoverTarget, target)
      applyRenderableState(material, target.kind, isSelected || isHovered, isSelected)
    }
  }
}

function applyRenderableState(
  material: THREE.Material | THREE.Material[],
  kind: PrimitiveRef['kind'],
  isActive: boolean,
  isSelected: boolean,
) {
  const materials = Array.isArray(material) ? material : [material]

  for (const entry of materials) {
    if (!(entry instanceof THREE.MeshStandardMaterial)) {
      continue
    }

    const color = (() => {
      if (kind === 'edge') {
        return isActive ? 0xc7e1ff : SURFACE_COLORS.edge
      }

      if (kind === 'vertex') {
        return isActive ? 0xffffff : SURFACE_COLORS.point
      }

      return isActive ? SURFACE_COLORS.active : SURFACE_COLORS.base
    })()

    entry.color.setHex(color)
    entry.emissive.setHex(isSelected ? 0x3c8dff : isActive ? 0x1e4f87 : 0x07111d)
    entry.emissiveIntensity = isSelected ? 0.48 : isActive ? 0.3 : 0.18
    entry.opacity = kind === 'face' ? (isActive ? 0.98 : 0.86) : 1
  }
}

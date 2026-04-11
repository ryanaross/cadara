import * as THREE from 'three'

import type { RenderableEntityRecord } from '@/contracts/render/schema'
import {
  buildSketchDisplayGroup,
  buildWorkspaceRenderScene,
  resolvePickTarget,
  updateWorkspaceHighlight,
} from '@/domain/workspace/render-picking'
import type { SketchSessionDisplayRenderable } from '@/domain/editor/sketch-session'
import type { ViewportRenderableRecord } from '@/domain/workspace/viewport-renderables'

function assert(condition: unknown, message = 'Assertion failed'): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function assertEqual<T>(actual: T, expected: T, message = 'Expected values to match') {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}`)
  }
}

function assertDeepEqual(actual: unknown, expected: unknown, message = 'Expected values to match deeply') {
  const actualJson = JSON.stringify(actual)
  const expectedJson = JSON.stringify(expected)

  if (actualJson !== expectedJson) {
    throw new Error(`${message}: expected ${expectedJson}, received ${actualJson}`)
  }
}

const datumPlaneRenderable: RenderableEntityRecord = {
  id: 'renderable_construction_xy_surface',
  label: 'XY Plane',
  ownerBodyId: null,
  ownerFeatureId: null,
  binding: {
    pickId: 'pick_construction_xy_surface',
    pickPriority: 10,
    target: { kind: 'construction', constructionId: 'construction_plane-xy' },
    topology: null,
    semanticClass: 'construction',
  },
  geometry: {
    kind: 'mesh',
    vertexPositions: [
      [-1, -1, 0],
      [1, -1, 0],
      [1, 1, 0],
      [-1, 1, 0],
    ],
    vertexNormals: [
      [0, 0, 1],
      [0, 0, 1],
      [0, 0, 1],
      [0, 0, 1],
    ],
    triangleIndices: [
      [0, 1, 2],
      [0, 2, 3],
    ],
  },
}

const durableMarkerRenderable: RenderableEntityRecord = {
  id: 'renderable_vertex_marker',
  label: 'Vertex marker',
  ownerBodyId: 'body_a',
  ownerFeatureId: null,
  binding: {
    pickId: 'pick_vertex_marker',
    pickPriority: 2,
    target: { kind: 'vertex', bodyId: 'body_a', vertexId: 'vertex_a' },
    topology: 'vertex',
    semanticClass: 'featureVertex',
  },
  geometry: {
    kind: 'marker',
    position: [2, 3, 4],
    displayRadius: 0.25,
  },
}

const solidFaceRenderable: RenderableEntityRecord = {
  id: 'renderable_solid_face',
  label: 'Solid face',
  ownerBodyId: 'body_a',
  ownerFeatureId: null,
  binding: {
    pickId: 'pick_solid_face',
    pickPriority: 10,
    target: { kind: 'face', bodyId: 'body_a', faceId: 'face_a' },
    topology: 'face',
    semanticClass: 'bodyFace',
  },
  geometry: {
    kind: 'mesh',
    vertexPositions: [
      [0, 0, 0],
      [2, 0, 0],
      [0, 2, 0],
    ],
    vertexNormals: [
      [0, 0, 1],
      [0, 0, 1],
      [0, 0, 1],
    ],
    triangleIndices: [[0, 1, 2]],
  },
}

const regionRenderable: RenderableEntityRecord = {
  id: 'renderable_region',
  label: 'Region',
  ownerBodyId: null,
  ownerFeatureId: 'feature_region',
  binding: {
    pickId: 'pick_region',
    pickPriority: 12,
    target: { kind: 'region', sketchId: 'sketch_a', regionId: 'region_a' },
    topology: null,
    semanticClass: 'region',
  },
  geometry: {
    kind: 'mesh',
    vertexPositions: [
      [0, 0, 0],
      [1, 0, 0],
      [0, 1, 0],
    ],
    vertexNormals: [
      [0, 0, 1],
      [0, 0, 1],
      [0, 0, 1],
    ],
    triangleIndices: [[0, 1, 2]],
  },
}

const durableEdgeRenderable: RenderableEntityRecord = {
  id: 'renderable_edge',
  label: 'Edge',
  ownerBodyId: 'body_a',
  ownerFeatureId: null,
  binding: {
    pickId: 'pick_edge',
    pickPriority: 1,
    target: { kind: 'edge', bodyId: 'body_a', edgeId: 'edge_a' },
    topology: 'edge',
    semanticClass: 'featureEdge',
  },
  geometry: {
    kind: 'polyline',
    points: [
      [0, 0, 0],
      [2, 0, 0],
    ],
    isClosed: false,
  },
}

const sketchDisplayMarker: SketchSessionDisplayRenderable = {
  id: 'renderable_display_marker',
  label: 'Display marker',
  target: { kind: 'sketchPoint', sketchId: 'sketch_a', pointId: 'sketch_point_a' },
  geometry: {
    kind: 'marker' as const,
    position: [5, 6, 7] as const,
    displayRadius: 0.125,
  },
}

const sketchDisplayLine: SketchSessionDisplayRenderable = {
  id: 'renderable_display_line',
  label: 'Display line',
  target: { kind: 'sketchEntity', sketchId: 'sketch_a', entityId: 'sketch_entity_a' },
  geometry: {
    kind: 'polyline' as const,
    points: [
      [0, 0, 0] as const,
      [4, 0, 0] as const,
    ],
    isClosed: false,
  },
}

function asDocument(renderable: RenderableEntityRecord): ViewportRenderableRecord {
  return {
    origin: 'document',
    renderable,
  }
}

function asPreview(renderable: RenderableEntityRecord): ViewportRenderableRecord {
  return {
    origin: 'preview',
    renderable,
  }
}

function createIntersection(
  object: THREE.Object3D,
  distance: number,
): THREE.Intersection<THREE.Object3D> {
  return {
    distance,
    object,
    point: new THREE.Vector3(),
  } as unknown as THREE.Intersection<THREE.Object3D>
}

{
  const renderScene = buildWorkspaceRenderScene([
    asDocument(datumPlaneRenderable),
    asDocument(solidFaceRenderable),
    asDocument(regionRenderable),
    asDocument(durableEdgeRenderable),
    asDocument(durableMarkerRenderable),
  ])
  assertEqual(renderScene.group.children.length, 5)

  const datumMesh = renderScene.group.children[0]
  assert(datumMesh instanceof THREE.Mesh)
  assert(datumMesh.material instanceof THREE.MeshStandardMaterial)
  assertEqual(datumMesh.material.color.getHex(), 0x9ea8b5)
  assertEqual(datumMesh.material.opacity, 0.12)

  const solidMesh = renderScene.group.children[1]
  assert(solidMesh instanceof THREE.Mesh)
  assert(solidMesh.material instanceof THREE.MeshStandardMaterial)
  assertEqual(solidMesh.material.color.getHex(), 0xf1eee4)
  assertEqual(solidMesh.material.opacity, 1)

  const regionMesh = renderScene.group.children[2]
  assert(regionMesh instanceof THREE.Mesh)
  assert(regionMesh.material instanceof THREE.MeshStandardMaterial)
  assertEqual(regionMesh.material.color.getHex(), 0x93dff2)
  assertEqual(regionMesh.material.opacity, 0.22)

  const edgeGroup = renderScene.group.children[3]
  assert(edgeGroup instanceof THREE.Line)

  const markerGroup = renderScene.group.children[4]
  assert(markerGroup instanceof THREE.Group)
  assertEqual(markerGroup.children.length, 2)
  const markerMesh = markerGroup.children[0]
  assert(markerMesh instanceof THREE.Mesh)
  assert(markerMesh.material instanceof THREE.MeshStandardMaterial)
  assertDeepEqual(markerMesh.position.toArray(), [2, 3, 4])
  assertDeepEqual(markerMesh.scale.toArray(), [0.11, 0.11, 0.11])

  updateWorkspaceHighlight(renderScene.targetToObjects, [durableMarkerRenderable.binding.target], durableEdgeRenderable.binding.target)
  const edgeLine = edgeGroup
  assert(edgeLine.material instanceof THREE.LineBasicMaterial)
  assertEqual(edgeLine.material.color.getHex(), 0xf0a14a)
  assertEqual(markerMesh.material.color.getHex(), 0xf4fbff)

  updateWorkspaceHighlight(renderScene.targetToObjects, [], solidFaceRenderable.binding.target)
  assertEqual(solidMesh.material.color.getHex(), 0xf7c78c)
  assertEqual(solidMesh.material.opacity, 1)
}

{
  const displayScene = buildSketchDisplayGroup([sketchDisplayMarker])
  assertEqual(displayScene.group.children.length, 1)
  assertEqual(displayScene.pickables.length, 1)

  const markerGroup = displayScene.group.children[0]
  assert(markerGroup instanceof THREE.Group)
  const markerMesh = markerGroup.children[0]
  assert(markerMesh instanceof THREE.Mesh)
  assert(markerMesh.material instanceof THREE.MeshStandardMaterial)
  assertDeepEqual(markerMesh.position.toArray(), [5, 6, 7])
  assertDeepEqual(markerMesh.scale.toArray(), [0.055, 0.055, 0.055])
}

{
  const renderScene = buildWorkspaceRenderScene([
    asDocument(durableEdgeRenderable),
    asDocument(durableMarkerRenderable),
  ])
  const edgeLine = renderScene.group.children[0]
  assert(edgeLine instanceof THREE.Line)
  const markerGroup = renderScene.group.children[1]
  assert(markerGroup instanceof THREE.Group)
  const markerHitProxy = markerGroup.children[1]

  const edgeHit = resolvePickTarget(
    [createIntersection(edgeLine, 3)],
    renderScene.pickIdToRenderable,
  )
  assertDeepEqual(edgeHit?.target, durableEdgeRenderable.binding.target)

  const markerHit = resolvePickTarget(
    [createIntersection(markerHitProxy, 1)],
    renderScene.pickIdToRenderable,
  )
  assertDeepEqual(markerHit?.target, durableMarkerRenderable.binding.target)
}

{
  const renderScene = buildWorkspaceRenderScene([
    asDocument(datumPlaneRenderable),
    asDocument(durableEdgeRenderable),
  ])
  const constructionObject = renderScene.group.children[0]
  const edgeLine = renderScene.group.children[1]
  assert(edgeLine instanceof THREE.Line)

  const result = resolvePickTarget(
    [
      createIntersection(constructionObject, 1),
      createIntersection(edgeLine, 2),
    ],
    renderScene.pickIdToRenderable,
  )

  assertDeepEqual(result?.target, durableEdgeRenderable.binding.target)
}

{
  const renderScene = buildWorkspaceRenderScene([
    asDocument(regionRenderable),
    asDocument(solidFaceRenderable),
  ])
  const regionObject = renderScene.group.children[0]
  const faceObject = renderScene.group.children[1]
  const result = resolvePickTarget(
    [
      createIntersection(regionObject, 1),
      createIntersection(faceObject, 2),
    ],
    renderScene.pickIdToRenderable,
  )

  assertDeepEqual(result?.target, solidFaceRenderable.binding.target)
}

{
  const renderScene = buildWorkspaceRenderScene([
    asDocument(solidFaceRenderable),
    asDocument(durableEdgeRenderable),
  ])
  const faceObject = renderScene.group.children[0]
  const edgeLine = renderScene.group.children[1]
  assert(faceObject instanceof THREE.Mesh)
  assert(edgeLine instanceof THREE.Line)

  const result = resolvePickTarget(
    [
      createIntersection(edgeLine, 1),
      createIntersection(faceObject, 0.8),
    ],
    renderScene.pickIdToRenderable,
  )

  assertDeepEqual(result?.target, solidFaceRenderable.binding.target)
}

{
  const renderScene = buildWorkspaceRenderScene([
    asDocument(solidFaceRenderable),
    asDocument(durableEdgeRenderable),
  ])
  const faceObject = renderScene.group.children[0]
  const edgeLine = renderScene.group.children[1]
  assert(faceObject instanceof THREE.Mesh)
  assert(edgeLine instanceof THREE.Line)

  const result = resolvePickTarget(
    [
      createIntersection(edgeLine, 0.805),
      createIntersection(faceObject, 0.8),
    ],
    renderScene.pickIdToRenderable,
  )

  assertDeepEqual(result?.target, durableEdgeRenderable.binding.target)
}

{
  const displayScene = buildSketchDisplayGroup([sketchDisplayLine])
  const line = displayScene.group.children[0]
  assert(line instanceof THREE.Line)
  assert(line.material instanceof THREE.LineBasicMaterial)
  assertEqual(line.material.color.getHex(), 0x8db7d6)

  updateWorkspaceHighlight(displayScene.targetToObjects, [], sketchDisplayLine.target)
  assertEqual(line.material.color.getHex(), 0xf0a14a)
}

{
  const renderScene = buildWorkspaceRenderScene([
    asDocument(solidFaceRenderable),
    asPreview({
      ...solidFaceRenderable,
      id: 'renderable_preview_face',
      binding: {
        ...solidFaceRenderable.binding,
        pickId: 'pick_preview_face',
      },
    }),
    asPreview({
      ...durableEdgeRenderable,
      id: 'renderable_preview_edge',
      binding: {
        ...durableEdgeRenderable.binding,
        pickId: 'pick_preview_edge',
      },
    }),
    asPreview({
      ...durableMarkerRenderable,
      id: 'renderable_preview_marker',
      binding: {
        ...durableMarkerRenderable.binding,
        pickId: 'pick_preview_marker',
      },
    }),
  ])

  const committedMesh = renderScene.group.children[0]
  const previewMesh = renderScene.group.children[1]
  const previewLine = renderScene.group.children[2]
  const previewMarkerGroup = renderScene.group.children[3]

  assert(committedMesh instanceof THREE.Mesh)
  assert(previewMesh instanceof THREE.Mesh)
  assert(previewLine instanceof THREE.Line)
  assert(previewMarkerGroup instanceof THREE.Group)
  assert(previewMarkerGroup.children[0] instanceof THREE.Mesh)

  assert(committedMesh.material instanceof THREE.MeshStandardMaterial)
  assert(previewMesh.material instanceof THREE.MeshStandardMaterial)
  assert(previewLine.material instanceof THREE.LineBasicMaterial)
  assert(previewMarkerGroup.children[0].material instanceof THREE.MeshStandardMaterial)

  assertEqual(committedMesh.material.opacity, 1)
  assertEqual(committedMesh.renderOrder, 2)
  assertEqual(previewMesh.material.opacity, 0.34)
  assertEqual(previewMesh.renderOrder, 5)
  assertEqual(previewLine.material.opacity, 0.72)
  assertEqual(previewLine.renderOrder, 6)
  assertEqual(previewMarkerGroup.children[0].material.opacity, 0.72)
}

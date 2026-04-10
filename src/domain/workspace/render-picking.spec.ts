import * as THREE from 'three'

import type { RenderableEntityRecord } from '@/contracts/render/schema'
import { buildSketchDisplayGroup, buildWorkspaceRenderScene } from '@/domain/workspace/render-picking'
import type { SketchSessionDisplayRenderable } from '@/domain/editor/sketch-session'

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

const sketchDisplayMarker: SketchSessionDisplayRenderable = {
  id: 'renderable_display_marker',
  label: 'Display marker',
  geometry: {
    kind: 'marker' as const,
    position: [5, 6, 7] as const,
    displayRadius: 0.125,
  },
}

{
  const renderScene = buildWorkspaceRenderScene([datumPlaneRenderable, durableMarkerRenderable])
  assertEqual(renderScene.group.children.length, 2)

  const datumMesh = renderScene.group.children[0]
  assert(datumMesh instanceof THREE.Mesh)
  assert(datumMesh.material instanceof THREE.MeshStandardMaterial)
  assertEqual(datumMesh.material.color.getHex(), 0x9ea8b5)
  assertEqual(datumMesh.material.opacity, 0.12)

  const markerMesh = renderScene.group.children[1]
  assert(markerMesh instanceof THREE.Mesh)
  assert(markerMesh.material instanceof THREE.MeshStandardMaterial)
  assertDeepEqual(markerMesh.position.toArray(), [2, 3, 4])
  assertDeepEqual(markerMesh.scale.toArray(), [0.25, 0.25, 0.25])
}

{
  const displayGroup = buildSketchDisplayGroup([sketchDisplayMarker])
  assertEqual(displayGroup.children.length, 1)

  const markerMesh = displayGroup.children[0]
  assert(markerMesh instanceof THREE.Mesh)
  assert(markerMesh.material instanceof THREE.MeshStandardMaterial)
  assertDeepEqual(markerMesh.position.toArray(), [5, 6, 7])
  assertDeepEqual(markerMesh.scale.toArray(), [0.125, 0.125, 0.125])
}

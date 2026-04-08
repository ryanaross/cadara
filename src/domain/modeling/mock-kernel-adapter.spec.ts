import { MockKernelAdapter } from './mock-kernel-adapter'
import { modelingRuntimeValidators } from './modeling-service'
import { resolvePickTarget } from '@/domain/workspace/render-picking'
import * as THREE from 'three'
import type { RenderableEntityRecord } from '@/contracts/render/schema'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

async function testExtrudePreviewDependsOnDefinition() {
  const adapter = new MockKernelAdapter()
  const snapshot = await adapter.getDocumentSnapshot({
    contractVersion: 'modeling-contract/v1alpha1',
    documentId: 'doc_workspace',
  })
  const existingExtrude = snapshot.snapshot.features.find(
    (feature) => feature.featureId === 'feature_extrude-1' && feature.definition.kind === 'extrude',
  )

  if (!existingExtrude || existingExtrude.definition.kind !== 'extrude') {
    throw new Error('Mock snapshot must expose the seeded extrude feature definition.')
  }

  const valid = await adapter.evaluatePreview({
    contractVersion: 'modeling-contract/v1alpha1',
    documentId: 'doc_workspace',
    baseRevisionId: 'rev_0001',
    previewId: 'preview_extrude_valid',
    definition: {
      kind: 'extrude',
      featureTypeVersion: 'feature-type/v1alpha1',
      parameters: {
        profile: existingExtrude.definition.parameters.profile,
        depth: 12,
        direction: 'oneSided',
        operation: 'newBody',
      },
    },
  })

  assert(valid.render.records.length > 0, 'Valid extrude previews should return preview renderables.')
  assert(valid.diagnostics.length === 0, 'Valid extrude previews should not emit diagnostics.')
  assert(
    valid.render.records.every((renderable) => {
      if (renderable.binding.topology === null) {
        return (
          renderable.binding.target.kind === 'construction'
          || renderable.binding.target.kind === 'sketchEntity'
          || renderable.binding.target.kind === 'sketchPoint'
        )
      }

      return renderable.binding.target.kind === renderable.binding.topology
    }),
    'Preview renderables must bind selection through durable refs rather than geometry shortcuts.',
  )
  assert(
    valid.render.records.some(
      (renderable) =>
        renderable.binding.semanticClass === 'planarFace' && renderable.geometry.kind === 'mesh',
    ),
    'Preview renderables must expose face semantics independently from the mesh geometry payload.',
  )

  const invalid = await adapter.evaluatePreview({
    contractVersion: 'modeling-contract/v1alpha1',
    documentId: 'doc_workspace',
    baseRevisionId: 'rev_0001',
    previewId: 'preview_extrude_invalid',
    definition: {
      kind: 'extrude',
      featureTypeVersion: 'feature-type/v1alpha1',
      parameters: {
        profile: existingExtrude.definition.parameters.profile,
        depth: 0,
        direction: 'oneSided',
        operation: 'newBody',
      },
    },
  })

  assert(invalid.render.records.length === 0, 'Invalid extrude previews must not return authoritative preview geometry.')
  assert(
    invalid.diagnostics.some((diagnostic) => diagnostic.code === 'mock-invalid-extrude'),
    'Invalid extrude previews must emit structured diagnostics.',
  )
}

async function testUnsupportedFeatureDefinitionsAreRejectedByMock() {
  const adapter = new MockKernelAdapter()

  const plane = await adapter.createFeature({
    contractVersion: 'modeling-contract/v1alpha1',
    documentId: 'doc_workspace',
    baseRevisionId: 'rev_0001',
    definition: {
      kind: 'plane',
      featureTypeVersion: 'feature-type/v1alpha1',
      parameters: {
        mode: 'coplanar',
        reference: {
          target: { kind: 'construction', constructionId: 'construction_plane-xy' },
        },
      },
    },
  })

  assert(
    plane.diagnostics.some((diagnostic) => diagnostic.code === 'mock-unsupported-plane'),
    'Unsupported plane features must report explicit mock diagnostics.',
  )
  assert(plane.changedTargets.length === 0, 'Unsupported plane features must not report changed targets.')
  assert(
    plane.rebuildResult.kind === 'skipped' && plane.rebuildResult.reasonCode === 'validationRejected',
    'Rejected feature requests must report an explicit skipped rebuild result.',
  )
}

async function testMutationResponsesReportRebuildResults() {
  const adapter = new MockKernelAdapter()
  const snapshot = await adapter.getDocumentSnapshot({
    contractVersion: 'modeling-contract/v1alpha1',
    documentId: 'doc_workspace',
  })
  const extrude = snapshot.snapshot.features.find(
    (feature) => feature.featureId === 'feature_extrude-1' && feature.definition.kind === 'extrude',
  )

  if (!extrude || extrude.definition.kind !== 'extrude') {
    throw new Error('Mock snapshot must expose the seeded extrude feature definition.')
  }

  const accepted = await adapter.createFeature({
    contractVersion: 'modeling-contract/v1alpha1',
    documentId: 'doc_workspace',
    baseRevisionId: 'rev_0001',
    definition: {
      kind: 'extrude',
      featureTypeVersion: 'feature-type/v1alpha1',
      parameters: {
        ...extrude.definition.parameters,
        depth: 8,
      },
    },
  })

  assert(accepted.rebuildResult.kind === 'rebuilt', 'Accepted feature creates must report a rebuilt result.')
  assert(
    accepted.rebuildResult.revisionId === 'rev_0001',
    'Accepted feature creates must report the rebuild revision ID.',
  )

  const conflict = await adapter.deleteFeature({
    contractVersion: 'modeling-contract/v1alpha1',
    documentId: 'doc_workspace',
    baseRevisionId: 'rev_stale',
    featureId: 'feature_extrude-1',
  })

  assert(
    conflict.rebuildResult.kind === 'skipped' && conflict.rebuildResult.reasonCode === 'revisionConflict',
    'Revision conflicts must report a skipped rebuild result.',
  )
}

async function testSnapshotRenderablesExposeSemanticBindings() {
  const adapter = new MockKernelAdapter()
  const snapshot = await adapter.getDocumentSnapshot({
    contractVersion: 'modeling-contract/v1alpha1',
    documentId: 'doc_workspace',
  })

  const planarFace = snapshot.snapshot.render.records.find(
    (renderable) => renderable.binding.semanticClass === 'planarFace',
  )

  assert(planarFace !== undefined, 'Seed snapshot must contain a planar face binding.')
  assert(planarFace.geometry.kind === 'mesh', 'Planar face exports must use mesh geometry.')
  assert(
    planarFace.binding.target.kind === 'face',
    'Planar face bindings must round-trip through a durable face ref.',
  )

  const topFaceEntity = snapshot.snapshot.entities.find(
    (entity) => entity.target.kind === 'face' && entity.target.faceId === 'face_top',
  )

  assert(
    topFaceEntity?.selectionSemantics.includes('planarFace') === true,
    'Planar-face selection semantics must live on durable snapshot entities.',
  )
}

function testResolvePickTargetUsesKernelPriority() {
  const edgeRenderable = {
    id: 'renderable_edge_priority',
    label: 'Priority edge',
    ownerBodyId: 'body_test',
    ownerFeatureId: null,
    binding: {
      pickId: 'pick_edge_priority',
      pickPriority: 10,
      target: { kind: 'edge', bodyId: 'body_test', edgeId: 'edge_test' },
      topology: 'edge',
      semanticClass: 'featureEdge',
    },
    geometry: {
      kind: 'polyline',
      points: [[0, 0, 0], [1, 0, 0]],
      isClosed: false,
    },
  } as const

  const faceRenderable = {
    id: 'renderable_face_priority',
    label: 'Priority face',
    ownerBodyId: 'body_test',
    ownerFeatureId: null,
    binding: {
      pickId: 'pick_face_priority',
      pickPriority: 20,
      target: { kind: 'face', bodyId: 'body_test', faceId: 'face_test' },
      topology: 'face',
      semanticClass: 'planarFace',
    },
    geometry: {
      kind: 'mesh',
      vertexPositions: [[0, 0, 0], [1, 0, 0], [0, 1, 0]],
      vertexNormals: [[0, 0, 1], [0, 0, 1], [0, 0, 1]],
      triangleIndices: [[0, 1, 2]],
    },
  } as const

  const faceObject = new THREE.Object3D()
  faceObject.userData.pickId = 'pick_face_priority'
  const edgeObject = new THREE.Object3D()
  edgeObject.userData.pickId = 'pick_edge_priority'

  const intersections = [
    {
      distance: 1,
      object: faceObject,
    },
    {
      distance: 2,
      object: edgeObject,
    },
  ] as THREE.Intersection<THREE.Object3D>[]

  const result = resolvePickTarget(
    intersections,
    new Map<string, RenderableEntityRecord>([
      [faceRenderable.binding.pickId, faceRenderable],
      [edgeRenderable.binding.pickId, edgeRenderable],
    ]),
  )

  assert(result?.pickId === 'pick_edge_priority', 'Pick resolution must prefer kernel-authored pickPriority over viewer distance.')
}

function testRenderValidatorRejectsInvalidGeometry() {
  const validFace = {
    id: 'renderable_test_face',
    label: 'Test face',
    ownerBodyId: null,
    ownerFeatureId: null,
    binding: {
      pickId: 'pick_test_face',
      pickPriority: 20,
      target: { kind: 'face', bodyId: 'body_test', faceId: 'face_test' },
      topology: 'face',
      semanticClass: 'planarFace',
    },
    geometry: {
      kind: 'mesh',
      vertexPositions: [],
      vertexNormals: null,
      triangleIndices: [],
    },
  } as const

  let meshRejected = false

  try {
    modelingRuntimeValidators.renderables([validFace])
  } catch {
    meshRejected = true
  }

  assert(meshRejected, 'Render validator must reject empty mesh exports.')

  const invalidPolyline = {
    id: 'renderable_test_curve',
    label: 'Test curve',
    ownerBodyId: null,
    ownerFeatureId: null,
    binding: {
      pickId: 'pick_test_curve',
      pickPriority: 10,
      target: { kind: 'edge', bodyId: 'body_test', edgeId: 'edge_test' },
      topology: 'edge',
      semanticClass: 'featureEdge',
    },
    geometry: {
      kind: 'polyline',
      points: [[0, 0, 0]],
      isClosed: false,
    },
  } as const

  let polylineRejected = false

  try {
    modelingRuntimeValidators.renderables([invalidPolyline])
  } catch {
    polylineRejected = true
  }

  assert(polylineRejected, 'Render validator must reject degenerate open polylines.')

  const invalidMarker = {
    id: 'renderable_test_point',
    label: 'Test point',
    ownerBodyId: null,
    ownerFeatureId: null,
    binding: {
      pickId: 'pick_test_point',
      pickPriority: 0,
      target: { kind: 'vertex', bodyId: 'body_test', vertexId: 'vertex_test' },
      topology: 'vertex',
      semanticClass: 'featureVertex',
    },
    geometry: {
      kind: 'marker',
      position: [0, 0, 0],
      displayRadius: 0,
    },
  } as const

  let markerRejected = false

  try {
    modelingRuntimeValidators.renderables([invalidMarker])
  } catch {
    markerRejected = true
  }

  assert(markerRejected, 'Render validator must reject non-positive marker radius.')
}

await testExtrudePreviewDependsOnDefinition()
await testUnsupportedFeatureDefinitionsAreRejectedByMock()
await testMutationResponsesReportRebuildResults()
await testSnapshotRenderablesExposeSemanticBindings()
testResolvePickTargetUsesKernelPriority()
testRenderValidatorRejectsInvalidGeometry()

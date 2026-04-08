import { MockKernelAdapter } from './mock-kernel-adapter'

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

  assert(valid.renderables.length > 0, 'Valid extrude previews should return preview renderables.')
  assert(valid.diagnostics.length === 0, 'Valid extrude previews should not emit diagnostics.')

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

  assert(invalid.renderables.length === 0, 'Invalid extrude previews must not return authoritative preview geometry.')
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
}

await testExtrudePreviewDependsOnDefinition()
await testUnsupportedFeatureDefinitionsAreRejectedByMock()

import type {
  FeatureTreeNodeId,
  ObjectTreeNodeId,
  PickId,
  RenderableId,
  SnapshotEntityId,
} from '@/contracts/shared/ids'
import type { DurableRef } from '@/contracts/shared/references'
import type { ModelingKernelAdapter } from '@/contracts/modeling/adapter'
import type {
  CreateFeatureRequest,
  DocumentSnapshot,
  FeatureDefinition,
  FeatureTreeNodeRecord,
  ModelingDiagnostic,
  ObjectTreeNodeRecord,
  ReferenceRecord,
  RenderableEntityRecord,
  ReorderFeatureRequest,
  ResolvedReferenceRecord,
  SnapshotEntityRecord,
} from '@/contracts/modeling/schema'

type Equals<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends
  (<Value>() => Value extends Right ? 1 : 2)
    ? true
    : false

type Assert<T extends true> = T

type DurableRefKinds = DurableRef['kind']

type DurableRefKindsAreCanonical = Assert<
  Equals<
    DurableRefKinds,
    | 'body'
    | 'face'
    | 'edge'
    | 'vertex'
    | 'loop'
    | 'sketch'
    | 'sketchEntity'
    | 'sketchPoint'
    | 'feature'
    | 'construction'
    | 'region'
  >
>

type FeatureTreeIdsArePresentational = Assert<
  Equals<FeatureTreeNodeRecord['id'], FeatureTreeNodeId>
>

type ObjectTreeIdsArePresentational = Assert<
  Equals<ObjectTreeNodeRecord['id'], ObjectTreeNodeId>
>

type SnapshotEntityIdsArePresentational = Assert<
  Equals<SnapshotEntityRecord['id'], SnapshotEntityId>
>

type RenderableIdsArePresentational = Assert<
  Equals<RenderableEntityRecord['id'], RenderableId>
>

type PickIdsAreTyped = Assert<
  Equals<RenderableEntityRecord['pickBinding']['pickId'], PickId>
>

type SharedIdsModule = typeof import('@/contracts/shared/ids')
type SharedIdsDoNotLeakSketchPrimitiveId = Assert<
  Equals<'SketchPrimitiveId' extends keyof SharedIdsModule ? true : false, false>
>

type KernelSnapshotBoundaryIsTyped = Assert<
  Equals<
    Awaited<ReturnType<ModelingKernelAdapter['getDocumentSnapshot']>>['snapshot'],
    import('@/contracts/modeling/schema').DocumentSnapshot
  >
>

type FeatureDefinitionIsClosedUnion = Assert<
  Equals<FeatureDefinition['kind'], 'extrude' | 'fillet' | 'plane' | 'revolve'>
>

type CreateFeatureUsesTypedDefinition = Assert<
  Equals<CreateFeatureRequest['definition'], FeatureDefinition>
>

type ReorderFeatureRequestIsTyped = Assert<
  Equals<ReorderFeatureRequest['beforeFeatureId'], import('@/contracts/shared/ids').FeatureId | null>
>

type DiagnosticsUseCanonicalRefs = Assert<
  Equals<Exclude<ModelingDiagnostic['target'], null>, DurableRef>
>

type ReferencesUseCanonicalRefs = Assert<
  Equals<ReferenceRecord['target'], DurableRef>
>

type ResolutionUsesCanonicalRefs = Assert<
  Equals<ResolvedReferenceRecord['target'], DurableRef>
>

type SnapshotEntitiesUseCanonicalRefs = Assert<
  Equals<SnapshotEntityRecord['target'], DurableRef>
>

type SnapshotReferencesAreModelingOwned = Assert<
  Equals<DocumentSnapshot['references'][number], ReferenceRecord>
>

export const CONTRACT_TYPE_TESTS: readonly [
  DurableRefKindsAreCanonical,
  FeatureTreeIdsArePresentational,
  ObjectTreeIdsArePresentational,
  SnapshotEntityIdsArePresentational,
  RenderableIdsArePresentational,
  PickIdsAreTyped,
  SharedIdsDoNotLeakSketchPrimitiveId,
  KernelSnapshotBoundaryIsTyped,
  FeatureDefinitionIsClosedUnion,
  CreateFeatureUsesTypedDefinition,
  ReorderFeatureRequestIsTyped,
  DiagnosticsUseCanonicalRefs,
  ReferencesUseCanonicalRefs,
  ResolutionUsesCanonicalRefs,
  SnapshotEntitiesUseCanonicalRefs,
  SnapshotReferencesAreModelingOwned,
] = [true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true]

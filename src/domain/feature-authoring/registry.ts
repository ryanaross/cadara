import type { AuthoredFeatureKind } from '@/contracts/modeling/schema'
import type { FeatureAuthoringDefinition } from '@/domain/feature-authoring/definition'
import { chamferAuthoringDefinition } from '@/domain/feature-authoring/features/chamfer'
import { extrudeAuthoringDefinition } from '@/domain/feature-authoring/features/extrude'
import { filletAuthoringDefinition } from '@/domain/feature-authoring/features/fillet'
import { loftAuthoringDefinition } from '@/domain/feature-authoring/features/loft'
import { planeAuthoringDefinition } from '@/domain/feature-authoring/features/plane'
import { revolveAuthoringDefinition } from '@/domain/feature-authoring/features/revolve'
import { shellAuthoringDefinition } from '@/domain/feature-authoring/features/shell'
import { sweepAuthoringDefinition } from '@/domain/feature-authoring/features/sweep'

export const featureAuthoringDefinitions = [
  extrudeAuthoringDefinition,
  revolveAuthoringDefinition,
  filletAuthoringDefinition,
  planeAuthoringDefinition,
  shellAuthoringDefinition,
  sweepAuthoringDefinition,
  loftAuthoringDefinition,
  chamferAuthoringDefinition,
] as const satisfies readonly FeatureAuthoringDefinition[]

const featureAuthoringRegistry = new Map<AuthoredFeatureKind, FeatureAuthoringDefinition>(
  featureAuthoringDefinitions.map((definition) => [definition.metadata.kind, definition]),
)

export function getFeatureAuthoringDefinition<TKind extends AuthoredFeatureKind>(
  featureKind: TKind,
): FeatureAuthoringDefinition<TKind> {
  const definition = featureAuthoringRegistry.get(featureKind)

  if (!definition) {
    throw new Error(`No feature authoring definition registered for "${featureKind}".`)
  }

  return definition as unknown as FeatureAuthoringDefinition<TKind>
}

export function findFeatureAuthoringDefinition<TKind extends AuthoredFeatureKind>(
  featureKind: TKind,
): FeatureAuthoringDefinition<TKind> | null {
  return (featureAuthoringRegistry.get(featureKind) as FeatureAuthoringDefinition<TKind> | undefined) ?? null
}

export function getRegisteredFeatureAuthoringDefinitions() {
  return featureAuthoringDefinitions
}

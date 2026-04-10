import type { SketchToolDefinition, SketchToolId } from '@/domain/sketch-tools/definition'
import { circleSketchToolDefinition } from '@/domain/sketch-tools/tools/circle'
import { lineSketchToolDefinition } from '@/domain/sketch-tools/tools/line'
import { rectangleSketchToolDefinition } from '@/domain/sketch-tools/tools/rectangle'

export const sketchToolDefinitions = [
  lineSketchToolDefinition,
  rectangleSketchToolDefinition,
  circleSketchToolDefinition,
] as const satisfies readonly SketchToolDefinition[]

const sketchToolMap = new Map<SketchToolId, SketchToolDefinition>(
  sketchToolDefinitions.map((definition) => [definition.metadata.id, definition]),
)

export function getSketchToolDefinition(toolId: SketchToolId): SketchToolDefinition {
  const definition = sketchToolMap.get(toolId)

  if (!definition) {
    throw new Error(`Sketch tool ${toolId} is not registered.`)
  }

  return definition
}

export function getRegisteredSketchToolDefinitions(): readonly SketchToolDefinition[] {
  return sketchToolDefinitions
}

export function isRegisteredSketchToolId(toolId: string): toolId is SketchToolId {
  return sketchToolMap.has(toolId as SketchToolId)
}

import type { SketchPoint } from '@/contracts/modeling/schema'

export type SketchToolControlValue = string | number | boolean | null

export interface SketchToolActionDescriptor {
  type: 'patch'
  patch: Record<string, SketchToolControlValue>
}

export interface SketchToolPromptDescriptor {
  id: string
  text: string
  tone?: 'neutral' | 'success' | 'warning'
}

export interface SketchToolStepDescriptor {
  id: string
  label: string
}

export type SketchToolControlDescriptor =
  | {
      id: string
      kind: 'numeric'
      label: string
      value: number | null
      unit?: string
      disabled?: boolean
      action: SketchToolActionDescriptor
    }
  | {
      id: string
      kind: 'option'
      label: string
      value: string | null
      options: readonly {
        value: string
        label: string
      }[]
      disabled?: boolean
      action: SketchToolActionDescriptor
    }

export interface SketchToolMeasurementDescriptor {
  id: string
  label: string
  value: number
  unit?: string
}

export interface SketchToolCompletionHintDescriptor {
  id: string
  text: string
  ready: boolean
}

export type SketchToolOverlayDescriptor =
  | {
      id: string
      kind: 'measurement'
      label: string
      value: number
      unit?: string
      anchor: SketchPoint
    }
  | {
      id: string
      kind: 'anchor'
      label: string
      point: SketchPoint
    }
  | {
      id: string
      kind: 'helperMarker'
      label: string
      point: SketchPoint
    }
  | {
      id: string
      kind: 'completionCue'
      label: string
      point: SketchPoint
      ready: boolean
    }

export interface SketchToolValidationDescriptor {
  id: string
  message: string
  severity: 'info' | 'warning' | 'error'
}

export interface SketchToolPresentationSchema {
  prompts: readonly SketchToolPromptDescriptor[]
  steps?: readonly SketchToolStepDescriptor[]
  controls?: readonly SketchToolControlDescriptor[]
  measurements?: readonly SketchToolMeasurementDescriptor[]
  completionHints?: readonly SketchToolCompletionHintDescriptor[]
  overlays?: readonly SketchToolOverlayDescriptor[]
  validation?: readonly SketchToolValidationDescriptor[]
  extension?: {
    id: string
    payload: Record<string, unknown>
  }
}

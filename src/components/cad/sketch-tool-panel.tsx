import type { SketchToolPresentationSchema } from '@/domain/sketch-tools/editor-schema'

interface SketchToolPanelProps {
  schema: SketchToolPresentationSchema | null
  onPatch: (patch: Record<string, unknown>) => void
}

function formatNumber(value: number | null) {
  return value === null ? 'n/a' : value.toFixed(2)
}

export function SketchToolPanel({ schema, onPatch }: SketchToolPanelProps) {
  if (!schema) {
    return null
  }

  const validation = schema.validation ?? []
  const controls = schema.controls ?? []
  const measurements = schema.measurements ?? []
  const hints = schema.completionHints ?? []

  return (
    <div className="pointer-events-auto absolute left-4 top-4 w-[260px] rounded-lg border border-[var(--cad-border-strong)] bg-[rgba(8,12,17,0.9)] p-3 text-xs text-[var(--cad-muted-foreground)] shadow-[var(--cad-panel-shadow)]">
      <div className="grid gap-2">
        {schema.prompts.map((prompt) => (
          <div key={prompt.id} className="text-sm font-medium text-[var(--cad-foreground)]">
            {prompt.text}
          </div>
        ))}
        {schema.steps?.map((step) => (
          <div key={step.id}>
            Step: <span className="text-[var(--cad-foreground)]">{step.label}</span>
          </div>
        ))}
        {validation.map((message) => (
          <div key={message.id} className="rounded-md border border-[rgba(255,143,107,0.45)] px-2 py-1 text-[rgb(255,190,164)]">
            {message.message}
          </div>
        ))}
        {controls.length > 0 ? (
          <div className="grid gap-2 border-t border-[var(--cad-border)] pt-2">
            {controls.map((control) => (
              <label key={control.id} className="grid gap-1">
                <span>{control.label}</span>
                {control.kind === 'numeric' ? (
                  <input
                    className="h-8 rounded-md border border-[var(--cad-border)] bg-[var(--cad-surface)] px-2 text-[var(--cad-foreground)] outline-none"
                    disabled={control.disabled}
                    type="number"
                    value={control.value ?? ''}
                    onChange={(event) => {
                      const nextValue = Number(event.currentTarget.value)
                      onPatch({
                        ...control.action.patch,
                        value: Number.isNaN(nextValue) ? null : nextValue,
                      })
                    }}
                  />
                ) : (
                  <select
                    className="h-8 rounded-md border border-[var(--cad-border)] bg-[var(--cad-surface)] px-2 text-[var(--cad-foreground)] outline-none"
                    disabled={control.disabled}
                    value={control.value ?? ''}
                    onChange={(event) => {
                      onPatch({
                        ...control.action.patch,
                        value: event.currentTarget.value,
                      })
                    }}
                  >
                    {control.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                )}
              </label>
            ))}
          </div>
        ) : null}
        {measurements.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 border-t border-[var(--cad-border)] pt-2">
            {measurements.map((measurement) => (
              <div key={measurement.id}>
                <div>{measurement.label}</div>
                <div className="text-[var(--cad-foreground)]">
                  {formatNumber(measurement.value)} {measurement.unit ?? ''}
                </div>
              </div>
            ))}
          </div>
        ) : null}
        {hints.map((hint) => (
          <div
            key={hint.id}
            className={hint.ready ? 'text-[rgb(136,212,152)]' : 'text-[var(--cad-muted-foreground)]'}
          >
            {hint.text}
          </div>
        ))}
      </div>
    </div>
  )
}

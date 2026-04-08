import type * as React from 'react'

import { cn } from '@/lib/utils'

export function Input({ className, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'w-full border bg-[var(--cad-surface)] px-3 py-2 text-sm text-[var(--cad-foreground)] outline-none transition placeholder:text-[var(--cad-muted)] focus:border-[var(--cad-accent)] focus:ring-2 focus:ring-[rgba(79,148,255,0.12)]',
        className,
      )}
      {...props}
    />
  )
}

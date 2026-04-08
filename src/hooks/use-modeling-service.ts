import { useContext } from 'react'

import { ModelingServiceContext } from '@/hooks/modeling-service-context'

export function useModelingService() {
  const context = useContext(ModelingServiceContext)

  if (!context) {
    throw new Error('useModelingService must be used inside ModelingServiceProvider.')
  }

  return context.modelingService
}

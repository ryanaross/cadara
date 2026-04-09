import type { OpenCascadeInstance } from 'opencascade.js/dist/opencascade.full'

let openCascadePromise: Promise<OpenCascadeInstance> | null = null

async function loadOpenCascadeFactory() {
  if (typeof window === 'undefined') {
    const module = await import('opencascade.js/dist/node.js')
    return module.default
  }

  const module = await import('opencascade.js')
  return module.default
}

export function getOpenCascadeInstance() {
  if (!openCascadePromise) {
    openCascadePromise = loadOpenCascadeFactory().then((initOpenCascade) => initOpenCascade())
  }

  return openCascadePromise
}

export type { OpenCascadeInstance }

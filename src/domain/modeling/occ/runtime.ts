import type { OpenCascadeInstance } from 'opencascade.js/dist/opencascade.full'

export interface OpenCascadeInitializationOptions {
  mainJS?: unknown
  mainWasm?: string
  worker?: string
  libs?: string[]
  module?: Record<string, unknown>
}

export type OpenCascadeInitializer = (
  settings?: OpenCascadeInitializationOptions,
) => Promise<OpenCascadeInstance>

export type OpenCascadeEntrySpecifier = 'opencascade.js' | 'opencascade.js/dist/node.js'

interface OpenCascadeFactoryModule {
  default: OpenCascadeInitializer
}

interface OpenCascadeFactoryLoadOptions {
  isNodeRuntime?: boolean
  loadBrowserModule?: () => Promise<OpenCascadeFactoryModule>
  loadNodeModule?: () => Promise<OpenCascadeFactoryModule>
}

function isNodeRuntime() {
  const processLike = (globalThis as typeof globalThis & {
    process?: { versions?: { node?: string } }
  }).process

  return typeof processLike?.versions === 'object'
    && typeof processLike.versions?.node === 'string'
}

export function getDefaultOpenCascadeEntrySpecifier(
  options: Pick<OpenCascadeFactoryLoadOptions, 'isNodeRuntime'> = {},
): OpenCascadeEntrySpecifier {
  return (options.isNodeRuntime ?? isNodeRuntime())
    ? 'opencascade.js/dist/node.js'
    : 'opencascade.js'
}

async function loadBrowserOpenCascadeModule(): Promise<OpenCascadeFactoryModule> {
  return import('opencascade.js')
}

async function loadNodeOpenCascadeModule(): Promise<OpenCascadeFactoryModule> {
  const nodeEntrySpecifier = 'opencascade.js/dist/' + 'node.js'
  return import(/* @vite-ignore */ nodeEntrySpecifier) as Promise<OpenCascadeFactoryModule>
}

export async function loadDefaultOpenCascadeFactory(
  options: OpenCascadeFactoryLoadOptions = {},
): Promise<OpenCascadeInitializer> {
  const entrySpecifier = getDefaultOpenCascadeEntrySpecifier(options)
  const loadModule = entrySpecifier === 'opencascade.js/dist/node.js'
    ? (options.loadNodeModule ?? loadNodeOpenCascadeModule)
    : (options.loadBrowserModule ?? loadBrowserOpenCascadeModule)
  const module = await loadModule()

  return module.default
}

export function createOpenCascadeInstanceLoader(
  loadFactory: () => Promise<OpenCascadeInitializer>,
) {
  let openCascadePromise: Promise<OpenCascadeInstance> | null = null

  return {
    getInstance() {
      if (!openCascadePromise) {
        openCascadePromise = loadFactory()
          .then((initOpenCascade) => initOpenCascade())
          .catch((error: unknown) => {
            openCascadePromise = null
            throw error
          })
      }

      return openCascadePromise
    },
    reset() {
      openCascadePromise = null
    },
  }
}

const defaultOpenCascadeInstanceLoader = createOpenCascadeInstanceLoader(
  loadDefaultOpenCascadeFactory,
)

export function getDefaultOpenCascadeInstance() {
  return defaultOpenCascadeInstanceLoader.getInstance()
}

export function resetDefaultOpenCascadeInstanceForTests() {
  defaultOpenCascadeInstanceLoader.reset()
}

export function getOpenCascadeInstance() {
  return getDefaultOpenCascadeInstance()
}

export type { OpenCascadeInstance }

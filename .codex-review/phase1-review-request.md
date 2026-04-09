Please do a brutally honest code review of this phase-1 OCC runtime bootstrap implementation. Do not rubber stamp it. I want findings first, ordered by severity, with file/line references and concrete fixes. Only pass it if it is genuinely solid for OCC.md phase 1.

Scope:
- /app/src/domain/modeling/occ/runtime.ts
- /app/src/domain/modeling/occ/runtime.spec.ts
- /app/package.json

Relevant requirement from OCC.md phase 1:
- Verify or replace src/domain/modeling/occ/runtime.ts.
- Ensure browser uses `opencascade.js`.
- Ensure node/test uses `opencascade.js/dist/node.js`.
- Export a cached `getDefaultOpenCascadeInstance()`.
- Add small helper types for the loaded OCJS instance if needed.
- Exit criteria: both browser and node paths compile; node tests can initialize OCC.

Current file with line numbers:

runtime.ts
     1	import type { OpenCascadeInstance } from 'opencascade.js/dist/opencascade.full'
     2	
     3	export interface OpenCascadeInitializationOptions {
     4	  mainJS?: unknown
     5	  mainWasm?: string
     6	  worker?: string
     7	  libs?: string[]
     8	  module?: Record<string, unknown>
     9	}
    10	
    11	export type OpenCascadeInitializer = (
    12	  settings?: OpenCascadeInitializationOptions,
    13	) => Promise<OpenCascadeInstance>
    14	
    15	interface OpenCascadeFactoryModule {
    16	  default: OpenCascadeInitializer
    17	}
    18	
    19	interface OpenCascadeFactoryLoadOptions {
    20	  isNodeRuntime?: boolean
    21	  loadBrowserModule?: () => Promise<OpenCascadeFactoryModule>
    22	  loadNodeModule?: () => Promise<OpenCascadeFactoryModule>
    23	}
    24	
    25	function isNodeRuntime() {
    26	  const processLike = (globalThis as typeof globalThis & {
    27	    process?: { versions?: { node?: string } }
    28	  }).process
    29	
    30	  return typeof processLike?.versions === 'object'
    31	    && typeof processLike.versions?.node === 'string'
    32	}
    33	
    34	async function loadBrowserOpenCascadeModule(): Promise<OpenCascadeFactoryModule> {
    35	  return import('opencascade.js')
    36	}
    37	
    38	async function loadNodeOpenCascadeModule(): Promise<OpenCascadeFactoryModule> {
    39	  return import('opencascade.js/dist/node.js')
    40	}
    41	
    42	export async function loadDefaultOpenCascadeFactory(
    43	  options: OpenCascadeFactoryLoadOptions = {},
    44	): Promise<OpenCascadeInitializer> {
    45	  const shouldUseNodeEntry = options.isNodeRuntime ?? isNodeRuntime()
    46	  const loadModule = shouldUseNodeEntry
    47	    ? (options.loadNodeModule ?? loadNodeOpenCascadeModule)
    48	    : (options.loadBrowserModule ?? loadBrowserOpenCascadeModule)
    49	  const module = await loadModule()
    50	
    51	  return module.default
    52	}
    53	
    54	export function createOpenCascadeInstanceLoader(
    55	  loadFactory: () => Promise<OpenCascadeInitializer>,
    56	) {
    57	  let openCascadePromise: Promise<OpenCascadeInstance> | null = null
    58	
    59	  return {
    60	    getInstance() {
    61	      if (!openCascadePromise) {
    62	        openCascadePromise = loadFactory().then((initOpenCascade) => initOpenCascade())
    63	      }
    64	
    65	      return openCascadePromise
    66	    },
    67	    reset() {
    68	      openCascadePromise = null
    69	    },
    70	  }
    71	}
    72	
    73	const defaultOpenCascadeInstanceLoader = createOpenCascadeInstanceLoader(
    74	  loadDefaultOpenCascadeFactory,
    75	)
    76	
    77	export function getDefaultOpenCascadeInstance() {
    78	  return defaultOpenCascadeInstanceLoader.getInstance()
    79	}
    80	
    81	export function resetDefaultOpenCascadeInstanceForTests() {
    82	  defaultOpenCascadeInstanceLoader.reset()
    83	}
    84	
    85	export function getOpenCascadeInstance() {
    86	  return getDefaultOpenCascadeInstance()
    87	}
    88	
    89	export type { OpenCascadeInstance }


runtime.spec.ts
     1	import {
     2	  createOpenCascadeInstanceLoader,
     3	  getDefaultOpenCascadeInstance,
     4	  loadDefaultOpenCascadeFactory,
     5	  resetDefaultOpenCascadeInstanceForTests,
     6	  type OpenCascadeInitializer,
     7	  type OpenCascadeInstance,
     8	} from '@/domain/modeling/occ/runtime'
     9	
    10	function assert(condition: unknown, message: string): asserts condition {
    11	  if (!condition) {
    12	    throw new Error(message)
    13	  }
    14	}
    15	
    16	function createMockOpenCascadeInstance() {
    17	  return {
    18	    BRepBuilderAPI_MakeEdge_3: class BRepBuilderAPI_MakeEdge_3 {},
    19	  } as unknown as OpenCascadeInstance
    20	}
    21	
    22	async function testLoadDefaultOpenCascadeFactoryUsesNodeEntryInNodeRuntime() {
    23	  let browserLoads = 0
    24	  let nodeLoads = 0
    25	
    26	  const nodeInitializer: OpenCascadeInitializer = async () => createMockOpenCascadeInstance()
    27	
    28	  const initializer = await loadDefaultOpenCascadeFactory({
    29	    isNodeRuntime: true,
    30	    loadBrowserModule: async () => {
    31	      browserLoads += 1
    32	      return { default: async () => createMockOpenCascadeInstance() }
    33	    },
    34	    loadNodeModule: async () => {
    35	      nodeLoads += 1
    36	      return { default: nodeInitializer }
    37	    },
    38	  })
    39	
    40	  assert(initializer === nodeInitializer, 'Node runtime must resolve the node-specific OCJS entry point.')
    41	  assert(nodeLoads === 1, 'Node runtime must load the node-specific OCJS module exactly once.')
    42	  assert(browserLoads === 0, 'Node runtime must not touch the browser OCJS entry point.')
    43	}
    44	
    45	async function testLoadDefaultOpenCascadeFactoryUsesBrowserEntryOutsideNodeRuntime() {
    46	  let browserLoads = 0
    47	  let nodeLoads = 0
    48	
    49	  const browserInitializer: OpenCascadeInitializer = async () => createMockOpenCascadeInstance()
    50	
    51	  const initializer = await loadDefaultOpenCascadeFactory({
    52	    isNodeRuntime: false,
    53	    loadBrowserModule: async () => {
    54	      browserLoads += 1
    55	      return { default: browserInitializer }
    56	    },
    57	    loadNodeModule: async () => {
    58	      nodeLoads += 1
    59	      return { default: async () => createMockOpenCascadeInstance() }
    60	    },
    61	  })
    62	
    63	  assert(initializer === browserInitializer, 'Browser runtime must resolve the browser OCJS entry point.')
    64	  assert(browserLoads === 1, 'Browser runtime must load the browser OCJS module exactly once.')
    65	  assert(nodeLoads === 0, 'Browser runtime must not touch the node-specific OCJS entry point.')
    66	}
    67	
    68	async function testCreateOpenCascadeInstanceLoaderCachesTheInitializedInstance() {
    69	  const instance = createMockOpenCascadeInstance()
    70	  let factoryCalls = 0
    71	  let initializerCalls = 0
    72	
    73	  const loader = createOpenCascadeInstanceLoader(async () => {
    74	    factoryCalls += 1
    75	
    76	    return async () => {
    77	      initializerCalls += 1
    78	      return instance
    79	    }
    80	  })
    81	
    82	  const first = loader.getInstance()
    83	  const second = loader.getInstance()
    84	
    85	  assert(first === second, 'Instance loader must memoize the in-flight initialization promise.')
    86	
    87	  const resolvedFirst = await first
    88	  const resolvedSecond = await second
    89	
    90	  assert(resolvedFirst === instance, 'Instance loader must resolve the initialized OCJS instance.')
    91	  assert(resolvedSecond === instance, 'Instance loader must reuse the same initialized OCJS instance.')
    92	  assert(factoryCalls === 1, 'Instance loader must only load the OCJS factory once.')
    93	  assert(initializerCalls === 1, 'Instance loader must only initialize OCJS once.')
    94	
    95	  loader.reset()
    96	
    97	  const third = await loader.getInstance()
    98	
    99	  assert(factoryCalls > 1, 'Reset must clear the cached OCJS factory promise.')
   100	  assert(initializerCalls > 1, 'Reset must force OCJS to initialize again on the next access.')
   101	  assert(third === instance, 'Reset must still resolve a valid OCJS instance.')
   102	}
   103	
   104	async function testGetDefaultOpenCascadeInstanceInitializesNodeOpenCascade() {
   105	  resetDefaultOpenCascadeInstanceForTests()
   106	
   107	  try {
   108	    const first = getDefaultOpenCascadeInstance()
   109	    const second = getDefaultOpenCascadeInstance()
   110	
   111	    assert(first === second, 'Default OCJS loader must memoize the in-flight initialization promise.')
   112	
   113	    const oc = await first
   114	
   115	    assert(
   116	      typeof oc.BRepBuilderAPI_MakeEdge_3 === 'function',
   117	      'Node/test OCJS initialization must expose confirmed modeling APIs from the node entry point.',
   118	    )
   119	  } finally {
   120	    resetDefaultOpenCascadeInstanceForTests()
   121	  }
   122	}
   123	
   124	await testLoadDefaultOpenCascadeFactoryUsesNodeEntryInNodeRuntime()
   125	await testLoadDefaultOpenCascadeFactoryUsesBrowserEntryOutsideNodeRuntime()
   126	await testCreateOpenCascadeInstanceLoaderCachesTheInitializedInstance()
   127	await testGetDefaultOpenCascadeInstanceInitializesNodeOpenCascade()
   128	
   129	console.log('OCC phase 1 runtime bootstrap tests passed.')


package.json
     1	{
     2	  "name": "onshape-clone",
     3	  "private": true,
     4	  "version": "0.0.0",
     5	  "type": "module",
     6	  "scripts": {
     7	    "dev": "vite --host 0.0.0.0 --port 3000",
     8	    "build": "tsc -b && vite build",
     9	    "lint": "eslint .",
    10	    "preview": "vite preview",
    11	    "test:editor-state-machine": "bun x vite-node src/contracts/editor/state-machine.spec.ts",
    12	    "test:solver-contract": "bun x vite-node src/contracts/solver/solver-contract.spec.ts",
    13	    "test:mock-kernel-contract": "bun x vite-node src/domain/modeling/mock-kernel-adapter.spec.ts",
    14	    "test:occ-phase0": "bun x vite-node src/domain/modeling/occ/implementation-policy.spec.ts",
    15	    "test:occ-phase1": "bun x vite-node src/domain/modeling/occ/runtime.spec.ts",
    16	    "test:contract-examples": "bun x vite-node src/contracts/shared/contract-examples.spec.ts"
    17	  },
    18	  "dependencies": {
    19	    "@radix-ui/react-dropdown-menu": "^2.1.16",
    20	    "@radix-ui/react-scroll-area": "^1.2.10",
    21	    "@radix-ui/react-tooltip": "^1.2.8",
    22	    "class-variance-authority": "^0.7.1",
    23	    "clsx": "^2.1.1",
    24	    "lucide-react": "^1.7.0",
    25	    "opencascade.js": "^2.0.0-beta.b5ff984",
    26	    "react": "^19.2.4",
    27	    "react-dom": "^19.2.4",
    28	    "tailwind-merge": "^3.5.0",
    29	    "three": "^0.183.2"
    30	  },
    31	  "devDependencies": {
    32	    "@eslint/js": "^9.39.4",
    33	    "@tailwindcss/vite": "^4.2.2",
    34	    "@types/node": "^24.12.2",
    35	    "@types/react": "^19.2.14",
    36	    "@types/react-dom": "^19.2.3",
    37	    "@types/three": "^0.183.1",
    38	    "@vitejs/plugin-react": "^6.0.1",
    39	    "eslint": "^9.39.4",
    40	    "eslint-plugin-react-hooks": "^7.0.1",
    41	    "eslint-plugin-react-refresh": "^0.5.2",
    42	    "globals": "^17.4.0",
    43	    "tailwindcss": "^4.2.2",
    44	    "typescript": "~6.0.2",
    45	    "typescript-eslint": "^8.58.0",
    46	    "vite": "^8.0.4"
    47	  }
    48	}

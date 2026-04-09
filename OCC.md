# OpenCascade Kernel Implementation Plan

This document is a handoff plan for implementing the modeling kernel contracts in this repository with `opencascade.js`.

It is intentionally specific.

The goal is not to change the contracts.
The goal is to implement them faithfully, report contract gaps explicitly, and keep the UI/editor/solver split intact.

## Scope

Implement the full `ModelingKernelAdapter` surface from:

- [src/contracts/modeling/adapter.ts](/app/src/contracts/modeling/adapter.ts)
- [src/contracts/modeling/schema.ts](/app/src/contracts/modeling/schema.ts)

This includes:

- `getDocumentSnapshot`
- `commitSketch`
- `createFeature`
- `updateFeature`
- `deleteFeature`
- `reorderFeature`
- `evaluatePreview`
- `resolveReference`

Feature kinds in scope:

- `plane`
- `extrude`
- `revolve`
- `fillet`

Use `opencascade.js`.
Do not infer OCC behavior from memory.
Use the official OCJS reference docs plus the installed package typings.

## Current Repository State

The repository currently has a mock-only kernel implementation:

- [src/domain/modeling/mock-kernel-adapter.ts](/app/src/domain/modeling/mock-kernel-adapter.ts)
- [src/domain/modeling/mock-kernel-adapter.spec.ts](/app/src/domain/modeling/mock-kernel-adapter.spec.ts)

The app is wired to the mock adapter:

- [src/App.tsx](/app/src/App.tsx)

The sketch solver boundary already exists and should remain separate:

- [src/contracts/solver/adapter.ts](/app/src/contracts/solver/adapter.ts)
- [src/domain/solver/mock-sketch-solver-adapter.ts](/app/src/domain/solver/mock-sketch-solver-adapter.ts)

`opencascade.js` has already been added to the repo:

- [package.json](/app/package.json)
- [bun.lock](/app/bun.lock)

There is also partial unreviewed groundwork in the repo that should be verified before reuse:

- [src/domain/modeling/occ/runtime.ts](/app/src/domain/modeling/occ/runtime.ts)
- [src/domain/modeling/opencascade-kernel-seed.ts](/app/src/domain/modeling/opencascade-kernel-seed.ts)

Do not assume these files are correct just because they exist.
Review them against the contracts and the OCJS docs before using them.

## Verified OCJS Findings

These were verified against the installed package typings in `node_modules/opencascade.js/dist/opencascade.full.d.ts` and through local runtime probes using `opencascade.js/dist/node.js`.

### Initialization

Browser entry:

- `import initOpenCascade from 'opencascade.js'`

Node/test entry:

- `import initOpenCascade from 'opencascade.js/dist/node.js'`

Important:

- The root package import failed under Node in this repo.
- The Node-specific entry worked.
- Browser-side code should use the normal browser entry.
- Node/test code should use `dist/node.js`.

### Confirmed Modeling APIs

Profile and face construction:

- `BRepBuilderAPI_MakeEdge_3(P1: gp_Pnt, P2: gp_Pnt)`
- `BRepBuilderAPI_MakeEdge_8/9/10/11` for `gp_Circ`
- `BRepBuilderAPI_MakeEdge_24+` for `Handle_Geom_Curve`
- `BRepBuilderAPI_MakeWire_*`
- `BRepBuilderAPI_MakeFace_15(Wire, OnlyPlane)`
- `BRepBuilderAPI_MakeFace_16(gp_Pln, Wire, Inside)`

Feature bodies:

- `BRepPrimAPI_MakePrism_1(S, gp_Vec, Copy, Canonize)`
- `BRepPrimAPI_MakeRevol_1(S, gp_Ax1, D, Copy)`

Fillets:

- `BRepFilletAPI_MakeFillet(shape, ChFi3d_FilletShape)`
- `Add_2(radius, edge)`

Booleans:

- `BRepAlgoAPI_Fuse_3`
- `BRepAlgoAPI_Cut_3`
- `BRepAlgoAPI_Common_3`
- `SetToFillHistory(true)`
- `History()`

Traversal and topology:

- `TopExp_Explorer_2(shape, TopAbs_ShapeEnum.TopAbs_*, TopAbs_ShapeEnum.TopAbs_SHAPE)`
- `TopExp.MapShapes_1(shape, TopAbs_ShapeEnum.TopAbs_*, TopTools_IndexedMapOfShape_1())`
- `TopoDS.Face_1`
- `TopoDS.Edge_1`
- `TopoDS.Vertex_1`
- `TopTools_IndexedMapOfShape`

Planarity and geometric inspection:

- `BRepAdaptor_Surface_2(face, true)`
- `GetType() === GeomAbs_SurfaceType.GeomAbs_Plane`
- `Plane()`
- `BRepAdaptor_Curve_2(edge)`
- `GetType()`
- `Line()`
- `Circle()`
- `Value(U)`
- `FirstParameter()`
- `LastParameter()`

Meshing and render extraction:

- `BRepMesh_IncrementalMesh_2(shape, linDeflection, isRelative, angDeflection, isParallel)`
- `BRep_Tool.Triangulation(face, location, meshPurpose)`
- `BRep_Tool.PolygonOnTriangulation_1(edge, triangulation, location)`
- `BRep_Tool.Polygon3D(edge, location)`
- `Poly_Triangulation.NbNodes()`
- `Poly_Triangulation.NbTriangles()`
- `Poly_Triangulation.Node(i)`
- `Poly_Triangulation.Triangle(i)`
- `Poly_Triangulation.HasNormals()`
- `Poly_Triangulation.Normal_1(i)`
- `TopLoc_Location.Transformation()`
- `StdPrs_ShapeTool`
- `CurrentTriangulation`
- `PolygonOnTriangulation`
- `Polygon3D`

Transforms and axes:

- `gp_Ax1_2(point, dir)`
- `gp_Ax3_3(point, normal, xdir)`
- `gp_Ax3_4(point, normal)`
- `gp_Pln`
- `gp_Trsf_1`
- `TopLoc_Location_2(trsf)`

Arc and circle helpers:

- `GC_MakeArcOfCircle_*`
- `GC_MakeCircle_*`
- `gp_Circ`
- `gp_Ax2`
- `Handle_Geom_TrimmedCurve`

## Contract Findings

These are not implementation bugs.
These are gaps or ambiguities in the current public contract that must be reported, not hidden.

### Gap 1: Construction snapshots do not expose geometric plane data

File:

- [src/contracts/modeling/schema.ts](/app/src/contracts/modeling/schema.ts)

Problem:

- `ConstructionSnapshotRecord` contains:
  - `constructionId`
  - `label`
  - `constructionType: 'plane'`
  - `target`
- It does not contain plane origin, normal, xAxis, yAxis, or any other explicit geometric plane definition.

Impact:

- A consumer cannot reconstruct a feature-created construction plane from snapshot data alone.
- This makes later sketch creation on such a plane under-specified from the public contract.
- The current mock implementation avoids this because the standard planes are hardcoded.

Required handling:

- Keep internal plane geometry in the OCC adapter.
- Do not change the contract.
- Report this gap explicitly.

### Gap 2: `RevolveAxisRef` allows `construction`, but public constructions are only planes

Files:

- [src/contracts/modeling/schema.ts](/app/src/contracts/modeling/schema.ts)

Problem:

- `RevolveAxisRef` allows `{ kind: 'construction'; constructionId }`.
- Public construction snapshots only model `constructionType: 'plane'`.
- There is no public axis/line construction type.

Impact:

- A revolve “construction axis” is not actually representable from the current contract.
- Any implementation that invents semantics here would be guessing.

Required handling:

- Do not invent hidden semantics.
- Treat this as a contract issue.
- Support edge-backed axes.
- For construction-backed axes, either:
  - reject explicitly with structured diagnostics, or
  - document an internal-only convention very clearly if product owners approve it later.

Current recommendation:

- Reject `axis.kind === 'construction'` and report this gap.

### Gap 3: Projected geometry in committed region loops is not reconstructible

Files:

- [src/contracts/sketch/schema.ts](/app/src/contracts/sketch/schema.ts)

Problem:

- `RegionBoundarySegmentRecord.source` can be `{ kind: 'projectedGeometry'; reference: ProjectedSketchGeometryRef }`.
- `SketchRecord` does not persist the actual projected geometry payloads required to rebuild such segments later.

Impact:

- A later `extrude` or `revolve` from a committed region may not be reconstructible from committed snapshot data alone if that region depends on projected geometry.

Required handling:

- Support entity-backed region loops first.
- Reject or fail explicitly when a region loop requires projected geometry reconstruction that is not available.
- Report the contract gap.

### Ambiguity 4: Multi-body boolean semantics are not fully explicit

Files:

- [src/contracts/modeling/schema.ts](/app/src/contracts/modeling/schema.ts)

Problem:

- `FeatureBooleanScope.kind === 'targetBodies'` provides an ordered body set.
- The exact semantics for `join`, `cut`, and `intersect` across multiple bodies are not fully spelled out.

Impact:

- Different kernels could interpret multi-body boolean scope differently.

Required handling:

- Pick one explicit policy and document it in implementation comments and tests.
- Do not silently rely on OCC defaults without documenting the chosen policy.

Recommended default:

- `join`: fuse the feature solid into the selected bodies sequentially in the supplied order.
- `cut`: subtract the feature solid from each selected body individually.
- `intersect`: intersect the feature solid with each selected body individually.

If this policy is adopted, encode it explicitly in tests.

## Non-Negotiables

- Do not modify the contracts.
- Do not mix solver responsibilities into the kernel.
- Do not infer construction axes from planes.
- Do not claim `supportsDurableTopologyNaming: true` unless a real naming/remap layer exists.
- Do not use viewport-only render data as kernel truth.
- Do not silently remap invalid references.
- Use structured diagnostics and explicit rejection where the contract requires it.

## High-Level Architecture

Implement a new OCC-backed in-memory kernel adapter.

Recommended class:

- `OpenCascadeKernelAdapter`

Recommended location:

- [src/domain/modeling/](/app/src/domain/modeling/)

The authoritative document state should be:

- committed sketches
- committed feature definitions
- static datum constructions
- revision metadata

On each accepted mutation:

1. Build a tentative next authoring state.
2. Rebuild the OCC model from that state.
3. If the rebuild succeeds, commit the state and revision.
4. If the rebuild fails, reject explicitly with diagnostics.

Do not mutate the viewport or UI directly.
Only produce modeling contract responses.

## Proposed Module Split

Recommended modules:

- `src/domain/modeling/occ/runtime.ts`
  - browser/node OCJS init
  - loader caching
- `src/domain/modeling/occ/math.ts`
  - vector helpers
  - frame conversions
  - transform helpers
- `src/domain/modeling/occ/planes.ts`
  - construction plane registry
  - face-to-plane extraction
  - `SketchPlaneDefinition` to OCC conversions
- `src/domain/modeling/occ/profiles.ts`
  - sketch region to OCC wire/face conversion
  - line/circle/arc edge builders
  - hole loop handling
- `src/domain/modeling/occ/features.ts`
  - plane
  - extrude
  - revolve
  - fillet
  - boolean application
- `src/domain/modeling/occ/topology.ts`
  - body/face/edge/vertex enumeration
  - OCC history-assisted remap helpers
  - reference lookup tables
- `src/domain/modeling/occ/render.ts`
  - face meshing
  - edge polyline extraction
  - vertex markers
  - sketch renderables
  - construction renderables
- `src/domain/modeling/opencascade-kernel-adapter.ts`
  - public adapter implementation
- `src/domain/modeling/opencascade-kernel-seed.ts`
  - bootstrapping only

## Phase Plan

### Phase 0: Contract Audit and Red Lines

Goal:

- Freeze what can and cannot be implemented without changing contracts.

Tasks:

- Re-read:
  - [src/contracts/modeling/schema.ts](/app/src/contracts/modeling/schema.ts)
  - [src/contracts/sketch/schema.ts](/app/src/contracts/sketch/schema.ts)
  - [src/contracts/render/schema.ts](/app/src/contracts/render/schema.ts)
  - [src/contracts/solver/adapter.ts](/app/src/contracts/solver/adapter.ts)
- Record the contract gaps listed above in code comments and implementation notes.
- Decide explicit behavior for:
  - construction-backed revolve axes
  - projected-geometry region loops
  - multi-body boolean scope

Exit criteria:

- There is a written implementation policy for every ambiguous area.

### Phase 1: OCC Bootstrap Layer

Goal:

- Provide a safe, lazy loader for OCJS in browser and node/test.

Tasks:

- Verify or replace [src/domain/modeling/occ/runtime.ts](/app/src/domain/modeling/occ/runtime.ts).
- Ensure:
  - browser uses `opencascade.js`
  - node/test uses `opencascade.js/dist/node.js`
- Export a cached `getDefaultOpenCascadeInstance()`.
- Add small helper types for the loaded OCJS instance if needed.

Exit criteria:

- Both browser and node paths compile.
- Node tests can initialize OCC.

### Phase 2: Plane and Frame Utilities

Goal:

- Convert contract plane data into OCC geometry consistently.

Tasks:

- Implement helpers for:
  - `SketchPlaneFrame -> gp_Ax3`
  - `SketchPlaneFrame -> gp_Pln`
  - `gp_Ax1` from frame origin + normal
  - world/sketch-space point transforms
- Implement planar-face extraction using:
  - `BRepAdaptor_Surface_2`
  - `GetType()`
  - `Plane()`
- Preserve:
  - origin
  - normal
  - xAxis
  - yAxis

Exit criteria:

- Datum planes and planar faces can be represented internally as exact OCC planes plus explicit frame data.

### Phase 3: Sketch Profile Construction

Goal:

- Turn committed sketch regions into OCC wires and planar faces.

Tasks:

- For entity-backed loop segments:
  - line -> `BRepBuilderAPI_MakeEdge_3`
  - circle -> `gp_Circ` + `BRepBuilderAPI_MakeEdge_*`
  - arc -> `GC_MakeArcOfCircle_*` to a trimmed curve handle, then edge
- Build loop wires with `BRepBuilderAPI_MakeWire`.
- Build planar faces with:
  - `BRepBuilderAPI_MakeFace_16(gp_Pln, outerWire, true)`
  - add inner wires for holes
- Validate:
  - loop closure
  - supported segment sources
  - region ownership

Important:

- Do not assume region loops are always rectangles.
- Do not assume only outer loops exist.

Exit criteria:

- A committed closed region can be converted into a valid OCC face.

### Phase 4: Feature Execution

Goal:

- Implement the feature families with OCC.

#### Phase 4A: Plane

Tasks:

- Resolve source plane from:
  - construction plane
  - planar face
- Create an internal construction plane record.
- Produce:
  - `ConstructionSnapshotRecord`
  - entity rows
  - render geometry for visualization

Important:

- This is a contract-plane duplication operation because current plane parameters only support `mode: 'coplanar'`.

#### Phase 4B: Extrude

Tasks:

- Resolve profile from:
  - sketch region
  - planar face
- Validate:
  - `startExtent.kind === 'profilePlane'`
  - positive `endExtent.distance`
  - explicit boolean scope is compatible with operation
- Use `BRepPrimAPI_MakePrism_1`.
- Apply boolean policy:
  - `newBody`
  - `join`
  - `cut`
  - `intersect`

#### Phase 4C: Revolve

Tasks:

- Resolve profile from region or planar face.
- Resolve axis from edge only.
- Validate edge-backed axis is linear via `BRepAdaptor_Curve_2(...).GetType()`.
- Apply `startAngle` by rotating the profile before the sweep.
- Use `BRepPrimAPI_MakeRevol_1`.
- Apply boolean policy.

Important:

- `axis.kind === 'construction'` is a contract gap.
- Reject explicitly unless the contract is expanded later.
- `BRepPrimAPI_MakeRevol_1` does not provide a start-angle parameter, so `startAngle` must be implemented with an explicit pre-rotation transform before building the revolve.

#### Phase 4D: Fillet

Tasks:

- Group edge targets by owning body.
- For each body:
  - instantiate `BRepFilletAPI_MakeFillet`
  - add edges with `Add_2(radius, edge)`
  - `Build()`
- Replace the affected body result.

Exit criteria:

- All feature kinds can be evaluated against live authoring state.

### Phase 5: Topology and Reference Layer

Goal:

- Produce body/topology ids, live lookup maps, and invalidation behavior.

Tasks:

- Enumerate solids/bodies from result shapes.
- Enumerate faces, edges, and vertices with `TopExp_Explorer_2`.
- Maintain:
  - body records
  - lookup maps by durable ref key
  - ownership metadata
- Use OCC history when available:
  - `Generated`
  - `Modified`
  - `IsDeleted`
  - `History()`

Identity policy:

- Preserve sketch, feature, and construction ids directly.
- Preserve body ids when ownership is still unambiguous.
- Do not overclaim stable face/edge/vertex ids across topology-changing edits.
- Keep `supportsDurableTopologyNaming: false` unless a stronger remap layer is implemented.

Exit criteria:

- `resolveReference` can answer live/missing state for the current revision.

### Phase 6: Snapshot and Render Export

Goal:

- Produce full modeling snapshots from the rebuilt OCC state.

Tasks:

- Build:
  - feature tree
  - object tree
  - sketches
  - features
  - bodies
  - constructions
  - entities
  - references
  - diagnostics
  - render export

Render extraction:

- Faces:
  - `BRepMesh_IncrementalMesh_2`
  - `BRep_Tool.Triangulation`
  - `Poly_Triangulation.Node/Triangle/Normal_1`
  - apply `TopLoc_Location.Transformation()` to exported node positions
- Edges:
  - `BRep_Tool.PolygonOnTriangulation_1`
  - fallback `BRep_Tool.Polygon3D`
  - fallback analytic sampling from `BRepAdaptor_Curve_2`
- Vertices:
  - `BRep_Tool.Pnt` or equivalent vertex point extraction
- Sketch geometry:
  - derive from solved sketch state and plane frame
- Construction planes:
  - finite visual outline or finite mesh patch for display

Selection semantics:

- planar faces must mark `planarFace`
- constructions must mark `constructionPlane` and `planarReference`
- sketches and sketch primitives must remain non-topological render bindings

Exit criteria:

- `getDocumentSnapshot` returns a full contract-valid workspace snapshot.

### Phase 7: Adapter Methods

Goal:

- Implement the public modeling kernel boundary.

Tasks:

- `getDocumentSnapshot`
  - return authoritative current snapshot
- `commitSketch`
  - use existing solver boundary
  - commit solved sketch state
  - rebuild OCC state
- `createFeature`
  - validate
  - tentatively rebuild
  - commit on success
- `updateFeature`
  - same pattern
- `deleteFeature`
  - same pattern
- `reorderFeature`
  - same pattern
- `evaluatePreview`
  - evaluate transient feature result against current/tentative state
  - return stale/fresh accurately
- `resolveReference`
  - resolve against current lookup tables
  - never silently remap

Conflict semantics:

- If `baseRevisionId !== currentRevisionId`, return explicit conflict.

Validation semantics:

- Reject invalid requests before commit.

Rebuild semantics:

- Prefer tentative rebuild before commit.
- If a tentative rebuild fails because downstream refs go invalid, reject explicitly with structured diagnostics.

Exit criteria:

- The adapter satisfies the full `ModelingKernelAdapter` interface without changing contracts.

### Phase 8: Tests

Goal:

- Prove the OCC adapter honors the contracts and the chosen implementation policies.

Tests to add:

- snapshot fetch works and exposes a valid render export
- accepted sketch commit mutates committed snapshot
- plane feature create succeeds for construction-backed and planar-face-backed coplanar planes
- extrude preview returns renderables and diagnostics correctly
- extrude create/update commit geometry
- revolve preview/create works for edge-backed axes
- revolve construction-axis request rejects explicitly with structured diagnostics
- fillet create/update mutates body topology
- delete removes feature and rebuilds snapshot
- reorder changes feature order and rebuilds
- stale preview reports current revision
- resolveReference reports explicit invalidation for missing refs

Also add tests for the documented gaps/policies:

- construction plane snapshots do not expose enough geometry for reconstruction
- projected-geometry region loops are rejected or surfaced as unsupported
- multi-body boolean policy behaves exactly as documented

### Phase 9: App Integration

Goal:

- Swap the app from the mock kernel to the OCC kernel once contract tests pass.

Tasks:

- Update [src/App.tsx](/app/src/App.tsx) to instantiate the OCC adapter.
- Keep the sketch solver boundary separate.
- Do not mix UI logic into the kernel layer.

Optional:

- keep the mock adapter around for comparison
- add a dedicated test script for the OCC adapter

## Recommended Seed State

The repo already contains a partial seed helper:

- [src/domain/modeling/opencascade-kernel-seed.ts](/app/src/domain/modeling/opencascade-kernel-seed.ts)

Recommended bootstrap:

1. datum constructions:
   - XY
   - YZ
   - XZ
2. one rectangle sketch on XY
3. one extrude from the primary region
4. optional seed fillet only after edge ids are known from the rebuilt body

Important:

- Do not hardcode seed edge ids before the actual OCC topology is enumerated.

## Validation Checklist

Before considering the adapter complete, verify:

- all adapter methods are implemented
- all four feature kinds are covered
- stale preview behavior is explicit
- revision conflict behavior is explicit
- invalid references never silently remap
- render bindings use canonical durable refs
- face-backed sketch planes validate planarity using OCC
- construction-backed revolve axes are not silently invented
- `supportsDurableTopologyNaming` is honest

## References

Primary docs:

- https://ocjs.org/reference-docs
- https://ocjs.org/docs/getting-started/configure-bundler

Local primary sources:

- `/app/node_modules/opencascade.js/dist/opencascade.full.d.ts`
- `/app/node_modules/opencascade.js/dist/node.d.ts`
- `/app/node_modules/opencascade.js/starter-templates/ocjs-node/index.js`
- `/app/node_modules/opencascade.js/starter-templates/ocjs-create-react-app-typescript/src/App.tsx`

Contract files:

- [src/contracts/modeling/schema.ts](/app/src/contracts/modeling/schema.ts)
- [src/contracts/modeling/adapter.ts](/app/src/contracts/modeling/adapter.ts)
- [src/contracts/sketch/schema.ts](/app/src/contracts/sketch/schema.ts)
- [src/contracts/render/schema.ts](/app/src/contracts/render/schema.ts)
- [src/contracts/solver/adapter.ts](/app/src/contracts/solver/adapter.ts)

## Final Notes for the Implementing Agent

- Start by reviewing the two partial files already added in the repo.
- Do not trust them blindly.
- Do not change the contracts to make implementation easier.
- If a contract gap blocks a faithful implementation, preserve the contract, reject explicitly, and document the limitation.
- Keep the solver boundary separate from the OCC kernel.
- Build the implementation around authoritative document state and deterministic rebuilds, not around UI events.

import type {
  RegionRecord,
  SolvedSketchEntityGeometryRecord,
  SketchRecord,
} from '@/contracts/sketch/schema'
import type { FaceId } from '@/contracts/shared/ids'
import type { SketchPlaneDefinition } from '@/contracts/shared/sketch-plane'
import type { OpenCascadeInstance } from '@/domain/modeling/occ/runtime'
import {
  createPlaneAxes,
  mapSketchPointToWorld,
  midpointOnArc,
  negate,
  toGpDir,
  toGpPlane,
  toGpPnt,
  type Vec3,
} from '@/domain/modeling/occ/geometry'
import {
  getProjectedRegionLoopRejectionMessage,
  isProjectedRegionSegmentSourceSupported,
} from '@/domain/modeling/occ/implementation-policy'

export interface BuiltSketchProfileFace {
  face: InstanceType<OpenCascadeInstance['TopoDS_Face']>
  plane: SketchPlaneDefinition
  normal: Vec3
}

function getSolvedEntityGeometry(
  sketch: SketchRecord,
  entityId: string,
): SolvedSketchEntityGeometryRecord {
  const geometry = sketch.solvedSnapshot.solvedEntities.find((entry) => entry.entityId === entityId)

  if (!geometry) {
    throw new Error(`Sketch entity ${entityId} does not resolve in solved geometry.`)
  }

  return geometry
}

function buildLineEdge(
  oc: OpenCascadeInstance,
  plane: SketchPlaneDefinition,
  geometry: Extract<SolvedSketchEntityGeometryRecord, { kind: 'lineSegment' }>,
) {
  const start = toGpPnt(oc, mapSketchPointToWorld(plane, geometry.startPosition))
  const end = toGpPnt(oc, mapSketchPointToWorld(plane, geometry.endPosition))
  const builder = new oc.BRepBuilderAPI_MakeEdge_3(start, end)
  return builder.Edge()
}

function buildCircleEdge(
  oc: OpenCascadeInstance,
  plane: SketchPlaneDefinition,
  geometry: Extract<SolvedSketchEntityGeometryRecord, { kind: 'circle' }>,
) {
  const { axis } = createPlaneAxes(oc, plane)
  const circle = new oc.gp_Circ_2(axis.Ax2(), geometry.solvedRadius)
  const builder = new oc.BRepBuilderAPI_MakeEdge_8(circle)
  return builder.Edge()
}

function buildArcEdge(
  oc: OpenCascadeInstance,
  plane: SketchPlaneDefinition,
  geometry: Extract<SolvedSketchEntityGeometryRecord, { kind: 'arc' }>,
) {
  const start = mapSketchPointToWorld(plane, geometry.startPosition)
  const end = mapSketchPointToWorld(plane, geometry.endPosition)
  const midpoint = midpointOnArc(
    start,
    end,
    mapSketchPointToWorld(plane, geometry.centerPosition),
    plane.frame.normal,
    geometry.sweepDirection,
  )
  const arc = new oc.GC_MakeArcOfCircle_4(
    toGpPnt(oc, start),
    toGpPnt(oc, midpoint),
    toGpPnt(oc, end),
  )

  if (!arc.IsDone()) {
    throw new Error(`Failed to build OCC arc for sketch entity ${geometry.entityId}.`)
  }

  const builder = new oc.BRepBuilderAPI_MakeEdge_24(arc.Value())
  return builder.Edge()
}

function buildLoopWire(
  oc: OpenCascadeInstance,
  plane: SketchPlaneDefinition,
  sketch: SketchRecord,
  loop: RegionRecord['loops'][number],
) {
  const wireBuilder = new oc.BRepBuilderAPI_MakeWire_1()

  for (const segment of loop.segments) {
    // Phase 0 red line: committed sketch payloads do not preserve enough
    // projected-geometry data to rebuild OCC profile wires faithfully.
    if (!isProjectedRegionSegmentSourceSupported(segment.source)) {
      throw new Error(getProjectedRegionLoopRejectionMessage(segment.source))
    }

    const geometry = getSolvedEntityGeometry(sketch, segment.source.entityId)
    switch (geometry.kind) {
      case 'lineSegment':
        wireBuilder.Add_1(buildLineEdge(oc, plane, geometry))
        break
      case 'circle':
        wireBuilder.Add_1(buildCircleEdge(oc, plane, geometry))
        break
      case 'arc':
        wireBuilder.Add_1(buildArcEdge(oc, plane, geometry))
        break
      case 'point':
        throw new Error(`Point entity ${geometry.entityId} cannot define a profile boundary.`)
    }
  }

  if (!wireBuilder.IsDone()) {
    throw new Error(`Failed to build OCC wire for region loop ${loop.loopId}.`)
  }

  return wireBuilder.Wire()
}

export function buildRegionProfileFace(
  oc: OpenCascadeInstance,
  snapshotSketch: { plane: SketchPlaneDefinition; sketch: SketchRecord },
  region: RegionRecord,
): BuiltSketchProfileFace {
  const outerLoop = region.loops.find((loop) => loop.role === 'outer')

  if (!outerLoop) {
    throw new Error(`Region ${region.regionId} does not contain an outer loop.`)
  }

  const plane = snapshotSketch.plane
  const planeShape = toGpPlane(oc, plane)
  const outerWire = buildLoopWire(oc, plane, snapshotSketch.sketch, outerLoop)
  const faceBuilder = new oc.BRepBuilderAPI_MakeFace_16(planeShape, outerWire, true)

  for (const innerLoop of region.loops.filter((loop) => loop.role === 'inner')) {
    faceBuilder.Add(buildLoopWire(oc, plane, snapshotSketch.sketch, innerLoop))
  }

  if (!faceBuilder.IsDone()) {
    throw new Error(`Failed to build OCC face for region ${region.regionId}.`)
  }

  return {
    face: faceBuilder.Face(),
    plane,
    normal: plane.frame.normal,
  }
}

export function getExtrusionNormalForSketchProfile(
  plane: SketchPlaneDefinition,
  direction: 'positive' | 'negative',
): Vec3 {
  return direction === 'positive' ? plane.frame.normal : negate(plane.frame.normal)
}

export function getExtrusionNormalForPlanarFace(
  oc: OpenCascadeInstance,
  face: InstanceType<OpenCascadeInstance['TopoDS_Face']>,
  direction: 'positive' | 'negative',
) {
  const surface = new oc.BRepAdaptor_Surface_2(face, true)

  if (surface.GetType() !== oc.GeomAbs_SurfaceType.GeomAbs_Plane) {
    throw new Error('Face-backed profile requires a planar face.')
  }

  const plane = surface.Plane()
  const normal = [
    plane.Axis().Direction().X(),
    plane.Axis().Direction().Y(),
    plane.Axis().Direction().Z(),
  ] as Vec3
  return direction === 'positive' ? normal : negate(normal)
}

export function buildConstructionPlaneFromPlanarFace(
  oc: OpenCascadeInstance,
  face: InstanceType<OpenCascadeInstance['TopoDS_Face']>,
  faceId: FaceId,
  support: SketchPlaneDefinition['support'],
): SketchPlaneDefinition {
  const surface = new oc.BRepAdaptor_Surface_2(face, true)

  if (surface.GetType() !== oc.GeomAbs_SurfaceType.GeomAbs_Plane) {
    throw new Error(`Face ${faceId} is not planar.`)
  }

  const plane = surface.Plane()
  return {
    support,
    frame: {
      origin: [
        plane.Location().X(),
        plane.Location().Y(),
        plane.Location().Z(),
      ],
      xAxis: [
        plane.Position().XDirection().X(),
        plane.Position().XDirection().Y(),
        plane.Position().XDirection().Z(),
      ],
      yAxis: [
        plane.Position().YDirection().X(),
        plane.Position().YDirection().Y(),
        plane.Position().YDirection().Z(),
      ],
      normal: [
        plane.Axis().Direction().X(),
        plane.Axis().Direction().Y(),
        plane.Axis().Direction().Z(),
      ],
      linearUnit: 'documentLength',
      handedness: 'rightHanded',
    },
    key: null,
  }
}

export function buildAxisFromLineEdge(
  oc: OpenCascadeInstance,
  edge: InstanceType<OpenCascadeInstance['TopoDS_Edge']>,
) {
  const curve = new oc.BRepAdaptor_Curve_2(edge)

  if (curve.GetType() !== oc.GeomAbs_CurveType.GeomAbs_Line) {
    throw new Error('Revolve axis edges must resolve to linear OCC edges.')
  }

  return curve.Line().Position()
}

export function buildCircleAxis(
  oc: OpenCascadeInstance,
  plane: SketchPlaneDefinition,
  center: Vec3,
  radius: number,
) {
  const normal = toGpDir(oc, plane.frame.normal)
  return new oc.GC_MakeCircle_6(toGpPnt(oc, center), normal, radius)
}

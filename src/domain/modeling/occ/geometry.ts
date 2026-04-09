import type { SketchPlaneDefinition } from '@/contracts/shared/sketch-plane'
import type { SketchPoint2D } from '@/contracts/sketch/schema'
import type { OpenCascadeInstance } from '@/domain/modeling/occ/runtime'

export type Vec3 = readonly [number, number, number]

function scale(vector: Vec3, scalar: number): Vec3 {
  return [vector[0] * scalar, vector[1] * scalar, vector[2] * scalar]
}

function add(left: Vec3, right: Vec3): Vec3 {
  return [left[0] + right[0], left[1] + right[1], left[2] + right[2]]
}

export function dot(left: Vec3, right: Vec3) {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2]
}

export function cross(left: Vec3, right: Vec3): Vec3 {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0],
  ]
}

export function magnitude(vector: Vec3) {
  return Math.hypot(vector[0], vector[1], vector[2])
}

export function normalize(vector: Vec3): Vec3 {
  const length = magnitude(vector)

  if (length === 0) {
    throw new Error('Cannot normalize a zero-length vector.')
  }

  return [vector[0] / length, vector[1] / length, vector[2] / length]
}

export function negate(vector: Vec3): Vec3 {
  return [-vector[0], -vector[1], -vector[2]]
}

export function mapSketchPointToWorld(
  plane: SketchPlaneDefinition,
  point: SketchPoint2D,
): Vec3 {
  return add(
    plane.frame.origin,
    add(scale(plane.frame.xAxis, point[0]), scale(plane.frame.yAxis, point[1])),
  )
}

export function toGpPnt(
  oc: OpenCascadeInstance,
  point: Vec3,
) {
  return new oc.gp_Pnt_3(point[0], point[1], point[2])
}

export function toGpDir(
  oc: OpenCascadeInstance,
  vector: Vec3,
) {
  const unit = normalize(vector)
  return new oc.gp_Dir_4(unit[0], unit[1], unit[2])
}

export function toGpVec(
  oc: OpenCascadeInstance,
  vector: Vec3,
) {
  return new oc.gp_Vec_4(vector[0], vector[1], vector[2])
}

export function createPlaneAxes(
  oc: OpenCascadeInstance,
  plane: SketchPlaneDefinition,
) {
  const origin = toGpPnt(oc, plane.frame.origin)
  const normal = toGpDir(oc, plane.frame.normal)
  const xDirection = toGpDir(oc, plane.frame.xAxis)
  const axis = new oc.gp_Ax3_3(origin, normal, xDirection)
  return {
    origin,
    normal,
    xDirection,
    axis,
  }
}

export function toGpPlane(
  oc: OpenCascadeInstance,
  plane: SketchPlaneDefinition,
) {
  const { axis } = createPlaneAxes(oc, plane)
  return new oc.gp_Pln_2(axis)
}

export function toVec3FromGpPoint(point: { X(): number; Y(): number; Z(): number }): Vec3 {
  return [point.X(), point.Y(), point.Z()]
}

export function midpointOnArc(
  startPoint: Vec3,
  endPoint: Vec3,
  centerPoint: Vec3,
  planeNormal: Vec3,
  sweepDirection: 'clockwise' | 'counterClockwise',
): Vec3 {
  const startVector = normalize([
    startPoint[0] - centerPoint[0],
    startPoint[1] - centerPoint[1],
    startPoint[2] - centerPoint[2],
  ])
  const endVector = normalize([
    endPoint[0] - centerPoint[0],
    endPoint[1] - centerPoint[1],
    endPoint[2] - centerPoint[2],
  ])
  let cosine = dot(startVector, endVector)
  cosine = Math.max(-1, Math.min(1, cosine))
  let sweep = Math.acos(cosine)
  const orientation = dot(cross(startVector, endVector), planeNormal)

  if (sweepDirection === 'counterClockwise') {
    if (orientation < 0) {
      sweep = Math.PI * 2 - sweep
    }
  } else if (orientation > 0) {
    sweep = Math.PI * 2 - sweep
  }

  const halfSweep = sweep / 2
  const tangentDirection = sweepDirection === 'counterClockwise'
    ? normalize(cross(planeNormal, startVector))
    : normalize(cross(startVector, planeNormal))
  const midVector = normalize(add(scale(startVector, Math.cos(halfSweep)), scale(tangentDirection, Math.sin(halfSweep))))
  const radius = magnitude([
    startPoint[0] - centerPoint[0],
    startPoint[1] - centerPoint[1],
    startPoint[2] - centerPoint[2],
  ])

  return add(centerPoint, scale(midVector, radius))
}

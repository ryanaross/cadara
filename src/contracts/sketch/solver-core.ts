import type {
  ConstraintStatusRecord,
  DimensionStatusRecord,
  SketchDefinition,
  SketchEntityDefinition,
  SketchPoint2D,
  SketchSolveDiagnostic,
  SolvedSketchEntityGeometryRecord,
  SolvedSketchSnapshot,
  SolvedSketchStatus,
} from '@/contracts/sketch/schema'
import {
  SOLVED_SKETCH_SCHEMA_VERSION,
} from '@/contracts/sketch/schema'
import type { SolverPartialSolvePolicy } from '@/contracts/solver/schema'
import type {
  ConstraintId,
  DimensionId,
  SketchEntityId,
  SketchPointId,
} from '@/contracts/shared/ids'

export interface SketchSolveTolerancePolicy {
  coincidence: number
  angleRadians: number
  minimumSegmentLength: number
}

export interface SketchCoreSolveResult {
  status: SolvedSketchStatus
  solvedSnapshot: SolvedSketchSnapshot
  diagnostics: SketchSolveDiagnostic[]
}

export type SketchSolveStrategy =
  | 'bfgs'
  | 'gradientDescent'
  | 'gaussNewton'
  | 'levenbergMarquardt'

export interface SketchCoreValidationResult {
  isValid: boolean
  diagnostics: SketchSolveDiagnostic[]
}

type PointState = {
  kind: 'point'
  pointId: SketchPointId
  label: string
  baseIndex: number
}

type ArcState = {
  kind: 'arc'
  entityId: SketchEntityId
  baseIndex: number
}

type SolverEntityState = PointState | ArcState

type ScalarConstraintEvaluation = {
  residual: number
  gradient: Float64Array
}

type ScalarConstraintRecord = {
  id: ConstraintId | DimensionId
  targetKind: 'constraint' | 'dimension'
  evaluate(values: Float64Array): ScalarConstraintEvaluation
}

type ConstraintEvaluationRecord = {
  id: ConstraintId | DimensionId
  targetKind: 'constraint' | 'dimension'
  residual: number
  gradient: Float64Array
}

type SolverPointRecord = {
  pointId: SketchPointId
  initial: SketchPoint2D
  baseIndex: number
}

type BuildSystemResult = {
  parameterCount: number
  initialValues: Float64Array
  pointRecords: Map<SketchPointId, SolverPointRecord>
  entityStates: Map<SketchEntityId, SolverEntityState>
  scalarConstraints: ScalarConstraintRecord[]
}

const WOLFE_C1 = 1e-4
const WOLFE_C2 = 0.9
const LINE_SEARCH_MAX_ITERATIONS = 15

function cloneValues(values: Float64Array) {
  return new Float64Array(values)
}

function makeDiagnostic(
  code: string,
  severity: SketchSolveDiagnostic['severity'],
  message: string,
  target: SketchSolveDiagnostic['target'],
): SketchSolveDiagnostic {
  return { code, severity, message, target }
}

function zeroVector(length: number) {
  return new Float64Array(length)
}

function addScaled(target: Float64Array, scale: number, source: Float64Array) {
  for (let index = 0; index < target.length; index += 1) {
    target[index] += scale * source[index]!
  }
}

function dot(left: Float64Array, right: Float64Array) {
  let value = 0
  for (let index = 0; index < left.length; index += 1) {
    value += left[index]! * right[index]!
  }
  return value
}

function euclideanNorm(values: Float64Array) {
  return Math.sqrt(dot(values, values))
}

function getPoint(values: Float64Array, point: SolverPointRecord): SketchPoint2D {
  return [values[point.baseIndex]!, values[point.baseIndex + 1]!] as const
}

function getArcParameters(values: Float64Array, arc: ArcState) {
  return {
    radius: values[arc.baseIndex]!,
    startAngle: values[arc.baseIndex + 1]!,
    endAngle: values[arc.baseIndex + 2]!,
  }
}

function subtract(left: SketchPoint2D, right: SketchPoint2D): SketchPoint2D {
  return [left[0] - right[0], left[1] - right[1]]
}

function add(left: SketchPoint2D, right: SketchPoint2D): SketchPoint2D {
  return [left[0] + right[0], left[1] + right[1]]
}

function length(point: SketchPoint2D) {
  return Math.hypot(point[0], point[1])
}

function addPointGradient(
  gradient: Float64Array,
  point: SolverPointRecord,
  x: number,
  y: number,
) {
  gradient[point.baseIndex] += x
  gradient[point.baseIndex + 1] += y
}

function buildSystem(definition: SketchDefinition): BuildSystemResult {
  const pointRecords = new Map<SketchPointId, SolverPointRecord>()
  const entityStates = new Map<SketchEntityId, SolverEntityState>()
  const scalarConstraints: ScalarConstraintRecord[] = []

  let parameterCount = 0
  for (const point of definition.points) {
    pointRecords.set(point.pointId, {
      pointId: point.pointId,
      initial: point.position,
      baseIndex: parameterCount,
    })
    parameterCount += 2
  }

  for (const entity of definition.entities) {
    if (entity.kind === 'arc') {
      const center = pointRecords.get(entity.centerPointId)
      const start = pointRecords.get(entity.startPointId)
      const end = pointRecords.get(entity.endPointId)
      if (!center || !start || !end) {
        continue
      }

      const centerPos = center.initial
      const startVector = subtract(start.initial, centerPos)
      const endVector = subtract(end.initial, centerPos)
      entityStates.set(entity.entityId, {
        kind: 'arc',
        entityId: entity.entityId,
        baseIndex: parameterCount,
      })
      parameterCount += 3

      void startVector
      void endVector
    }
  }

  const initialValues = new Float64Array(parameterCount)
  for (const record of pointRecords.values()) {
    initialValues[record.baseIndex] = record.initial[0]
    initialValues[record.baseIndex + 1] = record.initial[1]
  }

  for (const entity of definition.entities) {
    if (entity.kind !== 'arc') {
      continue
    }
    const arcState = entityStates.get(entity.entityId)
    const center = pointRecords.get(entity.centerPointId)
    const start = pointRecords.get(entity.startPointId)
    const end = pointRecords.get(entity.endPointId)
    if (!arcState || arcState.kind !== 'arc' || !center || !start || !end) {
      continue
    }

    const centerPos = center.initial
    const startOffset = subtract(start.initial, centerPos)
    const endOffset = subtract(end.initial, centerPos)
    initialValues[arcState.baseIndex] = Math.max(length(startOffset), 1e-9)
    initialValues[arcState.baseIndex + 1] = Math.atan2(startOffset[1], startOffset[0])
    initialValues[arcState.baseIndex + 2] = Math.atan2(endOffset[1], endOffset[0])
  }

  const lineEntityMap = new Map(
    definition.entities
      .filter((entity): entity is Extract<SketchEntityDefinition, { kind: 'lineSegment' }> => entity.kind === 'lineSegment')
      .map((entity) => [entity.entityId, entity]),
  )
  const arcEntityMap = new Map(
    definition.entities
      .filter((entity): entity is Extract<SketchEntityDefinition, { kind: 'arc' }> => entity.kind === 'arc')
      .map((entity) => [entity.entityId, entity]),
  )

  for (const constraint of definition.constraints) {
    if (constraint.kind === 'coincident') {
      const left = pointRecords.get(constraint.pointIds[0])
      const right = pointRecords.get(constraint.pointIds[1])
      if (!left || !right) {
        continue
      }

      scalarConstraints.push({
        id: constraint.constraintId,
        targetKind: 'constraint',
        evaluate(values) {
          const gradient = zeroVector(parameterCount)
          const a = getPoint(values, left)
          const b = getPoint(values, right)
          const delta = subtract(a, b)
          addPointGradient(gradient, left, delta[0], delta[1])
          addPointGradient(gradient, right, -delta[0], -delta[1])
          return { residual: 0.5 * (delta[0] * delta[0] + delta[1] * delta[1]), gradient }
        },
      })
      continue
    }

    if (constraint.kind === 'horizontal' || constraint.kind === 'vertical') {
      const line = lineEntityMap.get(constraint.entityId)
      if (!line) {
        continue
      }
      const start = pointRecords.get(line.startPointId)
      const end = pointRecords.get(line.endPointId)
      if (!start || !end) {
        continue
      }

      scalarConstraints.push({
        id: constraint.constraintId,
        targetKind: 'constraint',
        evaluate(values) {
          const gradient = zeroVector(parameterCount)
          const a = getPoint(values, start)
          const b = getPoint(values, end)
          if (constraint.kind === 'horizontal') {
            const dy = b[1] - a[1]
            addPointGradient(gradient, start, 0, -dy)
            addPointGradient(gradient, end, 0, dy)
            return { residual: 0.5 * dy * dy, gradient }
          }

          const dx = b[0] - a[0]
          addPointGradient(gradient, start, -dx, 0)
          addPointGradient(gradient, end, dx, 0)
          return { residual: 0.5 * dx * dx, gradient }
        },
      })
      continue
    }

    if (constraint.kind === 'fixPoint') {
      const point = pointRecords.get(constraint.pointId)
      if (!point) {
        continue
      }

      scalarConstraints.push({
        id: constraint.constraintId,
        targetKind: 'constraint',
        evaluate(values) {
          const gradient = zeroVector(parameterCount)
          const actual = getPoint(values, point)
          const delta = subtract(actual, constraint.position)
          addPointGradient(gradient, point, delta[0], delta[1])
          return { residual: 0.5 * (delta[0] * delta[0] + delta[1] * delta[1]), gradient }
        },
      })
      continue
    }

    if (constraint.kind === 'angle') {
      const point1 = pointRecords.get(constraint.pointIds[0])
      const point2 = pointRecords.get(constraint.pointIds[1])
      const middle = pointRecords.get(constraint.pointIds[2])
      if (!point1 || !point2 || !middle) {
        continue
      }

      scalarConstraints.push({
        id: constraint.constraintId,
        targetKind: 'constraint',
        evaluate(values) {
          const gradient = zeroVector(parameterCount)
          const p1 = getPoint(values, point1)
          const p2 = getPoint(values, point2)
          const pm = getPoint(values, middle)
          const d1 = subtract(p1, pm)
          const d2 = subtract(p2, pm)
          const norm1 = length(d1)
          const norm2 = length(d2)
          if (norm1 < 1e-12 || norm2 < 1e-12) {
            return { residual: 0.5 * constraint.valueRadians * constraint.valueRadians, gradient }
          }

          const dotValue = d1[0] * d2[0] + d1[1] * d2[1]
          const cosTheta = Math.max(-1, Math.min(1, dotValue / (norm1 * norm2)))
          const theta = Math.acos(cosTheta)
          const lossGradient = theta - constraint.valueRadians
          const denom = Math.sqrt(Math.max(1e-12, 1 - cosTheta * cosTheta))
          const gradThetaFromCos = -1 / denom

          const gradCosFromD1X =
            d2[0] / (norm1 * norm2) - (dotValue * d1[0]) / (norm1 * norm1 * norm1 * norm2)
          const gradCosFromD1Y =
            d2[1] / (norm1 * norm2) - (dotValue * d1[1]) / (norm1 * norm1 * norm1 * norm2)
          const gradCosFromD2X =
            d1[0] / (norm1 * norm2) - (dotValue * d2[0]) / (norm1 * norm2 * norm2 * norm2)
          const gradCosFromD2Y =
            d1[1] / (norm1 * norm2) - (dotValue * d2[1]) / (norm1 * norm2 * norm2 * norm2)

          const scaleFactor = lossGradient * gradThetaFromCos
          addPointGradient(gradient, point1, scaleFactor * gradCosFromD1X, scaleFactor * gradCosFromD1Y)
          addPointGradient(gradient, point2, scaleFactor * gradCosFromD2X, scaleFactor * gradCosFromD2Y)
          addPointGradient(
            gradient,
            middle,
            -scaleFactor * (gradCosFromD1X + gradCosFromD2X),
            -scaleFactor * (gradCosFromD1Y + gradCosFromD2Y),
          )
          const residual = 0.5 * lossGradient * lossGradient
          return { residual, gradient }
        },
      })
      continue
    }

    if (
      constraint.kind === 'parallel'
      || constraint.kind === 'perpendicular'
      || constraint.kind === 'equalLength'
    ) {
      const lineA = lineEntityMap.get(constraint.entityIds[0])
      const lineB = lineEntityMap.get(constraint.entityIds[1])
      if (!lineA || !lineB) {
        continue
      }
      const a0 = pointRecords.get(lineA.startPointId)
      const a1 = pointRecords.get(lineA.endPointId)
      const b0 = pointRecords.get(lineB.startPointId)
      const b1 = pointRecords.get(lineB.endPointId)
      if (!a0 || !a1 || !b0 || !b1) {
        continue
      }

      scalarConstraints.push({
        id: constraint.constraintId,
        targetKind: 'constraint',
        evaluate(values) {
          const gradient = zeroVector(parameterCount)
          const pa0 = getPoint(values, a0)
          const pa1 = getPoint(values, a1)
          const pb0 = getPoint(values, b0)
          const pb1 = getPoint(values, b1)
          const da = subtract(pa1, pa0)
          const db = subtract(pb1, pb0)
          const na = length(da)
          const nb = length(db)
          if (na < 1e-12 || nb < 1e-12) {
            return { residual: 0, gradient }
          }

          if (constraint.kind === 'equalLength') {
            const diff = na - nb
            const dNa = [da[0] / na, da[1] / na] as const
            const dNb = [db[0] / nb, db[1] / nb] as const
            addPointGradient(gradient, a0, -diff * dNa[0], -diff * dNa[1])
            addPointGradient(gradient, a1, diff * dNa[0], diff * dNa[1])
            addPointGradient(gradient, b0, diff * dNb[0], diff * dNb[1])
            addPointGradient(gradient, b1, -diff * dNb[0], -diff * dNb[1])
            return { residual: 0.5 * diff * diff, gradient }
          }

          const ua = [da[0] / na, da[1] / na] as const
          const ub = [db[0] / nb, db[1] / nb] as const
          const residualValue =
            constraint.kind === 'parallel'
              ? ua[0] * ub[1] - ua[1] * ub[0]
              : ua[0] * ub[0] + ua[1] * ub[1]

          const hA = [
            [1 / na - (da[0] * da[0]) / (na * na * na), -(da[0] * da[1]) / (na * na * na)],
            [-(da[0] * da[1]) / (na * na * na), 1 / na - (da[1] * da[1]) / (na * na * na)],
          ] as const
          const hB = [
            [1 / nb - (db[0] * db[0]) / (nb * nb * nb), -(db[0] * db[1]) / (nb * nb * nb)],
            [-(db[0] * db[1]) / (nb * nb * nb), 1 / nb - (db[1] * db[1]) / (nb * nb * nb)],
          ] as const

          const gradResidualUa =
            constraint.kind === 'parallel'
              ? [ub[1], -ub[0]] as const
              : [ub[0], ub[1]] as const
          const gradResidualUb =
            constraint.kind === 'parallel'
              ? [-ua[1], ua[0]] as const
              : [ua[0], ua[1]] as const

          const gradResidualDa = [
            gradResidualUa[0] * hA[0][0] + gradResidualUa[1] * hA[1][0],
            gradResidualUa[0] * hA[0][1] + gradResidualUa[1] * hA[1][1],
          ] as const
          const gradResidualDb = [
            gradResidualUb[0] * hB[0][0] + gradResidualUb[1] * hB[1][0],
            gradResidualUb[0] * hB[0][1] + gradResidualUb[1] * hB[1][1],
          ] as const

          addPointGradient(gradient, a0, -residualValue * gradResidualDa[0], -residualValue * gradResidualDa[1])
          addPointGradient(gradient, a1, residualValue * gradResidualDa[0], residualValue * gradResidualDa[1])
          addPointGradient(gradient, b0, -residualValue * gradResidualDb[0], -residualValue * gradResidualDb[1])
          addPointGradient(gradient, b1, residualValue * gradResidualDb[0], residualValue * gradResidualDb[1])
          return { residual: 0.5 * residualValue * residualValue, gradient }
        },
      })
    }
  }

  for (const dimension of definition.dimensions) {
    if (dimension.kind === 'distance') {
      const left = pointRecords.get(dimension.pointIds[0])
      const right = pointRecords.get(dimension.pointIds[1])
      if (!left || !right) {
        continue
      }

      scalarConstraints.push({
        id: dimension.dimensionId,
        targetKind: 'dimension',
        evaluate(values) {
          const gradient = zeroVector(parameterCount)
          const a = getPoint(values, left)
          const b = getPoint(values, right)
          const delta =
            dimension.axis === 'aligned'
              ? subtract(a, b)
              : subtract(b, a)

          if (dimension.axis === 'aligned') {
            const current = length(delta)
            if (current < 1e-12) {
              return { residual: 0.5 * dimension.value * dimension.value, gradient }
            }
            const err = current - dimension.value
            const coeffX = (err * delta[0]) / current
            const coeffY = (err * delta[1]) / current
            addPointGradient(gradient, left, coeffX, coeffY)
            addPointGradient(gradient, right, -coeffX, -coeffY)
            return { residual: 0.5 * err * err, gradient }
          }

          const index = dimension.axis === 'horizontal' ? 0 : 1
          const err = delta[index] - dimension.value
          if (index === 0) {
            addPointGradient(gradient, left, err, 0)
            addPointGradient(gradient, right, -err, 0)
          } else {
            addPointGradient(gradient, left, 0, err)
            addPointGradient(gradient, right, 0, -err)
          }
          return { residual: 0.5 * err * err, gradient }
        },
      })
      continue
    }

    if (dimension.kind === 'horizontalDistance' || dimension.kind === 'verticalDistance') {
      const left = pointRecords.get(dimension.pointIds[0])
      const right = pointRecords.get(dimension.pointIds[1])
      if (!left || !right) {
        continue
      }

      scalarConstraints.push({
        id: dimension.dimensionId,
        targetKind: 'dimension',
        evaluate(values) {
          const gradient = zeroVector(parameterCount)
          const a = getPoint(values, left)
          const b = getPoint(values, right)
          const delta = subtract(b, a)
          const err =
            (dimension.kind === 'horizontalDistance' ? delta[0] : delta[1]) - dimension.value
          if (dimension.kind === 'horizontalDistance') {
            addPointGradient(gradient, left, -err, 0)
            addPointGradient(gradient, right, err, 0)
          } else {
            addPointGradient(gradient, left, 0, -err)
            addPointGradient(gradient, right, 0, err)
          }
          return { residual: 0.5 * err * err, gradient }
        },
      })
      continue
    }

    if (dimension.kind === 'circleRadius') {
      const entity = definition.entities.find((candidate) => candidate.entityId === dimension.entityId)
      if (!entity || entity.kind !== 'circle') {
        continue
      }

      scalarConstraints.push({
        id: dimension.dimensionId,
        targetKind: 'dimension',
        evaluate() {
          const err = entity.radius - dimension.value
          return { residual: 0.5 * err * err, gradient: zeroVector(parameterCount) }
        },
      })
      continue
    }

    if (dimension.kind === 'arcStartPointCoincident' || dimension.kind === 'arcEndPointCoincident') {
      const arc = arcEntityMap.get(dimension.entityId)
      const arcState = entityStates.get(dimension.entityId)
      const point = pointRecords.get(dimension.pointId)
      const center = arc ? pointRecords.get(arc.centerPointId) : null
      if (!arc || !arcState || arcState.kind !== 'arc' || !point || !center) {
        continue
      }

      scalarConstraints.push({
        id: dimension.dimensionId,
        targetKind: 'dimension',
        evaluate(values) {
          const gradient = zeroVector(parameterCount)
          const centerPos = getPoint(values, center)
          const pointPos = getPoint(values, point)
          const { radius, startAngle, endAngle } = getArcParameters(values, arcState)
          const angle = dimension.kind === 'arcStartPointCoincident' ? startAngle : endAngle
          const arcPoint = add(centerPos, [radius * Math.cos(angle), radius * Math.sin(angle)])
          const delta = subtract(arcPoint, pointPos)
          const gx = delta[0]
          const gy = delta[1]
          addPointGradient(gradient, center, gx, gy)
          addPointGradient(gradient, point, -gx, -gy)
          gradient[arcState.baseIndex] += gx * Math.cos(angle) + gy * Math.sin(angle)
          const angleGradient =
            gx * (-radius * Math.sin(angle)) + gy * (radius * Math.cos(angle))
          gradient[arcState.baseIndex + (dimension.kind === 'arcStartPointCoincident' ? 1 : 2)] += angleGradient
          return { residual: 0.5 * (delta[0] * delta[0] + delta[1] * delta[1]), gradient }
        },
      })
    }
  }

  return {
    parameterCount,
    initialValues,
    pointRecords,
    entityStates,
    scalarConstraints,
  }
}

function validateDefinition(
  definition: SketchDefinition,
  tolerances: SketchSolveTolerancePolicy,
): SketchCoreValidationResult {
  const diagnostics: SketchSolveDiagnostic[] = []
  const pointIds = new Set<SketchPointId>()
  const entityIds = new Set<SketchEntityId>()
  const constraintIds = new Set<ConstraintId>()
  const dimensionIds = new Set<DimensionId>()
  const pointMap = new Map(definition.points.map((point) => [point.pointId, point]))
  const entityMap = new Map(definition.entities.map((entity) => [entity.entityId, entity]))
  const referenceIds = new Set(definition.referenceIds)

  for (const pointId of definition.pointIds) {
    if (pointIds.has(pointId)) {
      diagnostics.push(makeDiagnostic('duplicate-point-id', 'error', `Point ${pointId} appears more than once.`, { kind: 'point', pointId }))
    }
    pointIds.add(pointId)
  }

  for (const entityId of definition.entityIds) {
    if (entityIds.has(entityId)) {
      diagnostics.push(makeDiagnostic('duplicate-entity-id', 'error', `Entity ${entityId} appears more than once.`, { kind: 'entity', entityId }))
    }
    entityIds.add(entityId)
  }

  for (const constraintId of definition.constraintIds) {
    if (constraintIds.has(constraintId)) {
      diagnostics.push(makeDiagnostic('duplicate-constraint-id', 'error', `Constraint ${constraintId} appears more than once.`, { kind: 'constraint', constraintId }))
    }
    constraintIds.add(constraintId)
  }

  for (const dimensionId of definition.dimensionIds) {
    if (dimensionIds.has(dimensionId)) {
      diagnostics.push(makeDiagnostic('duplicate-dimension-id', 'error', `Dimension ${dimensionId} appears more than once.`, { kind: 'dimension', dimensionId }))
    }
    dimensionIds.add(dimensionId)
  }

  for (const entity of definition.entities) {
    if (!entityIds.has(entity.entityId)) {
      diagnostics.push(makeDiagnostic('entity-missing-from-order', 'error', `Entity ${entity.entityId} is not listed in entityIds.`, { kind: 'entity', entityId: entity.entityId }))
    }

    if (entity.kind === 'lineSegment') {
      const start = pointMap.get(entity.startPointId)
      const end = pointMap.get(entity.endPointId)
      if (!start || !end) {
        diagnostics.push(makeDiagnostic('missing-line-endpoint', 'error', `Line ${entity.entityId} references a missing endpoint.`, { kind: 'entity', entityId: entity.entityId }))
      } else if (length(subtract(start.position, end.position)) < tolerances.minimumSegmentLength) {
        diagnostics.push(makeDiagnostic('degenerate-line-segment', 'error', `Line ${entity.entityId} is shorter than the minimum segment length tolerance.`, { kind: 'entity', entityId: entity.entityId }))
      }
    }

    if (entity.kind === 'circle' && entity.radius <= 0) {
      diagnostics.push(makeDiagnostic('invalid-circle-radius', 'error', `Circle ${entity.entityId} must have a radius greater than zero.`, { kind: 'entity', entityId: entity.entityId }))
    }
  }

  for (const point of definition.points) {
    if (!pointIds.has(point.pointId)) {
      diagnostics.push(makeDiagnostic('point-missing-from-order', 'error', `Point ${point.pointId} is not listed in pointIds.`, { kind: 'point', pointId: point.pointId }))
    }
  }

  for (const pointId of definition.pointIds) {
    if (!pointMap.has(pointId)) {
      diagnostics.push(makeDiagnostic('point-missing-from-records', 'error', `pointIds references missing point ${pointId}.`, { kind: 'point', pointId }))
    }
  }

  for (const entityId of definition.entityIds) {
    if (!entityMap.has(entityId)) {
      diagnostics.push(makeDiagnostic('entity-missing-from-records', 'error', `entityIds references missing entity ${entityId}.`, { kind: 'entity', entityId }))
    }
  }

  const constraintMap = new Map(definition.constraints.map((constraint) => [constraint.constraintId, constraint]))
  for (const constraint of definition.constraints) {
    if (!constraintIds.has(constraint.constraintId)) {
      diagnostics.push(makeDiagnostic('constraint-missing-from-order', 'error', `Constraint ${constraint.constraintId} is not listed in constraintIds.`, { kind: 'constraint', constraintId: constraint.constraintId }))
    }

    switch (constraint.kind) {
      case 'coincident':
        if (!pointMap.has(constraint.pointIds[0]) || !pointMap.has(constraint.pointIds[1])) {
          diagnostics.push(makeDiagnostic('missing-coincident-point', 'error', `Constraint ${constraint.constraintId} references a missing point.`, { kind: 'constraint', constraintId: constraint.constraintId }))
        }
        break
      case 'horizontal':
      case 'vertical':
        if (!entityMap.has(constraint.entityId)) {
          diagnostics.push(makeDiagnostic('missing-constrained-entity', 'error', `Constraint ${constraint.constraintId} references a missing entity.`, { kind: 'constraint', constraintId: constraint.constraintId }))
        }
        break
      case 'fixPoint':
        if (!pointMap.has(constraint.pointId)) {
          diagnostics.push(makeDiagnostic('missing-fix-point', 'error', `Constraint ${constraint.constraintId} references a missing point.`, { kind: 'constraint', constraintId: constraint.constraintId }))
        }
        break
      case 'angle':
        if (!constraint.pointIds.every((pointId) => pointMap.has(pointId))) {
          diagnostics.push(makeDiagnostic('missing-angle-point', 'error', `Constraint ${constraint.constraintId} references a missing point.`, { kind: 'constraint', constraintId: constraint.constraintId }))
        }
        break
      case 'parallel':
      case 'perpendicular':
      case 'equalLength':
        if (!constraint.entityIds.every((entityId) => entityMap.has(entityId))) {
          diagnostics.push(makeDiagnostic('missing-two-line-entity', 'error', `Constraint ${constraint.constraintId} references a missing entity.`, { kind: 'constraint', constraintId: constraint.constraintId }))
        }
        break
    }
  }

  for (const constraintId of definition.constraintIds) {
    if (!constraintMap.has(constraintId)) {
      diagnostics.push(makeDiagnostic('constraint-missing-from-records', 'error', `constraintIds references missing constraint ${constraintId}.`, { kind: 'constraint', constraintId }))
    }
  }

  const dimensionMap = new Map(definition.dimensions.map((dimension) => [dimension.dimensionId, dimension]))
  for (const dimension of definition.dimensions) {
    if (!dimensionIds.has(dimension.dimensionId)) {
      diagnostics.push(makeDiagnostic('dimension-missing-from-order', 'error', `Dimension ${dimension.dimensionId} is not listed in dimensionIds.`, { kind: 'dimension', dimensionId: dimension.dimensionId }))
    }

    switch (dimension.kind) {
      case 'distance':
      case 'horizontalDistance':
      case 'verticalDistance':
        if (!dimension.pointIds.every((pointId) => pointMap.has(pointId))) {
          diagnostics.push(makeDiagnostic('missing-dimension-point', 'error', `Dimension ${dimension.dimensionId} references a missing point.`, { kind: 'dimension', dimensionId: dimension.dimensionId }))
        }
        break
      case 'circleRadius':
        if (!entityMap.has(dimension.entityId)) {
          diagnostics.push(makeDiagnostic('missing-dimension-entity', 'error', `Dimension ${dimension.dimensionId} references a missing entity.`, { kind: 'dimension', dimensionId: dimension.dimensionId }))
        }
        break
      case 'arcStartPointCoincident':
      case 'arcEndPointCoincident':
        if (!entityMap.has(dimension.entityId) || !pointMap.has(dimension.pointId)) {
          diagnostics.push(makeDiagnostic('missing-arc-endpoint-reference', 'error', `Dimension ${dimension.dimensionId} references missing arc or point data.`, { kind: 'dimension', dimensionId: dimension.dimensionId }))
        }
        break
    }
  }

  for (const dimensionId of definition.dimensionIds) {
    if (!dimensionMap.has(dimensionId)) {
      diagnostics.push(makeDiagnostic('dimension-missing-from-records', 'error', `dimensionIds references missing dimension ${dimensionId}.`, { kind: 'dimension', dimensionId }))
    }
  }

  for (const reference of definition.references) {
    if (!referenceIds.has(reference.referenceId)) {
      diagnostics.push(makeDiagnostic('reference-missing-from-order', 'error', `Reference ${reference.referenceId} is not listed in referenceIds.`, null))
    }
  }

  const referenceMap = new Map(definition.references.map((reference) => [reference.referenceId, reference]))
  for (const referenceId of definition.referenceIds) {
    if (!referenceMap.has(referenceId)) {
      diagnostics.push(makeDiagnostic('reference-missing-from-records', 'error', `referenceIds references missing reference ${referenceId}.`, null))
    }
  }

  return {
    isValid: diagnostics.every((diagnostic) => diagnostic.severity !== 'error'),
    diagnostics,
  }
}

function evaluateLoss(
  values: Float64Array,
  constraints: ScalarConstraintRecord[],
): {
  loss: number
  gradient: Float64Array
  perConstraint: Map<string, number>
  evaluations: ConstraintEvaluationRecord[]
} {
  const perConstraint = new Map<string, number>()
  const gradient = zeroVector(values.length)
  const evaluations: ConstraintEvaluationRecord[] = []
  let loss = 0

  for (const constraint of constraints) {
    const evaluation = constraint.evaluate(values)
    loss += evaluation.residual
    addScaled(gradient, 1, evaluation.gradient)
    perConstraint.set(constraint.id, evaluation.residual)
    evaluations.push({
      id: constraint.id,
      targetKind: constraint.targetKind,
      residual: evaluation.residual,
      gradient: evaluation.gradient,
    })
  }

  return { loss, gradient, perConstraint, evaluations }
}

function identityMatrix(size: number) {
  const matrix = Array.from({ length: size }, (_, rowIndex) => {
    const row = new Float64Array(size)
    row[rowIndex] = 1
    return row
  })
  return matrix
}

function multiplyMatrixVector(matrix: Float64Array[], vector: Float64Array) {
  const result = zeroVector(vector.length)
  for (let row = 0; row < matrix.length; row += 1) {
    result[row] = dot(matrix[row]!, vector)
  }
  return result
}

function outer(left: Float64Array, right: Float64Array) {
  const matrix = Array.from({ length: left.length }, () => zeroVector(right.length))
  for (let row = 0; row < left.length; row += 1) {
    for (let column = 0; column < right.length; column += 1) {
      matrix[row]![column] = left[row]! * right[column]!
    }
  }
  return matrix
}

function addScaledMatrix(target: Float64Array[], scale: number, source: Float64Array[]) {
  for (let row = 0; row < target.length; row += 1) {
    for (let column = 0; column < target[row]!.length; column += 1) {
      target[row]![column] += scale * source[row]![column]!
    }
  }
}

function lineSearchWolfe(
  values: Float64Array,
  direction: Float64Array,
  gradient: Float64Array,
  constraints: ScalarConstraintRecord[],
) {
  const slope = dot(gradient, direction)
  if (slope >= 0) {
    return null
  }
  let alpha = 1
  const initial = evaluateLoss(values, constraints)
  for (let iteration = 0; iteration < LINE_SEARCH_MAX_ITERATIONS; iteration += 1) {
    const candidate = cloneValues(values)
    addScaled(candidate, alpha, direction)
    const next = evaluateLoss(candidate, constraints)
    if (next.loss <= initial.loss + WOLFE_C1 * alpha * slope) {
      const curvature = dot(next.gradient, direction)
      if (curvature >= WOLFE_C2 * slope) {
        return { alpha, nextValues: candidate, next }
      }
      alpha *= 1.5
    } else {
      alpha *= 0.5
    }
  }
  return null
}

function solveBfgs(
  initialValues: Float64Array,
  constraints: ScalarConstraintRecord[],
) {
  let values = cloneValues(initialValues)
  let state = evaluateLoss(values, constraints)
  const dimension = values.length
  let inverseHessian = identityMatrix(dimension)
  let recentlyReset = false

  for (let iteration = 0; iteration < 1000; iteration += 1) {
    if (state.loss < 1e-16 || euclideanNorm(state.gradient) < 1e-8) {
      break
    }

    const searchDirection = multiplyMatrixVector(inverseHessian, state.gradient)
    for (let index = 0; index < searchDirection.length; index += 1) {
      searchDirection[index] = -searchDirection[index]!
    }

    const step = lineSearchWolfe(values, searchDirection, state.gradient, constraints)
    if (!step) {
      if (recentlyReset) {
        break
      }
      inverseHessian = identityMatrix(dimension)
      recentlyReset = true
      continue
    }
    recentlyReset = false

    const s = cloneValues(searchDirection)
    for (let index = 0; index < s.length; index += 1) {
      s[index] *= step.alpha
    }

    const y = cloneValues(step.next.gradient)
    addScaled(y, -1, state.gradient)
    let sDotY = dot(s, y)
    if (Math.abs(sDotY) < 1e-16) {
      sDotY += 1e-6
    }

    const hy = multiplyMatrixVector(inverseHessian, y)
    const factor = (sDotY + dot(y, hy)) / (sDotY * sDotY)
    addScaledMatrix(inverseHessian, factor, outer(s, s))
    addScaledMatrix(inverseHessian, -1 / sDotY, outer(hy, s))
    addScaledMatrix(inverseHessian, -1 / sDotY, outer(s, hy))

    values = step.nextValues
    state = step.next
  }

  return { values, loss: state.loss, perConstraint: state.perConstraint }
}

function solveGradientDescent(
  initialValues: Float64Array,
  constraints: ScalarConstraintRecord[],
) {
  let values = cloneValues(initialValues)
  let state = evaluateLoss(values, constraints)

  for (let iteration = 0; iteration < 10000; iteration += 1) {
    if (state.loss < 1e-14 || euclideanNorm(state.gradient) < 1e-10) {
      break
    }

    const direction = cloneValues(state.gradient)
    for (let index = 0; index < direction.length; index += 1) {
      direction[index] = -direction[index]!
    }

    let alpha = 1
    let accepted = false

    for (let searchIteration = 0; searchIteration < LINE_SEARCH_MAX_ITERATIONS * 4; searchIteration += 1) {
      const candidateValues = cloneValues(values)
      addScaled(candidateValues, alpha, direction)
      const candidateState = evaluateLoss(candidateValues, constraints)
      if (Number.isFinite(candidateState.loss) && candidateState.loss < state.loss) {
        values = candidateValues
        state = candidateState
        accepted = true
        break
      }
      alpha *= 0.5
    }

    if (!accepted) {
      break
    }
  }

  return { values, loss: state.loss, perConstraint: state.perConstraint }
}

function transpose(matrix: Float64Array[]) {
  const rows = matrix.length
  const columns = matrix[0]?.length ?? 0
  const result = Array.from({ length: columns }, () => zeroVector(rows))
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      result[column]![row] = matrix[row]![column]!
    }
  }
  return result
}

function multiplyMatrices(left: Float64Array[], right: Float64Array[]) {
  const result = Array.from({ length: left.length }, () => zeroVector(right[0]?.length ?? 0))
  for (let row = 0; row < left.length; row += 1) {
    for (let column = 0; column < (right[0]?.length ?? 0); column += 1) {
      let value = 0
      for (let inner = 0; inner < right.length; inner += 1) {
        value += left[row]![inner]! * right[inner]![column]!
      }
      result[row]![column] = value
    }
  }
  return result
}

function addDiagonal(matrix: Float64Array[], value: number) {
  const result = matrix.map((row) => cloneValues(row))
  for (let index = 0; index < result.length; index += 1) {
    result[index]![index] += value
  }
  return result
}

function solveLinearSystem(matrix: Float64Array[], vector: Float64Array) {
  const size = matrix.length
  const a = matrix.map((row) => Array.from(row))
  const b = Array.from(vector)

  for (let pivot = 0; pivot < size; pivot += 1) {
    let maxRow = pivot
    for (let row = pivot + 1; row < size; row += 1) {
      if (Math.abs(a[row]![pivot]!) > Math.abs(a[maxRow]![pivot]!)) {
        maxRow = row
      }
    }

    if (Math.abs(a[maxRow]![pivot]!) < 1e-12) {
      a[maxRow]![pivot] = (a[maxRow]![pivot] ?? 0) + 1e-6
    }

    ;[a[pivot], a[maxRow]] = [a[maxRow]!, a[pivot]!]
    ;[b[pivot], b[maxRow]] = [b[maxRow]!, b[pivot]!]

    const pivotValue = a[pivot]![pivot]!
    for (let column = pivot; column < size; column += 1) {
      a[pivot]![column] /= pivotValue
    }
    b[pivot] /= pivotValue

    for (let row = 0; row < size; row += 1) {
      if (row === pivot) {
        continue
      }
      const factor = a[row]![pivot]!
      for (let column = pivot; column < size; column += 1) {
        a[row]![column] -= factor * a[pivot]![column]!
      }
      b[row] -= factor * b[pivot]!
    }
  }

  return new Float64Array(b)
}

function solveGaussNewtonLike(
  initialValues: Float64Array,
  constraints: ScalarConstraintRecord[],
  options: { maxIterations: number; minLoss: number; stepSize: number; damping: number },
) {
  let values = cloneValues(initialValues)
  let state = evaluateLoss(values, constraints)

  for (let iteration = 0; iteration < options.maxIterations && state.loss > options.minLoss; iteration += 1) {
    const jacobian = state.evaluations.map((evaluation) => {
      const row = zeroVector(evaluation.gradient.length)
      const scale = Math.sqrt(Math.max(2 * evaluation.residual, 1e-12))
      for (let index = 0; index < row.length; index += 1) {
        row[index] = evaluation.gradient[index]! / scale
      }
      return row
    })
    const losses = new Float64Array(state.evaluations.map((evaluation) => Math.sqrt(Math.max(2 * evaluation.residual, 0))))
    const jT = transpose(jacobian)
    const normal = multiplyMatrices(jT, jacobian)
    const normalWithDamping = options.damping > 0 ? addDiagonal(normal, options.damping) : normal
    const rhs = multiplyMatrixVector(jT, losses)
    const delta = solveLinearSystem(normalWithDamping, rhs)

    if (!Array.from(delta).every(Number.isFinite)) {
      break
    }

    const nextValues = cloneValues(values)
    addScaled(nextValues, -options.stepSize, delta)
    const nextState = evaluateLoss(nextValues, constraints)
    if (!Number.isFinite(nextState.loss) || nextState.loss > state.loss) {
      break
    }
    values = nextValues
    state = nextState
  }

  return { values, loss: state.loss, perConstraint: state.perConstraint }
}

function buildSolvedEntities(
  definition: SketchDefinition,
  pointRecords: Map<SketchPointId, SolverPointRecord>,
  entityStates: Map<SketchEntityId, SolverEntityState>,
  values: Float64Array,
): SolvedSketchEntityGeometryRecord[] {
  const solved: SolvedSketchEntityGeometryRecord[] = []
  for (const entity of definition.entities) {
    if (entity.kind === 'point') {
      const point = pointRecords.get(entity.pointId)
      if (point) {
        solved.push({ entityId: entity.entityId, kind: 'point', solvedPosition: getPoint(values, point) })
      }
      continue
    }

    if (entity.kind === 'lineSegment') {
      const start = pointRecords.get(entity.startPointId)
      const end = pointRecords.get(entity.endPointId)
      if (start && end) {
        solved.push({
            entityId: entity.entityId,
            kind: 'lineSegment',
            startPosition: getPoint(values, start),
            endPosition: getPoint(values, end),
          })
      }
      continue
    }

    if (entity.kind === 'circle') {
      const center = pointRecords.get(entity.centerPointId)
      if (center) {
        solved.push({
            entityId: entity.entityId,
            kind: 'circle',
            centerPosition: getPoint(values, center),
            solvedRadius: entity.radius,
          })
      }
      continue
    }

    const center = pointRecords.get(entity.centerPointId)
    const arcState = entityStates.get(entity.entityId)
    if (!center || !arcState || arcState.kind !== 'arc') {
      continue
    }
    const centerPos = getPoint(values, center)
    const { radius, startAngle, endAngle } = getArcParameters(values, arcState)
    const startPosition = add(centerPos, [radius * Math.cos(startAngle), radius * Math.sin(startAngle)])
    const endPosition = add(centerPos, [radius * Math.cos(endAngle), radius * Math.sin(endAngle)])
    solved.push({
      entityId: entity.entityId,
      kind: 'arc',
      centerPosition: centerPos,
      startPosition,
      endPosition,
      sweepDirection: entity.sweepDirection,
    })
  }
  return solved
}

function buildConstraintStatuses(
  definition: SketchDefinition,
  pointRecords: Map<SketchPointId, SolverPointRecord>,
  values: Float64Array,
  tolerance: SketchSolveTolerancePolicy,
  perConstraint: Map<string, number>,
): ConstraintStatusRecord[] {
  const lineEntityMap = new Map(
    definition.entities
      .filter((entity): entity is Extract<SketchEntityDefinition, { kind: 'lineSegment' }> => entity.kind === 'lineSegment')
      .map((entity) => [entity.entityId, entity]),
  )

  return definition.constraints.map((constraint) => {
    let status: ConstraintStatusRecord['status'] = 'satisfied'
    const residual = perConstraint.get(constraint.constraintId) ?? 0

    if (constraint.kind === 'horizontal' || constraint.kind === 'vertical') {
      const entity = lineEntityMap.get(constraint.entityId)
      if (!entity) {
        status = 'conflicting'
      } else {
        const start = pointRecords.get(entity.startPointId)
        const end = pointRecords.get(entity.endPointId)
        if (!start || !end) {
          status = 'conflicting'
        } else {
          const delta = subtract(getPoint(values, end), getPoint(values, start))
          const axisError = constraint.kind === 'horizontal' ? Math.abs(delta[1]) : Math.abs(delta[0])
          status = axisError <= tolerance.coincidence ? 'satisfied' : 'unsatisfied'
        }
      }
    } else if (residual > tolerance.coincidence * tolerance.coincidence) {
      status = 'unsatisfied'
    }

    return {
      constraintId: constraint.constraintId,
      status,
    }
  })
}

function buildDimensionStatuses(
  definition: SketchDefinition,
  pointRecords: Map<SketchPointId, SolverPointRecord>,
  entityStates: Map<SketchEntityId, SolverEntityState>,
  values: Float64Array,
  perConstraint: Map<string, number>,
): DimensionStatusRecord[] {
  const entityMap = new Map(definition.entities.map((entity) => [entity.entityId, entity]))

  return definition.dimensions.map((dimension) => {
    let solvedValue: number | null = null
    if (dimension.kind === 'distance') {
      const left = pointRecords.get(dimension.pointIds[0])
      const right = pointRecords.get(dimension.pointIds[1])
      if (left && right) {
        const delta =
          dimension.axis === 'aligned'
            ? subtract(getPoint(values, left), getPoint(values, right))
            : subtract(getPoint(values, right), getPoint(values, left))
        solvedValue =
          dimension.axis === 'aligned'
            ? length(delta)
            : dimension.axis === 'horizontal'
              ? delta[0]
              : delta[1]
      }
    } else if (dimension.kind === 'horizontalDistance' || dimension.kind === 'verticalDistance') {
      const left = pointRecords.get(dimension.pointIds[0])
      const right = pointRecords.get(dimension.pointIds[1])
      if (left && right) {
        const delta = subtract(getPoint(values, right), getPoint(values, left))
        solvedValue = dimension.kind === 'horizontalDistance' ? delta[0] : delta[1]
      }
    } else if (dimension.kind === 'circleRadius') {
      const entity = entityMap.get(dimension.entityId)
      solvedValue = entity?.kind === 'circle' ? entity.radius : null
    } else {
      const state = entityStates.get(dimension.entityId)
      solvedValue = state?.kind === 'arc' ? 0 : null
    }

    return {
      dimensionId: dimension.dimensionId,
      status: solvedValue === null || (perConstraint.get(dimension.dimensionId) ?? 0) > 1e-6 ? 'unsatisfied' : 'driving',
      solvedValue,
    }
  })
}

export function solveSketchDefinitionCore(input: {
  definition: SketchDefinition
  tolerances: SketchSolveTolerancePolicy
  partialSolvePolicy: SolverPartialSolvePolicy
  strategy?: SketchSolveStrategy
}): SketchCoreSolveResult {
  const validation = validateDefinition(input.definition, input.tolerances)
  const system = buildSystem(input.definition)
  const strategy = input.strategy ?? 'bfgs'
  const solved =
    strategy === 'gradientDescent'
      ? solveGradientDescent(system.initialValues, system.scalarConstraints)
      : strategy === 'gaussNewton'
        ? solveGaussNewtonLike(system.initialValues, system.scalarConstraints, {
            maxIterations: 500,
            minLoss: 1e-8,
            stepSize: 1,
            damping: 0,
          })
        : strategy === 'levenbergMarquardt'
          ? solveGaussNewtonLike(system.initialValues, system.scalarConstraints, {
              maxIterations: 1000,
              minLoss: 1e-10,
              stepSize: 0.1,
              damping: 1e-5,
            })
          : solveBfgs(system.initialValues, system.scalarConstraints)
  const stabilizedSolved =
    strategy === 'bfgs' || solved.loss < 1e-8
      ? solved
      : solveBfgs(system.initialValues, system.scalarConstraints)

  const diagnostics = [...validation.diagnostics]
  const solvedEntities = buildSolvedEntities(
    input.definition,
    system.pointRecords,
    system.entityStates,
    stabilizedSolved.values,
  )
  const solvedPoints = input.definition.points.flatMap((point) => {
    const record = system.pointRecords.get(point.pointId)
    return record
      ? [{
          pointId: point.pointId,
          target: point.target,
          solvedPosition: getPoint(stabilizedSolved.values, record),
        }]
      : []
  })

  let status: SolvedSketchStatus
  if (!validation.isValid) {
    status = {
      solveState: input.partialSolvePolicy === 'bestEffort' ? 'partiallySolved' : 'failed',
      constraintState: 'inconsistent',
    }
  } else if (system.scalarConstraints.length === 0) {
    status = {
      solveState: input.definition.entities.length === 0 ? 'notEvaluated' : 'solved',
      constraintState: input.definition.entities.length === 0 ? 'unknown' : 'underConstrained',
    }
  } else if (stabilizedSolved.loss < 1e-8) {
    status = {
      solveState: 'solved',
      constraintState: 'wellConstrained',
    }
  } else {
    diagnostics.push(
      makeDiagnostic(
        'solver-residual-too-large',
        'warning',
        `Sketch solve ended with residual ${stabilizedSolved.loss}.`,
        null,
      ),
    )
    status = {
      solveState: input.partialSolvePolicy === 'bestEffort' ? 'partiallySolved' : 'failed',
      constraintState: 'underConstrained',
    }
  }

  const solvedSnapshot: SolvedSketchSnapshot = {
    schemaVersion: SOLVED_SKETCH_SCHEMA_VERSION,
    status,
    solvedEntities,
    solvedPoints,
    constraintStatuses: buildConstraintStatuses(
      input.definition,
      system.pointRecords,
      stabilizedSolved.values,
      input.tolerances,
      stabilizedSolved.perConstraint,
    ),
    dimensionStatuses: buildDimensionStatuses(
      input.definition,
      system.pointRecords,
      system.entityStates,
      stabilizedSolved.values,
      stabilizedSolved.perConstraint,
    ),
    diagnostics,
  }

  return {
    status,
    solvedSnapshot,
    diagnostics,
  }
}

export function validateSketchDefinitionCore(input: {
  definition: SketchDefinition
  tolerances: SketchSolveTolerancePolicy
}): SketchCoreValidationResult {
  return validateDefinition(input.definition, input.tolerances)
}

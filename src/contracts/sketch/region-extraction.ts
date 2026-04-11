import type {
  RegionLoopRecord,
  RegionRecord,
  SketchDefinition,
  SketchPoint2D,
  SketchSolveDiagnostic,
  SolvedSketchEntityGeometryRecord,
  SolvedSketchSnapshot,
} from '@/contracts/sketch/schema'
import type { OwnershipRecord } from '@/contracts/shared/diagnostics'
import type {
  DocumentId,
  RegionId,
  RegionLoopId,
  RevisionId,
  SketchEntityId,
  SketchId,
  SketchPointId,
} from '@/contracts/shared/ids'

export interface SketchRegionExtractionInput {
  documentId: DocumentId
  revisionId: RevisionId
  sketchId: SketchId
  solvedSnapshot: SolvedSketchSnapshot
  definition: SketchDefinition
}

export interface SketchRegionExtractionResult {
  regions: RegionRecord[]
  diagnostics: SketchSolveDiagnostic[]
}

export interface SketchRingCandidate {
  kind: 'segments'
  boundaryEntityIds: SketchEntityId[]
  boundaryPointIds: SketchPointId[]
  points: SketchPoint2D[]
  signedArea: number
}

type SegmentRecord = {
  entityId: SketchEntityId
  startPointId: SketchPointId | null
  endPointId: SketchPointId | null
  start: SketchPoint2D
  end: SketchPoint2D
  startAngle: number
  endAngle: number
}

function makeDiagnostic(
  code: string,
  severity: SketchSolveDiagnostic['severity'],
  message: string,
  target: SketchSolveDiagnostic['target'],
): SketchSolveDiagnostic {
  return { code, severity, message, target }
}

function pointKey(point: SketchPoint2D) {
  return `${point[0].toFixed(9)},${point[1].toFixed(9)}`
}

function equalsPoint(left: SketchPoint2D, right: SketchPoint2D) {
  return pointKey(left) === pointKey(right)
}

function angleDifference(a0: number, a1: number) {
  const tau = Math.PI * 2
  let left = a0 % tau
  let right = a1 % tau

  if (left < 0) {
    left += tau
  }
  if (right < 0) {
    right += tau
  }

  let diff = right - left
  if (diff > tau) {
    diff -= tau
  }
  if (diff < 0) {
    diff += tau
  }

  return diff
}

function signedArea(points: SketchPoint2D[]) {
  let area = 0
  for (let index = 0; index < points.length; index += 1) {
    const start = points[index]!
    const end = points[(index + 1) % points.length]!
    area += start[0] * end[1] - end[0] * start[1]
  }
  return area / 2
}

function pointInPolygon(point: SketchPoint2D, polygon: SketchPoint2D[]) {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i]![0]
    const yi = polygon[i]![1]
    const xj = polygon[j]![0]
    const yj = polygon[j]![1]
    const intersects = (yi > point[1]) !== (yj > point[1])
      && point[0] < ((xj - xi) * (point[1] - yi)) / ((yj - yi) || Number.EPSILON) + xi
    if (intersects) {
      inside = !inside
    }
  }
  return inside
}

function centroid(points: SketchPoint2D[]): SketchPoint2D {
  let x = 0
  let y = 0
  for (const point of points) {
    x += point[0]
    y += point[1]
  }
  return [x / points.length, y / points.length]
}

function reverseSegment(segment: SegmentRecord): SegmentRecord {
  return {
    entityId: segment.entityId,
    startPointId: segment.endPointId,
    endPointId: segment.startPointId,
    start: segment.end,
    end: segment.start,
    startAngle: (segment.endAngle + Math.PI) % (Math.PI * 2),
    endAngle: (segment.startAngle + Math.PI) % (Math.PI * 2),
  }
}

function equalsOrReverseEquals(left: SegmentRecord, right: SegmentRecord) {
  return (
    left.entityId === right.entityId
    && ((equalsPoint(left.start, right.start) && equalsPoint(left.end, right.end))
      || (equalsPoint(left.start, right.end) && equalsPoint(left.end, right.start)))
  )
}

function continues(next: SegmentRecord, prior: SegmentRecord) {
  return equalsPoint(prior.end, next.start)
}

function cross(
  a: SketchPoint2D,
  b: SketchPoint2D,
  c: SketchPoint2D,
) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
}

function buildSegments(
  definition: SketchDefinition,
  solvedSnapshot: SolvedSketchSnapshot,
) {
  const solvedLineMap = new Map(
    solvedSnapshot.solvedEntities
      .filter((entity): entity is Extract<SolvedSketchEntityGeometryRecord, { kind: 'lineSegment' }> => entity.kind === 'lineSegment')
      .map((entity) => [entity.entityId, entity]),
  )

  return definition.entities.flatMap((entity) => {
    if (entity.kind !== 'lineSegment' || entity.isConstruction) {
      return []
    }
    const solved = solvedLineMap.get(entity.entityId)
    if (!solved) {
      return []
    }
    return [{
      entityId: entity.entityId,
      startPointId: entity.startPointId,
      endPointId: entity.endPointId,
      start: solved.startPosition,
      end: solved.endPosition,
      startAngle: Math.atan2(
        solved.endPosition[1] - solved.startPosition[1],
        solved.endPosition[0] - solved.startPosition[0],
      ),
      endAngle: Math.atan2(
        solved.endPosition[1] - solved.startPosition[1],
        solved.endPosition[0] - solved.startPosition[0],
      ),
    } satisfies SegmentRecord]
  })
}

function findNextSegment(
  segments: SegmentRecord[],
  current: SegmentRecord,
  used: Set<number>,
): [number, SegmentRecord] | null {
  let best: [number, SegmentRecord] | null = null
  let bestScore = Number.NEGATIVE_INFINITY

  for (const [index, candidate] of segments.entries()) {
    if (used.has(index)) {
      continue
    }
    if (!continues(candidate, current) || equalsOrReverseEquals(candidate, current)) {
      continue
    }
    const turn = cross(current.start, current.end, candidate.end)
    const diff = angleDifference(current.endAngle, candidate.startAngle)
    const score = turn * 1e6 + diff
    if (score > bestScore) {
      best = [index, candidate]
      bestScore = score
    }
  }

  return best
}

export function findSketchRings(
  definition: SketchDefinition,
  solvedSnapshot: SolvedSketchSnapshot,
): { rings: SketchRingCandidate[]; unusedSegments: SegmentRecord[] } {
  const initialSegments = buildSegments(definition, solvedSnapshot)
  const allSegments = [...initialSegments, ...initialSegments.map(reverseSegment)]

  const used = new Set<number>()
  const rings: SketchRingCandidate[] = []

  for (const [segmentIndex, segment] of allSegments.entries()) {
    if (used.has(segmentIndex)) {
      continue
    }

    const ringIndices: Array<[number, SegmentRecord]> = []
    const startPoint = segment.start
    let nextIndex = segmentIndex
    let nextSegment = segment

    for (let count = 1; count < allSegments.length; count += 1) {
      ringIndices.push([nextIndex, nextSegment])

      if (equalsPoint(nextSegment.end, startPoint)) {
        usedForRing(used, ringIndices)
        const ringSegments = ringIndices.map((entry) => entry[1])
        const points = ringSegments.map((entry) => entry.start)
        const area = signedArea(points)
        if (area > 0) {
          rings.push({
            kind: 'segments',
            boundaryEntityIds: ringSegments.map((entry) => entry.entityId),
            boundaryPointIds: ringSegments.flatMap((entry) => entry.startPointId ? [entry.startPointId] : []),
            points,
            signedArea: area,
          })
        }
        break
      }

      const found = findNextSegment(allSegments, nextSegment, used)
      if (!found) {
        break
      }
      ;[nextIndex, nextSegment] = found
    }
  }

  rings.sort((left, right) => left.signedArea - right.signedArea)
  const unusedSegments = initialSegments.filter((_, index) => !used.has(index))
  return { rings, unusedSegments }
}

function usedForRing(used: Set<number>, ringIndices: Array<[number, SegmentRecord]>) {
  for (const [index] of ringIndices) {
    used.add(index)
  }
}

function createRegionId(sketchId: SketchId, ordinal: number): RegionId {
  const suffix = sketchId.startsWith('sketch_') ? sketchId.slice('sketch_'.length) : sketchId
  return (ordinal === 0 ? `region_${suffix}-outer` : `region_${suffix}-loop-${ordinal + 1}`) as RegionId
}

function createRegionLoopId(regionId: RegionId, ordinal: number): RegionLoopId {
  return `region_loop_${regionId}_${ordinal}` as RegionLoopId
}

function createOwnershipRecord(
  input: Pick<SketchRegionExtractionInput, 'documentId' | 'revisionId' | 'sketchId'>,
): OwnershipRecord {
  return {
    ownerDocumentId: input.documentId,
    ownerRevisionId: input.revisionId,
    ownerFeatureId: null,
    ownerSketchId: input.sketchId,
    ownerBodyId: null,
  }
}

export function deriveSketchRegionsCore(
  input: SketchRegionExtractionInput,
): SketchRegionExtractionResult {
  if (input.solvedSnapshot.status.solveState === 'failed' || input.solvedSnapshot.status.solveState === 'notEvaluated') {
    return {
      regions: [],
      diagnostics: [
        makeDiagnostic(
          'regions-unavailable',
          'warning',
          'Closed regions are unavailable until the sketch reaches a usable solved state.',
          null,
        ),
      ],
    }
  }

  const { rings } = findSketchRings(input.definition, input.solvedSnapshot)
  const sorted = [...rings].sort((left, right) => Math.abs(right.signedArea) - Math.abs(left.signedArea))
  const childrenByParent = new Map<number, number[]>()
  const parentByRing = new Map<number, number | null>()

  for (let childIndex = 0; childIndex < sorted.length; childIndex += 1) {
    const child = sorted[childIndex]!
    const marker = centroid(child.points)
    let parent: number | null = null

    for (let parentIndex = 0; parentIndex < sorted.length; parentIndex += 1) {
      if (parentIndex === childIndex) {
        continue
      }
      const candidate = sorted[parentIndex]!
      if (Math.abs(candidate.signedArea) <= Math.abs(child.signedArea)) {
        continue
      }
      if (pointInPolygon(marker, candidate.points)) {
        parent = parentIndex
        break
      }
    }

    parentByRing.set(childIndex, parent)
    if (parent !== null) {
      const children = childrenByParent.get(parent) ?? []
      children.push(childIndex)
      childrenByParent.set(parent, children)
    }
  }

  const topLevel = sorted
    .map((ring, index) => ({ ring, index }))
    .filter(({ index }) => parentByRing.get(index) === null)

  const regions = topLevel.map(({ ring, index }, regionOrdinal) => {
    const regionId = createRegionId(input.sketchId, regionOrdinal)
    const outerLoop: RegionLoopRecord = {
      loopId: createRegionLoopId(regionId, 0),
      role: 'outer',
      orientation: ring.signedArea >= 0 ? 'counterClockwise' : 'clockwise',
      segments: ring.boundaryEntityIds.map((entityId, segmentIndex) => ({
        source: { kind: 'entity', entityId },
        startPointId: ring.boundaryPointIds[segmentIndex] ?? null,
        endPointId: ring.boundaryPointIds[(segmentIndex + 1) % ring.boundaryPointIds.length] ?? null,
      })),
      boundaryPointIds: ring.boundaryPointIds,
      isClosed: true,
    }

    const innerLoops = (childrenByParent.get(index) ?? []).map((childIndex, loopOrdinal) => {
      const child = sorted[childIndex]!
      return {
        loopId: createRegionLoopId(regionId, loopOrdinal + 1),
        role: 'inner',
        orientation: child.signedArea >= 0 ? 'counterClockwise' : 'clockwise',
        segments: child.boundaryEntityIds.map((entityId, segmentIndex) => ({
          source: { kind: 'entity', entityId },
          startPointId: child.boundaryPointIds[segmentIndex] ?? null,
          endPointId: child.boundaryPointIds[(segmentIndex + 1) % child.boundaryPointIds.length] ?? null,
        })),
        boundaryPointIds: child.boundaryPointIds,
        isClosed: true,
      } satisfies RegionLoopRecord
    })

    return {
      ...createOwnershipRecord(input),
      regionId,
      label: regionOrdinal === 0 ? 'Outer region' : `Loop region ${regionOrdinal + 1}`,
      target: { kind: 'region', sketchId: input.sketchId, regionId },
      sourceSketch: { kind: 'sketch', sketchId: input.sketchId },
      loops: [outerLoop, ...innerLoops],
      isClosed: true,
    } satisfies RegionRecord
  })

  return {
    regions,
    diagnostics: [],
  }
}

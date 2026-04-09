import type { BodyId, EdgeId, FaceId, VertexId } from '@/contracts/shared/ids'
import type { FeatureId } from '@/contracts/shared/ids'
import type { OpenCascadeInstance } from '@/domain/modeling/occ/runtime'

function solidShapeType(oc: OpenCascadeInstance) {
  return oc.TopAbs_ShapeEnum.TopAbs_SOLID as unknown as number
}

function faceShapeType(oc: OpenCascadeInstance) {
  return oc.TopAbs_ShapeEnum.TopAbs_FACE as unknown as number
}

function edgeShapeType(oc: OpenCascadeInstance) {
  return oc.TopAbs_ShapeEnum.TopAbs_EDGE as unknown as number
}

function vertexShapeType(oc: OpenCascadeInstance) {
  return oc.TopAbs_ShapeEnum.TopAbs_VERTEX as unknown as number
}

function anyShapeType(oc: OpenCascadeInstance) {
  return oc.TopAbs_ShapeEnum.TopAbs_SHAPE as unknown as number
}

export interface OccTrackedBody {
  bodyId: BodyId
  label: string
  ownerFeatureId: FeatureId | null
  shape: InstanceType<OpenCascadeInstance['TopoDS_Shape']>
  topology: {
    faceIds: FaceId[]
    edgeIds: EdgeId[]
    vertexIds: VertexId[]
  }
  facesById: Map<FaceId, InstanceType<OpenCascadeInstance['TopoDS_Face']>>
  edgesById: Map<EdgeId, InstanceType<OpenCascadeInstance['TopoDS_Edge']>>
  verticesById: Map<VertexId, InstanceType<OpenCascadeInstance['TopoDS_Vertex']>>
}

export function extractSolidShapes(
  oc: OpenCascadeInstance,
  shape: InstanceType<OpenCascadeInstance['TopoDS_Shape']>,
) {
  const solids: InstanceType<OpenCascadeInstance['TopoDS_Solid']>[] = []

  if ((shape.ShapeType() as unknown as number) === solidShapeType(oc)) {
    solids.push(oc.TopoDS.Solid_1(shape))
    return solids
  }

  const explorer = new oc.TopExp_Explorer_2(
    shape,
    solidShapeType(oc) as never,
    anyShapeType(oc) as never,
  )

  while (explorer.More()) {
    solids.push(oc.TopoDS.Solid_1(explorer.Current()))
    explorer.Next()
  }

  return solids
}

function enumerateFaces(
  oc: OpenCascadeInstance,
  bodyId: BodyId,
  shape: InstanceType<OpenCascadeInstance['TopoDS_Shape']>,
) {
  const faceIds: FaceId[] = []
  const facesById = new Map<FaceId, InstanceType<OpenCascadeInstance['TopoDS_Face']>>()
  const explorer = new oc.TopExp_Explorer_2(
    shape,
    faceShapeType(oc) as never,
    anyShapeType(oc) as never,
  )
  let index = 1

  while (explorer.More()) {
    const faceId = `face_${bodyId}_${index}` as FaceId
    faceIds.push(faceId)
    facesById.set(faceId, oc.TopoDS.Face_1(explorer.Current()))
    explorer.Next()
    index += 1
  }

  return { faceIds, facesById }
}

function enumerateEdges(
  oc: OpenCascadeInstance,
  bodyId: BodyId,
  shape: InstanceType<OpenCascadeInstance['TopoDS_Shape']>,
) {
  const edgeIds: EdgeId[] = []
  const edgesById = new Map<EdgeId, InstanceType<OpenCascadeInstance['TopoDS_Edge']>>()
  const explorer = new oc.TopExp_Explorer_2(
    shape,
    edgeShapeType(oc) as never,
    anyShapeType(oc) as never,
  )
  let index = 1

  while (explorer.More()) {
    const edgeId = `edge_${bodyId}_${index}` as EdgeId
    edgeIds.push(edgeId)
    edgesById.set(edgeId, oc.TopoDS.Edge_1(explorer.Current()))
    explorer.Next()
    index += 1
  }

  return { edgeIds, edgesById }
}

function enumerateVertices(
  oc: OpenCascadeInstance,
  bodyId: BodyId,
  shape: InstanceType<OpenCascadeInstance['TopoDS_Shape']>,
) {
  const vertexIds: VertexId[] = []
  const verticesById = new Map<VertexId, InstanceType<OpenCascadeInstance['TopoDS_Vertex']>>()
  const explorer = new oc.TopExp_Explorer_2(
    shape,
    vertexShapeType(oc) as never,
    anyShapeType(oc) as never,
  )
  let index = 1

  while (explorer.More()) {
    const vertexId = `vertex_${bodyId}_${index}` as VertexId
    vertexIds.push(vertexId)
    verticesById.set(vertexId, oc.TopoDS.Vertex_1(explorer.Current()))
    explorer.Next()
    index += 1
  }

  return { vertexIds, verticesById }
}

export function trackSolidBody(
  oc: OpenCascadeInstance,
  input: {
    bodyId: BodyId
    label: string
    ownerFeatureId: FeatureId | null
    shape: InstanceType<OpenCascadeInstance['TopoDS_Shape']>
  },
): OccTrackedBody {
  const solids = extractSolidShapes(oc, input.shape)

  if (solids.length !== 1) {
    throw new Error(
      `Body ${input.bodyId} must resolve to exactly one solid shape, received ${solids.length}.`,
    )
  }

  const [solid] = solids
  const faces = enumerateFaces(oc, input.bodyId, solid)
  const edges = enumerateEdges(oc, input.bodyId, solid)
  const vertices = enumerateVertices(oc, input.bodyId, solid)

  return {
    bodyId: input.bodyId,
    label: input.label,
    ownerFeatureId: input.ownerFeatureId,
    shape: solid,
    topology: {
      faceIds: faces.faceIds,
      edgeIds: edges.edgeIds,
      vertexIds: vertices.vertexIds,
    },
    facesById: faces.facesById,
    edgesById: edges.edgesById,
    verticesById: vertices.verticesById,
  }
}

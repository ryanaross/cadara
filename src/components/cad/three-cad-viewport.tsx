import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

import {
  selectionFilterAllowsTarget,
} from '@/domain/editor/schema'
import type { RenderableEntityRecord } from '@/contracts/render/schema'
import type { SketchSessionDisplayRenderable } from '@/domain/editor/sketch-session'
import { createWorkspaceScene } from '@/domain/workspace/scene-factory'
import {
  buildWorkspaceRenderScene,
  buildSketchDisplayGroup,
  resolvePickTarget,
  updateWorkspaceHighlight,
  type WorkspaceRenderScene,
} from '@/domain/workspace/render-picking'
import { snapCameraToVector } from '@/domain/workspace/view-navigation'
import { mapWorldPointToSketch } from '@/domain/modeling/occ/planes'
import { useEditorState } from '@/hooks/use-editor-state'

const GIZMO_DIRECTIONS = {
  front: new THREE.Vector3(0, -1, 0),
  back: new THREE.Vector3(0, 1, 0),
  right: new THREE.Vector3(1, 0, 0),
  left: new THREE.Vector3(-1, 0, 0),
  top: new THREE.Vector3(0, 0, 1),
  bottom: new THREE.Vector3(0, 0, -1),
} as const

const FACE_INDEX_TO_DIRECTION = {
  0: GIZMO_DIRECTIONS.right,
  1: GIZMO_DIRECTIONS.left,
  2: GIZMO_DIRECTIONS.top,
  3: GIZMO_DIRECTIONS.bottom,
  4: GIZMO_DIRECTIONS.front,
  5: GIZMO_DIRECTIONS.back,
} as const

interface ThreeCadViewportProps {
  renderables: RenderableEntityRecord[]
  sketchDisplayRenderables: SketchSessionDisplayRenderable[]
  onHover: (target: RenderableEntityRecord['binding']['target']) => void
  onSelect: (target: RenderableEntityRecord['binding']['target']) => void
  onClearHover: () => void
  onSketchMove: (point: readonly [number, number]) => void
  onSketchRelease: (point: readonly [number, number]) => void
}

interface ViewportRuntime {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  controls: OrbitControls
  gizmoScene: THREE.Scene
  gizmoCamera: THREE.PerspectiveCamera
  gizmoRenderer: THREE.WebGLRenderer
  gizmoCube: THREE.Mesh
  raycaster: THREE.Raycaster
  pointer: THREE.Vector2
  sketchPlane: THREE.Plane
  sketchHitPoint: THREE.Vector3
  animationFrameId: number
}

export function ThreeCadViewport({
  renderables,
  sketchDisplayRenderables,
  onHover,
  onSelect,
  onClearHover,
  onSketchMove,
  onSketchRelease,
}: ThreeCadViewportProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const gizmoRef = useRef<HTMLDivElement | null>(null)
  const runtimeRef = useRef<ViewportRuntime | null>(null)
  const renderSceneRef = useRef<WorkspaceRenderScene | null>(null)
  const sketchDisplayGroupRef = useRef<THREE.Group | null>(null)
  const hoverRef = useRef(onHover)
  const selectRef = useRef(onSelect)
  const clearHoverRef = useRef(onClearHover)
  const sketchMoveRef = useRef(onSketchMove)
  const sketchReleaseRef = useRef(onSketchRelease)
  const {
    state: { hoverTarget, selection, selectionFilter, selectionCatalog, sketchSession },
  } = useEditorState()
  const selectionRef = useRef(selection)
  const selectionFilterRef = useRef(selectionFilter)
  const selectionCatalogRef = useRef(selectionCatalog)

  useEffect(() => {
    hoverRef.current = onHover
    selectRef.current = onSelect
    clearHoverRef.current = onClearHover
    sketchMoveRef.current = onSketchMove
    sketchReleaseRef.current = onSketchRelease
    selectionRef.current = selection
    selectionFilterRef.current = selectionFilter
    selectionCatalogRef.current = selectionCatalog
  }, [
    onClearHover,
    onHover,
    onSelect,
    onSketchMove,
    onSketchRelease,
    selection,
    selectionCatalog,
    selectionFilter,
  ])

  useEffect(() => {
    const viewportElement = viewportRef.current
    const gizmoElement = gizmoRef.current

    if (!viewportElement || !gizmoElement) {
      return
    }

    const scene = createWorkspaceScene()
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000)
    camera.position.set(18, -16, 12)
    camera.up.set(0, 0, 1)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setClearColor(0x000000, 0)
    viewportElement.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, 0, 0)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.screenSpacePanning = true
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.PAN,
      RIGHT: THREE.MOUSE.ROTATE,
    }

    const gizmoScene = new THREE.Scene()
    const gizmoCamera = new THREE.PerspectiveCamera(35, 1, 0.1, 100)
    const gizmoRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    gizmoRenderer.setPixelRatio(window.devicePixelRatio)
    gizmoRenderer.setClearColor(0x000000, 0)
    gizmoElement.appendChild(gizmoRenderer.domElement)

    const gizmoCube = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 1.2, 1.2),
      [
        new THREE.MeshStandardMaterial({ color: 0x4b94ff, metalness: 0.15, roughness: 0.7 }),
        new THREE.MeshStandardMaterial({ color: 0x2e6fd1, metalness: 0.15, roughness: 0.7 }),
        new THREE.MeshStandardMaterial({ color: 0x7cc8ff, metalness: 0.15, roughness: 0.7 }),
        new THREE.MeshStandardMaterial({ color: 0x17365f, metalness: 0.15, roughness: 0.7 }),
        new THREE.MeshStandardMaterial({ color: 0x3f7fd8, metalness: 0.15, roughness: 0.7 }),
        new THREE.MeshStandardMaterial({ color: 0x234a8f, metalness: 0.15, roughness: 0.7 }),
      ],
    )

    gizmoScene.add(gizmoCube)
    gizmoScene.add(new THREE.AmbientLight(0xffffff, 1.4))

    const gizmoDirectionalLight = new THREE.DirectionalLight(0xffffff, 1.3)
    gizmoDirectionalLight.position.set(3, 4, 6)
    gizmoScene.add(gizmoDirectionalLight)

    const runtime: ViewportRuntime = {
      scene,
      camera,
      renderer,
      controls,
      gizmoScene,
      gizmoCamera,
      gizmoRenderer,
      gizmoCube,
      raycaster: new THREE.Raycaster(),
      pointer: new THREE.Vector2(),
      sketchPlane: new THREE.Plane(new THREE.Vector3(0, 0, 1), 0),
      sketchHitPoint: new THREE.Vector3(),
      animationFrameId: 0,
    }

    runtimeRef.current = runtime

    const resize = () => {
      const { clientWidth, clientHeight } = viewportElement
      renderer.setSize(clientWidth, clientHeight, false)
      camera.aspect = clientWidth / clientHeight
      camera.updateProjectionMatrix()

      const gizmoSize = Math.min(140, Math.max(110, clientWidth * 0.12))
      gizmoRenderer.setSize(gizmoSize, gizmoSize, false)
      gizmoCamera.aspect = 1
      gizmoCamera.updateProjectionMatrix()
    }

    const handleGizmoPointerDown = (event: PointerEvent) => {
      const rect = gizmoRenderer.domElement.getBoundingClientRect()
      runtime.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      runtime.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

      runtime.raycaster.setFromCamera(runtime.pointer, gizmoCamera)
      const [intersection] = runtime.raycaster.intersectObject(gizmoCube)

      if (!intersection?.face) {
        return
      }

      const direction =
        FACE_INDEX_TO_DIRECTION[
          intersection.face.materialIndex as keyof typeof FACE_INDEX_TO_DIRECTION
        ]

      if (!direction) {
        return
      }

      snapCameraToVector({
        camera,
        controls,
        direction,
      })
    }

    const animate = () => {
      const nextRuntime = runtimeRef.current

      if (!nextRuntime) {
        return
      }

      nextRuntime.controls.update()

      const orbitOffset = nextRuntime.camera.position
        .clone()
        .sub(nextRuntime.controls.target)
        .normalize()
      nextRuntime.gizmoCamera.position.copy(orbitOffset.multiplyScalar(4))
      nextRuntime.gizmoCamera.up.copy(nextRuntime.camera.up)
      nextRuntime.gizmoCamera.lookAt(0, 0, 0)

      nextRuntime.renderer.render(nextRuntime.scene, nextRuntime.camera)
      nextRuntime.gizmoRenderer.render(nextRuntime.gizmoScene, nextRuntime.gizmoCamera)
      nextRuntime.animationFrameId = window.requestAnimationFrame(animate)
    }

    const onContextMenu = (event: Event) => event.preventDefault()

    resize()
    runtime.animationFrameId = window.requestAnimationFrame(animate)

    window.addEventListener('resize', resize)
    renderer.domElement.addEventListener('contextmenu', onContextMenu)
    gizmoRenderer.domElement.addEventListener('pointerdown', handleGizmoPointerDown)

    return () => {
      window.cancelAnimationFrame(runtime.animationFrameId)
      window.removeEventListener('resize', resize)
      renderer.domElement.removeEventListener('contextmenu', onContextMenu)
      gizmoRenderer.domElement.removeEventListener('pointerdown', handleGizmoPointerDown)

      disposeRenderScene(renderSceneRef.current)
      renderSceneRef.current = null
      disposeSketchDisplayGroup(sketchDisplayGroupRef.current)
      sketchDisplayGroupRef.current = null
      runtimeRef.current = null

      controls.dispose()
      renderer.dispose()
      gizmoRenderer.dispose()

      viewportElement.removeChild(renderer.domElement)
      gizmoElement.removeChild(gizmoRenderer.domElement)
      scene.traverse((object: THREE.Object3D) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose()
          if (Array.isArray(object.material)) {
            object.material.forEach((material: THREE.Material) => material.dispose())
          } else {
            object.material.dispose()
          }
        }
      })
    }
  }, [])

  useEffect(() => {
    const runtime = runtimeRef.current

    if (!runtime) {
      return
    }

    disposeRenderScene(renderSceneRef.current)
    const nextScene = buildWorkspaceRenderScene(renderables)
    runtime.scene.add(nextScene.group)
    renderSceneRef.current = nextScene
  }, [renderables])

  useEffect(() => {
    const runtime = runtimeRef.current

    if (!runtime) {
      return
    }

    disposeSketchDisplayGroup(sketchDisplayGroupRef.current)
    const group = buildSketchDisplayGroup(sketchDisplayRenderables)
    runtime.scene.add(group)
    sketchDisplayGroupRef.current = group
  }, [sketchDisplayRenderables])

  useEffect(() => {
    if (!renderSceneRef.current) {
      return
    }

    updateWorkspaceHighlight(renderSceneRef.current.targetToObjects, selection, hoverTarget)
  }, [hoverTarget, selection])

  useEffect(() => {
    const runtime = runtimeRef.current
    const renderScene = renderSceneRef.current

    if (!runtime || !renderScene) {
      return
    }

    const canvas = runtime.renderer.domElement

    const projectSketchPoint = (event: PointerEvent): readonly [number, number] | null => {
      if (!sketchSession) {
        return null
      }

      const rect = canvas.getBoundingClientRect()
      runtime.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      runtime.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      runtime.raycaster.setFromCamera(runtime.pointer, runtime.camera)

      const { frame } = sketchSession.plane
      runtime.sketchPlane.set(
        new THREE.Vector3(frame.normal[0], frame.normal[1], frame.normal[2]),
        -(
          frame.normal[0] * frame.origin[0]
          + frame.normal[1] * frame.origin[1]
          + frame.normal[2] * frame.origin[2]
        ),
      )

      if (!runtime.raycaster.ray.intersectPlane(runtime.sketchPlane, runtime.sketchHitPoint)) {
        return null
      }

      return mapWorldPointToSketch(sketchSession.plane, [
        runtime.sketchHitPoint.x,
        runtime.sketchHitPoint.y,
        runtime.sketchHitPoint.z,
      ])
    }

    const handlePointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      runtime.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      runtime.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

      runtime.raycaster.setFromCamera(runtime.pointer, runtime.camera)
      const intersections = runtime.raycaster.intersectObjects(renderScene.pickables, true)
      const target = resolvePickTarget(intersections, renderScene.pickIdToRenderable)

      if (
        target &&
        selectionFilterAllowsTarget(
          selectionFilterRef.current,
          selectionRef.current,
          target.target,
          selectionCatalogRef.current,
        )
      ) {
        hoverRef.current(target.target)
      } else {
        clearHoverRef.current()
      }

      if (!sketchSession) {
        return
      }

      const point = projectSketchPoint(event)

      if (point) {
        sketchMoveRef.current(point)
      }
    }

    const handlePointerUp = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      runtime.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      runtime.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      runtime.raycaster.setFromCamera(runtime.pointer, runtime.camera)
      const intersections = runtime.raycaster.intersectObjects(renderScene.pickables, true)
      const target = resolvePickTarget(intersections, renderScene.pickIdToRenderable)
      const isSketchDrawingClick = sketchSession?.activeTool !== null

      if (
        !isSketchDrawingClick &&
        target &&
        selectionFilterAllowsTarget(
          selectionFilterRef.current,
          selectionRef.current,
          target.target,
          selectionCatalogRef.current,
        )
      ) {
        selectRef.current(target.target)
      }

      if (!sketchSession) {
        return
      }

      const point = projectSketchPoint(event)

      if (point) {
        sketchReleaseRef.current(point)
      }
    }

    const handlePointerLeave = () => {
      clearHoverRef.current()
    }

    canvas.addEventListener('pointermove', handlePointerMove)
    canvas.addEventListener('pointerup', handlePointerUp)
    canvas.addEventListener('pointerleave', handlePointerLeave)

    return () => {
      canvas.removeEventListener('pointermove', handlePointerMove)
      canvas.removeEventListener('pointerup', handlePointerUp)
      canvas.removeEventListener('pointerleave', handlePointerLeave)
    }
  }, [renderables, selection, sketchSession])

  return (
    <>
      <div ref={viewportRef} className="h-full w-full" />
      <div
        ref={gizmoRef}
        className="pointer-events-auto absolute right-4 top-4 h-[120px] w-[120px] overflow-hidden rounded-xl border border-[var(--cad-border-strong)] bg-[rgba(8,12,17,0.78)] shadow-[var(--cad-panel-shadow)]"
      />
    </>
  )
}

function disposeRenderScene(renderScene: WorkspaceRenderScene | null) {
  if (!renderScene) {
    return
  }

  renderScene.group.parent?.remove(renderScene.group)

  for (const object of [...renderScene.group.children]) {
    renderScene.group.remove(object)

    if (object instanceof THREE.Mesh) {
      object.geometry.dispose()

      if (Array.isArray(object.material)) {
        object.material.forEach((material) => material.dispose())
      } else {
        object.material.dispose()
      }
    }

    if (object instanceof THREE.Line || object instanceof THREE.Points) {
      object.geometry.dispose()

      if (Array.isArray(object.material)) {
        object.material.forEach((material) => material.dispose())
      } else {
        object.material.dispose()
      }
    }
  }
}

function disposeSketchDisplayGroup(group: THREE.Group | null) {
  if (!group) {
    return
  }

  group.parent?.remove(group)

  for (const object of [...group.children]) {
    group.remove(object)

    if (object instanceof THREE.Mesh) {
      object.geometry.dispose()

      if (Array.isArray(object.material)) {
        object.material.forEach((material) => material.dispose())
      } else {
        object.material.dispose()
      }
    }
  }
}

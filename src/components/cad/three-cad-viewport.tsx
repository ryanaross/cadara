import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

import { getPrimitiveRefLabel, selectionFilterAllowsTarget, type ViewportInteractionEvent } from '@/domain/editor/schema'
import { type SketchPlaneKey } from '@/domain/modeling/schema'
import type { RenderableEntityRecord } from '@/domain/modeling/schema'
import { createWorkspaceScene } from '@/domain/workspace/scene-factory'
import {
  buildWorkspaceRenderScene,
  resolvePickTarget,
  updateWorkspaceHighlight,
  type WorkspaceRenderScene,
} from '@/domain/workspace/render-picking'
import { snapCameraToVector } from '@/domain/workspace/view-navigation'
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
  onInteraction: (event: ViewportInteractionEvent) => void
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
  pointerDownTarget: EventTarget | null
}

export function ThreeCadViewport({ renderables, onInteraction }: ThreeCadViewportProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const gizmoRef = useRef<HTMLDivElement | null>(null)
  const runtimeRef = useRef<ViewportRuntime | null>(null)
  const renderSceneRef = useRef<WorkspaceRenderScene | null>(null)
  const onInteractionRef = useRef(onInteraction)
  const {
    state: { hoverTarget, selection, activeCommand, selectionFilter, sketchSession },
  } = useEditorState()

  onInteractionRef.current = onInteraction

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
      pointerDownTarget: null,
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

    const renderScene = buildWorkspaceRenderScene(renderables)
    renderSceneRef.current = renderScene
    runtime.scene.add(renderScene.group)

    const readPick = (event: PointerEvent) => {
      const rect = runtime.renderer.domElement.getBoundingClientRect()
      runtime.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      runtime.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

      runtime.raycaster.setFromCamera(runtime.pointer, runtime.camera)
      return resolvePickTarget(
        runtime.raycaster.intersectObjects(renderScene.pickables, false),
        renderScene.pickIdToRenderable,
      )
    }

    const readPlanePoint = (event: PointerEvent) => {
      const rect = runtime.renderer.domElement.getBoundingClientRect()
      runtime.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      runtime.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      runtime.raycaster.setFromCamera(runtime.pointer, runtime.camera)

      const planeNormal = getPlaneNormal(sketchSession?.planeKey ?? 'xy')
      runtime.sketchPlane.set(planeNormal, 0)

      return runtime.raycaster.ray.intersectPlane(runtime.sketchPlane, runtime.sketchHitPoint)
        ? ([runtime.sketchHitPoint.x, runtime.sketchHitPoint.y, runtime.sketchHitPoint.z] as const)
        : null
    }

    const handlePointerMove = (event: PointerEvent) => {
      const planePoint = readPlanePoint(event)

      if (planePoint) {
        onInteractionRef.current({ type: 'canvasMove', worldPosition: planePoint })
      }

      if (sketchSession) {
        return
      }

      const pickResult = readPick(event)

      if (!pickResult || !selectionFilterAllowsTarget(selectionFilter, pickResult.target)) {
        onInteractionRef.current({ type: 'clearHover' })
        return
      }

      onInteractionRef.current({ type: 'hover', target: pickResult.target })
    }

    const handlePointerLeave = () => {
      onInteractionRef.current({ type: 'clearHover' })
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) {
        return
      }
      runtime.pointerDownTarget = event.target

      if (sketchSession) {
        return
      }

      const pickResult = readPick(event)

      if (!pickResult || !selectionFilterAllowsTarget(selectionFilter, pickResult.target)) {
        return
      }

      onInteractionRef.current({ type: 'select', target: pickResult.target })
    }

    const handlePointerUp = (event: PointerEvent) => {
      if (event.button !== 0) {
        return
      }

       if (runtime.pointerDownTarget !== event.target) {
        runtime.pointerDownTarget = null
        return
      }

      runtime.pointerDownTarget = null

      const planePoint = readPlanePoint(event)

      if (planePoint) {
        onInteractionRef.current({ type: 'canvasPointerUp', worldPosition: planePoint })
      }
    }

    runtime.renderer.domElement.addEventListener('pointermove', handlePointerMove)
    runtime.renderer.domElement.addEventListener('pointerleave', handlePointerLeave)
    runtime.renderer.domElement.addEventListener('pointerdown', handlePointerDown)
    runtime.renderer.domElement.addEventListener('pointerup', handlePointerUp)
    updateWorkspaceHighlight(renderScene.targetToObjects, selection, hoverTarget)

    return () => {
      runtime.renderer.domElement.removeEventListener('pointermove', handlePointerMove)
      runtime.renderer.domElement.removeEventListener('pointerleave', handlePointerLeave)
      runtime.renderer.domElement.removeEventListener('pointerdown', handlePointerDown)
      runtime.renderer.domElement.removeEventListener('pointerup', handlePointerUp)

      if (renderSceneRef.current === renderScene) {
        disposeRenderScene(renderScene)
        renderSceneRef.current = null
      }
    }
  }, [renderables, selectionFilter, sketchSession])

  useEffect(() => {
    if (!renderSceneRef.current) {
      return
    }

    updateWorkspaceHighlight(renderSceneRef.current.targetToObjects, selection, hoverTarget)
  }, [hoverTarget, selection])

  return (
    <div className="relative h-full w-full">
      <div ref={viewportRef} className="h-full w-full" />
      <div className="pointer-events-none absolute left-4 top-18 rounded-xl border border-[var(--cad-border)] bg-[rgba(7,11,17,0.84)] px-3 py-2 text-xs text-[var(--cad-muted-foreground)] shadow-[var(--cad-panel-shadow)]">
        <div>
          Viewport event surface:{' '}
          <span className="text-[var(--cad-foreground)]">{activeCommand?.toolId ?? 'navigation'}</span>
        </div>
        <div>
          Hover:{' '}
          <span className="text-[var(--cad-foreground)]">
            {hoverTarget ? getPrimitiveRefLabel(hoverTarget) : 'none'}
          </span>
        </div>
        <div>
          Render bindings: <span className="text-[var(--cad-foreground)]">{renderables.length}</span>
        </div>
      </div>
      <div className="pointer-events-none absolute right-4 top-4 flex flex-col items-end gap-2">
        <div className="rounded-md border border-[var(--cad-border)] bg-[rgba(10,14,20,0.88)] px-2 py-1 text-[10px] font-medium uppercase tracking-[0.24em] text-[var(--cad-muted)] shadow-[var(--cad-panel-shadow)]">
          View Cube
        </div>
        <div
          ref={gizmoRef}
          className="pointer-events-auto overflow-hidden rounded-xl border border-[var(--cad-border-strong)] bg-[linear-gradient(180deg,_rgba(18,25,35,0.92),_rgba(7,11,17,0.92))] shadow-[var(--cad-panel-shadow)]"
        />
      </div>
    </div>
  )
}

function getPlaneNormal(planeKey: SketchPlaneKey) {
  if (planeKey === 'yz') {
    return new THREE.Vector3(1, 0, 0)
  }

  if (planeKey === 'xz') {
    return new THREE.Vector3(0, 1, 0)
  }

  return new THREE.Vector3(0, 0, 1)
}

function disposeRenderScene(renderScene: WorkspaceRenderScene | null) {
  if (!renderScene) {
    return
  }

  renderScene.group.removeFromParent()
  renderScene.group.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose()
      if (Array.isArray(object.material)) {
        object.material.forEach((material) => material.dispose())
      } else {
        object.material.dispose()
      }
    }
  })
}

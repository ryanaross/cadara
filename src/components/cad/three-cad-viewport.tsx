import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

import { createWorkspaceScene } from '@/domain/workspace/scene-factory'
import { snapCameraToVector } from '@/domain/workspace/view-navigation'

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

export function ThreeCadViewport() {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const gizmoRef = useRef<HTMLDivElement | null>(null)

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

    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()

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
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

      raycaster.setFromCamera(pointer, gizmoCamera)
      const [intersection] = raycaster.intersectObject(gizmoCube)

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
      controls.update()

      const orbitOffset = camera.position.clone().sub(controls.target).normalize()
      gizmoCamera.position.copy(orbitOffset.multiplyScalar(4))
      gizmoCamera.up.copy(camera.up)
      gizmoCamera.lookAt(0, 0, 0)

      renderer.render(scene, camera)
      gizmoRenderer.render(gizmoScene, gizmoCamera)
      animationFrameId = window.requestAnimationFrame(animate)
    }

    const onContextMenu = (event: Event) => event.preventDefault()

    let animationFrameId = window.requestAnimationFrame(animate)

    resize()
    window.addEventListener('resize', resize)
    renderer.domElement.addEventListener('contextmenu', onContextMenu)
    gizmoRenderer.domElement.addEventListener('pointerdown', handleGizmoPointerDown)

    return () => {
      window.cancelAnimationFrame(animationFrameId)
      window.removeEventListener('resize', resize)
      renderer.domElement.removeEventListener('contextmenu', onContextMenu)
      gizmoRenderer.domElement.removeEventListener('pointerdown', handleGizmoPointerDown)

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

  return (
    <div className="relative h-full w-full">
      <div
        ref={viewportRef}
        className="h-full w-full"
      />
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

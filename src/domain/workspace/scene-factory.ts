import * as THREE from 'three'

function createReferencePlane(
  size: number,
  rotation: THREE.Euler,
  color: number,
  position = new THREE.Vector3(),
) {
  const geometry = new THREE.PlaneGeometry(size, size)
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.08,
    side: THREE.DoubleSide,
  })

  const plane = new THREE.Mesh(geometry, material)
  plane.rotation.copy(rotation)
  plane.position.copy(position)

  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry),
    new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.3,
    }),
  )
  edges.rotation.copy(rotation)
  edges.position.copy(position)

  const group = new THREE.Group()
  group.add(plane)
  group.add(edges)

  return group
}

export function createWorkspaceScene() {
  const scene = new THREE.Scene()
  scene.background = null
  scene.add(new THREE.AmbientLight(0xffffff, 0.9))

  const keyLight = new THREE.DirectionalLight(0xbcd7ff, 1.4)
  keyLight.position.set(16, -12, 18)
  scene.add(keyLight)

  const fillLight = new THREE.DirectionalLight(0x6f8dab, 0.55)
  fillLight.position.set(-14, 18, 10)
  scene.add(fillLight)

  const grid = new THREE.GridHelper(100, 100, 0x43566e, 0x2a3543)
  grid.rotation.x = Math.PI / 2
  scene.add(grid)

  scene.add(
    createReferencePlane(28, new THREE.Euler(0, 0, 0), 0x3f7fd8),
    createReferencePlane(28, new THREE.Euler(0, Math.PI / 2, 0), 0x45b5e5),
    createReferencePlane(28, new THREE.Euler(Math.PI / 2, 0, 0), 0x2d5d8f),
  )

  const axes = new THREE.AxesHelper(8)
  scene.add(axes)

  const originMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 16, 16),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x2f6fd2,
      emissiveIntensity: 0.6,
      roughness: 0.35,
      metalness: 0.1,
    }),
  )
  scene.add(originMarker)

  return scene
}

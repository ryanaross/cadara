import * as THREE from 'three'

function createReferencePlane(
  size: number,
  rotation: THREE.Euler,
  color: number,
  position = new THREE.Vector3(),
) {
  const geometry = new THREE.PlaneGeometry(size, size)
  geometry.translate(size / 2, size / 2, 0)
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.14,
    side: THREE.DoubleSide,
    depthWrite: false,
  })

  const plane = new THREE.Mesh(geometry, material)
  plane.rotation.copy(rotation)
  plane.position.copy(position)

  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry),
    new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    }),
  )
  edges.rotation.copy(rotation)
  edges.position.copy(position)

  const group = new THREE.Group()
  group.add(plane)
  group.add(edges)
  plane.renderOrder = -2
  edges.renderOrder = -1

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

  const originPlaneSize = 5;
  scene.add(
    createReferencePlane(originPlaneSize, new THREE.Euler(0, 0, 0), 0x4f9cff),
    createReferencePlane(originPlaneSize, new THREE.Euler(0, Math.PI / -2, 0), 0x35c7a5),
    createReferencePlane(originPlaneSize, new THREE.Euler(Math.PI / 2, 0, 0), 0xff9b4a),
  )

  const axes = new THREE.AxesHelper(originPlaneSize)
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

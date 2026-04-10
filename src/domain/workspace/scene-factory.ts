import * as THREE from 'three'

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

  const originPlaneSize = 5
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

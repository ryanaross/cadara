import * as THREE from 'three'

export function createWorkspaceScene() {
  const scene = new THREE.Scene()
  scene.background = null
  scene.add(new THREE.AmbientLight(0xd7dfe9, 0.56))

  const skyLight = new THREE.HemisphereLight(0xe8edf5, 0x253447, 0.62)
  skyLight.position.set(0, 0, 1)
  scene.add(skyLight)

  const keyLight = new THREE.DirectionalLight(0xf5eee2, 1.45)
  keyLight.position.set(14, -16, 28)
  scene.add(keyLight)

  const fillLight = new THREE.DirectionalLight(0x91b4d8, 0.52)
  fillLight.position.set(-12, 14, 18)
  scene.add(fillLight)

  const rimLight = new THREE.DirectionalLight(0xb6d6f5, 0.18)
  rimLight.position.set(-14, -10, 12)
  scene.add(rimLight)

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

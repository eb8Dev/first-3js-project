import * as THREE from "three"

export function initScene(canvas) {
  // Scene
  const scene = new THREE.Scene()
  scene.fog = new THREE.Fog("#9db3c8", 10, 80)

  // Sky color
  scene.background = new THREE.Color("#9db3c8")

  // Camera
  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    200
  )
  const baseFov = 60
  camera.fov = baseFov
  camera.updateProjectionMatrix()

  // Renderer
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
  })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap

  // Lights
  scene.add(new THREE.AmbientLight(0xffffff, 0.5))

  const sun = new THREE.DirectionalLight(0xffffff, 1.2)
  sun.position.set(10, 20, 10)
  sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
  sun.shadow.camera.near = 1
  sun.shadow.camera.far = 60
  sun.shadow.camera.left = -40
  sun.shadow.camera.right = 40
  sun.shadow.camera.top = 40
  sun.shadow.camera.bottom = -40

  scene.add(sun.target)
  scene.add(sun)

  // Ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshStandardMaterial({
      color: "#6c8c6a",
      roughness: 1,
    })
  )
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  scene.add(ground)

  // Circular F1-style track
  const trackRadius = 60
  const trackWidth = 8

  const minTrackRadius = trackRadius - trackWidth + 1.5
  const maxTrackRadius = trackRadius + trackWidth - 1.5

  const track = new THREE.Mesh(
    new THREE.TorusGeometry(trackRadius, trackWidth, 32, 200),
    new THREE.MeshStandardMaterial({
      color: "#2a2a2a",
      roughness: 0.95,
      metalness: 0.05,
    })
  )
  track.rotation.x = Math.PI / 2
  track.position.y = 0.02
  track.receiveShadow = true
  scene.add(track)

  // Track curbs (red / white)
  const curbMaterialRed = new THREE.MeshStandardMaterial({ color: "#c40018" })
  const curbMaterialWhite = new THREE.MeshStandardMaterial({ color: "#ffffff" })

  // Flat inner curb (no dome / no black layer)
  const innerCurb = new THREE.Mesh(
    new THREE.RingGeometry(
      trackRadius - trackWidth + 0.8,
      trackRadius - trackWidth + 2.2,
      256
    ),
    new THREE.MeshStandardMaterial({
      color: "#c40018",
      roughness: 0.9,
      metalness: 0,
      side: THREE.DoubleSide,
    })
  )
  innerCurb.rotation.x = -Math.PI / 2
  innerCurb.position.y = 0.021
  innerCurb.receiveShadow = true
  scene.add(innerCurb)

  const outerCurb = new THREE.Mesh(
    new THREE.TorusGeometry(trackRadius + trackWidth - 1, 1.2, 16, 200),
    curbMaterialWhite
  )
  outerCurb.rotation.x = Math.PI / 2
  outerCurb.position.y = 0.025
  outerCurb.receiveShadow = true
  scene.add(outerCurb)

  // Simple scenery
  const treeMaterial = new THREE.MeshStandardMaterial({ color: "#3a5f3a" })
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: "#8b5a2b" })

  const treeColliders = []

  for (let i = 0; i < 40; i++) {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.25, 1.5, 8),
      trunkMaterial
    )
    const leaves = new THREE.Mesh(
      new THREE.SphereGeometry(0.8, 8, 8),
      treeMaterial
    )

    trunk.castShadow = true
    leaves.castShadow = true

    const x = (Math.random() - 0.5) * 160
    const z = (Math.random() - 0.5) * 160

    trunk.position.set(x, 0.75, z)
    leaves.position.set(x, 1.8, z)

    scene.add(trunk)
    scene.add(leaves)

    treeColliders.push(new THREE.Box3().setFromObject(trunk))
  }

  // Car
  const car = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.6, 3),
    new THREE.MeshStandardMaterial({ color: "#ff3b3b" })
  )
  car.position.set(trackRadius, 0.3, 0)
  car.rotation.y = Math.PI
  car.castShadow = true
  scene.add(car)
  sun.target.position.copy(car.position)

  // Wheels
  const wheelGeometry = new THREE.CylinderGeometry(0.35, 0.35, 0.3, 16)
  const wheelMaterial = new THREE.MeshStandardMaterial({ color: "#222222" })

  const frontWheels = []
  const rearWheels = []

  const wheelData = [
    { x: -0.7, z:  1.1, front: true },
    { x:  0.7, z:  1.1, front: true },
    { x: -0.7, z: -1.1, front: false },
    { x:  0.7, z: -1.1, front: false },
  ]

  wheelData.forEach(({ x, z, front }) => {
    const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial)
    wheel.rotation.z = Math.PI / 2
    wheel.position.set(x, 0.15, z)
    wheel.castShadow = true
    car.add(wheel)

    front ? frontWheels.push(wheel) : rearWheels.push(wheel)
  })

  // Controls
  const keys = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    cameraSwitch: false,
  }

  // Vehicle physics values
  let velocity = 0
  const acceleration = 0.0025
  const brakeForce = 0.004
  const maxSpeed = 0.15
  const friction = 0.98
  const turnSpeed = 0.03

  // Input handlers
  const onKeyDown = (e) => {
    if (e.key === "w" || e.key === "ArrowUp") keys.forward = true
    if (e.key === "s" || e.key === "ArrowDown") keys.backward = true
    if (e.key === "a" || e.key === "ArrowLeft") keys.left = true
    if (e.key === "d" || e.key === "ArrowRight") keys.right = true
    if (e.key === "c" || e.key === "C") {
      if (!keys.cameraSwitch) {
        activeCameraMode = (activeCameraMode + 1) % cameraModes.length
        keys.cameraSwitch = true
      }
    }
  }

  const onKeyUp = (e) => {
    if (e.key === "w" || e.key === "ArrowUp") keys.forward = false
    if (e.key === "s" || e.key === "ArrowDown") keys.backward = false
    if (e.key === "a" || e.key === "ArrowLeft") keys.left = false
    if (e.key === "d" || e.key === "ArrowRight") keys.right = false
    if (e.key === "c" || e.key === "C") keys.cameraSwitch = false
  }

  window.addEventListener("keydown", onKeyDown)
  window.addEventListener("keyup", onKeyUp)

  // Clock
  const clock = new THREE.Clock()

  // Camera modes (offsets in LOCAL space)
  const cameraModes = [
    { name: "chase",  offset: new THREE.Vector3(0, 4, -8) },   // default chase
    { name: "close",  offset: new THREE.Vector3(0, 2.5, -4) }, // close chase
    { name: "top",    offset: new THREE.Vector3(0, 12, -0.1) },// top-down
    { name: "side",   offset: new THREE.Vector3(8, 3, 0) },    // side view
  ]

  let activeCameraMode = 0

  const animate = () => {
    const delta = clock.getDelta()

    // Steering (only when moving)
    if (Math.abs(velocity) > 0.002) {
      if (keys.left) car.rotation.y += turnSpeed
      if (keys.right) car.rotation.y -= turnSpeed
    }

    // Acceleration / braking
    if (keys.forward) velocity += acceleration
    if (keys.backward) velocity -= brakeForce

    // Clamp speed
    velocity = THREE.MathUtils.clamp(velocity, -maxSpeed * 0.5, maxSpeed)

    // Friction
    velocity *= friction

    // Move car
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(car.quaternion)
    car.position.add(forward.multiplyScalar(velocity))

    // Keep car within track boundaries (between red & black lines)
    const dx = car.position.x
    const dz = car.position.z
    const currentRadius = Math.sqrt(dx * dx + dz * dz)

    if (currentRadius > 0.0001) {
      const clampedRadius = THREE.MathUtils.clamp(
        currentRadius,
        minTrackRadius,
        maxTrackRadius
      )

      car.position.x = (dx / currentRadius) * clampedRadius
      car.position.z = (dz / currentRadius) * clampedRadius
    }

    // Front wheel steering
    const steerAngle = THREE.MathUtils.clamp(
      (keys.left ? 1 : 0) - (keys.right ? 1 : 0),
      -1,
      1
    ) * 0.4

    frontWheels.forEach(wheel => {
      wheel.rotation.y = steerAngle
      wheel.rotation.x -= velocity * 20
    })

    rearWheels.forEach(wheel => {
      wheel.rotation.x -= velocity * 20
    })

    // Speed-based FOV
    const speedRatio = Math.abs(velocity) / maxSpeed
    camera.fov = THREE.MathUtils.lerp(baseFov, 70, speedRatio)
    camera.updateProjectionMatrix()

    // Tree collision
    const carBox = new THREE.Box3().setFromObject(car)
    treeColliders.forEach(box => {
      if (box.intersectsBox(carBox)) {
        velocity *= -0.3
      }
    })

    // Sun follows car (shadow fix)
    sun.position.lerp(
      new THREE.Vector3(
        car.position.x + 15,
        25,
        car.position.z + 15
      ),
      0.08
    )

    sun.target.position.copy(car.position)

    // Camera sway on turns
    const sway = THREE.MathUtils.clamp(
      (keys.left ? 1 : 0) - (keys.right ? 1 : 0),
      -1,
      1
    ) * 0.15

    camera.rotation.z = THREE.MathUtils.lerp(
      camera.rotation.z,
      -sway,
      0.1
    )

    // Camera follow (CORRECT way)
    const activeOffset = cameraModes[activeCameraMode].offset
    const desiredCameraPosition = activeOffset
      .clone()
      .applyQuaternion(car.quaternion)
      .add(car.position)

    camera.position.lerp(desiredCameraPosition, 0.08)
    camera.lookAt(car.position)

    renderer.render(scene, camera)
    requestAnimationFrame(animate)
  }

  animate()

  // Resize
  const onResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  }

  window.addEventListener("resize", onResize)

  // Cleanup
  return () => {
    window.removeEventListener("keydown", onKeyDown)
    window.removeEventListener("keyup", onKeyUp)
    window.removeEventListener("resize", onResize)
    renderer.dispose()
  }
}
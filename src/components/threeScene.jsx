import * as THREE from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"

const MODEL_PATH = "/porsche_992_gt3_r.glb"

const TRACK_POINTS = [
  [-54, 0, 18],
  [-40, 0, 48],
  [-4, 0, 58],
  [32, 0, 48],
  [62, 0, 18],
  [48, 0, -8],
  [22, 0, -16],
  [50, 0, -42],
  [24, 0, -62],
  [-12, 0, -48],
  [-42, 0, -64],
  [-68, 0, -38],
  [-52, 0, -10],
  [-78, 0, 4],
]

function seededRandom(seed) {
  let value = seed
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296
    return value / 4294967296
  }
}

function getKeyId(event) {
  if (event.key === "w" || event.key === "ArrowUp") return "w"
  if (event.key === "a" || event.key === "ArrowLeft") return "a"
  if (event.key === "s" || event.key === "ArrowDown") return "s"
  if (event.key === "d" || event.key === "ArrowRight") return "d"
  if (event.key === "Shift") return "shift"
  if (event.key === "c" || event.key === "C") return "c"
  if (event.key === "r" || event.key === "R") return "r"
  return null
}

function createTextSprite(text, color = "#ffffff") {
  const canvas = document.createElement("canvas")
  canvas.width = 1024
  canvas.height = 192

  const context = canvas.getContext("2d")
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = "rgba(0, 0, 0, 0.38)"
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.strokeStyle = "rgba(255, 255, 255, 0.24)"
  context.lineWidth = 8
  context.strokeRect(8, 8, canvas.width - 16, canvas.height - 16)
  context.fillStyle = color
  context.font = "800 76px Arial"
  context.textAlign = "center"
  context.textBaseline = "middle"
  context.fillText(text, canvas.width / 2, canvas.height / 2)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  })

  const sprite = new THREE.Sprite(material)
  sprite.scale.set(22, 4.1, 1)
  return sprite
}

function createTrackData() {
  const curve = new THREE.CatmullRomCurve3(
    TRACK_POINTS.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    true,
    "catmullrom",
    0.36
  )

  const sampleCount = 720
  const samples = []

  for (let i = 0; i < sampleCount; i += 1) {
    const u = i / sampleCount
    const point = curve.getPointAt(u)
    const tangent = curve.getTangentAt(u).normalize()
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize()
    samples.push({ u, point, tangent, normal })
  }

  return { curve, samples }
}

function createTrackMesh(samples, width, material, y = 0.026) {
  const positions = []
  const uvs = []
  const indices = []

  samples.forEach(({ point, normal }, index) => {
    const left = point.clone().addScaledVector(normal, width / 2)
    const right = point.clone().addScaledVector(normal, -width / 2)
    positions.push(left.x, y, left.z, right.x, y, right.z)
    uvs.push(0, index / 18, 1, index / 18)
  })

  for (let i = 0; i < samples.length; i += 1) {
    const next = (i + 1) % samples.length
    const a = i * 2
    const b = i * 2 + 1
    const c = next * 2
    const d = next * 2 + 1
    indices.push(a, b, c, b, d, c)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()

  const mesh = new THREE.Mesh(geometry, material)
  mesh.receiveShadow = true
  return mesh
}

function createTrackLine(samples, offset, width, color, y = 0.047) {
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.75,
    side: THREE.DoubleSide,
  })
  const positions = []
  const uvs = []
  const indices = []

  samples.forEach(({ point, normal }, index) => {
    const center = point.clone().addScaledVector(normal, offset)
    const left = center.clone().addScaledVector(normal, width / 2)
    const right = center.clone().addScaledVector(normal, -width / 2)
    positions.push(left.x, y, left.z, right.x, y, right.z)
    uvs.push(0, index / 24, 1, index / 24)
  })

  for (let i = 0; i < samples.length; i += 1) {
    const next = (i + 1) % samples.length
    indices.push(i * 2, i * 2 + 1, next * 2, i * 2 + 1, next * 2 + 1, next * 2)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()

  const mesh = new THREE.Mesh(geometry, material)
  mesh.receiveShadow = true
  return mesh
}

function createCurbSegments(samples, side, trackWidth) {
  const group = new THREE.Group()
  const red = new THREE.MeshStandardMaterial({ color: "#cf2431", roughness: 0.82, side: THREE.DoubleSide })
  const white = new THREE.MeshStandardMaterial({ color: "#f7f3e8", roughness: 0.78, side: THREE.DoubleSide })
  const segmentLength = 10
  const gap = 5

  for (let i = 0; i < samples.length; i += segmentLength + gap) {
    const segmentSamples = []
    for (let j = 0; j < segmentLength; j += 1) {
      segmentSamples.push(samples[(i + j) % samples.length])
    }

    const material = Math.floor(i / (segmentLength + gap)) % 2 === 0 ? red : white
    group.add(createTrackMesh(segmentSamples, 1.2, material, 0.06).translateOnAxis(
      new THREE.Vector3(),
      0
    ))

    const curb = group.children[group.children.length - 1]
    const positions = curb.geometry.attributes.position
    for (let p = 0; p < positions.count; p += 1) {
      const sample = segmentSamples[Math.floor(p / 2) % segmentSamples.length]
      positions.setXYZ(
        p,
        positions.getX(p) + sample.normal.x * side * ((trackWidth / 2) + 0.35),
        positions.getY(p),
        positions.getZ(p) + sample.normal.z * side * ((trackWidth / 2) + 0.35)
      )
    }
    positions.needsUpdate = true
    curb.geometry.computeVertexNormals()
  }

  return group
}

function createBarrier(samples, side, trackWidth, material) {
  const curvePoints = samples.map(({ point, normal }) =>
    point.clone().addScaledVector(normal, side * (trackWidth / 2 + 2.2)).setY(0.9)
  )
  const curve = new THREE.CatmullRomCurve3(curvePoints, true, "catmullrom", 0.2)
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 360, 0.28, 8, true), material)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

function findClosestTrackSample(position, samples) {
  let closest = samples[0]
  let closestDistance = Infinity
  let closestIndex = 0

  for (let i = 0; i < samples.length; i += 3) {
    const point = samples[i].point
    const distance = (position.x - point.x) ** 2 + (position.z - point.z) ** 2
    if (distance < closestDistance) {
      closestDistance = distance
      closest = samples[i]
      closestIndex = i
    }
  }

  return { sample: closest, distance: Math.sqrt(closestDistance), index: closestIndex }
}

function prepareTexture(texture, repeatX = 1, repeatY = 1) {
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(repeatX, repeatY)
  return texture
}

function applyModelTextures(model, textureLoader) {
  const textureSet = {
    body: prepareTexture(textureLoader.load("/textures/pink_EXT_Skin_1.png")),
    carbon: prepareTexture(textureLoader.load("/textures/carbon_n_vecarz.png")),
    detailsNormal: textureLoader.load("/textures/ext_details_nm.png"),
    rim: prepareTexture(textureLoader.load("/textures/rim_base_map.jpg")),
    tireNormal: textureLoader.load("/textures/tyre_dry_nm.png"),
    interior: prepareTexture(textureLoader.load("/textures/intgrigiooctans1_diff.png")),
    interiorNormal: textureLoader.load("/textures/intgrigiooctans1_diff_nm.png"),
    decals: prepareTexture(textureLoader.load("/textures/int_decals_colour.png")),
  }

  textureSet.detailsNormal.wrapS = THREE.RepeatWrapping
  textureSet.detailsNormal.wrapT = THREE.RepeatWrapping
  textureSet.tireNormal.wrapS = THREE.RepeatWrapping
  textureSet.tireNormal.wrapT = THREE.RepeatWrapping
  textureSet.interiorNormal.wrapS = THREE.RepeatWrapping
  textureSet.interiorNormal.wrapT = THREE.RepeatWrapping

  model.traverse((child) => {
    if (!child.isMesh || !child.material) return

    const materials = Array.isArray(child.material) ? child.material : [child.material]
    materials.forEach((material) => {
      const name = material.name.toLowerCase()
      material.needsUpdate = true
      material.envMapIntensity = 0.8

      if (name.includes("carpaint") || name.includes("banner")) {
        material.map = textureSet.body
        material.roughness = 0.38
        material.metalness = 0.15
      }

      if (name.includes("carbon") || name.includes("kevlar")) {
        material.normalMap = textureSet.carbon
        material.roughness = 0.55
      }

      if (name.includes("details") || name.includes("mechanics")) {
        material.normalMap = textureSet.detailsNormal
      }

      if (name.includes("rim")) {
        material.map = textureSet.rim
        material.roughness = 0.32
        material.metalness = 0.72
      }

      if (name.includes("tyre") || name.includes("tire")) {
        material.normalMap = textureSet.tireNormal
        material.roughness = 0.9
      }

      if (name.includes("int_") || name.includes("seat") || name.includes("dash")) {
        material.map = textureSet.interior
        material.normalMap = textureSet.interiorNormal
      }

      if (name.includes("decal")) {
        material.map = textureSet.decals
      }
    })
  })
}

function createWheelPivots(model) {
  const pivots = []
  const wheelNames = ["WHEEL_LF", "WHEEL_RF", "WHEEL_LR", "WHEEL_RR"]

  model.updateMatrixWorld(true)

  wheelNames.forEach((name) => {
    const wheelGroup = model.getObjectByName(name)
    if (!wheelGroup || !wheelGroup.parent) return

    const parent = wheelGroup.parent
    const box = new THREE.Box3().setFromObject(wheelGroup)
    const centerWorld = box.getCenter(new THREE.Vector3())
    const centerLocal = parent.worldToLocal(centerWorld.clone())
    const pivot = new THREE.Group()

    pivot.name = `${name}_PIVOT`
    pivot.position.copy(centerLocal)
    parent.add(pivot)
    parent.updateMatrixWorld(true)

    const children = [...wheelGroup.children]
    children.forEach((child) => {
      pivot.attach(child)
    })

    wheelGroup.visible = false
    pivots.push({
      pivot,
      isFront: name.includes("LF") || name.includes("RF"),
      roll: 0,
      steer: 0,
    })
  })

  return pivots
}

function fitModelToCar(model, wheelPivots, textureLoader) {
  const box = new THREE.Box3().setFromObject(model)
  const size = box.getSize(new THREE.Vector3())
  const maxAxis = Math.max(size.x, size.y, size.z)
  const scale = 4.5 / maxAxis

  model.scale.setScalar(scale)
  model.rotation.y = 0

  const centeredBox = new THREE.Box3().setFromObject(model)
  const center = centeredBox.getCenter(new THREE.Vector3())
  model.position.sub(center)

  const fittedBox = new THREE.Box3().setFromObject(model)
  model.position.y -= fittedBox.min.y

  model.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true
      child.receiveShadow = true
    }
  })

  applyModelTextures(model, textureLoader)
  wheelPivots.push(...createWheelPivots(model))
}

export function initScene(canvas, onStats = () => {}) {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color("#86b4d1")
  scene.fog = new THREE.Fog("#86b4d1", 60, 175)

  const camera = new THREE.PerspectiveCamera(
    58,
    window.innerWidth / window.innerHeight,
    0.1,
    320
  )

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
  })

  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05

  const textureLoader = new THREE.TextureLoader()
  const grassTexture = prepareTexture(textureLoader.load("/textures/internal_ground_ao_texture.jpeg"), 38, 38)

  const hemi = new THREE.HemisphereLight("#dcefff", "#556949", 1.75)
  scene.add(hemi)

  const sun = new THREE.DirectionalLight("#fff2d2", 3.1)
  sun.position.set(18, 34, 12)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.camera.near = 1
  sun.shadow.camera.far = 110
  sun.shadow.camera.left = -70
  sun.shadow.camera.right = 70
  sun.shadow.camera.top = 70
  sun.shadow.camera.bottom = -70
  scene.add(sun.target)
  scene.add(sun)

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(300, 300),
    new THREE.MeshStandardMaterial({
      color: "#5f855c",
      map: grassTexture,
      roughness: 0.98,
    })
  )
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  scene.add(ground)

  const { samples } = createTrackData()
  const trackWidth = 10
  const roadTexture = prepareTexture(textureLoader.load("/textures/styrofoam_nm.png"), 1.5, 90)
  const roadMaterial = new THREE.MeshStandardMaterial({
    color: "#24272b",
    roughness: 0.94,
    metalness: 0.02,
    normalMap: roadTexture,
    normalScale: new THREE.Vector2(0.25, 0.25),
    side: THREE.DoubleSide,
  })

  scene.add(createTrackMesh(samples, trackWidth, roadMaterial, 0.025))
  scene.add(createTrackLine(samples, 0, 0.16, "#dad8cb", 0.047))
  scene.add(createTrackLine(samples, trackWidth / 2 - 0.45, 0.18, "#f4f1e7", 0.052))
  scene.add(createTrackLine(samples, -trackWidth / 2 + 0.45, 0.18, "#f4f1e7", 0.052))
  scene.add(createCurbSegments(samples, 1, trackWidth))
  scene.add(createCurbSegments(samples, -1, trackWidth))

  const barrierMaterial = new THREE.MeshStandardMaterial({
    color: "#27343b",
    roughness: 0.68,
    metalness: 0.38,
  })
  scene.add(createBarrier(samples, 1, trackWidth, barrierMaterial))
  scene.add(createBarrier(samples, -1, trackWidth, barrierMaterial))

  const startSample = samples[0]
  const startLine = new THREE.Mesh(
    new THREE.PlaneGeometry(trackWidth, 1.1),
    new THREE.MeshStandardMaterial({
      color: "#f5f2ea",
      roughness: 0.7,
      side: THREE.DoubleSide,
    })
  )
  startLine.rotation.x = -Math.PI / 2
  startLine.rotation.z = Math.atan2(startSample.tangent.z, startSample.tangent.x)
  startLine.position.set(startSample.point.x, 0.06, startSample.point.z)
  startLine.receiveShadow = true
  scene.add(startLine)

  const pitMaterial = new THREE.MeshStandardMaterial({ color: "#ece7dc", roughness: 0.6 })
  const glassMaterial = new THREE.MeshStandardMaterial({
    color: "#7897aa",
    roughness: 0.16,
    metalness: 0.12,
  })

  for (let i = 0; i < 8; i += 1) {
    const garage = new THREE.Mesh(new THREE.BoxGeometry(5.4, 2.2, 3.2), pitMaterial)
    garage.position.set(-42 + i * 5.8, 1.1, 65)
    garage.castShadow = true
    garage.receiveShadow = true
    scene.add(garage)

    const window = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.8, 0.08), glassMaterial)
    window.position.set(garage.position.x, 1.45, 63.35)
    scene.add(window)
  }

  const badge = createTextSprite("APEX RUSH GP", "#f7f4ed")
  badge.position.set(-10, 8.5, 70)
  scene.add(badge)

  const rng = seededRandom(81)
  const treeMaterial = new THREE.MeshStandardMaterial({ color: "#2f6846", roughness: 0.9 })
  const treeMaterialDark = new THREE.MeshStandardMaterial({ color: "#1f4f3f", roughness: 0.92 })
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: "#6d5338", roughness: 1 })
  const sceneryColliders = []

  for (let i = 0; i < 120; i += 1) {
    const angle = rng() * Math.PI * 2
    const radius = 35 + rng() * 105
    const x = Math.cos(angle) * radius
    const z = Math.sin(angle) * radius
    const closest = findClosestTrackSample(new THREE.Vector3(x, 0, z), samples)

    if (closest.distance < trackWidth / 2 + 8) continue

    const trunkHeight = 1.2 + rng() * 1.1
    const crownSize = 1.1 + rng() * 1.35
    const tree = new THREE.Group()

    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.28, trunkHeight, 7),
      trunkMaterial
    )
    trunk.position.y = trunkHeight / 2
    trunk.castShadow = true
    tree.add(trunk)

    const leaves = new THREE.Mesh(
      new THREE.ConeGeometry(crownSize, crownSize * 2.1, 8),
      rng() > 0.5 ? treeMaterial : treeMaterialDark
    )
    leaves.position.y = trunkHeight + crownSize * 0.85
    leaves.castShadow = true
    tree.add(leaves)

    tree.position.set(x, 0, z)
    tree.rotation.y = rng() * Math.PI
    scene.add(tree)
    sceneryColliders.push(new THREE.Sphere(new THREE.Vector3(x, 0, z), crownSize * 0.8))
  }

  const car = new THREE.Group()
  car.position.copy(startSample.point).setY(0.08)
  car.rotation.y = Math.atan2(startSample.tangent.x, startSample.tangent.z)
  scene.add(car)
  sun.target.position.copy(car.position)

  const fallbackCar = new THREE.Group()
  const fallbackBody = new THREE.Mesh(
    new THREE.BoxGeometry(2, 0.55, 4.1),
    new THREE.MeshStandardMaterial({ color: "#d82732", roughness: 0.42, metalness: 0.2 })
  )
  fallbackBody.position.y = 0.55
  fallbackBody.castShadow = true
  fallbackCar.add(fallbackBody)

  const fallbackCabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.35, 0.55, 1.3),
    new THREE.MeshStandardMaterial({ color: "#101923", roughness: 0.25, metalness: 0.1 })
  )
  fallbackCabin.position.set(0, 1.05, -0.25)
  fallbackCabin.castShadow = true
  fallbackCar.add(fallbackCabin)
  car.add(fallbackCar)

  const wheelPivots = []
  const loader = new GLTFLoader()
  let modelReady = false
  let disposed = false

  loader.load(
    MODEL_PATH,
    (gltf) => {
      if (disposed) return
      const model = gltf.scene
      fitModelToCar(model, wheelPivots, textureLoader)
      fallbackCar.visible = false
      car.add(model)
      modelReady = true
    },
    undefined,
    () => {
      modelReady = true
    }
  )

  const keys = {
    w: false,
    a: false,
    s: false,
    d: false,
    shift: false,
    c: false,
    r: false,
  }

  let velocity = 0
  let lap = 0
  let lastClosestIndex = 0
  let animationFrameId = 0
  let lastStatsUpdate = 0
  let steerAmount = 0

  const maxSpeed = 83.33
  const reverseMaxSpeed = 16
  const acceleration = 18
  const boostAcceleration = 42
  const brakeForce = 24
  const drag = 0.58
  const offTrackDrag = 2.2
  const steering = 2.35
  const curbLimit = trackWidth / 2 + 1.6
  const wallLimit = trackWidth / 2 + 2.05

  const cameraModes = [
    { name: "Chase", offset: new THREE.Vector3(0, 4.6, -11), look: new THREE.Vector3(0, 1, 5) },
    { name: "Close", offset: new THREE.Vector3(0, 2.6, -5.4), look: new THREE.Vector3(0, 0.8, 3.2) },
    { name: "Top", offset: new THREE.Vector3(0, 24, -0.4), look: new THREE.Vector3(0, 0, 0) },
    { name: "Side", offset: new THREE.Vector3(11, 3.6, 0), look: new THREE.Vector3(0, 1, 1.5) },
  ]
  let activeCameraMode = 0

  function resetCar() {
    car.position.copy(startSample.point).setY(0.08)
    car.rotation.set(0, Math.atan2(startSample.tangent.x, startSample.tangent.z), 0)
    velocity = 0
    steerAmount = 0
  }

  const onKeyDown = (event) => {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(event.key)) {
      event.preventDefault()
    }

    const keyId = getKeyId(event)
    if (!keyId) return

    if (keyId === "r") resetCar()

    if (keyId === "c") {
      if (!keys.c) {
        activeCameraMode = (activeCameraMode + 1) % cameraModes.length
      }
    }

    keys[keyId] = true
  }

  const onKeyUp = (event) => {
    const keyId = getKeyId(event)
    if (keyId) keys[keyId] = false
  }

  window.addEventListener("keydown", onKeyDown)
  window.addEventListener("keyup", onKeyUp)

  const clock = new THREE.Clock()

  function animate() {
    if (disposed) return

    const delta = Math.min(clock.getDelta(), 0.04)
    const closest = findClosestTrackSample(car.position, samples)
    const onTrack = closest.distance <= curbLimit
    const throttle = keys.w ? 1 : 0
    const brake = keys.s ? 1 : 0
    const activeAcceleration = keys.shift ? boostAcceleration : acceleration

    velocity += throttle * activeAcceleration * delta
    velocity -= brake * brakeForce * delta
    velocity -= velocity * (onTrack ? drag : offTrackDrag) * delta
    velocity = THREE.MathUtils.clamp(velocity, -reverseMaxSpeed, maxSpeed)

    const speedRatio = Math.abs(velocity) / maxSpeed
    const speedFactor = THREE.MathUtils.clamp(0.28 + speedRatio * 0.72, 0.28, 1)
    const targetSteer = (keys.a ? 1 : 0) - (keys.d ? 1 : 0)
    const steerResponse = targetSteer === 0 ? 7.5 : 4.8
    steerAmount = THREE.MathUtils.damp(steerAmount, targetSteer, steerResponse, delta)

    if (Math.abs(velocity) > 0.4) {
      const direction = velocity >= 0 ? 1 : -1
      const boostTurn = keys.shift ? 1.08 : 1
      car.rotation.y += steerAmount * steering * speedFactor * boostTurn * direction * delta
    }

    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(car.quaternion)
    car.position.addScaledVector(forward, velocity * delta)

    const corrected = findClosestTrackSample(car.position, samples)
    if (corrected.distance > wallLimit) {
      const carToTrack = car.position.clone().sub(corrected.sample.point)
      const side = Math.sign(carToTrack.dot(corrected.sample.normal)) || 1
      const edge = corrected.sample.point
        .clone()
        .addScaledVector(corrected.sample.normal, side * wallLimit)
      car.position.x = edge.x
      car.position.z = edge.z
      velocity *= 0.88
    }

    for (const collider of sceneryColliders) {
      if (collider.distanceToPoint(car.position) < 1.45) {
        const away = car.position.clone().sub(collider.center).normalize()
        car.position.x += away.x * 0.35
        car.position.z += away.z * 0.35
        velocity *= -0.2
      }
    }

    if (lastClosestIndex > samples.length * 0.82 && corrected.index < samples.length * 0.14 && velocity > 6) {
      lap += 1
    }
    lastClosestIndex = corrected.index

    wheelPivots.forEach((wheel) => {
      wheel.roll += (velocity * delta) / 0.34
      wheel.steer = THREE.MathUtils.lerp(
        wheel.steer,
        wheel.isFront ? steerAmount * 0.34 : 0,
        0.24
      )
      wheel.pivot.rotation.set(wheel.roll, wheel.steer, 0)
    })

    sun.position.lerp(
      new THREE.Vector3(car.position.x + 20, 36, car.position.z + 16),
      0.08
    )
    sun.target.position.copy(car.position)

    const activeCamera = cameraModes[activeCameraMode]
    const desiredPosition = activeCamera.offset.clone().applyQuaternion(car.quaternion).add(car.position)
    const desiredLookAt = activeCamera.look.clone().applyQuaternion(car.quaternion).add(car.position)

    camera.position.lerp(desiredPosition, 1 - Math.pow(0.002, delta))
    camera.lookAt(desiredLookAt)
    camera.fov = THREE.MathUtils.lerp(58, 75, speedRatio)
    camera.updateProjectionMatrix()

    const now = performance.now()
    if (now - lastStatsUpdate > 80) {
      onStats({
        speed: Math.round(Math.abs(velocity) * 3.6),
        lap,
        camera: activeCamera.name,
        loading: !modelReady,
        keys: { ...keys },
      })
      lastStatsUpdate = now
    }

    renderer.render(scene, camera)
    animationFrameId = requestAnimationFrame(animate)
  }

  animate()

  const onResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  }

  window.addEventListener("resize", onResize)

  return () => {
    disposed = true
    cancelAnimationFrame(animationFrameId)
    window.removeEventListener("keydown", onKeyDown)
    window.removeEventListener("keyup", onKeyUp)
    window.removeEventListener("resize", onResize)

    scene.traverse((object) => {
      if (object.geometry) object.geometry.dispose()
      if (object.material) {
        const materials = Array.isArray(object.material) ? object.material : [object.material]
        materials.forEach((material) => {
          if (material.map) material.map.dispose()
          if (material.normalMap) material.normalMap.dispose()
          material.dispose()
        })
      }
    })

    renderer.dispose()
  }
}

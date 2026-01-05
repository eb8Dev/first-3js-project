import React, { useRef, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Sky } from "@react-three/drei";
import { Physics, useBox } from "@react-three/cannon";
import * as THREE from "three";

// --- Car ---
function Car() {
  const carRef = useRef();
  const api = useRef();
  const velocity = useRef([0, 0, 0]);
  const controls = useRef({ forward: 0, backward: 0, left: 0, right: 0 });
  const steerAngle = useRef(0);
  const maxSteer = 0.05;

  // Car body physics
  const [ref, carApi] = useBox(() => ({
    mass: 1500,
    args: [4, 1.5, 2],
    position: [0, 2, 0],
    angularDamping: 0.5,
    linearDamping: 0.2,
    allowSleep: false,
  }));

  carRef.current = ref;
  api.current = carApi;

  // Key controls
  useEffect(() => {
    const down = (e) => {
      if (e.key === "ArrowUp" || e.key === "w") controls.current.forward = 1;
      if (e.key === "ArrowDown" || e.key === "s") controls.current.backward = 1;
      if (e.key === "ArrowLeft" || e.key === "a") controls.current.left = 1;
      if (e.key === "ArrowRight" || e.key === "d") controls.current.right = 1;
    };
    const up = (e) => {
      if (e.key === "ArrowUp" || e.key === "w") controls.current.forward = 0;
      if (e.key === "ArrowDown" || e.key === "s") controls.current.backward = 0;
      if (e.key === "ArrowLeft" || e.key === "a") controls.current.left = 0;
      if (e.key === "ArrowRight" || e.key === "d") controls.current.right = 0;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // Movement logic
  useFrame(() => {
    if (!carRef.current) return;

    const forwardForce = 8000;
    const maxSpeed = 50;

    // Get car rotation
    carApi.rotation.subscribe(([rx, ry, rz]) => {
      // steering drift
      if (controls.current.left) steerAngle.current = THREE.MathUtils.clamp(steerAngle.current + 0.001, -maxSteer, maxSteer);
      else if (controls.current.right) steerAngle.current = THREE.MathUtils.clamp(steerAngle.current - 0.001, -maxSteer, maxSteer);
      else steerAngle.current *= 0.9; // self-centering
    });

    // Apply forward/backward force along local Z axis
    if (controls.current.forward || controls.current.backward) {
      const localZ = controls.current.forward ? -1 : 1;
      const force = localZ * forwardForce;

      // Use car's current rotation to get forward direction
      carApi.rotation.subscribe(([rx, ry, rz]) => {
        const forward = new THREE.Vector3(0, 0, 1);
        forward.applyAxisAngle(new THREE.Vector3(0, 1, 0), ry + steerAngle.current); // drifting
        carApi.applyForce([forward.x * force, 0, forward.z * force], [0, 0, 0]);
      });
    }

    // Apply angular velocity for smooth turning
    if (controls.current.left || controls.current.right) {
      carApi.angularVelocity.set(0, steerAngle.current * 50, 0);
    } else {
      carApi.angularVelocity.set(0, 0, 0);
    }
  });

  // --- Car mesh with wheels ---
  return (
    <group ref={ref}>
      <mesh castShadow>
        <boxGeometry args={[4, 1.5, 2]} />
        <meshStandardMaterial color="red" />
      </mesh>

      {/* Wheels */}
      {[-1.5, 1.5].map((x, i) =>
        [-1, 1].map((z, j) => (
          <mesh key={`${i}-${j}`} position={[x, -0.75, z]}>
            <cylinderGeometry args={[0.5, 0.5, 0.4, 16]} />
            <meshStandardMaterial color="black" />
          </mesh>
        ))
      )}
    </group>
  );
}

// --- Physical Ground Tile ---
function GroundTile({ position }) {
  const [ref] = useBox(() => ({
    args: [50, 1, 50],
    position: position,
    mass: 0, // static
  }));

  return (
    <mesh ref={ref} receiveShadow>
      <boxGeometry args={[50, 1, 50]} />
      <meshStandardMaterial color="#228B22" />
    </mesh>
  );
}

// --- Infinite Ground Manager ---
function InfiniteGround({ carRef }) {
  const tiles = useRef([]);
  for (let x = -1; x <= 1; x++) {
    for (let z = -1; z <= 1; z++) {
      tiles.current.push([x * 50, -0.5, z * 50]);
    }
  }

  useFrame(() => {
    if (!carRef.current) return;
    carRef.current.position.subscribe(([cx, , cz]) => {
      tiles.current = tiles.current.map(([x, y, z]) => {
        let nx = x;
        let nz = z;
        if (cx - x > 50) nx += 150;
        if (cx - x < -50) nx -= 150;
        if (cz - z > 50) nz += 150;
        if (cz - z < -50) nz -= 150;
        return [nx, y, nz];
      });
    });
  });

  return tiles.current.map(([x, y, z], i) => <GroundTile key={i} position={[x, y, z]} />);
}

// --- Camera Follow ---
function CameraFollow({ carRef }) {
  const { camera } = useThree();
  useFrame(() => {
    if (!carRef.current) return;
    carRef.current.position.subscribe(([x, y, z]) => {
      camera.position.lerp(new THREE.Vector3(x, y + 10, z + 15), 0.1);
      camera.lookAt(new THREE.Vector3(x, y + 1, z));
    });
  });
  return null;
}


// --- Main Scene ---
export default function CarGame() {
  const carRef = useRef();
  return (
    <div tabIndex={0} style={{ width: "100vw", height: "100vh", outline: "none" }}>
      <Canvas shadows camera={{ position: [0, 10, 20], fov: 60 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[50, 100, 50]} intensity={1} castShadow />
        <Sky sunPosition={[100, 20, 100]} />
        <Physics gravity={[0, -9.8, 0]}>
          <Car ref={carRef} />
          <InfiniteGround carRef={carRef} />
        </Physics>
        <CameraFollow carRef={carRef} />
        <OrbitControls target={[0, 0, 0]} maxPolarAngle={Math.PI / 2} enablePan={false} />
      </Canvas>
    </div>
  );
}


// this is it
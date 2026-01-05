import { useEffect, useRef } from "react"
import { initScene } from "./threeScene"

export default function ExperienceCanvas() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const cleanup = initScene(canvasRef.current)
    return cleanup
  }, [])

  return <canvas ref={canvasRef} className="webgl" />
}
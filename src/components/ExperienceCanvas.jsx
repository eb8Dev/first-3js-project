import { useEffect, useRef } from "react"
import { initScene } from "./threeScene"

export default function ExperienceCanvas({ onStats }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const cleanup = initScene(canvasRef.current, onStats)
    return cleanup
  }, [onStats])

  return <canvas ref={canvasRef} className="webgl" />
}

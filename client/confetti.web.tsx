import { useEffect, useRef, useState } from "react";
import type { ConfettiOptions } from "../shared/settings";
import { createConfetti } from "./confetti-physics";

/** Browser-only drawing boundary; no React state updates during animation frames. */
export function Confetti({
  eventId,
  width,
  height,
  options,
}: {
  eventId: string | null;
  width: number;
  height: number;
  options: ConfettiOptions;
}) {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const [simulation] = useState(() => createConfetti(width, height, Math.random, options));
  useEffect(() => simulation.configure(options), [options, simulation]);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (eventId) {
      simulation.start();
      setRunning(true);
    } else simulation.stop();
  }, [eventId, simulation]);
  useEffect(() => () => simulation.clear(), [simulation]);
  useEffect(() => {
    if (!running || !canvas.current) return;
    const surface = canvas.current;
    const context = surface.getContext("2d");
    if (!context) return;
    simulation.resize(width, height);
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    surface.width = Math.round(width * ratio);
    surface.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    let frame = 0;
    let previous = performance.now();
    const draw = (now: number) => {
      simulation.step((now - previous) / 1000);
      previous = now;
      context.clearRect(0, 0, width, height);
      for (const particle of simulation.particles) {
        const face = Math.cos(particle.flip);
        context.save();
        context.translate(particle.x, particle.y);
        context.rotate(particle.angle);
        // Project a turning sheet: it narrows edge-on and shows a darker reverse side.
        context.transform(
          1,
          Math.sin(particle.flip + particle.phase) * 0.18,
          Math.sin(particle.flip) * 0.25,
          face,
          0,
          0,
        );
        context.fillStyle = face >= 0 ? particle.color : particle.backColor;
        context.fillRect(
          -particle.width / 2,
          -particle.height / 2,
          particle.width,
          particle.height,
        );
        context.restore();
      }
      if (!simulation.emitting && simulation.particles.length === 0) {
        setRunning(false);
        return;
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [running, simulation, width, height]);
  return running ? (
    <canvas
      ref={canvas}
      data-testid="confetti"
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
    />
  ) : null;
}

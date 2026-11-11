import { useEffect } from "react";
import { motion, useMotionValue, useSpring, useReducedMotion } from "framer-motion";

const blobs = [
  { className: "blob blob-a", x: [0, 120, -60, 0], y: [0, 80, 140, 0], d: 26 },
  { className: "blob blob-b", x: [0, -140, 40, 0], y: [0, 60, -90, 0], d: 32 },
  { className: "blob blob-c", x: [0, 90, -110, 0], y: [0, -70, 40, 0], d: 22 }
];

/** Slow drifting aurora, a masked dot grid and a soft pointer spotlight. */
export default function Aurora({ energy = 0 }) {
  const reduce = useReducedMotion();
  const mx = useMotionValue(-600);
  const my = useMotionValue(-600);
  const sx = useSpring(mx, { stiffness: 60, damping: 20 });
  const sy = useSpring(my, { stiffness: 60, damping: 20 });

  useEffect(() => {
    if (reduce) return undefined;
    const onMove = (event) => { mx.set(event.clientX - 300); my.set(event.clientY - 300); };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [reduce, mx, my]);

  return (
    <div className="aurora" aria-hidden="true">
      {blobs.map((blob) => (
        <motion.div
          key={blob.className}
          className={blob.className}
          animate={reduce ? undefined : { x: blob.x, y: blob.y, scale: [1, 1.12 + energy * 0.15, 0.95, 1] }}
          transition={{ duration: blob.d / (1 + energy), repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
      <div className="grid-dots" />
      <motion.div className="spotlight" style={{ x: sx, y: sy }} />
      <div className="grain" />
    </div>
  );
}

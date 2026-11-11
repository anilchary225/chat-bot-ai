import { useEffect, useId, useRef, useState } from "react";
import { motion, useAnimationFrame, useMotionValue, useSpring, useReducedMotion } from "framer-motion";

const RX = 0.7;
const RY = 0.2;
const TILT = (-18 * Math.PI) / 180;

/** Tilted planetary orbit: `half` = "back" (behind the globe) or "front". */
function OrbitArc({ id, half }) {
  return (
    <svg className={`orb-orbit ${half}`} viewBox="-0.85 -0.85 1.7 1.7" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-g`} gradientUnits="userSpaceOnUse" x1="-0.7" y1="0" x2="0.7" y2="0">
          <stop offset="0" stopColor="var(--amber)" stopOpacity="0.35" />
          <stop offset="0.5" stopColor="var(--amber)" />
          <stop offset="1" stopColor="var(--mint)" />
        </linearGradient>
        <clipPath id={`${id}-${half}`}>
          <rect x="-1" y={half === "back" ? -1 : 0} width="2" height="1" />
        </clipPath>
      </defs>
      <g transform="rotate(-18)">
        <ellipse cx="0" cy="0" rx={RX} ry={RY} fill="none" stroke={`url(#${id}-g)`} strokeWidth="0.035" clipPath={`url(#${id}-${half})`} opacity={half === "back" ? 0.5 : 1} />
      </g>
    </svg>
  );
}

/**
 * Zenoxi's "living" orb. It blinks, follows the pointer (when `track`),
 * scans while thinking and pulses while streaming. `still` renders a calm,
 * non-looping version for history avatars so the page stays light.
 */
export default function Orb({ size = 40, state = "idle", track = false, still = false, className = "" }) {
  const ref = useRef(null);
  const moonRef = useRef(null);
  const uid = useId().replace(/:/g, "");
  const reduce = useReducedMotion();
  const live = !still && !reduce;
  const [blink, setBlink] = useState(false);

  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const ex = useSpring(px, { stiffness: 160, damping: 16, mass: 0.4 });
  const ey = useSpring(py, { stiffness: 160, damping: 16, mass: 0.4 });

  useEffect(() => {
    if (!live) return undefined;
    let timer;
    const loop = () => {
      timer = setTimeout(() => {
        setBlink(true);
        setTimeout(() => setBlink(false), 130);
        loop();
      }, 2200 + Math.random() * 3200);
    };
    loop();
    return () => clearTimeout(timer);
  }, [live]);

  useEffect(() => {
    if (!track || !live) return undefined;
    const onMove = (event) => {
      const box = ref.current?.getBoundingClientRect();
      if (!box) return;
      const dx = event.clientX - (box.left + box.width / 2);
      const dy = event.clientY - (box.top + box.height / 2);
      const dist = Math.hypot(dx, dy) || 1;
      const reach = Math.min(1, dist / 420) * size * 0.07;
      px.set((dx / dist) * reach);
      py.set((dy / dist) * reach);
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [track, live, size, px, py]);

  const thinking = state === "thinking";
  const period = thinking ? 1600 : state === "streaming" ? 2600 : 7000;
  const placeMoon = (angle) => {
    const el = moonRef.current;
    if (!el) return;
    const ox = RX * Math.cos(angle);
    const oy = RY * Math.sin(angle);
    const x = ox * Math.cos(TILT) - oy * Math.sin(TILT);
    const y = ox * Math.sin(TILT) + oy * Math.cos(TILT);
    el.style.transform = `translate(${x}em, ${y}em)`;
    el.style.zIndex = Math.sin(angle) > 0 ? 5 : 0;
  };
  const angleRef = useRef(0.45);
  const lastRef = useRef(null);
  useAnimationFrame((time) => {
    if (!live) { lastRef.current = null; placeMoon(0.45); return; }
    const dt = lastRef.current == null ? 0 : time - lastRef.current;
    lastRef.current = time;
    angleRef.current += (dt / period) * Math.PI * 2;
    placeMoon(angleRef.current);
  });

  const streaming = state === "streaming";
  const eyeScale = blink ? 0.12 : thinking ? 0.5 : streaming ? 0.85 : 1;

  return (
    <div
      ref={ref}
      className={`orb ${className}`}
      data-state={state}
      style={{ "--orb": `${size}px` }}
      aria-hidden="true"
    >
      <motion.div
        className="orb-halo"
        animate={live ? { scale: streaming ? [1, 1.18, 1] : thinking ? [1, 1.1, 1] : [1, 1.05, 1], opacity: [0.65, 1, 0.65] } : undefined}
        transition={{ duration: streaming ? 1.1 : thinking ? 1.6 : 4, repeat: Infinity, ease: "easeInOut" }}
      />
      <OrbitArc id={uid} half="back" />
      <motion.div
        className="orb-core"
        animate={live ? {
          borderRadius: ["50% 50% 50% 50%", "46% 54% 52% 48%", "53% 47% 46% 54%", "50% 50% 50% 50%"],
          rotate: [0, 8, -6, 0]
        } : undefined}
        transition={{ duration: thinking ? 2.2 : 7, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="orb-shine" />
      <motion.div className="orb-eyes" style={{ x: ex, y: ey }}>
        <motion.div
          className="orb-eyes-inner"
          animate={live && thinking ? { x: [-size * 0.06, size * 0.06, -size * 0.06] } : { x: 0 }}
          transition={thinking ? { duration: 1.4, repeat: Infinity, ease: "easeInOut" } : { duration: 0.3 }}
        >
          {[0, 1].map((eye) => (
            <motion.span
              key={eye}
              className="orb-eye"
              animate={{ scaleY: eyeScale }}
              transition={{ duration: blink ? 0.06 : 0.25 }}
            />
          ))}
        </motion.div>
      </motion.div>
      <OrbitArc id={uid} half="front" />
      <span ref={moonRef} className="orb-moon" />
    </div>
  );
}

import React, { useEffect, useRef, useState } from "react";

const words = [
  "example",
  "words",
  "for",
  "the",
  "game",
  "react",
  "type",
  "royale",
];

export default function Game() {
  const [enemies, setEnemies] = useState([]);
  const [input, setInput] = useState("");
  const [target, setTarget] = useState(null);
  const nextId = useRef(0);

  // game dimensions (px) - keep stable refs so effects don't require them as deps
  const dims = useRef({ width: 600, height: 600, playerRadius: 22 });
  const width = dims.current.width;
  const height = dims.current.height;
  const cx = width / 2;
  const cy = height / 2;
  const spawnRadius = Math.min(width, height) / 2 - 40; // spawn on the circle
  const playerRadius = dims.current.playerRadius;

  // spawn an enemy on the circle perimeter at random angle
  useEffect(() => {
    const interval = setInterval(() => {
      const angle = Math.random() * Math.PI * 2;
      const x = cx + Math.cos(angle) * spawnRadius;
      const y = cy + Math.sin(angle) * spawnRadius;
      // direction toward center
      const dx = cx - x;
      const dy = cy - y;
      const dist = Math.hypot(dx, dy) || 1;
      const speed = 0.6 + Math.random() * 0.8; // px per tick
      const vx = (dx / dist) * speed;
      const vy = (dy / dist) * speed;

      const newEnemy = {
        id: nextId.current++,
        word: words[Math.floor(Math.random() * words.length)],
        x,
        y,
        vx,
        vy,
        alive: true,
        reached: false,
      };
      setEnemies((prev) => [...prev, newEnemy]);
    }, 1800);
    return () => clearInterval(interval);
    // DONT remove comment below !!!
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // move enemies toward player (center)
  useEffect(() => {
    const tickMs = 30;
    const move = setInterval(() => {
      setEnemies((prev) =>
        prev
          .map((e) => {
            if (!e.alive || e.reached) return e;
            const nx = e.x + e.vx;
            const ny = e.y + e.vy;
            const d = Math.hypot(nx - cx, ny - cy);
            if (d <= playerRadius) {
              return { ...e, x: nx, y: ny, reached: true };
            }
            return { ...e, x: nx, y: ny };
          })
          // keep a reasonable limit of enemies (will change this in the future, as time progress there will be more enemies)
          .slice(-40)
      );
    }, tickMs);
    return () => clearInterval(move);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // find nearest enemy to player center IMPROVE THIS TO ADD TRACKER UI
  useEffect(() => {
    const { width, height } = dims.current;
    const cxLocal = width / 2;
    const cyLocal = height / 2;
    const alive = enemies.filter((e) => e.alive && !e.reached);
    if (alive.length > 0) {
      const nearest = alive.reduce((a, b) => {
        const da = Math.hypot(a.x - cxLocal, a.y - cyLocal);
        const db = Math.hypot(b.x - cxLocal, b.y - cyLocal);
        return da < db ? a : b;
      });
      setTarget(nearest);
    } else {
      setTarget(null);
    }
  }, [enemies]);

  // check typed word kills target
  useEffect(() => {
    if (!target) return;
    if (input === target.word) {
      setEnemies((prev) =>
        prev.map((e) => (e.id === target.id ? { ...e, alive: false } : e))
      );
      setInput("");
    }
  }, [input, target]);

  // keyboard input (typing)
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Backspace") {
        setInput((i) => i.slice(0, -1));
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        setInput((i) => i + e.key.toLowerCase());
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // compute distance to target
  const targetDistance = target
    ? Math.hypot(target.x - cx, target.y - cy)
    : null;

  return (
    <div className="p-5 font-mono text-slate-900 dark:text-white">
      <h2 className="text-2xl font-bold">Type royale 🧟</h2>

      <div
        className="mt-3 rounded-lg border-2 border-slate-800 relative overflow-hidden mx-auto"
        style={{
          width,
          height,
          background:
            "radial-gradient(circle at 50% 50%, #e8f0ff 0%, #cfe0ff 40%, #9fbaff 100%)",
        }}
      >
        {/* player in center */}
        <div
          title="player"
          className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center text-lg"
          style={{
            left: cx,
            top: cy,
            width: playerRadius * 2,
            height: playerRadius * 2,
            borderRadius: "50%",
            background: "linear-gradient(180deg,#fff,#ffd36b)",
            border: "3px solid #333",
          }}
        >
          ⌨️
        </div>

        {/* enemies */}
        {enemies.map((e) => {
          const isTarget = target && target.id === e.id;
          const bgClass = e.alive ? "bg-emerald-400" : "bg-slate-600";
          return (
            <div
              key={e.id}
              title={e.word}
              className={`absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-opacity`}
              style={{ left: e.x, top: e.y, opacity: e.alive ? 1 : 0.35 }}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${bgClass} border-slate-800 shadow ${
                  isTarget ? "ring-2 ring-yellow-400" : ""
                }`}
                style={{ fontSize: 18 }}
              >
                🧟
              </div>
              <div className="text-center mt-1 text-xs text-slate-900 dark:text-white">
                {e.alive ? e.word : "DEAD"}
              </div>
            </div>
          );
        })}
      </div>

      {/* tracker box outside the game area */}
      <div className="mt-3 p-2 bg-white/90 dark:bg-slate-800/90 backdrop-blur rounded-md flex items-center gap-3 border border-slate-300 dark:border-slate-700">
        <div className="min-w-[120px]">
          <div className="text-xs text-slate-500 dark:text-slate-300">
            Closest
          </div>
          <div className="font-semibold text-sm">
            {target ? target.word : "None"}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm">
            {targetDistance ? `${Math.round(targetDistance)}px` : "—"}
          </div>
        </div>
        <div className="ml-auto text-sm text-slate-600 dark:text-slate-300">
          Enemies: {enemies.filter((e) => e.alive).length}
        </div>
      </div>

      <div className="flex gap-3 items-center mt-3">
        <div>Target: {target?.word || "none"}</div>
        <div>Input: {input}</div>
        <div className="ml-auto">
          Enemies: {enemies.filter((e) => e.alive).length}
        </div>
      </div>
    </div>
  );
}

// small presentational arrow that points toward the target relative to cx/cy
function TrackerArrow({ target, cx, cy }) {
  const dx = target.x - cx;
  const dy = target.y - cy;
  const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  return (
    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center border border-slate-300 dark:border-slate-600">
      <div style={{ transform: `rotate(${angleDeg}deg)` }}>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M12 2L19 21H12L12 2Z" fill="#1f2937" />
        </svg>
      </div>
    </div>
  );
}

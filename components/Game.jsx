import React, { useEffect, useRef, useState } from "react";

import { allWords } from "../libs/words";
import { initAudio, loadGunshot, playGunshot } from "../libs/gunshot";
import useInterpolation from "../hooks/useInterpolation";
// Game expects socketData to be passed from parent when used in multiplayer mode.
// Do not call useSocket here to avoid duplicate socket connections.
export default function Game({ socketData } = {}) {
  const [enemies, setEnemies] = useState([]);
  const [input, setInput] = useState("");
  const [target, setTarget] = useState(null);
  const nextId = useRef(0);

  // socketData should be passed from parent (App). If not provided, treat as
  // offline single-player (connected=false).
  const {
    connected = false,
    match = null,
    serverEnemies = [],
    roomPlayers = null,
    sendHit = () => {},
  } = socketData || {};

  // Use interpolation for smooth multiplayer movement (like Tetris.io)
  const interpolatedEnemies = useInterpolation(serverEnemies);
  const displayEnemies = connected && match ? interpolatedEnemies : enemies;

  // game timing (adjust totalGameSeconds to 180 for 3min or 240 for 4min)
  const startTime = useRef(Date.now());
  const totalGameSeconds = 340; // 4 minutes target difficulty ramp
  const [elapsed, setElapsed] = useState(0);

  // player health and game state
  const [hearts, setHearts] = useState(3);
  const [gameOver, setGameOver] = useState(false);
  // ref for movement interval so we can clear it from other code
  const moveIntervalRef = useRef(null);
  // mirror ref for gameOver so long-running effects can check it without adding deps
  const gameOverRef = useRef(false);
  useEffect(() => {
    gameOverRef.current = gameOver;
  }, [gameOver]);

  useEffect(() => {
    // prefetch sample (best-effort)
    loadGunshot("/gunshot.wav").catch(() => {
      /* ignore, fallback synth will be used */
    });

    // Many browsers require a user gesture to unlock audio. Resume on first click/keydown.
    const resume = async () => {
      try {
        const ctx = await initAudio();
        if (typeof ctx.resume === "function") await ctx.resume();
      } catch {
        /* ignore */
      }
      window.removeEventListener("click", resume);
      window.removeEventListener("keydown", resume);
    };
    window.addEventListener("click", resume, { once: true });
    window.addEventListener("keydown", resume, { once: true });

    return () => {
      window.removeEventListener("click", resume);
      window.removeEventListener("keydown", resume);
    };
  }, []);
  // refs for spawn control and death detection
  const spawnTimeoutRef = useRef(null);
  const scheduleNextRef = useRef(null);
  const prevAliveRef = useRef({});

  // game dimensions (px) - keep stable refs so effects don't require them as deps
  const dims = useRef({ width: 600, height: 600, playerRadius: 22 });
  const width = dims.current.width;
  const height = dims.current.height;
  const cx = width / 2;
  const cy = height / 2;
  const spawnRadius = Math.min(width, height) / 2 - 40; // spawn on the circle
  const playerRadius = dims.current.playerRadius;

  // spawn an enemy on the circle perimeter at random angle with dynamic spawn interval
  // In multiplayer matches the server is authoritative for spawning/movement,
  // so skip local spawn scheduling when connected to a match.
  useEffect(() => {
    if (connected && match) {
      // clear any local timers just in case and don't schedule new spawns
      if (spawnTimeoutRef.current) clearTimeout(spawnTimeoutRef.current);
      scheduleNextRef.current = null;
      return;
    }
    let mounted = true;

    // Get difficulty parameters based on current phase
    function getDifficultyPhase(elapsedSec) {
      const progress = elapsedSec / totalGameSeconds;

      if (progress < 0.15) {
        return {
          spawnInterval: [2000, 2500],
          speedRange: [0.3, 0.5],
          burstChance: 0,
          variety: 0.2,
          max: 5,
        };
      } else if (progress < 0.35) {
        return {
          spawnInterval: [1200, 1800],
          speedRange: [0.5, 0.9],
          burstChance: 0.1,
          variety: 0.4,
          max: 6,
        };
      } else if (progress < 0.6) {
        return {
          spawnInterval: [800, 1300],
          speedRange: [0.8, 1.4],
          burstChance: 0.15,
          variety: 0.6,
          max: 7,
        };
      } else if (progress < 0.85) {
        return {
          spawnInterval: [600, 1000],
          speedRange: [1.2, 2.0],
          burstChance: 0.25,
          variety: 0.8,
          max: 7,
        };
      } else {
        return {
          spawnInterval: [400, 700],
          speedRange: [1.8, 3.5],
          burstChance: 0.4,
          variety: 1.0,
          max: 7,
        };
      }
    }

    function spawnEnemy(phase, isBurst = false) {
      const angle = Math.random() * Math.PI * 2;
      const x = cx + Math.cos(angle) * spawnRadius;
      const y = cy + Math.sin(angle) * spawnRadius;
      const dx = cx - x;
      const dy = cy - y;
      const dist = Math.hypot(dx, dy) || 1;
      const ux = dx / dist;
      const uy = dy / dist;

      // Use phase-based speed with variety
      const [minSpeed, maxSpeed] = phase.speedRange;
      let baseSpeed = minSpeed + Math.random() * (maxSpeed - minSpeed);
      const varietyFactor = 1 + (Math.random() - 0.5) * phase.variety;
      let finalSpeed = baseSpeed * varietyFactor;
      // burst-spawned enemies are a bit slower so bursts are manageable
      if (isBurst) finalSpeed *= 0.65;

      return {
        id: nextId.current++,
        word: allWords[Math.floor(Math.random() * allWords.length)],
        x,
        y,
        ux,
        uy,
        baseSpeed: finalSpeed,
        alive: true,
        reached: false,
      };
    }

    function scheduleNext() {
      // don't spawn if game ended
      if (gameOverRef.current) return;
      if (!mounted) return;

      const now = Date.now();
      const elapsedSec = Math.floor((now - startTime.current) / 1000);
      const phase = getDifficultyPhase(elapsedSec);

      // Spawn a single zombie (restore original single-spawn algorithm)
      const newEnemy = spawnEnemy(phase, false);
      setEnemies((prev) => [...prev, newEnemy]);

      // Adaptive delay based on alive count
      const [minDelay, maxDelay] = phase.spawnInterval;
      let delay = Math.random() * (maxDelay - minDelay) + minDelay;

      setEnemies((current) => {
        const aliveCount = current.filter((e) => e.alive && !e.reached).length;
        if (aliveCount > 20) delay *= 1.5;
        else if (aliveCount < 5) delay *= 0.85;
        return current;
      });

      // (no burst handling - single spawn)

      // schedule next spawn and keep ref
      spawnTimeoutRef.current = setTimeout(scheduleNext, delay);
    }

    // Initial spawn with phase-appropriate delay
    const elapsedSec = Math.floor((Date.now() - startTime.current) / 1000);
    const initialPhase = getDifficultyPhase(elapsedSec);
    const [minInit, maxInit] = initialPhase.spawnInterval;
    const initialDelay = Math.random() * (maxInit - minInit) + minInit;

    spawnTimeoutRef.current = setTimeout(scheduleNext, initialDelay);
    // keep ref to schedule function so other effects can trigger an immediate spawn
    scheduleNextRef.current = scheduleNext;
    return () => {
      mounted = false;
      clearTimeout(spawnTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // move enemies toward player (center) with speed scaled by elapsed time
  // helper to start the movement interval (call on mount and on restart)
  function startMovement() {
    // clear existing interval if any
    if (moveIntervalRef.current) clearInterval(moveIntervalRef.current);

    // If we're in a multiplayer match, the server is authoritative for movement
    // and we should not run a local movement loop.
    if (connected && match) {
      if (moveIntervalRef.current) {
        clearInterval(moveIntervalRef.current);
        moveIntervalRef.current = null;
      }
      return;
    }

    const tickMs = 60; // zombie tick
    const move = setInterval(() => {
      const now = Date.now();
      const elapsedSec = Math.floor((now - startTime.current) / 1000);
      // keep enemy speed constant (no global acceleration)
      const multiplier = 1;

      // update elapsed UI state occasionally
      setElapsed(elapsedSec);

      setEnemies((prev) => {
        // reachedCount must be local to this updater - React may call the updater multiple
        // times (Strict Mode), so using an outer-scoped counter causes inflated counts.
        let reachedCount = 0;

        const updated = prev
          .map((e) => {
            if (!e.alive || e.reached) return e;
            const nx = e.x + e.ux * e.baseSpeed * multiplier;
            const ny = e.y + e.uy * e.baseSpeed * multiplier;
            const d = Math.hypot(nx - cx, ny - cy);
            if (d <= playerRadius) {
              // mark this enemy as dead/reached so it won't trigger again
              reachedCount += 1;
              return { ...e, x: nx, y: ny, reached: true, alive: false };
            }
            return { ...e, x: nx, y: ny };
          })
          // keep a reasonable limit of enemies
          .slice(-50);

        // apply heart decrement once per tick if any reached
        if (reachedCount > 0) {
          setHearts((h) => {
            const next = Math.max(0, h - reachedCount);
            if (next <= 0) {
              // set game over and stop loops
              setGameOver(true);
              if (spawnTimeoutRef.current)
                clearTimeout(spawnTimeoutRef.current);
              if (moveIntervalRef.current)
                clearInterval(moveIntervalRef.current);
            }
            return next;
          });
        }

        return updated;
      });
    }, tickMs);

    moveIntervalRef.current = move;
  }

  // start movement on mount
  useEffect(() => {
    startMovement();
    return () => {
      if (moveIntervalRef.current) clearInterval(moveIntervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If match status changes, ensure we stop the local simulation when joined,
  // and restart it when leaving a match.
  useEffect(() => {
    if (connected && match) {
      if (moveIntervalRef.current) {
        clearInterval(moveIntervalRef.current);
        moveIntervalRef.current = null;
      }
      // also clear spawn scheduling
      if (spawnTimeoutRef.current) {
        clearTimeout(spawnTimeoutRef.current);
        spawnTimeoutRef.current = null;
      }
    } else {
      // not in match -> ensure local simulation is running
      startMovement();
      if (typeof scheduleNextRef.current === "function")
        scheduleNextRef.current();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, match]);

  // find nearest enemy to player center IMPROVE THIS TO ADD TRACKER UI
  useEffect(() => {
    // detect when any previously-alive enemy becomes dead/reached and trigger immediate spawn
    const aliveMap = {};
    enemies.forEach((e) => {
      if (e.alive && !e.reached) aliveMap[e.id] = true;
    });

    // compare with prevAliveRef to find transitions
    const prevAlive = prevAliveRef.current || {};
    const died = Object.keys(prevAlive).some((id) => !aliveMap[id]);
    prevAliveRef.current = aliveMap;
    if (died) {
      // clear any scheduled spawn and fire immediate spawn
      if (spawnTimeoutRef.current) clearTimeout(spawnTimeoutRef.current);
      if (typeof scheduleNextRef.current === "function") {
        scheduleNextRef.current();
      }
    }

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
      // if we're online in a match, let server validate the kill
      if (connected && match?.roomId) {
        sendHit(match.roomId, target.id, target.word);
      } else {
        // fallback: local single-player behavior
        setEnemies((prev) =>
          prev.map((e) => (e.id === target.id ? { ...e, alive: false } : e))
        );
      }

      setInput("");
      playGunshot();
    }
  }, [input, target, connected, match, sendHit]);

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

  // If we're in a multiplayer match and server provided player info, derive hearts
  const serverPlayer =
    connected && match && roomPlayers
      ? // roomPlayers may be an array or object depending on server; try array first
        Array.isArray(roomPlayers)
        ? roomPlayers.find((p) => p.id === match.playerId)
        : roomPlayers?.[match.playerId]
      : null;

  const opponentPlayer =
    connected && match && roomPlayers
      ? Array.isArray(roomPlayers)
        ? roomPlayers.find((p) => p.id === match.opponentId)
        : roomPlayers?.[match.opponentId]
      : null;

  const displayHearts = serverPlayer?.heart ?? hearts;
  const displayKills = serverPlayer?.kills ?? 0;
  const opponentHearts = opponentPlayer?.heart ?? 3;
  const opponentKills = opponentPlayer?.kills ?? 0;

  return (
    <div className="p-5 font-mono text-slate-900 dark:text-white ">
      <div className="text-center mx-auto">
        <h2 className="text-2xl font-bold">Type royale 🧟</h2>

        {/* Hearts HUD */}
        <div className="flex items-center justify-center gap-2 mt-2 ">
          <div className="font-medium">Hearts:</div>
          <div className="text-xl">
            {Array.from({ length: displayHearts }).map((_, i) => (
              <span key={i} className="text-red-500 mr-1">
                ❤️
              </span>
            ))}
            {displayHearts === 0 && (
              <span className="text-sm text-slate-400"> (0)</span>
            )}
          </div>
        </div>
      </div>

      {/* If in a multiplayer match, show split-screen (player | opponent) */}
      {connected && match ? (
        <div className="flex gap-3 mt-4">
          {/* Player POV */}
          <div className="flex-1">
            <div className="mb-2 text-sm font-semibold text-center">
              You - ❤️ {displayHearts} | 🎯 {displayKills} kills
            </div>
            <div
              className="rounded-lg border-2 border-slate-800 relative overflow-hidden mx-auto"
              style={{ width, height, background: "#000" }}
            >
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

              {displayEnemies.map((e) => {
                // Use interpolated position for smooth movement in multiplayer
                const posX = e.displayX ?? e.x;
                const posY = e.displayY ?? e.y;
                return (
                  <div
                    key={e.id}
                    title={e.word}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-opacity`}
                    style={{
                      left: posX,
                      top: posY,
                      opacity: e.alive ? 1 : 0.35,
                    }}
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center border-2 bg-emerald-400 border-slate-800 shadow`}
                      style={{ fontSize: 18 }}
                    >
                      🧟
                    </div>
                    <div className="text-center mt-1 text-xs text-white">
                      {e.alive ? e.word : "DEAD"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Opponent POV (read-only mirror) */}
          <div className="flex-1">
            <div className="mb-2 text-sm font-semibold text-center">
              Opponent - ❤️ {opponentHearts} | 🎯 {opponentKills} kills
            </div>
            <div
              className="rounded-lg border-2 border-slate-800 relative overflow-hidden mx-auto"
              style={{ width, height, background: "#111" }}
            >
              {displayEnemies.map((e) => {
                const posX = e.displayX ?? e.x;
                const posY = e.displayY ?? e.y;
                return (
                  <div
                    key={"opp-" + e.id}
                    title={e.word}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-opacity`}
                    style={{
                      left: posX,
                      top: posY,
                      opacity: e.alive ? 1 : 0.35,
                    }}
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center border-2 bg-sky-400 border-slate-800 shadow`}
                      style={{ fontSize: 18 }}
                    >
                      🧟
                    </div>
                    <div className="text-center mt-1 text-xs text-white">
                      {e.alive ? e.word : "DEAD"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        // single-player view
        <div
          className="mt-3 rounded-lg border-2 border-slate-800 relative overflow-hidden mx-auto"
          style={{
            width,
            height,
            background: "#000000",
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
                className={`absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-opacity ${
                  target && target.id === e.id ? "z-10" : ""
                }`}
                style={{ left: e.x, top: e.y, opacity: e.alive ? 1 : 0.35 }}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${bgClass} border-slate-800 shadow ${
                    isTarget ? "ring-1 ring-yellow-400 z-10" : ""
                  }`}
                  style={{ fontSize: 18 }}
                >
                  🧟
                </div>
                <div className="text-center mt-1 text-xs text-white">
                  {e.alive ? e.word : "DEAD"}
                </div>
              </div>
            );
          })}
        </div>
      )}

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
          <div className="text-xs text-slate-400">Time: {elapsed}s</div>
        </div>
        <div className="ml-auto text-sm text-slate-600 dark:text-slate-300">
          Enemies: {displayEnemies.filter((e) => e.alive).length}
        </div>
      </div>

      <div className="flex gap-3 items-center mt-3">
        <div>Target: {target?.word || "none"}</div>
        <div>Input: {input}</div>
        <div className="ml-auto">
          Enemies: {displayEnemies.filter((e) => e.alive).length}
        </div>
      </div>

      {/* Game over overlay */}
      {gameOver && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg text-center">
            <h3 className="text-2xl font-bold mb-2">Game Over</h3>
            <div className="mb-4">You ran out of hearts.</div>
            <button
              onClick={() => {
                // minimal reset
                setEnemies([]);
                setHearts(3);
                setGameOver(false);
                nextId.current = 0;
                startTime.current = Date.now();
                if (typeof scheduleNextRef.current === "function")
                  scheduleNextRef.current();
                // ensure movement is running after restart
                if (typeof startMovement === "function") startMovement();
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded"
            >
              Restart
            </button>
          </div>
        </div>
      )}
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

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { allWords } from "../libs/words";
import audioInit from "../libs/audio-init";
import { playGunshot } from "../libs/gunshot";
import usePlayerStats from "../hooks/usePlayerStats";

export default function Game() {
  const [enemies, setEnemies] = useState([]);
  const [input, setInput] = useState("");
  const [target, setTarget] = useState(null);
  const [nextTarget, setNextTarget] = useState(null);
  const nextId = useRef(0);
  const [score, setScore] = useState(0);
  const { stats, updateStats, stackUser } = usePlayerStats();
  const [personalBest, setPersonalBest] = useState(stats.highestScore);
  const [combo, setCombo] = useState(0);
  const comboRef = useRef(0);
  const [multiplier, setMultiplier] = useState(1);
  const [typedStats, setTypedStats] = useState({ total: 0, correct: 0 });
  const [explosions, setExplosions] = useState([]);
  const [errorFlash, setErrorFlash] = useState(false);
  const errorFlashRef = useRef(null);
  const [surgeMode, setSurgeMode] = useState(false);

  const [bullets, setBullets] = useState([]);
  const [hitEnemies, setHitEnemies] = useState(new Set());
  const [errorEnemies, setErrorEnemies] = useState(new Set());

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

  audioInit();

  useEffect(() => {
    setPersonalBest(stats.highestScore);
  }, [stats.highestScore]);

  const accuracyPct = useMemo(() => {
    if (typedStats.total === 0) return 100;
    return Math.max(
      0,
      Math.min(100, Math.round((typedStats.correct / typedStats.total) * 100))
    );
  }, [typedStats]);

  // refs for spawn control and death detection
  const spawnTimeoutRef = useRef(null);
  const scheduleNextRef = useRef(null);
  const prevAliveRef = useRef({});

  // game dimensions (px) - keep stable refs so effects don't require them as deps
  const dims = useRef({ width: 1280, height: 600, playerRadius: 22 });
  const width = dims.current.width;
  const height = dims.current.height;
  const cx = width / 2;
  const cy = height / 2;
  const spawnRadius = Math.min(width, height) / 2 - 40; // spawn on the circle
  const playerRadius = dims.current.playerRadius;
  const BASE_MAX_ALIVE = 8;
  const SPAWN_INTERVAL_SCALE = 0.8;

  const registerComboWin = useCallback(() => {
    setCombo((prevCombo) => {
      const nextCombo = prevCombo + 1;
      comboRef.current = nextCombo;
      const nextMultiplier = 1 + Math.floor(nextCombo / 5);
      setMultiplier(nextMultiplier);
      if (nextMultiplier >= 3) {
        setSurgeMode(true);
        setTimeout(() => setSurgeMode(false), 1500);
      }
      setScore((prevScore) => prevScore + Math.round(100 * nextMultiplier));
      return nextCombo;
    });
  }, []);

  const breakCombo = useCallback(() => {
    comboRef.current = 0;
    setCombo(0);
    setMultiplier(1);
  }, []);

  const pushExplosion = useCallback((x, y) => {
    const id = `${x}-${y}-${Date.now()}`;
    setExplosions((prev) => [...prev, { id, x, y }]);
    setTimeout(() => {
      setExplosions((prev) => prev.filter((blast) => blast.id !== id));
    }, 450);
  }, []);

  const dynamicMaxEnemies = useCallback(() => {
    const comboBoost = Math.min(4, Math.floor(comboRef.current / 6));
    return BASE_MAX_ALIVE + comboBoost;
  }, []);

  // spawn an enemy on the circle perimeter at random angle with dynamic spawn interval
  useEffect(() => {
    let mounted = true;

    // Get difficulty parameters based on current phase
    const scaleInterval = ([min, max]) => [
      min * SPAWN_INTERVAL_SCALE,
      max * SPAWN_INTERVAL_SCALE,
    ];

    function getDifficultyPhase(elapsedSec) {
      const progress = elapsedSec / totalGameSeconds;

      if (progress < 0.15) {
        return {
          spawnInterval: scaleInterval([2000, 2500]),
          speedRange: [0.3, 0.5],
          burstChance: 0,
          variety: 0.2,
          max: 5,
        };
      } else if (progress < 0.35) {
        return {
          spawnInterval: scaleInterval([1200, 1800]),
          speedRange: [0.5, 0.9],
          burstChance: 0.1,
          variety: 0.4,
          max: 6,
        };
      } else if (progress < 0.6) {
        return {
          spawnInterval: scaleInterval([800, 1300]),
          speedRange: [0.8, 1.4],
          burstChance: 0.15,
          variety: 0.6,
          max: 7,
        };
      } else if (progress < 0.85) {
        return {
          spawnInterval: scaleInterval([600, 1000]),
          speedRange: [1.2, 2.0],
          burstChance: 0.15,
          variety: 0.8,
          max: 7,
        };
      } else {
        return {
          spawnInterval: scaleInterval([400, 700]),
          speedRange: [1.8, 3.5],
          burstChance: 0.15,
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

      // Determine if this is a burst spawn
      const burstSize =
        Math.random() < phase.burstChance
          ? Math.floor(Math.random() * 3) + 1
          : 1;

      let spawnedCount = 0;
      let aliveCountForDelay = null;
      setEnemies((prev) => {
        const aliveCount = prev.filter((e) => e.alive && !e.reached).length;
        aliveCountForDelay = aliveCount;

        const maxAllowed = dynamicMaxEnemies();
        const availableSlots = maxAllowed - aliveCount;
        if (availableSlots <= 0) {
          return prev;
        }

        const spawnCount = Math.min(burstSize, availableSlots);
        if (spawnCount <= 0) {
          return prev;
        }

        const newEnemies = [];
        for (let i = 0; i < spawnCount; i++) {
          newEnemies.push(spawnEnemy(phase, spawnCount > 1));
        }

        spawnedCount = spawnCount;
        aliveCountForDelay = aliveCount + spawnCount;
        return [...prev, ...newEnemies];
      });

      // Adaptive delay based on alive count
      const [minDelay, maxDelay] = phase.spawnInterval;
      let delay = Math.random() * (maxDelay - minDelay) + minDelay;

      if (aliveCountForDelay !== null) {
        if (aliveCountForDelay > 20) delay *= 1.5;
        else if (aliveCountForDelay < 5) delay *= 0.85;
      }

      // If burst, add small delay between spawns in burst
      if (spawnedCount > 1) {
        // small gap between burst members but they were already slower
        delay = 220;
      } else if (
        spawnedCount === 0 &&
        typeof aliveCountForDelay === "number" &&
        aliveCountForDelay >= dynamicMaxEnemies()
      ) {
        delay = Math.max(delay, 300);
      }

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
          breakCombo();
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

    const ranked = alive
      .map((enemy) => ({
        enemy,
        dist: Math.hypot(enemy.x - cxLocal, enemy.y - cyLocal),
      }))
      .sort((a, b) => a.dist - b.dist);

    const currentTargetStillAlive =
      target && ranked.some((entry) => entry.enemy.id === target.id);

    let primaryEnemy = null;

    if (currentTargetStillAlive) {
      primaryEnemy =
        ranked.find((entry) => entry.enemy.id === target.id)?.enemy || null;
      if (!primaryEnemy && ranked.length > 0) {
        primaryEnemy = ranked[0].enemy;
      }
    } else if (ranked.length > 0) {
      primaryEnemy = ranked[0].enemy;
    }

    if (!primaryEnemy) {
      setTarget(null);
      setNextTarget(null);
      return;
    }

    setTarget(primaryEnemy);

    const secondaryEntry = ranked.find(
      (entry) => entry.enemy.id !== primaryEnemy.id
    );
    setNextTarget(secondaryEntry ? secondaryEntry.enemy : null);
  }, [enemies, target]);

  // check typed word kills target
  useEffect(() => {
    if (!target) return;
    if (input === target.word) {
      setEnemies((prev) =>
        prev.map((e) => (e.id === target.id ? { ...e, alive: false } : e))
      );
      setInput("");
      registerComboWin();
      pushExplosion(target.x, target.y);
      setErrorFlash(false);
      // play gunshot sound on success
      playGunshot();
    }
  }, [input, target, registerComboWin, pushExplosion]);

  // keyboard input (typing)
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Backspace") {
        setInput((i) => i.slice(0, -1));
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        const newChar = e.key.toLowerCase();
        const newInput = input + newChar;

        if (target) {
          setTypedStats((prev) => ({
            total: prev.total + 1,
            correct: prev.correct + (target.word.startsWith(newInput) ? 1 : 0),
          }));
        }

        if (target && target.word.startsWith(newInput)) {
          // Correct letter - shoot bullet
          const targetX = target.displayX ?? target.x;
          const targetY = target.displayY ?? target.y;

          const bulletId = Date.now() + Math.random();
          setBullets((prev) => [
            ...prev,
            {
              id: bulletId,
              startX: cx,
              startY: cy,
              endX: targetX,
              endY: targetY,
              progress: 0,
            },
          ]);

          // animate bullet
          let progress = 0;
          const duration = 200;
          const startTime = Date.now();

          const animateBullet = () => {
            const elapsed = Date.now() - startTime;
            progress = Math.min(elapsed / duration, 1);

            setBullets((prev) =>
              prev.map((b) => (b.id === bulletId ? { ...b, progress } : b))
            );

            if (progress < 1) {
              requestAnimationFrame(animateBullet);
            } else {
              setHitEnemies((prev) => new Set(prev).add(target.id));

              setTimeout(() => {
                setHitEnemies((prev) => {
                  const next = new Set(prev);
                  next.delete(target.id);
                  return next;
                });
              }, 150);
              // Remove bullet after animation
              setTimeout(() => {
                setBullets((prev) => prev.filter((b) => b.id !== bulletId));
              }, 100);
            }
          };
          requestAnimationFrame(animateBullet);
        } else if (target && input.length >= 0) {
          // Wrong letter - trigger error shake
          setErrorEnemies((prev) => new Set(prev).add(target.id));
          breakCombo();
          if (errorFlashRef.current) clearTimeout(errorFlashRef.current);
          setErrorFlash(true);
          errorFlashRef.current = setTimeout(() => setErrorFlash(false), 250);

          // Remove error after shake animation (500ms)
          setTimeout(() => {
            setErrorEnemies((prev) => {
              const next = new Set(prev);
              next.delete(target.id);
              return next;
            });
          }, 500);
        }

        setInput(newInput);
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
      if (errorFlashRef.current) clearTimeout(errorFlashRef.current);
    };
  }, [input, target, cx, cy, breakCombo]);

  // compute distance to target
  const targetDistance = target
    ? Math.hypot(target.x - cx, target.y - cy)
    : null;

  const typedPrefix = target ? target.word.slice(0, input.length) : "";
  const typedSuffix = target ? target.word.slice(input.length) : "";
  const inputDisplay = input.length > 0 ? input : "Start typing...";
  const nextWord = nextTarget?.word || null;

  const inputClass = (() => {
    if (!input) return "text-slate-400";
    if (target && !target.word.startsWith(input))
      return "text-red-400 font-bold";
    return "text-white";
  })();

  const aliveEnemyCount = useMemo(
    () => enemies.filter((enemy) => enemy.alive).length,
    [enemies]
  );

  useEffect(() => {
    setPersonalBest(stats.highestScore);
  }, [stats.highestScore]);

  useEffect(() => {
    if (score === 0) return;
    if (score <= personalBest) return;
    setPersonalBest(score);
    updateStats({ highestScore: score });
  }, [score, personalBest, updateStats]);

  return (
    <div className="relative min-h-screen w-full bg-gradient-to-b from-slate-900 via-slate-950 to-black px-4 py-8 font-mono text-white lg:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.45em] text-slate-500">
              Solo Arena
            </p>
            <h2 className="text-4xl font-black tracking-tight text-white lg:text-5xl">
              Type Royale 🧟
            </h2>
            <p className="mt-2 max-w-xl text-sm text-slate-400">
              Survive the endless surge. Chain flawless combos to trigger surge
              mode and keep every heart intact.
            </p>
          </div>
          <div className="flex flex-wrap gap-4 text-slate-100">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 shadow-lg shadow-black/40">
              <p className="text-[11px] uppercase tracking-[0.35em] text-slate-400">
                Score
              </p>
              <p className="text-3xl font-black text-amber-300">{score}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 shadow-lg shadow-black/40">
              <p className="text-[11px] uppercase tracking-[0.35em] text-slate-400">
                Personal Best
              </p>
              <p className="text-2xl font-semibold text-emerald-300">
                {personalBest}
              </p>
              {!stackUser && (
                <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">
                  Sign in to save
                </p>
              )}
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 shadow-lg shadow-black/40">
              <p className="text-[11px] uppercase tracking-[0.35em] text-slate-400">
                Vitals
              </p>
              <div className="mt-1 flex items-center gap-1 text-2xl">
                {Array.from({ length: hearts }).map((_, i) => (
                  <span key={i} className="text-red-400">
                    ❤️
                  </span>
                ))}
                {hearts === 0 && (
                  <span className="text-sm text-slate-500">K.O.</span>
                )}
              </div>
            </div>
          </div>
        </header>

        <section className="relative rounded-[32px] border border-white/10 bg-slate-950/70 shadow-[0_50px_120px_rgba(15,23,42,0.65)]">
          <div className="pointer-events-none absolute top-6 left-6 z-30 w-[230px] space-y-3">
            <div
              className={`rounded-2xl border px-4 py-3 backdrop-blur shadow-lg ${
                surgeMode
                  ? "border-amber-300/80 bg-amber-500/15 shadow-amber-400/40"
                  : "border-white/10 bg-white/5 shadow-black/40"
              }`}
            >
              <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.35em] text-slate-300">
                Combo
                {surgeMode && (
                  <span className="rounded-full bg-amber-400/30 px-2 py-0.5 text-[10px] tracking-normal text-white">
                    Surge
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <div className="text-4xl font-black text-amber-300">
                  {combo}
                </div>
                <div className="text-xs text-slate-300">
                  Mult <span className="text-amber-200">x{multiplier}</span>
                </div>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-amber-400 transition-all"
                  style={{ width: `${Math.min(100, (combo % 5) * 20)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="pointer-events-none absolute top-6 right-6 z-30 w-[230px] space-y-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur shadow-lg shadow-black/40">
              <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.35em] text-slate-300">
                Accuracy
                <span className="text-[10px] tracking-normal text-slate-400">
                  {typedStats.total} keys
                </span>
              </div>
              <div className="mt-1 text-4xl font-black text-emerald-300">
                {accuracyPct}%
              </div>
              <p className="text-xs text-slate-400">
                Keep it above 95% to bend the swarm.
              </p>
            </div>
          </div>

          <div className="relative flex justify-center px-6 pb-16 pt-6">
            <div
              className={`rounded-[28px] border-2 relative overflow-hidden mx-auto transition-all duration-300 ${
                errorFlash
                  ? "border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.45)]"
                  : surgeMode
                  ? "border-amber-400/70 shadow-[0_0_30px_rgba(251,191,36,0.45)]"
                  : "border-slate-800/90"
              }`}
              style={{
                width,
                height,
                background: "#000000",
              }}
            >
              {errorFlash && (
                <div className="absolute inset-0 z-[5] pointer-events-none bg-red-500/10" />
              )}
              {/* Target tracking line */}
              {target && (
                <svg
                  className="absolute inset-0 pointer-events-none z-10"
                  style={{ width: "100%", height: "100%" }}
                >
                  <defs>
                    <linearGradient
                      id="target-line-gradient"
                      x1="0%"
                      y1="0%"
                      x2="100%"
                      y2="0%"
                    >
                      <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.8" />
                      <stop
                        offset="100%"
                        stopColor="#f59e0b"
                        stopOpacity="0.3"
                      />
                    </linearGradient>
                  </defs>
                  <line
                    x1={cx}
                    y1={cy}
                    x2={target.x}
                    y2={target.y}
                    stroke="url(#target-line-gradient)"
                    strokeWidth="3"
                    strokeDasharray="8,4"
                    opacity="0.9"
                  />
                  <circle
                    cx={target.x}
                    cy={target.y}
                    r="6"
                    fill="#fbbf24"
                    opacity="0.8"
                  />
                </svg>
              )}

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

              {nextWord && (
                <div
                  className="absolute px-2.5 py-1 rounded-full border border-slate-600/40 bg-slate-900/75 text-[11px] font-semibold tracking-[0.25em] uppercase text-slate-300 shadow-lg shadow-slate-900/40"
                  style={{
                    left: cx,
                    top: cy - playerRadius - 60,
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  <span className="text-slate-500 mr-2 tracking-[0.35em]">
                    Next
                  </span>
                  <span className="text-slate-100 tracking-[0.2em]">
                    {nextWord}
                  </span>
                </div>
              )}

              <div
                className="absolute px-3 py-1 rounded-full border border-amber-400/40 bg-slate-900/85 text-sm font-semibold tracking-wide text-amber-200 shadow-lg shadow-amber-400/25 backdrop-blur-sm"
                style={{
                  left: cx,
                  top: cy - playerRadius - 28,
                  transform: "translate(-50%, -50%)",
                }}
              >
                {target ? (
                  <span className="uppercase">
                    <span>{typedPrefix}</span>
                    <span className={inputClass}>{typedSuffix}</span>
                  </span>
                ) : (
                  <span className="text-slate-300">Waiting...</span>
                )}
              </div>

              <div
                className="absolute px-3 py-1 rounded-full border border-slate-600/40 bg-slate-900/75 text-sm font-mono tracking-widest uppercase shadow-lg shadow-slate-900/40"
                style={{
                  left: cx,
                  top: cy + playerRadius + 34,
                  transform: "translate(-50%, -50%)",
                  minWidth: 120,
                }}
              >
                <span className={inputClass}>{inputDisplay}</span>
              </div>

              {/* enemies */}
              {enemies
                .filter((e) => {
                  if (e.alive) return true;

                  const deadEnemies = enemies.filter((e) => !e.alive);
                  const deadEnemyIndex = deadEnemies.findIndex(
                    (de) => de.id === e.id
                  );

                  return deadEnemyIndex >= deadEnemies.length - 12;
                })
                .map((e) => {
                  const isTarget = target && target.id === e.id;
                  const isHit = hitEnemies.has(e.id);
                  const hasError = errorEnemies.has(e.id);
                  const bgClass = e.alive ? "bg-emerald-400" : "bg-slate-600";
                  return (
                    <div
                      key={e.id}
                      title={e.word}
                      className={`absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-opacity ${
                        target && target.id === e.id ? "z-10" : ""
                      } ${isHit ? "animate-pulse" : ""} ${
                        hasError ? "animate-shake" : ""
                      }`}
                      style={{
                        left: e.x,
                        top: e.y,
                        opacity: e.alive ? 1 : 0.35,
                      }}
                    >
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center border-2 border-slate-800 shadow ${
                          isHit ? "bg-red-500 scale-110" : bgClass
                        } ${isTarget ? "ring-1 ring-yellow-400 z-10" : ""}`}
                        style={{
                          fontSize: 18,
                          transition: "all 0.15s ease-out",
                        }}
                      >
                        🧟
                      </div>
                      <div className="text-center mt-1 text-xs text-white">
                        {e.alive ? (
                          isTarget ? (
                            e.word.startsWith(input) ? (
                              <span>
                                <span className="text-green-400 font-bold">
                                  {e.word.slice(0, input.length)}
                                </span>
                                <span>{e.word.slice(input.length)}</span>
                              </span>
                            ) : (
                              <span className="text-red-400 font-bold">
                                {e.word}
                              </span>
                            )
                          ) : (
                            e.word
                          )
                        ) : (
                          "DEAD"
                        )}
                      </div>
                    </div>
                  );
                })}

              {explosions.map((blast) => (
                <div
                  key={blast.id}
                  className="absolute pointer-events-none z-20"
                  style={{
                    left: blast.x,
                    top: blast.y,
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  <div className="w-16 h-16 rounded-full bg-amber-400/20 border border-amber-200/60 animate-ping" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-4 h-4 rounded-full bg-white/90 shadow shadow-yellow-200/70" />
                  </div>
                </div>
              ))}

              {/* Render bullets */}
              {bullets.map((bullet) => {
                const currentX =
                  bullet.startX +
                  (bullet.endX - bullet.startX) * bullet.progress;
                const currentY =
                  bullet.startY +
                  (bullet.endY - bullet.startY) * bullet.progress;

                return (
                  <div
                    key={bullet.id}
                    className="absolute pointer-events-none"
                    style={{
                      left: currentX,
                      top: currentY,
                      transform: "translate(-50%, -50%)",
                    }}
                  >
                    <div className="w-2 h-2 rounded-full bg-yellow-400 shadow-lg shadow-yellow-400/50" />
                  </div>
                );
              })}
            </div>
          </div>
          <div className="px-6 pb-6">
            <div className="grid gap-4 text-sm md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
                <p className="text-[10px] uppercase tracking-[0.35em] text-slate-400">
                  Closest Target
                </p>
                <p className="text-xl font-semibold text-white">
                  {target ? target.word : "Waiting"}
                </p>
                <p className="text-xs text-slate-400">
                  Next up: {nextWord || "—"}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
                <p className="text-[10px] uppercase tracking-[0.35em] text-slate-400">
                  Game Clock
                </p>
                <p className="text-xl font-semibold text-white">{elapsed}s</p>
                <p className="text-xs text-slate-400">
                  Distance:{" "}
                  {targetDistance ? `${Math.round(targetDistance)}px` : "—"}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
                <p className="text-[10px] uppercase tracking-[0.35em] text-slate-400">
                  Swarm Status
                </p>
                <p className="text-xl font-semibold text-white">
                  {aliveEnemyCount} alive
                </p>
                <p className="text-xs text-slate-400">
                  Input: {input ? input : "Start typing"}
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
      {gameOver && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 px-6">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900/95 p-6 text-center shadow-2xl shadow-black/60">
            <h3 className="text-2xl font-black text-white">Game Over</h3>
            <p className="mt-2 text-sm text-slate-400">
              You ran out of hearts.
            </p>
            <p className="mt-1 text-lg font-semibold text-amber-300">
              Final Score: {score}
            </p>
            <button
              onClick={() => {
                // minimal reset
                setEnemies([]);
                setHearts(3);
                setScore(0);
                setCombo(0);
                comboRef.current = 0;
                setMultiplier(1);
                setTypedStats({ total: 0, correct: 0 });
                setExplosions([]);
                setSurgeMode(false);
                setErrorFlash(false);
                setGameOver(false);
                nextId.current = 0;
                startTime.current = Date.now();
                if (typeof scheduleNextRef.current === "function")
                  scheduleNextRef.current();
                // ensure movement is running after restart
                if (typeof startMovement === "function") startMovement();
              }}
              className="mt-5 w-full rounded-xl bg-amber-400/90 px-4 py-2 text-sm font-semibold uppercase tracking-[0.35em] text-slate-900 shadow-lg shadow-amber-400/40"
            >
              Restart Run
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

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { playGunshot } from "../libs/gunshot";
import useInterpolation from "../hooks/useInterpolation";
import audioInit from "../libs/audio-init";
import usePlayerStats from "../hooks/usePlayerStats";

export default function Multiplayer({ socketData, onGameOver } = {}) {
  const [input, setInput] = useState("");
  const [target, setTarget] = useState(null);
  const [nextTarget, setNextTarget] = useState(null);
  const [bullets, setBullets] = useState([]);
  const [hitEnemies, setHitEnemies] = useState(new Set());
  const [spectatorHitEnemies, setSpectatorHitEnemies] = useState(new Set());
  const [spectatorBullets, setSpectatorBullets] = useState([]);
  const prevOpponentEnemiesRef = useRef([]);
  const [typedStats, setTypedStats] = useState({ total: 0, correct: 0 });

  //b

  const {
    connected = false,
    match = null,
    serverEnemies = [],
    roomPlayers = null,
    sendHit = () => {},
    spectatorEnemies = {},
  } = socketData || {};

  // Use interpolation for smooth multiplayer movement
  const displayEnemies = useInterpolation(serverEnemies);
  const opponentEnemies = useInterpolation(
    spectatorEnemies?.[match?.opponentId] || []
  );

  const [gameOver, setGameOver] = useState(false);
  const { stats, updateStats, stackUser } = usePlayerStats();
  const recordedWinRef = useRef(null);

  // game dimensions (px)
  const width = 600;
  const height = 600;
  const cx = width / 2;
  const cy = height / 2;
  const playerRadius = 22;

  audioInit();

  const launchSpectatorBullet = useCallback(
    (endX, endY, enemyId) => {
      const bulletId = `spectator-${enemyId}-${Date.now()}`;
      const duration = 200;
      const startTime = Date.now();

      setSpectatorBullets((prev) => [
        ...prev,
        {
          id: bulletId,
          startX: cx,
          startY: cy,
          endX,
          endY,
          progress: 0,
        },
      ]);

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        setSpectatorBullets((prev) =>
          prev.map((b) => (b.id === bulletId ? { ...b, progress } : b))
        );

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          setSpectatorBullets((prev) => prev.filter((b) => b.id !== bulletId));
        }
      };

      requestAnimationFrame(animate);
    },
    [cx, cy]
  );

  useEffect(() => {
    setSpectatorHitEnemies(new Set());
    setSpectatorBullets([]);
    prevOpponentEnemiesRef.current = [];
  }, [match?.opponentId]);

  // find nearest enemy to player center
  useEffect(() => {
    const alive = displayEnemies.filter((e) => e.alive && !e.reached);

    const ranked = alive
      .map((enemy) => ({
        enemy,
        dist: Math.hypot(enemy.x - cx, enemy.y - cy),
      }))
      .sort((a, b) => a.dist - b.dist);

    const currentTargetIsStillAlive =
      target && ranked.some((entry) => entry.enemy.id === target.id);

    let primaryEnemy = null;
    if (currentTargetIsStillAlive) {
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
  }, [displayEnemies, cx, cy, target]);

  useEffect(() => {
    const opponentId = match?.opponentId;
    if (!opponentId) {
      prevOpponentEnemiesRef.current = [];
      return;
    }

    const current = spectatorEnemies?.[opponentId] || [];
    const prevSnapshot = prevOpponentEnemiesRef.current || [];

    current.forEach((enemy) => {
      const prevEnemy = prevSnapshot.find((p) => p.id === enemy.id);
      if (prevEnemy && prevEnemy.alive && !enemy.alive) {
        const endX = enemy.displayX ?? enemy.x;
        const endY = enemy.displayY ?? enemy.y;

        launchSpectatorBullet(endX, endY, enemy.id);

        setSpectatorHitEnemies((prev) => {
          const next = new Set(prev);
          next.add(enemy.id);
          return next;
        });

        setTimeout(() => {
          setSpectatorHitEnemies((prev) => {
            const next = new Set(prev);
            next.delete(enemy.id);
            return next;
          });
        }, 200);
      }
    });

    prevOpponentEnemiesRef.current = current.map((enemy) => ({
      id: enemy.id,
      alive: enemy.alive,
    }));
  }, [spectatorEnemies, match?.opponentId, launchSpectatorBullet]);

  // check typed word kills target
  useEffect(() => {
    if (!target) return;
    if (!connected || !match?.roomId) return;

    if (input === target.word) {
      sendHit(match.roomId, target.id, target.word);
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
        const newChar = e.key.toLowerCase();
        const newInput = input + newChar;

        if (target) {
          setTypedStats((prev) => ({
            total: prev.total + 1,
            correct: prev.correct + (target.word.startsWith(newInput) ? 1 : 0),
          }));
        }

        // Check if this letter matches the target word
        if (target && target.word.startsWith(newInput)) {
          // Correct letter Shoot a bullet
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

          // Animate bullet
          let progress = 0;
          const duration = 200; // 200ms bullet travel time
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
              // Bullet reached target - add hit effect
              setHitEnemies((prev) => new Set(prev).add(target.id));

              // Remove hit effect after 150ms
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
        }

        setInput(newInput);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [input, target, cx, cy]);

  // compute distance to target
  const targetDistance = target
    ? Math.hypot(target.x - cx, target.y - cy)
    : null;

  const typedPrefix = target ? target.word.slice(0, input.length) : "";
  const typedSuffix = target ? target.word.slice(input.length) : "";
  const inputDisplay = input.length > 0 ? input : "Start typing...";
  const nextWord = nextTarget?.word || null;

  // Get player info from server
  const serverPlayer =
    connected && match && roomPlayers
      ? Array.isArray(roomPlayers)
        ? roomPlayers.find((p) => p.id === match.playerId)
        : roomPlayers?.[match.playerId]
      : null;

  const opponentPlayer =
    connected && match && roomPlayers
      ? Array.isArray(roomPlayers)
        ? roomPlayers.find((p) => p.id === match.opponentId)
        : roomPlayers?.[match.opponentId]
      : null;

  const displayHearts = serverPlayer?.heart ?? 3;
  const displayKills = serverPlayer?.kills ?? 0;
  const opponentHearts = opponentPlayer?.heart ?? 3;
  const opponentKills = opponentPlayer?.kills ?? 0;

  const accuracyPct = useMemo(() => {
    if (typedStats.total === 0) return 100;
    return Math.max(
      0,
      Math.min(100, Math.round((typedStats.correct / typedStats.total) * 100))
    );
  }, [typedStats]);

  const alivePlayerEnemies = useMemo(
    () => displayEnemies.filter((enemy) => enemy.alive).length,
    [displayEnemies]
  );

  const aliveOpponentEnemies = useMemo(
    () => opponentEnemies.filter((enemy) => enemy.alive).length,
    [opponentEnemies]
  );

  const matchStatus = connected
    ? match?.ended
      ? "Match Complete"
      : match
      ? "Head-to-head live"
      : "Queued for opponent"
    : "Connecting";

  // Detect game over in multiplayer when hearts reach 0 OR match ends
  useEffect(() => {
    if (connected && match) {
      // Check if match ended (either player lost)
      if (match.ended && !gameOver) {
        setGameOver(true);
        if (onGameOver) {
          // Delay to show win/loss screen
          setTimeout(() => onGameOver(), 3000);
        }
      }
      // Or check if this player's hearts reached 0 (only if we have server data)
      else if (
        serverPlayer &&
        displayHearts <= 0 &&
        !gameOver &&
        !match.ended
      ) {
        setGameOver(true);
      }
    }
  }, [connected, match, serverPlayer, displayHearts, gameOver, onGameOver]);

  // Determine win/loss status for display
  const isWinner =
    connected && match?.ended && match.winnerId === match.playerId;

  useEffect(() => {
    if (
      !isWinner ||
      !match?.roomId ||
      recordedWinRef.current === match.roomId
    ) {
      return;
    }
    recordedWinRef.current = match.roomId;
    updateStats((current) => ({ totalWins: current.totalWins + 1 }));
  }, [isWinner, match?.roomId, updateStats]);

  return (
    <div className="relative min-h-screen w-full bg-gradient-to-b from-slate-900 via-slate-950 to-black px-4 py-8 font-mono text-white lg:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.45em] text-slate-500">
              Versus Arena
            </p>
            <h2 className="text-4xl font-black tracking-tight text-white lg:text-5xl">
              Multiplayer Royale ⚔️
            </h2>
            <p className="mt-2 max-w-xl text-sm text-slate-400">
              Duel another typist in real time. Hold your hearts, keep the swarm
              at bay, and flex flawless accuracy.
            </p>
          </div>
          <div className="flex flex-wrap gap-4 text-slate-100">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 shadow-lg shadow-black/40">
              <p className="text-[11px] uppercase tracking-[0.35em] text-slate-400">
                Status
              </p>
              <p className="text-xl font-semibold text-amber-300">
                {matchStatus}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 shadow-lg shadow-black/40">
              <p className="text-[11px] uppercase tracking-[0.35em] text-slate-400">
                Lifetime Wins
              </p>
              <p className="text-2xl font-black text-emerald-300">
                {stats.totalWins}
              </p>
              {!stackUser && (
                <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">
                  Sign in to sync
                </p>
              )}
            </div>
          </div>
        </header>

        <section className="relative rounded-[32px] border border-white/10 bg-slate-950/70 shadow-[0_50px_120px_rgba(15,23,42,0.65)]">
          <div className="pointer-events-none absolute top-6 left-6 z-30 w-[230px] space-y-3">
            <div className="rounded-2xl border border-emerald-300/50 bg-emerald-400/10 px-4 py-3 backdrop-blur shadow-lg shadow-emerald-400/40">
              <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.35em] text-slate-200">
                You
                <span className="text-[10px] tracking-normal text-emerald-200">
                  {displayKills} kills
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-xl font-black text-emerald-200">
                {Array.from({ length: displayHearts }).map((_, i) => (
                  <span key={`heart-${i}`}>❤️</span>
                ))}
                {displayHearts === 0 && (
                  <span className="text-xs text-slate-400">K.O.</span>
                )}
              </div>
              <div className="text-xs text-slate-300">
                Accuracy {accuracyPct}%
              </div>
            </div>
          </div>

          <div className="pointer-events-none absolute top-6 right-6 z-30 w-[230px] space-y-3">
            <div className="rounded-2xl border border-sky-300/60 bg-sky-400/10 px-4 py-3 backdrop-blur shadow-lg shadow-sky-400/40">
              <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.35em] text-slate-200">
                Opponent
                <span className="text-[10px] tracking-normal text-sky-200">
                  {opponentKills} kills
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-xl font-black text-sky-200">
                {Array.from({ length: opponentHearts }).map((_, i) => (
                  <span key={`opponent-heart-${i}`}>❤️</span>
                ))}
                {opponentHearts === 0 && (
                  <span className="text-xs text-slate-400">K.O.</span>
                )}
              </div>
              <div className="text-xs text-slate-300">
                Swarm {aliveOpponentEnemies} alive
              </div>
            </div>
          </div>

          <div className="relative grid gap-8 px-6 pb-16 pt-6 lg:grid-cols-2">
            <div>
              <div className="mb-3 text-sm font-semibold uppercase tracking-[0.35em] text-slate-400">
                You vs Horde
              </div>
              <div
                className="rounded-[28px] border-2 relative overflow-hidden mx-auto transition-all duration-300 border-slate-800/80"
                style={{ width, height, background: "#000" }}
              >
                {target && (
                  <svg
                    className="absolute inset-0 pointer-events-none"
                    style={{ width: "100%", height: "100%" }}
                  >
                    <defs>
                      <linearGradient
                        id="targetLineGradient"
                        x1="0%"
                        y1="0%"
                        x2="100%"
                        y2="0%"
                      >
                        <stop
                          offset="0%"
                          stopColor="#fbbf24"
                          stopOpacity="0.8"
                        />
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
                      x2={target.displayX ?? target.x}
                      y2={target.displayY ?? target.y}
                      stroke="url(#targetLineGradient)"
                      strokeWidth="2"
                      strokeDasharray="5,5"
                      className="animate-pulse"
                    />
                    <circle
                      cx={target.displayX ?? target.x}
                      cy={target.displayY ?? target.y}
                      r="4"
                      fill="#fbbf24"
                      className="animate-pulse"
                    />
                  </svg>
                )}

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
                      <span className="text-emerald-300">{typedPrefix}</span>
                      <span className="text-amber-200">{typedSuffix}</span>
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
                  <span
                    className={
                      input.length ? "text-emerald-300" : "text-slate-400"
                    }
                  >
                    {inputDisplay}
                  </span>
                </div>

                {displayEnemies
                  .filter((e) => {
                    if (e.alive) return true;
                    const deadEnemies = displayEnemies.filter(
                      (enemy) => !enemy.alive
                    );
                    const deadEnemiesIndex = deadEnemies.findIndex(
                      (de) => de.id === e.id
                    );
                    return deadEnemiesIndex >= deadEnemies.length - 12;
                  })
                  .map((e) => {
                    const posX = e.displayX ?? e.x;
                    const posY = e.displayY ?? e.y;
                    const isHit = hitEnemies.has(e.id);
                    const isTarget = target && target.id === e.id;

                    return (
                      <div
                        key={e.id}
                        title={e.word}
                        className={`absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-opacity ${
                          isHit ? "animate-pulse" : ""
                        }`}
                        style={{
                          left: posX,
                          top: posY,
                          opacity: e.alive ? 1 : 0.35,
                        }}
                      >
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center border-2 border-slate-800 shadow ${
                            isHit ? "bg-red-500 scale-110" : "bg-emerald-400"
                          }`}
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
                              <span>
                                <span className="text-green-400 font-bold">
                                  {e.word.slice(0, input.length)}
                                </span>
                                <span>{e.word.slice(input.length)}</span>
                              </span>
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

            <div>
              <div className="mb-3 text-sm font-semibold uppercase tracking-[0.35em] text-slate-400">
                Spectator Feed
              </div>
              <div
                className="rounded-[28px] border-2 relative overflow-hidden mx-auto transition-all duration-300 border-slate-800/80"
                style={{ width, height, background: "#050505" }}
              >
                <div
                  title="opponent"
                  className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center text-lg"
                  style={{
                    left: cx,
                    top: cy,
                    width: playerRadius * 2,
                    height: playerRadius * 2,
                    borderRadius: "50%",
                    background: "linear-gradient(180deg,#60a5fa,#3b82f6)",
                    border: "3px solid #1e3a8a",
                  }}
                >
                  🎮
                </div>

                {opponentEnemies
                  .filter((e) => {
                    if (e.alive) return true;
                    const deadEnemies = opponentEnemies.filter(
                      (enemy) => !enemy.alive
                    );
                    const deadEnemiesIndex = deadEnemies.findIndex(
                      (de) => de.id === e.id
                    );
                    return deadEnemiesIndex >= deadEnemies.length - 12;
                  })
                  .map((e) => {
                    const posX = e.displayX ?? e.x;
                    const posY = e.displayY ?? e.y;
                    const isHit = spectatorHitEnemies.has(e.id);

                    return (
                      <div
                        key={e.id}
                        title={e.word}
                        className={`absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-opacity ${
                          isHit ? "animate-pulse" : ""
                        }`}
                        style={{
                          left: posX,
                          top: posY,
                          opacity: e.alive ? 1 : 0.35,
                        }}
                      >
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center border-2 border-slate-800 shadow ${
                            isHit ? "bg-red-500 scale-110" : "bg-emerald-400"
                          }`}
                          style={{
                            fontSize: 18,
                            transition: "all 0.15s ease-out",
                          }}
                        >
                          🧟
                        </div>
                        <div className="text-center mt-1 text-xs text-white">
                          {e.alive ? e.word : "DEAD"}
                        </div>
                      </div>
                    );
                  })}

                {spectatorBullets.map((bullet) => {
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
                      <div className="w-2 h-2 rounded-full bg-sky-400 shadow-lg shadow-sky-400/50" />
                    </div>
                  );
                })}
              </div>
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
                  Next: {nextWord || "—"}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
                <p className="text-[10px] uppercase tracking-[0.35em] text-slate-400">
                  Distance & Clock
                </p>
                <p className="text-xl font-semibold text-white">
                  {targetDistance ? `${Math.round(targetDistance)}px` : "—"}
                </p>
                <p className="text-xs text-slate-400">
                  Match clock synced server-side
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
                <p className="text-[10px] uppercase tracking-[0.35em] text-slate-400">
                  Swarm Count
                </p>
                <p className="text-xl font-semibold text-white">
                  {alivePlayerEnemies} alive
                </p>
                <p className="text-xs text-slate-400">
                  Input: {input || "Start typing"}
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>

      {gameOver && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 px-6">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900/95 p-6 text-center shadow-2xl shadow-black/60">
            {match?.ended ? (
              <>
                <h3
                  className={`text-3xl font-black ${
                    isWinner ? "text-emerald-300" : "text-red-400"
                  }`}
                >
                  {isWinner ? "Victory" : "Defeat"}
                </h3>
                <p className="mt-2 text-sm text-slate-400">
                  {isWinner
                    ? "You outlasted the swarm."
                    : "Opponent held the line."}
                </p>
                <p className="mt-4 text-lg font-semibold text-amber-300">
                  Final tally: {displayKills} kills • {displayHearts} hearts
                </p>
              </>
            ) : (
              <>
                <h3 className="text-2xl font-black text-white">Game Over</h3>
                <p className="mt-2 text-sm text-slate-400">
                  You ran out of hearts.
                </p>
              </>
            )}
            <button
              onClick={() => {
                if (onGameOver) onGameOver();
              }}
              className="mt-5 w-full rounded-xl bg-amber-400/90 px-4 py-2 text-sm font-semibold uppercase tracking-[0.35em] text-slate-900 shadow-lg shadow-amber-400/40"
            >
              Return to Home
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

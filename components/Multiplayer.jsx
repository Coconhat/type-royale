import React, { useEffect, useState, useRef, useCallback } from "react";

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
        <div className="text-xs text-slate-400 mt-1">
          Lifetime Wins: {stats.totalWins}
          {!stackUser && " (sign in to sync)"}
        </div>
      </div>

      {/* Multiplayer split-screen (player | opponent) */}
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
            {/* Target tracking line */}
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
                    <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.3" />
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
                {/* Arrowhead at enemy position */}
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
                className={input.length ? "text-emerald-300" : "text-slate-400"}
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
                // Use interpolated position for smooth movement in multiplayer
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

            {/* Render bullets */}
            {bullets.map((bullet) => {
              const currentX =
                bullet.startX + (bullet.endX - bullet.startX) * bullet.progress;
              const currentY =
                bullet.startY + (bullet.endY - bullet.startY) * bullet.progress;

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

        {/* Opponent POV (spectator view - shows stats only) */}
        <div className="flex-1">
          <div className="mb-2 text-sm font-semibold text-center">
            Opponent - ❤️ {opponentHearts} | 🎯 {opponentKills} kills
          </div>
          <div
            className="rounded-lg border-2 border-slate-800 relative overflow-hidden mx-auto"
            style={{ width, height, background: "#111" }}
          >
            {/* Opponent player character in center */}
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
                // Use interpolated position for smooth movement in multiplayer
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
                bullet.startX + (bullet.endX - bullet.startX) * bullet.progress;
              const currentY =
                bullet.startY + (bullet.endY - bullet.startY) * bullet.progress;

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
          <div className="bg-white p-6 rounded-lg text-center min-w-[300px]">
            {match?.ended ? (
              // Multiplayer match ended
              <>
                <h3
                  className={`text-3xl font-bold mb-4 ${
                    isWinner ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {isWinner ? "🎉 Victory! 🎉" : "💀 Defeat 💀"}
                </h3>
                <div className="mb-4 text-lg">
                  {isWinner
                    ? "You won the match!"
                    : "Your opponent survived longer."}
                </div>
                <div className="text-sm text-gray-600 mb-4">
                  Final Score: {displayKills} kills | {displayHearts} ❤️
                  remaining
                </div>
                <button
                  onClick={() => {
                    if (onGameOver) onGameOver();
                  }}
                  className="px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                >
                  Return to Home
                </button>
              </>
            ) : (
              // Game over but match not ended
              <>
                <h3 className="text-2xl font-bold mb-2">Game Over</h3>
                <div className="mb-4">You ran out of hearts.</div>
                <button
                  onClick={() => {
                    if (onGameOver) onGameOver();
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded"
                >
                  Return to Home
                </button>
              </>
            )}
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

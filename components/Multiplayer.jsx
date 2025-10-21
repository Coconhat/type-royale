import React, { useEffect, useState } from "react";

import { initAudio, loadGunshot, playGunshot } from "../libs/gunshot";
import useInterpolation from "../hooks/useInterpolation";

export default function Multiplayer({ socketData, onGameOver } = {}) {
  const [input, setInput] = useState("");
  const [target, setTarget] = useState(null);

  const {
    connected = false,
    match = null,
    serverEnemies = [],
    roomPlayers = null,
    sendHit = () => {},
  } = socketData || {};

  // Use interpolation for smooth multiplayer movement
  const displayEnemies = useInterpolation(serverEnemies);

  const [gameOver, setGameOver] = useState(false);

  // game dimensions (px)
  const width = 600;
  const height = 600;
  const cx = width / 2;
  const cy = height / 2;
  const playerRadius = 22;

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

  // find nearest enemy to player center
  useEffect(() => {
    const alive = displayEnemies.filter((e) => e.alive && !e.reached);
    if (alive.length > 0) {
      const nearest = alive.reduce((a, b) => {
        const da = Math.hypot(a.x - cx, a.y - cy);
        const db = Math.hypot(b.x - cx, b.y - cy);
        return da < db ? a : b;
      });
      setTarget(nearest);
    } else {
      setTarget(null);
    }
  }, [displayEnemies, cx, cy]);

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

            {/* Spectator view - no enemy details shown */}
            <div className="text-slate-500 text-sm text-center px-4">
              <div className="mb-2">👁️ Spectator View</div>
              <div className="text-xs">
                You cannot see opponent enemies or words.
                <br />
                Watch their stats above!
              </div>
            </div>
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

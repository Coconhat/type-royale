import React, { useEffect, useState } from "react";
import Game from "../components/Game";
import useSocket from "../hooks/useSocket";
import MultiplayerClient from "../components/MultiplayerClient";
import GithubButton from "../components/github-button";
import AuthHeader from "../components/auth-header";

export default function StartPage() {
  const [start, setStart] = useState(false);
  const [finding, setFinding] = useState(false);
  const [findSeconds, setFindSeconds] = useState(0);
  const [autoCountdown, setAutoCountdown] = useState(null);

  // create a single socket hook instance here and pass it down to children
  const socketHook = useSocket("https://type-royale-backend.onrender.com/");
  const {
    connected,
    match,
    joinQueue,
    leaveQueue,
    ready,
    onlinePlayers,
    playerId,
  } = socketHook;

  // Start local timer while searching for match
  useEffect(() => {
    let t;
    if (finding) {
      setFindSeconds(0);
      t = setInterval(() => setFindSeconds((s) => s + 1), 1000);
    }
    return () => clearInterval(t);
  }, [finding]);

  // When a match is found, immediately start the countdown and mount Multiplayer
  // The Multiplayer component will send "ready" and wait for matchStart from server
  useEffect(() => {
    if (match) {
      setFinding(false);
      // Short countdown before starting
      setAutoCountdown(2);
      const cd = setInterval(() => {
        setAutoCountdown((c) => {
          if (c === 1) {
            clearInterval(cd);
            setAutoCountdown(null);
            setStart(true);
            return null;
          }
          return c - 1;
        });
      }, 1000);

      return () => clearInterval(cd);
    }
  }, [match]);

  // Handle game over in multiplayer - return to home
  const handleGameOver = () => {
    leaveQueue();
    setStart(false);
    setFinding(false);
    setAutoCountdown(null);
  };

  // If the user manually starts single-player, go to Game (no socketData)
  if (start && !match) return <Game />;
  // If matched, render Multiplayer component with socketHook
  if (match)
    return (
      <MultiplayerClient socketData={socketHook} onGameOver={handleGameOver} />
    );
  // If start was pressed in presence of a match, the above handles mounting Multiplayer

  return (
    <div className="mx-auto text-center mt-9 ">
      {/* Auth buttons */}
      <AuthHeader />

      <h1 className="p-5 font-bold text-slate-900  text-3xl">
        Welcome to Type Royale
      </h1>
      <p className="p-5 font-mono text-slate-900 text-bold text-3xl">
        Get ready to test your typing skills!
      </p>
      {/* Compact status chip */}
      <div
        aria-live="polite"
        className="flex items-center justify-center gap-3 mt-4"
      >
        <StatusChip connected={connected} onlinePlayers={onlinePlayers} />
      </div>
      <div className="flex items-center justify-center gap-4 mt-6">
        {/* Left: Match controls */}

        <div className="flex items-center gap-4">
          {/* FIND MATCH button (hidden while finding/matched) */}
          {!finding && !match && (
            <button
              onClick={() => {
                joinQueue();
                setFinding(true);
              }}
              aria-pressed="false"
              className="flex items-center gap-3 px-6 py-3 text-lg rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg hover:scale-105 transform transition"
            >
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden
              >
                <path
                  d="M12 5v14M5 12h14"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Find Match
            </button>
          )}

          {/* FINDING card */}
          {finding && !match && (
            <div className="flex items-center gap-4 p-4 bg-white/95 border rounded-lg shadow-sm min-w-[260px]">
              <Spinner />
              <div className="flex flex-col">
                <div className="font-medium text-slate-800">Finding match…</div>
                <div className="text-sm text-slate-500">
                  Elapsed: <span className="font-mono">{findSeconds}s</span>
                </div>
              </div>

              <div className="ml-4 flex gap-2">
                <button
                  onClick={() => {
                    leaveQueue();
                    setFinding(false);
                  }}
                  className="px-3 py-1 bg-red-600 text-white rounded-md shadow-sm hover:opacity-95 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* MATCHED card */}
          {match && (
            <div className="flex items-center gap-4 p-4 bg-white/95 border rounded-lg shadow-sm min-w-[320px]">
              <div className="flex flex-col">
                <div className="text-sm text-slate-700"></div>
                <div className="text-xs text-slate-400">
                  {match.roomId ? `Room ${match.roomId}` : ""}
                </div>
              </div>

              {/* Countdown */}
              <div className="ml-2">
                {autoCountdown !== null ? (
                  <div className="text-lg font-bold">{autoCountdown}s</div>
                ) : (
                  <div className="text-sm text-emerald-600">Starting…</div>
                )}
              </div>

              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => {
                    if (match?.roomId) ready(match.roomId);
                    setStart(true);
                  }}
                  className="px-3 py-1 bg-green-600 text-white rounded-md shadow-sm hover:brightness-105 transition"
                  aria-label="Start match now"
                >
                  Start Now
                </button>

                <button
                  onClick={() => {
                    leaveQueue();
                    setFinding(false);
                    setStart(false);
                  }}
                  className="px-3 py-1 bg-red-600 text-white rounded-md shadow-sm hover:brightness-95 transition"
                  aria-label="Leave match"
                >
                  Leave
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Start Solo button */}
      <div className="mt-6 flex justify-center">
        <button
          className="px-8 py-4 text-2xl rounded-2xl bg-slate-800 text-white font-mono shadow-lg hover:scale-[1.02] transition"
          onClick={() => setStart(true)}
          aria-label="Start solo game"
        >
          Start Solo
        </button>
      </div>

      <p className="mt-3">Your ID: {playerId}</p>

      <div className="fixed bottom-6 right-10">
        <GithubButton
          username="coconhat"
          repo="type-royale"
          showStars={true}
          token="your-github-token"
          className="mt-4"
        />
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div
      className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center animate-pulse"
      aria-hidden
    >
      <svg className="w-5 h-5 text-slate-500" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 2a10 10 0 100 20 10 10 0 000-20z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.25"
        />
        <path
          d="M22 12a10 10 0 00-10-10"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function StatusChip({ connected, onlinePlayers = 0 }) {
  return (
    <div className="flex items-center gap-2 bg-white/95 border px-3 py-1 rounded-full shadow-sm text-xs">
      <div className="flex items-center gap-2">
        <span
          className={`inline-block w-2 h-2 rounded-full ${
            connected ? "bg-emerald-500" : "bg-yellow-400"
          }`}
          aria-hidden
        />
        <span className="font-medium">
          {connected ? "Online" : "Connecting…"}
        </span>
      </div>
      <div className="ml-3 text-slate-500">
        Players: <span className="font-mono ml-1">{onlinePlayers}</span>
      </div>
    </div>
  );
}

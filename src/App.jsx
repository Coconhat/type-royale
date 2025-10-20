import React, { useEffect, useState } from "react";
import Game from "../components/Game";
import useSocket from "../hooks/useSocket";

export default function StartPage() {
  const [start, setStart] = useState(false);
  const [finding, setFinding] = useState(false);
  const [findSeconds, setFindSeconds] = useState(0);
  const [autoCountdown, setAutoCountdown] = useState(null);

  const { connected, match, joinQueue, leaveQueue, ready } = useSocket(
    "http://localhost:4000"
  ); // change URL to your server

  // Start local timer while searching for match
  useEffect(() => {
    let t;
    if (finding) {
      setFindSeconds(0);
      t = setInterval(() => setFindSeconds((s) => s + 1), 1000);
    }
    return () => clearInterval(t);
  }, [finding]);

  // When a match is found, automatically transition into the Game view.
  // Optionally, show a short countdown (3s) before starting to allow "ready".
  useEffect(() => {
    if (match) {
      // If user was searching, stop that UI
      setFinding(false);

      // If server sends a roomId immediately, auto-enter Game; otherwise wait for matchStart
      // We'll do a short 2-second countdown so both players see a brief "matched" state.
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

  // If the user manually starts single-player, go to Game
  if (start && !match) return <Game />;
  // If matched, Game will be shown automatically after countdown; allow Game to mount when start===true
  if (start && match) return <Game />;

  return (
    <div className="mx-auto text-center mt-9">
      <h1 className="p-5 font-bold text-slate-900  text-3xl">
        Welcome to Type Royale
      </h1>
      <p className="p-5 font-mono text-slate-900 text-bold text-3xl">
        Get ready to test your typing skills!
      </p>

      {/* MATCHMAKING CONTROLS */}
      <div className="flex items-center gap-2 justify-center mt-4">
        {!finding && !match && (
          <button
            onClick={() => {
              joinQueue();
              setFinding(true);
            }}
            className="px-3 py-1 bg-blue-600 text-white rounded"
          >
            Find Match
          </button>
        )}

        {/* Finding match box */}
        {finding && !match && (
          <div className="p-4 border rounded-md bg-white/90">
            <div className="font-medium">Finding match...</div>
            <div className="text-sm text-slate-600">
              Elapsed: {findSeconds}s
            </div>
            <div className="mt-2 flex gap-2 justify-center">
              <button
                onClick={() => {
                  leaveQueue();
                  setFinding(false);
                }}
                className="px-3 py-1 bg-red-600 text-white rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Matched small card while countdown runs */}
        {match && (
          <div className="p-4 border rounded-md bg-white/95 flex items-center gap-3">
            <div className="text-sm">
              Matched vs {match.opponent?.id?.slice(0, 6) || "Opponent"}
            </div>
            {autoCountdown !== null ? (
              <div className="text-lg font-bold">
                Starting in {autoCountdown}s
              </div>
            ) : (
              <div className="text-sm text-green-600">Starting...</div>
            )}
            <button
              onClick={() => {
                // allow manual start/ready if you want
                if (match?.roomId) ready(match.roomId);
                setStart(true);
              }}
              className="px-3 py-1 bg-green-600 text-white rounded"
            >
              Start Now
            </button>
            <button
              onClick={() => {
                // allow leaving match/queue
                leaveQueue();
                setFinding(false);
                setStart(false);
              }}
              className="px-3 py-1 bg-red-600 text-white rounded"
            >
              Leave
            </button>
          </div>
        )}

        <div className="text-xs ml-3">{connected ? "Online" : "Offline"}</div>
      </div>

      <div className="mt-6">
        <button
          className="p-5 font-mono bg-slate-300 text-slate-900 text-bold text-3xl hover:bg-slate-600 rounded-3xl"
          onClick={() => setStart(true)}
        >
          Start Solo
        </button>
      </div>
    </div>
  );
}

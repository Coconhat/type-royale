import React, { useEffect, useRef } from "react";
import Game from "./Game";

// Multiplayer component: renders the split-screen Game using server-provided state.
// Expects a single socketHook object created at App level (the return value of useSocket).
export default function Multiplayer({ socketData }) {
  const serverEnemies = (socketData && socketData.serverEnemies) || [];
  const readySentRef = useRef(false);

  // Automatically send "ready" signal when component mounts and we have a match
  useEffect(() => {
    if (socketData?.match?.roomId && socketData?.ready && !readySentRef.current) {
      console.log("[Multiplayer] Sending ready signal to room:", socketData.match.roomId);
      socketData.ready(socketData.match.roomId);
      readySentRef.current = true;
    }
  }, [socketData]);

  return (
    <div>
      <div className="p-2 text-sm text-slate-500">
        Multiplayer — Enemies: {serverEnemies.length}
      </div>
      {serverEnemies.length === 0 && (
        <div className="p-2 text-xs text-yellow-400">
          Waiting for both players to be ready...
        </div>
      )}
      <Game socketData={socketData} />
    </div>
  );
}

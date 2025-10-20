import React from "react";
import Game from "./Game";

// Multiplayer component: renders the split-screen Game using server-provided state.
// Expects a single socketHook object created at App level (the return value of useSocket).
export default function Multiplayer({ socketData }) {
  const serverEnemies = (socketData && socketData.serverEnemies) || [];

  return (
    <div>
      <div className="p-2 text-sm text-slate-500">
        Multiplayer — Enemies: {serverEnemies.length}
      </div>
      {serverEnemies.length === 0 && (
        <div className="p-2 text-xs text-red-400">
          No enemies received yet from server. Debug:{" "}
          {JSON.stringify(serverEnemies[0] || {})}
        </div>
      )}
      <Game socketData={socketData} />
    </div>
  );
}

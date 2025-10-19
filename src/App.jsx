import React, { useState } from "react";
import Game from "../components/Game";

export default function StartPage() {
  const [start, setStart] = useState(false);

  if (start) return <Game />;

  return (
    <div className="mx-auto text-center mt-9">
      <h1 className="p-5 font-bold text-slate-900  text-3xl">
        Welcome to Type Royale
      </h1>
      <p className="p-5 font-mono text-slate-900 text-bold text-3xl">
        Get ready to test your typing skills!
      </p>
      <button
        className="p-5 font-mono bg-slate-300 text-slate-900 text-bold text-3xl hover:bg-slate-600 rounded-3xl"
        onClick={() => setStart(true)}
      >
        Start
      </button>
    </div>
  );
}

import { useState } from "react";
import Game from "../components/Game";
import "./App.css";

function App() {
  const [start, setStart] = useState(false);

  return (
    <>
      {!start && (
        <>
          <h1>Welcome to Type Royale</h1>
          <button onClick={() => setStart(true)}>Start Game</button>
        </>
      )}

      {start && <Game />}
    </>
  );
}

export default App;

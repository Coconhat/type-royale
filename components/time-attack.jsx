import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { allWords } from "../libs/words";

export default function TimeAttack() {
  const words = useMemo(() => allWords, []);
  const TOTAL_TIME_MS = 20000;

  const getRandomPhrase = useCallback(() => {
    const wordsPerPhrase = 10;
    const phrase = [];

    while (phrase.length < wordsPerPhrase) {
      const nextWord = words[Math.floor(Math.random() * words.length)];
      const lastWord = phrase[phrase.length - 1];
      if (nextWord === lastWord) continue;
      phrase.push(nextWord);
    }

    return phrase.join(" ");
  }, [words]);

  const [phrase, setPhrase] = useState(() => getRandomPhrase());

  const [inputValue, setInputValue] = useState("");
  const [remainingMs, setRemainingMs] = useState(TOTAL_TIME_MS);
  const [isRunning, setIsRunning] = useState(false);
  const [timeUp, setTimeUp] = useState(false);
  const [completed, setCompleted] = useState(0);

  const inputRef = useRef(null);

  const handleRestart = useCallback(() => {
    setPhrase(getRandomPhrase());
    setInputValue("");
    setRemainingMs(TOTAL_TIME_MS);
    setIsRunning(false);
    setTimeUp(false);
    setCompleted(0);
    if (inputRef.current) {
      inputRef.current.focus({ preventScroll: true });
    }
  }, [getRandomPhrase]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus({ preventScroll: true });
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Tab") {
        event.preventDefault();
        handleRestart();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleRestart]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus({ preventScroll: true });
    }
  }, [phrase]);

  useEffect(() => {
    if (!isRunning) return undefined;

    const interval = setInterval(() => {
      setRemainingMs((t) => {
        if (t <= 1000) {
          clearInterval(interval);
          setIsRunning(false);
          setTimeUp(true);
          return 0;
        }
        return t - 1000;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning]);

  function handleInputChange(event) {
    const next = event.target.value.toLowerCase();

    if (timeUp || remainingMs <= 0) {
      return;
    }

    if (next.length > phrase.length) {
      return;
    }

    if (!isRunning && next.length > 0) {
      setIsRunning(true);
      setTimeUp(false);
    }

    setInputValue(next);

    if (next === phrase) {
      setPhrase(getRandomPhrase());
      setInputValue("");
      setCompleted((count) => count + 1);
    }
  }

  const characters = Array.from(phrase).map((char, index) => {
    const typedChar = inputValue[index];

    if (typedChar === undefined) {
      return {
        char,
        status: index === inputValue.length ? "current" : "pending",
      };
    }

    if (typedChar === char) {
      return { char, status: "correct" };
    }

    return { char, status: "incorrect" };
  });

  const mistakes = characters.filter((c) => c.status === "incorrect").length;
  const secondsLeft = Math.ceil(remainingMs / 1000);

  return (
    <div
      className="min-h-screen bg-[#1c1c1c] flex items-center justify-center p-6"
      onClick={() => inputRef.current?.focus({ preventScroll: true })}
    >
      <div className="w-full max-w-3xl space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-white">Time Attack</h1>
          <p className="text-slate-400">Type the words as fast as you can</p>
        </div>

        <div className="bg-[#262626] rounded-lg p-8 shadow-xl border border-[#333]">
          <p className="font-mono text-2xl leading-relaxed text-center min-h-[120px] flex flex-wrap items-center justify-center gap-1">
            {characters.map(({ char, status }, index) => {
              const displayChar = char === " " ? "\u00A0" : char;

              let className = "px-0.5 transition-colors";

              if (status === "correct") className += " text-emerald-400";
              else if (status === "incorrect")
                className +=
                  " text-amber-300 underline decoration-amber-300 decoration-2";
              else if (status === "current")
                className += " text-violet-200 bg-violet-500/20 rounded-sm";
              else className += " text-slate-500";

              return (
                <span key={`${char}-${index}`} className={className}>
                  {displayChar}
                </span>
              );
            })}
          </p>
        </div>

        <div className="flex items-center justify-center gap-8 text-slate-400">
          <div className="text-center">
            <div className="text-3xl font-bold text-white">
              {Math.max(0, secondsLeft)}s
            </div>
            <div className="text-sm mt-1">Time left</div>
          </div>
          <div className="h-12 w-px bg-[#333]"></div>
          <div className="text-center">
            <div className="text-3xl font-bold text-emerald-400">
              {completed}
            </div>
            <div className="text-sm mt-1">Completed</div>
          </div>
          <div className="h-12 w-px bg-[#333]"></div>
          <div className="text-center">
            <div className="text-3xl font-bold text-amber-300">{mistakes}</div>
            <div className="text-sm mt-1">Active mistakes</div>
          </div>
        </div>

        {timeUp && (
          <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 px-6 py-4 text-center">
            <p className="text-rose-400 font-medium">
              Time's up! You completed {completed} phrases.
            </p>
            <p className="text-slate-400 text-sm mt-1">
              press Left Tab to restart or use the button below
            </p>
          </div>
        )}

        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleRestart}
            className="rounded-lg bg-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow-lg hover:bg-emerald-600 transition-colors"
          >
            Restart Game
          </button>
        </div>

        <input
          ref={inputRef}
          className="absolute h-0 w-0 opacity-0"
          value={inputValue}
          onChange={handleInputChange}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

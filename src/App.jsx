import React, { useEffect, useState, useRef } from "react";
import Game from "../components/Game";
import useSocket from "../hooks/useSocket";
import MultiplayerClient from "../components/MultiplayerClient";
import GithubButton from "../components/github-button";
import AuthHeader from "../components/auth-header";
import { useNavigation } from "./navigation-context";

export default function StartPage() {
  const [start, setStart] = useState(false);
  const [finding, setFinding] = useState(false);
  const [findSeconds, setFindSeconds] = useState(0);
  const [autoCountdown, setAutoCountdown] = useState(null);
  const bgmRef = useRef(null);

  const socketHook = useSocket("https://type-royale-backend.onrender.com/");
  const navigate = useNavigation();
  const {
    connected,
    match,
    joinQueue,
    leaveQueue,
    ready,
    onlinePlayers,
    playerId,
  } = socketHook;

  useEffect(() => {
    if (!bgmRef.current) {
      const audio = new Audio("/MainMenu.mp3");
      audio.loop = true;
      audio.preload = "auto";
      audio.volume = 0.4;
      audio.addEventListener("error", (e) =>
        console.warn("MainMenu.mp3 failed to load", e)
      );
      audio.addEventListener("play", () =>
        console.log("Main menu music playing")
      );
      bgmRef.current = audio;
    }
    if (!start && !match) {
      if (bgmRef.current.paused) {
        bgmRef.current.play().catch((err) => {
          console.log("Autoplay blocked, will wait for user gesture.", err);
        });
      }
    } else {
      if (!bgmRef.current.paused) bgmRef.current.pause();
    }
    return () => {
      bgmRef.current && bgmRef.current.pause();
    };
  }, [start, match]);

  // unlock audio on first user interaction if autoplay was blocked
  useEffect(() => {
    const unlock = () => {
      if (bgmRef.current && bgmRef.current.paused && !start && !match) {
        bgmRef.current.play().catch(() => {});
      }
      document.removeEventListener("pointerdown", unlock);
      document.removeEventListener("keydown", unlock);
    };
    document.addEventListener("pointerdown", unlock);
    document.addEventListener("keydown", unlock);
    return () => {
      document.removeEventListener("pointerdown", unlock);
      document.removeEventListener("keydown", unlock);
    };
  }, [start, match]);

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
  useEffect(() => {
    if (match) {
      setFinding(false);
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

  if (start && !match) return <Game />;
  if (match)
    return (
      <MultiplayerClient socketData={socketHook} onGameOver={handleGameOver} />
    );

  return (
    <div className="min-h-screen bg-[#060612] text-white">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-12 space-y-12">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.45em] text-slate-500">
              Welcome to
            </p>
            <h1 className="text-5xl font-black tracking-wide text-white drop-shadow-lg md:text-6xl">
              Type Royale
            </h1>
            <p className="text-lg text-slate-300 md:text-xl">
              Choose a mode and start typing your way to victory.
            </p>
            <StatusChip connected={connected} onlinePlayers={onlinePlayers} />
          </div>
          <div className="self-end md:self-auto md:translate-y-2">
            <AuthHeader />
          </div>
        </div>

        <div className="space-y-6">
          {!finding && !match && (
            <ModeOption
              badge="MP"
              title="Multiplayer"
              subtitle="Battle real opponents in real time"
              accent="from-fuchsia-500 via-purple-600 to-indigo-600"
              cta="Find Match"
              onClick={() => {
                joinQueue();
                setFinding(true);
              }}
            />
          )}

          {finding && !match && (
            <ModeStatus
              badge="MP"
              title="Searching For Opponents"
              subtitle="Hang tight while we find the perfect lobby"
              accent="from-sky-500 via-blue-600 to-indigo-700"
              footer={
                <button
                  onClick={() => {
                    leaveQueue();
                    setFinding(false);
                  }}
                  className="rounded-xl bg-rose-500 px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-rose-400"
                >
                  Cancel Search
                </button>
              }
            >
              <div className="flex items-center gap-4">
                <Spinner />
                <div className="text-slate-100">
                  <div className="text-lg font-semibold">Elapsed</div>
                  <div className="font-mono text-2xl text-sky-200">
                    {findSeconds}s
                  </div>
                </div>
              </div>
            </ModeStatus>
          )}

          {match && (
            <ModeStatus
              badge="MP"
              title="Match Found"
              subtitle={
                match.roomId ? `Room ${match.roomId}` : "Preparing arena"
              }
              accent="from-emerald-500 via-teal-500 to-cyan-500"
              footer={
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => {
                      if (match?.roomId) ready(match.roomId);
                      setStart(true);
                    }}
                    className="flex-1 min-w-[160px] rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-emerald-400"
                  >
                    Start Now
                  </button>
                  <button
                    onClick={() => {
                      leaveQueue();
                      setFinding(false);
                      setStart(false);
                    }}
                    className="flex-1 min-w-[160px] rounded-xl bg-slate-700 px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-slate-600"
                  >
                    Leave Match
                  </button>
                </div>
              }
            >
              <div className="flex items-center gap-6 text-slate-100">
                <div className="text-6xl font-bold text-emerald-300">
                  {autoCountdown ?? "GO"}
                </div>
                <div className="text-base text-slate-300">
                  Get ready! The arena opens in a moment.
                </div>
              </div>
            </ModeStatus>
          )}

          <ModeOption
            badge="SP"
            title="Classic"
            subtitle="Sharpen your accuracy without pressure"
            accent="from-blue-500 via-indigo-500 to-purple-500"
            cta="Launch Solo"
            onClick={() => setStart(true)}
          />

          <ModeOption
            badge="TA"
            title="Time Attack"
            subtitle="Clear as many phrases as you can in 20 seconds"
            accent="from-teal-500 via-emerald-500 to-lime-500"
            cta="Enter Time Attack"
            onClick={() => navigate("/time-attack")}
          />
        </div>

        <div className="text-center text-sm text-slate-500">
          Player ID:{" "}
          <span className="font-mono text-slate-300">{playerId}</span>
        </div>
      </div>

      <div className="fixed bottom-6 right-6">
        <GithubButton
          username="coconhat"
          repo="type-royale"
          showStars={true}
          token="your-github-token"
        />
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div className="relative h-12 w-12">
      <div className="absolute inset-0 rounded-full border border-white/10" />
      <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-emerald-300 animate-spin" />
    </div>
  );
}

function StatusChip({ connected, onlinePlayers = 0 }) {
  return (
    <div className="inline-flex items-center gap-4 rounded-full border border-white/10 bg-[#121223] px-6 py-3 shadow-lg shadow-black/30">
      <div className="flex items-center gap-2">
        <span
          className={`inline-block h-3 w-3 rounded-full ${
            connected ? "bg-emerald-400" : "bg-amber-300"
          }`}
        />
        <span className="text-sm font-semibold text-white">
          {connected ? "Online" : "Connecting"}
        </span>
      </div>
      <div className="h-4 w-px bg-white/10" />
      <div className="text-sm text-slate-300">
        <span className="font-mono text-white">{onlinePlayers}</span> players
        queued
      </div>
    </div>
  );
}

function ModeOption({
  badge,
  title,
  subtitle,
  accent,
  cta,
  onClick,
  disabled,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`group relative w-full overflow-hidden rounded-2xl border border-white/5 bg-[#141427] shadow-2xl transition transform hover:scale-[1.01] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-60`}
    >
      <div
        className={`absolute inset-0 bg-gradient-to-r ${accent} opacity-80`}
      />
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative z-10 flex h-28 items-center justify-between px-8">
        <div className="flex items-center gap-6">
          <div className="rounded-lg bg-black/30 px-4 py-2 text-3xl font-black tracking-wider text-white">
            {badge}
          </div>
          <div>
            <div className="text-3xl font-bold text-white drop-shadow-sm">
              {title}
            </div>
            <div className="mt-1 text-xs uppercase tracking-[0.35em] text-white/70">
              {subtitle}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 text-lg font-semibold text-white/90">
          <span>{cta}</span>
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none">
            <path
              d="M9 18l6-6-6-6"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    </button>
  );
}

function ModeStatus({ badge, title, subtitle, accent, children, footer }) {
  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-white/5 bg-[#141427] shadow-2xl">
      <div
        className={`absolute inset-0 bg-gradient-to-r ${accent} opacity-70`}
      />
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative z-10 flex flex-col gap-6 px-8 py-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-black/30 px-4 py-2 text-3xl font-black tracking-wider text-white">
              {badge}
            </div>
            <div>
              <div className="text-3xl font-bold text-white drop-shadow-sm">
                {title}
              </div>
              <div className="mt-1 text-xs uppercase tracking-[0.35em] text-white/70">
                {subtitle}
              </div>
            </div>
          </div>
        </div>

        <div>{children}</div>

        {footer && <div className="pt-2">{footer}</div>}
      </div>
    </div>
  );
}

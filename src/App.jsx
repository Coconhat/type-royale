import React, { useState } from "react";
import Game from "../components/Game";

export default function StartPage() {
  const [isHovered, setIsHovered] = useState(false);
  const [start, setStart] = useState(false);

  if (start) return <Game />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-400 via-blue-500 to-blue-600 flex items-center justify-center p-8 relative overflow-hidden">
      {/* LEGO studs background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="grid grid-cols-12 gap-8 h-full w-full p-8">
          {[...Array(48)].map((_, i) => (
            <div
              key={i}
              className="rounded-full bg-white"
              style={{ aspectRatio: "1" }}
            />
          ))}
        </div>
      </div>

      {/* Main LEGO brick container */}
      <div className="relative z-10 max-w-2xl w-full">
        {/* Top studs */}
        <div className="flex justify-center gap-6 mb-4">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="w-12 h-12 bg-yellow-400 rounded-full shadow-lg border-4 border-yellow-500"
            />
          ))}
        </div>

        {/* Main brick body */}
        <div className="bg-yellow-400 rounded-3xl p-12 shadow-2xl border-8 border-yellow-500 relative">
          {/* Side shadow lines for depth */}
          <div className="absolute left-0 top-8 bottom-8 w-2 bg-yellow-600 rounded-l-xl" />
          <div className="absolute right-0 top-8 bottom-8 w-2 bg-yellow-600 rounded-r-xl" />

          {/* Content */}
          <div className="text-center space-y-8">
            {/* Title */}
            <h1 className="text-6xl font-black text-white drop-shadow-lg tracking-tight">
              TYPE ROYALE
            </h1>

            {/* Decorative divider */}
            <div className="flex justify-center gap-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="relative">
                  <div className="w-8 h-2 bg-red-500 rounded-sm" />
                  <div className="flex justify-center gap-1 mt-0.5">
                    <div className="w-2 h-2 bg-red-600 rounded-full" />
                    <div className="w-2 h-2 bg-red-600 rounded-full" />
                  </div>
                </div>
              ))}
            </div>

            <p className="text-2xl font-bold text-blue-900">
              Build Your Typing Speed, Brick by Brick!
            </p>

            {/* LEGO-style button */}
            <div
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              className="relative group mt-8 cursor-pointer select-none"
              onClick={() => setStart(true)}
            >
              {/* Button studs */}
              <div className="flex justify-center gap-4 mb-2">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className={`w-8 h-8 rounded-full shadow-md border-3 transition-all duration-200 ${
                      isHovered
                        ? "bg-green-300 border-green-400"
                        : "bg-green-400 border-green-500"
                    }`}
                  />
                ))}
              </div>

              {/* Button body */}
              <div
                className={`px-16 py-6 rounded-2xl border-6 font-black text-3xl shadow-xl transition-all duration-200 transform ${
                  isHovered
                    ? "bg-green-400 border-green-500 -translate-y-1 shadow-2xl"
                    : "bg-green-500 border-green-600 translate-y-0"
                }`}
              >
                <span className="text-white drop-shadow-md">START GAME</span>
              </div>
            </div>

            {/* Fun stats placeholder */}
            <div className="flex justify-center gap-6 mt-12">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="text-center">
                  <div className="flex justify-center gap-1 mb-1">
                    <div className="w-3 h-3 bg-gray-400 rounded-full" />
                    <div className="w-3 h-3 bg-gray-400 rounded-full" />
                  </div>
                  <div className="bg-gray-400 rounded-lg px-4 py-2 border-3">
                    <div className="text-white font-bold text-lg">--</div>
                    <div className="text-white text-xs font-semibold">STAT</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom studs */}
        <div className="flex justify-center gap-6 mt-4">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="w-12 h-12 bg-yellow-400 rounded-full shadow-lg border-4 border-yellow-500"
            />
          ))}
        </div>
      </div>

      {/* Floating LEGO pieces */}
      <div
        className="absolute top-10 left-10 animate-bounce"
        style={{ animationDelay: "0s", animationDuration: "3s" }}
      >
        <div className="w-16 h-16 bg-red-500 rounded-lg border-4 border-red-600 shadow-xl" />
      </div>
      <div
        className="absolute bottom-20 right-20 animate-bounce"
        style={{ animationDelay: "1s", animationDuration: "4s" }}
      >
        <div className="w-20 h-20 bg-blue-500 rounded-lg border-4 border-blue-600 shadow-xl" />
      </div>
      <div
        className="absolute top-1/3 right-10 animate-bounce"
        style={{ animationDelay: "0.5s", animationDuration: "3.5s" }}
      >
        <div className="w-12 h-12 bg-green-500 rounded-lg border-4 border-green-600 shadow-xl" />
      </div>
    </div>
  );
}

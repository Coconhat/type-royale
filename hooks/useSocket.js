import { useStackApp } from "@stackframe/react";
import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

export default function useSocket(
  serverUrl = "https://type-royale-backend.onrender.com/"
) {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);

  const [match, setMatch] = useState(null);

  const [serverEnemies, setServerEnemies] = useState([]);
  const [roomPlayers, setRoomPlayers] = useState([]);

  const [spectatorEnemies, setSpectatorEnemies] = useState({});

  const [onlinePlayers, setOnlinePlayers] = useState(0);

  const updateSpectators = (ownerId, updater) => {
    setSpectatorEnemies((prev) => {
      const current = prev[ownerId] || [];
      const next = updater(current);
      return { ...prev, [ownerId]: next };
    });
  };

  useEffect(() => {
    if (socketRef.current) {
      console.log("⚠️ Socket already exists, skipping connection");
      return;
    }

    console.log("🔌 Connecting to:", serverUrl);

    const socket = io(serverUrl, {
      autoConnect: true,
      transports: ["polling", "websocket"], // Try polling first, then upgrade
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
      timeout: 20000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      console.log("✅ Socket connected:", socket.id);
      console.log("🚀 Transport:", socket.io.engine.transport.name);

      // Request online player count when connected
      socket.emit("getOnlinePlayers");

      // Render cold start warning
      if (socket.io.engine.transport.name === "polling") {
        console.log(
          "💡 Using polling - will upgrade to websocket automatically"
        );
      }
    });

    socket.on("connect_error", (error) => {
      console.error("❌ Connection error:", error.message);

      // Helpful debugging for common issues
      if (error.message === "timeout") {
        console.warn(
          "⏱️ Connection timed out - Render might be cold starting (takes 30-60s)"
        );
        console.warn("💡 Will retry automatically...");
      }
    });

    socket.on("disconnect", (reason) => {
      setConnected(false);
      console.log("🔌 Socket disconnected:", reason);
    });

    socket.io.on("reconnect_attempt", (attempt) => {
      console.log("🔄 Reconnection attempt #" + attempt);
    });

    socket.io.on("reconnect", () => {
      console.log("✅ Reconnected successfully!");
    });

    socket.on("onlineCount", (count) => {
      setOnlinePlayers(count);
    });

    socket.on("getOnlinePlayers", (data) => {
      setOnlinePlayers(data.count);
    });

    socket.on("matchFound", (payload) => {
      // payload: { roomId, playerId, opponentId }
      console.log("match found", payload);
      setMatch(payload);
      // clear any previous server state until matchStart
      setServerEnemies([]);
      setSpectatorEnemies({});
      setRoomPlayers(null);
    });

    // server sends the full initial battlefield and players when match starts
    socket.on("matchStart", (payload) => {
      // payload: { roomId, enemies, players }
      console.log("match start", payload);
      // merge with any existing match info (e.g. playerId from matchFound)
      setMatch((prev) => ({ ...(prev || {}), roomId: payload.roomId }));
      if (payload.enemies) setServerEnemies(payload.enemies);
      if (payload.players) setRoomPlayers(payload.players);
    });

    socket.on("spawnEnemy", (enemy) => {
      console.log(
        `[Frontend ${socket.id}] Received spawnEnemy: id=${enemy.id}, word="${enemy.word}", ownerId=${enemy.ownerId}`
      );
      setServerEnemies((prev) => {
        console.log(
          `[Frontend ${socket.id}] Current enemy count: ${prev.length}`
        );
        return [...prev, enemy].slice(-200);
      });
    });

    socket.on("enemyUpdate", (payload) => {
      // payload: { updates: [{id, x, y, alive}, ...], t }
      // Backend sends only changed enemies as deltas
      if (!payload.updates || !Array.isArray(payload.updates)) return;

      setServerEnemies((prev) => {
        const updatesMap = new Map(payload.updates.map((u) => [u.id, u]));
        return prev.map((e) => {
          const update = updatesMap.get(e.id);
          if (!update) return e;
          // Store previous position for interpolation
          return {
            ...e,
            ...update,
            _prevX: e.x,
            _prevY: e.y,
            _updateTime: payload.t || Date.now(),
          };
        });
      });
    });

    // server announces an enemy was killed
    socket.on("enemyKilled", ({ enemyId, by }) => {
      console.log(
        `[Frontend ${socket.id}] Received enemyKilled: enemyId=${enemyId}, by=${by}`
      );
      setServerEnemies((prev) => {
        const enemy = prev.find((e) => e.id === enemyId);
        console.log(
          `[Frontend ${socket.id}] Enemy ${enemyId} found in local state:`,
          enemy ? `yes (word: "${enemy.word}")` : "NO"
        );
        return prev.map((e) => (e.id === enemyId ? { ...e, alive: false } : e));
      });
    });

    // when an enemy reaches center (deduct hearts)
    socket.on("enemyReached", ({ enemyIds }) => {
      setServerEnemies((prev) =>
        prev.map((e) => (enemyIds.includes(e.id) ? { ...e, alive: false } : e))
      );
    });

    // full room state snapshot (optional, server may send periodically)
    socket.on("roomState", (state) => {
      // { players: {...}, enemies: [...] }
      if (state.enemies) setServerEnemies(state.enemies);
      if (state.players) setRoomPlayers(state.players);
    });

    // Immediate player stats update (for instant kill counter)
    socket.on("playerStats", ({ playerId, heart, kills }) => {
      setRoomPlayers((prev) => {
        if (!prev) return prev;
        if (Array.isArray(prev)) {
          return prev.map((p) =>
            p.id === playerId ? { ...p, heart, kills } : p
          );
        }
        // If prev is an object
        if (prev[playerId]) {
          return { ...prev, [playerId]: { ...prev[playerId], heart, kills } };
        }
        return prev;
      });
    });

    socket.on("matchEnd", (result) => {
      console.log("[socket] matchEnd", result);
      // result: { reason, winnerId, loserId, players }
      // Store match end info before clearing
      setMatch((prev) => ({
        ...(prev || {}),
        ended: true,
        winnerId: result.winnerId,
        loserId: result.loserId,
        reason: result.reason,
      }));
      // Don't clear immediately - let component handle the display
    });

    socket.on("enemySpawned", ({ ownerId, enemy }) => {
      console.log("[spectator] spawn", ownerId, enemy.id, enemy.word);
      updateSpectators(ownerId, (list) =>
        [...list.filter((e) => e.id !== enemy.id), enemy].slice(-200)
      );
    });

    socket.on("spectatorUpdate", ({ ownerId, updates, t }) => {
      if (!Array.isArray(updates)) return;
      if (updates.length > 0) {
        console.log("[spectator] update", ownerId, updates.length);
      }
      updateSpectators(ownerId, (list) => {
        const map = new Map(updates.map((u) => [u.id, u]));
        return list.map((enemy) => {
          const update = map.get(enemy.id);
          if (!update) return enemy;
          return {
            ...enemy,
            ...update,
            _prevX: enemy.x,
            _prevY: enemy.y,
            _updateTime: t || Date.now(),
          };
        });
      });
    });

    socket.on("spectatorKilled", ({ ownerId, enemyId }) => {
      console.log("[spectator] killed", ownerId, enemyId);
      updateSpectators(ownerId, (list) =>
        list.map((e) => (e.id === enemyId ? { ...e, alive: false } : e))
      );
    });

    socket.on("spectatorReached", ({ ownerId, enemies }) => {
      console.log(
        "[spectator] reached",
        ownerId,
        enemies?.map((e) => e.id)
      );
      const reachedIds = new Set(enemies?.map((e) => e.id) || []);
      updateSpectators(ownerId, (list) =>
        list.map((e) => (reachedIds.has(e.id) ? { ...e, alive: false } : e))
      );
    });

    // cleanup on unmount
    return () => {
      console.log("🔌 Cleaning up socket connection");
      socket.off(); // Remove all listeners
      socket.disconnect();
      socketRef.current = null;
      setServerEnemies([]);
      setSpectatorEnemies({});
    };
  }, [serverUrl]);

  // If we've been matched but haven't received enemies, ask the server for a
  // room snapshot after a short delay (best-effort recovery from dropped events).
  useEffect(() => {
    if (!socketRef.current) return;
    if (!match) return;
    const t = setTimeout(() => {
      if (serverEnemies.length === 0 && socketRef.current) {
        try {
          socketRef.current.emit("requestRoomState", { roomId: match.roomId });
          console.log("[socket] requested roomState for", match?.roomId);
        } catch (err) {
          console.warn("[socket] requestRoomState failed", err);
        }
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [match, serverEnemies.length]);

  /* ---- helper actions ---- */
  const joinQueue = () => socketRef.current?.emit("joinQueue");
  const leaveQueue = () => socketRef.current?.emit("leaveQueue");
  const ready = (roomId) => socketRef.current?.emit("ready", { roomId });

  /**
   * send a hit claim to server.
   * server should validate and broadcast enemyKilled if valid.
   */
  const sendHit = (roomId, enemyId, word) =>
    socketRef.current?.emit("hit", { roomId, enemyId, word });

  const resetMatch = () => {
    setMatch(null);
    setServerEnemies([]);
    setRoomPlayers([]);
    setSpectatorEnemies({});
  };

  return {
    socket: socketRef.current,
    connected,
    match,
    serverEnemies,
    roomPlayers,
    spectatorEnemies,
    onlinePlayers,
    joinQueue,
    leaveQueue,
    ready,
    sendHit,
    resetMatch,
    playerId: socketRef.current?.id,
  };
}

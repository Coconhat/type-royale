import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

export default function useSocket(serverUrl = "http://localhost:4000") {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);

  const [match, setMatch] = useState(null);

  const [serverEnemies, setServerEnemies] = useState([]);
  const [roomPlayers, setRoomPlayers] = useState([]);

  useEffect(() => {
    const socket = io(serverUrl, {
      autoConnect: true,
      transports: ["websocket"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      console.log("socket connected:", socket.id);
    });

    socket.on("disconnect", (reason) => {
      setConnected(false);
      console.log("socket disconnected:", reason);
    });

    socket.on("matchFound", (payload) => {
      // payload: { roomId, playerId, opponentId }
      console.log("match found", payload);
      setMatch(payload);
      // clear any previous server state until matchStart
      setServerEnemies([]);
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
      setServerEnemies((prev) => [...prev, enemy].slice(-200));
    });

    socket.on("enemyUpdate", (enemy) => {
      // enemy: { id, x, y, alive }
      setServerEnemies((prev) =>
        prev.map((e) => (e.id === enemy.id ? { ...e, ...enemy } : e))
      );
    });

    // server announces an enemy was killed
    socket.on("enemyKilled", ({ enemyId }) => {
      setServerEnemies((prev) =>
        prev.map((e) => (e.id === enemyId ? { ...e, alive: false } : e))
      );
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

    socket.on("matchEnd", (result) => {
      console.log("[socket] matchEnd", result);
      // result: { winnerId, players }
      // clear match / server enemies
      setMatch(null);
      setServerEnemies([]);
      setRoomPlayers(null);
    });

    // cleanup on unmount
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [serverUrl]);

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

  return {
    socket: socketRef.current,
    connected,
    match,
    serverEnemies,
    roomPlayers,
    joinQueue,
    leaveQueue,
    ready,
    sendHit,
  };
}

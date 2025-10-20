import { v4 } from "uuid";
import { allWords } from "../../libs/words.js";

const rooms = new Map();

function generateBattlefield(opts = {}) {
  const count = opts.count || 10;
  const enemies = [];
  for (let i = 0; i < count; i++) {
    enemies.push({
      id: i + 1,
      word: allWords[Math.floor(Math.random() * allWords.length)],
      x: Math.floor(Math.random() * 560) + 20,
      y: Math.floor(Math.random() * 560) + 20,
      ux: 0,
      uy: 0,
      baseSpeed: 0,
      alive: true,
    });
  }
  return enemies;
}

export function createRoom(io, socketA, socketB) {
  const roomId = v4();
  const battlefield = generateBattlefield({ count: 10 });

  // compute initial direction/speed toward center (300,300)
  battlefield.forEach((e) => {
    const dx = 300 - e.x;
    const dy = 300 - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    e.ux = dx / dist;
    e.uy = dy / dist;
    e.baseSpeed = 0.8 + Math.random() * 1.2; // base speed
  });

  const roomState = {
    id: roomId,
    io,
    players: new Map([
      [socketA.id, { id: socketA.id, heart: 3, kills: 0 }],
      [socketB.id, { id: socketB.id, heart: 3, kills: 0 }],
    ]),
    enemies: new Map(battlefield.map((e) => [e.id, e])),
    nextEnemyId: battlefield.length + 1,
    tickHandle: null,
    lastTick: Date.now(),
    handleHit: (playerId, enemyId, word) =>
      handleHit(roomState, playerId, enemyId, word),
    serializeEnemies: () => Array.from(roomState.enemies.values()),
    serializePlayers: () => Array.from(roomState.players.values()),
  };

  rooms.set(roomId, roomState);

  socketA.join(roomId);
  socketB.join(roomId);

  // store rooms Map on function for lookup from handler helper
  createRoom.__rooms = rooms;

  // start tick
  roomState.tickHandle = startRoomTick(io, roomState);

  // send initial snapshot
  io.to(roomId).emit("matchStart", {
    roomId: roomState.id,
    enemies: roomState.serializeEnemies(),
    players: roomState.serializePlayers(),
  });

  return roomState;
}

function broadcastRoomState(room) {
  room.io
    .to(room.id)
    .emit("roomState", {
      enemies: room.serializeEnemies(),
      players: room.serializePlayers(),
    });
}

function handleHit(room, playerId, enemyId, word) {
  const enemy = room.enemies.get(enemyId);
  if (!enemy || !enemy.alive) return;
  if ((enemy.word || "").toLowerCase() !== (word || "").toLowerCase()) return;

  enemy.alive = false;
  const player = room.players.get(playerId);
  if (player) player.kills = (player.kills || 0) + 1;

  // broadcast kill
  room.io.to(room.id).emit("enemyKilled", { enemyId, by: playerId });
}

function startRoomTick(io, room) {
  const TICK_MS = 80; // ~12.5Hz
  return setInterval(() => {
    const now = Date.now();
    const dt = Math.min(0.12, (now - room.lastTick) / 1000);
    room.lastTick = now;

    const reached = [];

    // update enemies
    for (const e of room.enemies.values()) {
      if (!e.alive) continue;
      e.x += e.ux * e.baseSpeed * (dt * 60); // scale to our client tick
      e.y += e.uy * e.baseSpeed * (dt * 60);
      const d = Math.hypot(e.x - 300, e.y - 300);
      if (d <= 24) {
        e.alive = false;
        reached.push(e.id);
      }
    }

    // broadcast deltas (enemyUpdate + enemyKilled/enemyReached)
    for (const e of room.enemies.values()) {
      io.to(room.id).emit("enemyUpdate", {
        id: e.id,
        x: e.x,
        y: e.y,
        alive: e.alive,
      });
    }

    if (reached.length > 0) {
      // deduct hearts (for simplicity, reduce both players)
      for (const p of room.players.values()) {
        p.heart = Math.max(0, (p.heart || 0) - reached.length);
      }
      io.to(room.id).emit("enemyReached", { enemyIds: reached });
    }

    // occasionally emit full snapshot (every second)
    if (Math.random() < 0.08) {
      broadcastRoomState(room);
    }
  }, TICK_MS);
}

export function leaveRoomIfAny(io, socketId) {
  for (const [id, room] of rooms) {
    if (room.players.has(socketId)) {
      if (room.tickHandle) clearInterval(room.tickHandle);
      rooms.delete(id);
      const otherIds = Array.from(room.players.keys()).filter(
        (pid) => pid !== socketId
      );
      for (const pid of otherIds) {
        io.to(pid).emit("opponentLeft", { roomId: id, by: socketId });
      }
    }
  }
}

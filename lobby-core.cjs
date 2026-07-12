'use strict';

const crypto = require('crypto');
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const COLORS = ['coral', 'amber', 'mint', 'sky', 'violet', 'rose', 'lime', 'navy', 'white', 'black'];
const BOT_NAMES = ['Atlas', 'Pico', 'Luna', 'Bolt', 'Echo', 'Mochi', 'Pixel', 'Orbit'];
const WORLD = { width: 30000, height: 20000 };
const ROOMS = [
  { id: 'reactor', label: 'REACTOR', x: 900, y: 900, w: 4200, h: 3000 },
  { id: 'engine', label: 'ENGINE', x: 6200, y: 700, w: 3600, h: 2800 },
  { id: 'medical', label: 'MEDICAL', x: 10800, y: 900, w: 3600, h: 2600 },
  { id: 'laboratory', label: 'LABORATORY', x: 15800, y: 700, w: 4600, h: 3000 },
  { id: 'navigation', label: 'NAVIGATION', x: 23000, y: 900, w: 5600, h: 3000 },
  { id: 'electrical', label: 'ELECTRICAL', x: 1600, y: 6900, w: 3900, h: 3000 },
  { id: 'security', label: 'SECURITY', x: 7200, y: 6500, w: 3400, h: 2800 },
  { id: 'command', label: 'COMMAND HUB', x: 12300, y: 6100, w: 5400, h: 4100 },
  { id: 'communications', label: 'COMMUNICATIONS', x: 20100, y: 6700, w: 3900, h: 2800 },
  { id: 'oxygen', label: 'OXYGEN', x: 25300, y: 6500, w: 3200, h: 3100 },
  { id: 'waste', label: 'WASTE', x: 1200, y: 13700, w: 4200, h: 3800 },
  { id: 'storage', label: 'STORAGE', x: 6900, y: 13200, w: 4400, h: 4200 },
  { id: 'quarters', label: 'CREW QUARTERS', x: 12800, y: 13700, w: 4300, h: 3300 },
  { id: 'cargo', label: 'CARGO BAY', x: 18500, y: 13000, w: 4800, h: 4400 },
  { id: 'lifeboat', label: 'LIFEBOATS', x: 25000, y: 13800, w: 3500, h: 3500 }
];
const TASKS = [
  { id: 'reactor', roomId: 'reactor', label: 'Calibrate reactor', x: 2800, y: 2100 },
  { id: 'engine', roomId: 'engine', label: 'Prime engine', x: 7900, y: 1900 },
  { id: 'medical', roomId: 'medical', label: 'Scan samples', x: 12600, y: 2200 },
  { id: 'laboratory', roomId: 'laboratory', label: 'Sort specimens', x: 18100, y: 2100 },
  { id: 'navigation', roomId: 'navigation', label: 'Align navigation', x: 25800, y: 2200 },
  { id: 'electrical', roomId: 'electrical', label: 'Repair relay', x: 3500, y: 8400 },
  { id: 'security', roomId: 'security', label: 'Review sensors', x: 8900, y: 7900 },
  { id: 'command', roomId: 'command', label: 'Upload flight data', x: 15000, y: 8000 },
  { id: 'communications', roomId: 'communications', label: 'Tune antenna', x: 22000, y: 8100 },
  { id: 'oxygen', roomId: 'oxygen', label: 'Clean oxygen filter', x: 26900, y: 8100 },
  { id: 'waste', roomId: 'waste', label: 'Empty waste chute', x: 3200, y: 15500 },
  { id: 'storage', roomId: 'storage', label: 'Route supplies', x: 9000, y: 15300 },
  { id: 'quarters', roomId: 'quarters', label: 'Restore life support', x: 14900, y: 15300 },
  { id: 'cargo', roomId: 'cargo', label: 'Secure cargo', x: 20900, y: 15100 },
  { id: 'lifeboat', roomId: 'lifeboat', label: 'Inspect lifeboat', x: 26700, y: 15500 }
];
const ROOM_LINKS = [
  ['reactor', 'engine'], ['engine', 'medical'], ['medical', 'laboratory'], ['laboratory', 'navigation'],
  ['electrical', 'security'], ['security', 'command'], ['command', 'communications'], ['communications', 'oxygen'],
  ['waste', 'storage'], ['storage', 'quarters'], ['quarters', 'cargo'], ['cargo', 'lifeboat'],
  ['reactor', 'electrical'], ['engine', 'security'], ['medical', 'command'], ['laboratory', 'communications'],
  ['navigation', 'oxygen'], ['electrical', 'waste'], ['security', 'storage'], ['command', 'quarters'],
  ['communications', 'cargo'], ['oxygen', 'lifeboat']
];
function roomById(roomId) { return ROOMS.find(function (room) { return room.id === roomId; }); }
function roomCenter(roomId) {
  const room = roomById(roomId);
  return { x: room.x + room.w / 2, y: room.y + room.h / 2, roomId: roomId };
}
function segmentRect(a, b, width) {
  return { x: Math.min(a.x, b.x) - width / 2, y: Math.min(a.y, b.y) - width / 2,
    w: Math.abs(a.x - b.x) + width, h: Math.abs(a.y - b.y) + width };
}
const CORRIDORS = [];
const DOORS = [];
ROOM_LINKS.forEach(function (link, index) {
  const a = roomCenter(link[0]);
  const b = roomCenter(link[1]);
  const bend = { x: b.x, y: a.y };
  CORRIDORS.push(Object.assign({ id: 'corridor-' + index + '-a' }, segmentRect(a, bend, 820)));
  CORRIDORS.push(Object.assign({ id: 'corridor-' + index + '-b' }, segmentRect(bend, b, 820)));
  DOORS.push({ id: 'door-' + index, x: bend.x - 330, y: bend.y - 330, w: 660, h: 660, rooms: link.slice() });
});
const SPAWNS = [
  [14300, 7600], [15000, 7600], [15700, 7600], [14300, 8400], [15000, 8400],
  [15700, 8400], [14650, 9100], [15350, 9100], [13600, 8400], [16400, 8400]
];

function id(bytes) { return crypto.randomBytes(bytes || 18).toString('hex'); }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function pointInRect(x, y, rect, margin) {
  const pad = margin || 0;
  return x >= rect.x + pad && x <= rect.x + rect.w - pad && y >= rect.y + pad && y <= rect.y + rect.h - pad;
}
function isDoorClosed(gameRoom, doorId) {
  return Boolean(gameRoom && gameRoom.doorStates && gameRoom.doorStates[doorId] > gameRoom.gameTime);
}
function isWalkable(x, y, gameRoom) {
  const onFloor = ROOMS.some(function (room) { return pointInRect(x, y, room, 90); }) ||
    CORRIDORS.some(function (corridor) { return pointInRect(x, y, corridor, 90); });
  if (!onFloor) return false;
  return !DOORS.some(function (door) { return isDoorClosed(gameRoom, door.id) && pointInRect(x, y, door, 40); });
}
function hasLineOfSight(viewer, target, gameRoom) {
  const radius = viewer.role === 'IMPOSTOR' ? 3600 : 2700;
  const dist = distance(viewer, target);
  if (dist > radius) return false;
  const steps = Math.max(1, Math.ceil(dist / 150));
  for (let i = 1; i < steps; i += 1) {
    const ratio = i / steps;
    if (!isWalkable(viewer.x + (target.x - viewer.x) * ratio, viewer.y + (target.y - viewer.y) * ratio, gameRoom)) return false;
  }
  return true;
}
function roomAt(x, y) {
  const room = ROOMS.find(function (candidate) { return pointInRect(x, y, candidate, 0); });
  return room ? room.id : 'command';
}
function roomPath(startId, goalId) {
  if (startId === goalId) return [startId];
  const queue = [[startId]];
  const visited = new Set([startId]);
  while (queue.length) {
    const path = queue.shift();
    const current = path[path.length - 1];
    const neighbors = ROOM_LINKS.filter(function (link) { return link[0] === current || link[1] === current; })
      .map(function (link) { return link[0] === current ? link[1] : link[0]; });
    for (const next of neighbors) {
      if (visited.has(next)) continue;
      const result = path.concat(next);
      if (next === goalId) return result;
      visited.add(next);
      queue.push(result);
    }
  }
  return [startId, goalId];
}
function pathWaypoints(start, targetRoomId) {
  const ids = roomPath(roomAt(start.x, start.y), targetRoomId);
  const startCenter = roomCenter(ids[0]);
  const points = [{ x: startCenter.x, y: startCenter.y }];
  ids.slice(1).forEach(function (roomId, index) {
    const previousId = ids[index];
    const next = roomCenter(roomId);
    const link = ROOM_LINKS.find(function (candidate) {
      return (candidate[0] === previousId && candidate[1] === roomId) ||
        (candidate[1] === previousId && candidate[0] === roomId);
    });
    const originalA = roomCenter(link[0]);
    const originalB = roomCenter(link[1]);
    points.push({ x: originalB.x, y: originalA.y });
    points.push({ x: next.x, y: next.y });
  });
  return points;
}

function nickname(value) {
  const name = String(value || '').trim().replace(/\s+/g, ' ');
  if (!name || name.length > 16 || /[<>]/.test(name)) throw new Error('Nickname must be 1-16 safe characters.');
  return name;
}

function roomView(room, viewerId) {
  const viewer = room.players.get(viewerId);
  const allPlayers = Array.from(room.players.values());
  const visiblePlayers = room.phase === 'PLAYING' && viewer
    ? allPlayers.filter(function (p) { return p.id === viewer.id || hasLineOfSight(viewer, p, room); })
    : allPlayers;
  const players = visiblePlayers.map(function (p) {
    return {
      id: p.id, nickname: p.nickname, color: p.color, ready: p.ready,
      connected: p.connected, isBot: p.isBot, x: p.x, y: p.y,
      tasksDone: p.tasksDone, taskGoal: p.taskGoal, alive: p.alive,
      facing: p.facing, moving: (p.movingUntil || 0) > (room.gameTime || 0),
      isImpostorAlly: Boolean(viewer && viewer.role === 'IMPOSTOR' && p.role === 'IMPOSTOR')
    };
  });
  const humans = players.filter(function (p) { return !p.isBot; });
  const ready = humans.every(function (p) { return p.id === room.hostId || p.ready; });
  return {
    code: room.code,
    phase: room.phase,
    revision: room.revision,
    hostId: room.hostId,
    settings: Object.assign({}, room.settings),
    players: players,
    canStart: room.phase === 'LOBBY' && ready && humans.length >= 1,
    selfRole: (room.phase === 'PLAYING' || room.phase === 'ENDED') && viewer ? viewer.role : null,
    selfAlive: viewer ? viewer.alive !== false : false,
    world: room.phase === 'LOBBY' ? null : WORLD,
    rooms: room.phase === 'LOBBY' ? [] : ROOMS,
    corridors: room.phase === 'LOBBY' ? [] : CORRIDORS,
    doors: room.phase === 'LOBBY' ? [] : DOORS.map(function (door) {
      return { id: door.id, x: door.x, y: door.y, w: door.w, h: door.h,
        closed: isDoorClosed(room, door.id), remaining: Math.max(0, (room.doorStates[door.id] || 0) - room.gameTime) };
    }),
    tasks: room.phase === 'PLAYING' ? TASKS.map(function (task) {
      return { id: task.id, label: task.label, x: task.x, y: task.y };
    }) : [],
    bodies: room.phase !== 'LOBBY' && viewer ? room.bodies.filter(function (body) {
      return hasLineOfSight(viewer, body, room);
    }).map(function (body) { return Object.assign({}, body); }) : [],
    taskProgress: room.taskGoal ? room.tasksCompleted / room.taskGoal : 0,
    winner: room.winner,
    message: room.message,
    visionRadius: viewer && viewer.role === 'IMPOSTOR' ? 3600 : 2700,
    sabotageCooldown: Math.max(0, (room.sabotageReadyAt || 0) - (room.gameTime || 0)),
    killCooldown: viewer && viewer.role === 'IMPOSTOR' ? Math.max(0, (viewer.killReadyAt || 0) - (room.gameTime || 0)) : 0
  };
}

class LobbyStore {
  constructor() {
    this.rooms = new Map();
    this.sessions = new Map();
  }

  create(input) {
    const player = this._human(input);
    const code = this._code();
    const room = {
      code: code, phase: 'LOBBY', revision: 1, hostId: player.id,
      players: new Map([[player.id, player]]),
      settings: { targetPlayers: 4, impostors: 1, autoFillBots: true },
      tasksCompleted: 0, taskGoal: 0, winner: null, message: '', gameTime: 0,
      doorStates: {}, sabotageReadyAt: 0, bodies: []
    };
    this.rooms.set(code, room);
    this.sessions.set(player.token, { roomCode: code, playerId: player.id });
    return this._sessionResult(player, room);
  }

  join(input) {
    const room = this.rooms.get(String(input.code || '').trim().toUpperCase());
    if (!room || room.phase !== 'LOBBY') throw new Error('Room is unavailable.');
    const humanCount = Array.from(room.players.values()).filter(function (p) { return !p.isBot; }).length;
    if (humanCount >= 10) throw new Error('Room is full.');
    const name = nickname(input.nickname);
    if (Array.from(room.players.values()).some(function (p) { return p.nickname.toLowerCase() === name.toLowerCase(); })) {
      throw new Error('That nickname is already in use.');
    }
    this._removeBots(room);
    const player = this._human({ nickname: name, color: input.color });
    room.players.set(player.id, player);
    this.sessions.set(player.token, { roomCode: room.code, playerId: player.id });
    room.settings.targetPlayers = Math.max(4, room.settings.targetPlayers, room.players.size);
    this._touch(room);
    return this._sessionResult(player, room);
  }

  setReady(token, ready) {
    const found = this.byToken(token);
    if (found.player.id === found.room.hostId) throw new Error('The host is always ready.');
    found.player.ready = Boolean(ready);
    this._touch(found.room);
    return roomView(found.room, found.player.id);
  }

  updateSettings(token, input) {
    const found = this.byToken(token);
    if (found.player.id !== found.room.hostId) throw new Error('Only the host can change settings.');
    if (found.room.phase !== 'LOBBY') throw new Error('Settings are locked during a game.');
    const humans = Array.from(found.room.players.values()).filter(function (p) { return !p.isBot; }).length;
    const target = clamp(Number(input.targetPlayers) || 4, Math.max(4, humans), 10);
    const maxImpostors = target >= 7 ? 2 : 1;
    found.room.settings.targetPlayers = target;
    found.room.settings.impostors = clamp(Number(input.impostors) || 1, 1, maxImpostors);
    found.room.settings.autoFillBots = input.autoFillBots !== false;
    this._removeBots(found.room);
    this._touch(found.room);
    return roomView(found.room, found.player.id);
  }

  start(token) {
    const found = this.byToken(token);
    const room = found.room;
    if (found.player.id !== room.hostId) throw new Error('Only the host can start.');
    const publicState = roomView(room, found.player.id);
    if (!publicState.canStart) throw new Error('All human players must be ready.');
    if (!room.settings.autoFillBots && room.players.size < 4) throw new Error('At least 4 players are required.');
    this._removeBots(room);
    while (room.players.size < room.settings.targetPlayers) this._addBot(room);
    if (room.players.size < 4) throw new Error('At least 4 players are required.');

    const humans = Array.from(room.players.values()).filter(function (p) { return !p.isBot; });
    const shuffledHumans = humans.slice().sort(function () { return Math.random() - 0.5; });
    const impostorCount = Math.min(room.settings.impostors, shuffledHumans.length);
    const impostorIds = new Set(shuffledHumans.slice(0, impostorCount).map(function (p) { return p.id; }));
    room.tasksCompleted = 0;
    room.taskGoal = 0;
    room.winner = null;
    room.message = '';
    room.gameTime = 0;
    room.doorStates = {};
    room.sabotageReadyAt = 0;
    room.bodies = [];
    let spawn = 0;
    room.players.forEach(function (p) {
      p.role = impostorIds.has(p.id) ? 'IMPOSTOR' : 'CREW';
      p.x = SPAWNS[spawn % SPAWNS.length][0];
      p.y = SPAWNS[spawn % SPAWNS.length][1];
      p.tasksDone = 0;
      p.taskGoal = p.role === 'CREW' ? 2 : 0;
      p.completedTaskIds = new Set();
      p.botTarget = null;
      p.botWork = 0;
      p.alive = true;
      p.killReadyAt = p.role === 'IMPOSTOR' ? 8 : 0;
      p.facing = 'down';
      p.movingUntil = 0;
      room.taskGoal += p.taskGoal;
      spawn += 1;
    });
    room.phase = 'PLAYING';
    this._touch(room);
    return roomView(room, found.player.id);
  }

  move(token, input) {
    const found = this.byToken(token);
    if (found.room.phase !== 'PLAYING') return roomView(found.room, found.player.id);
    if (!found.player.alive) throw new Error('Eliminated players cannot move.');
    const dx = clamp(Number(input.dx) || 0, -1, 1);
    const dy = clamp(Number(input.dy) || 0, -1, 1);
    const length = Math.hypot(dx, dy) || 1;
    const nextX = clamp(found.player.x + (dx / length) * 125, 120, WORLD.width - 120);
    const nextY = clamp(found.player.y + (dy / length) * 125, 120, WORLD.height - 120);
    if (Math.abs(dx) >= Math.abs(dy) && dx) found.player.facing = dx < 0 ? 'left' : 'right';
    else if (dy) found.player.facing = dy < 0 ? 'up' : 'down';
    if (dx || dy) found.player.movingUntil = found.room.gameTime + 0.24;
    if (isWalkable(nextX, found.player.y, found.room)) found.player.x = nextX;
    if (isWalkable(found.player.x, nextY, found.room)) found.player.y = nextY;
    this._touch(found.room);
    return roomView(found.room, found.player.id);
  }

  completeTask(token, taskId) {
    const found = this.byToken(token);
    const player = found.player;
    const task = TASKS.find(function (t) { return t.id === taskId; });
    if (found.room.phase !== 'PLAYING' || player.role !== 'CREW' || !player.alive) throw new Error('Living crew tasks only.');
    if (!task || distance(player, task) > 520) throw new Error('Move closer to the task station.');
    if (player.completedTaskIds.has(task.id)) throw new Error('Task already completed.');
    if (player.tasksDone >= player.taskGoal) throw new Error('Your tasks are complete.');
    this._finishTask(found.room, player, task.id);
    return roomView(found.room, player.id);
  }

  useDoor(token, doorId) {
    const found = this.byToken(token);
    const door = DOORS.find(function (candidate) { return candidate.id === doorId; });
    if (found.room.phase !== 'PLAYING' || !door) throw new Error('Door unavailable.');
    const center = { x: door.x + door.w / 2, y: door.y + door.h / 2 };
    if (distance(found.player, center) > 850) throw new Error('Move closer to the door.');
    const closed = isDoorClosed(found.room, door.id);
    if (!found.player.alive) throw new Error('Eliminated players cannot use doors.');
    if (found.player.role === 'IMPOSTOR') {
      if (closed) throw new Error('Door is already locked.');
      found.room.doorStates[door.id] = found.room.gameTime + 12;
    } else {
      if (!closed) throw new Error('Door is already open.');
      found.room.doorStates[door.id] = 0;
    }
    this._touch(found.room);
    return roomView(found.room, found.player.id);
  }

  sabotageDoors(token) {
    const found = this.byToken(token);
    if (found.room.phase !== 'PLAYING' || found.player.role !== 'IMPOSTOR' || !found.player.alive) throw new Error('Living impostor ability only.');
    if (found.room.sabotageReadyAt > found.room.gameTime) throw new Error('Sabotage is cooling down.');
    const nearest = DOORS.slice().sort(function (a, b) {
      const ac = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
      const bc = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
      return distance(found.player, ac) - distance(found.player, bc);
    }).slice(0, 5);
    nearest.forEach(function (door) { found.room.doorStates[door.id] = found.room.gameTime + 15; });
    found.room.sabotageReadyAt = found.room.gameTime + 35;
    this._touch(found.room);
    return roomView(found.room, found.player.id);
  }

  rematch(token) {
    const found = this.byToken(token);
    const room = found.room;
    if (found.player.id !== room.hostId) throw new Error('Only the host can start a rematch.');
    if (room.phase !== 'ENDED') throw new Error('The current game has not ended.');
    this._removeBots(room);
    room.phase = 'LOBBY';
    room.tasksCompleted = 0;
    room.taskGoal = 0;
    room.winner = null;
    room.message = '';
    room.gameTime = 0;
    room.doorStates = {};
    room.sabotageReadyAt = 0;
    room.bodies = [];
    room.players.forEach(function (player) {
      player.role = null;
      player.alive = true;
      player.ready = false;
      player.tasksDone = 0;
      player.taskGoal = 0;
      player.completedTaskIds = new Set();
      player.killReadyAt = 0;
      player.botTarget = null;
      player.botPath = [];
      player.botWork = 0;
      player.facing = 'down';
      player.movingUntil = 0;
    });
    this._touch(room);
    return roomView(room, found.player.id);
  }

  eliminate(token, targetId) {
    const found = this.byToken(token);
    const room = found.room;
    const attacker = found.player;
    const target = room.players.get(String(targetId || ''));
    if (room.phase !== 'PLAYING' || attacker.role !== 'IMPOSTOR' || !attacker.alive) throw new Error('Living impostor ability only.');
    if (attacker.killReadyAt > room.gameTime) throw new Error('Attack is cooling down.');
    if (!target || !target.alive || target.role !== 'CREW') throw new Error('Target is unavailable.');
    if (distance(attacker, target) > 650 || !hasLineOfSight(attacker, target, room)) throw new Error('Target is out of range.');
    target.alive = false;
    target.botTarget = null;
    const remainingTasks = Math.max(0, target.taskGoal - target.tasksDone);
    room.taskGoal = Math.max(room.tasksCompleted, room.taskGoal - remainingTasks);
    room.bodies.push({ id: 'body-' + target.id + '-' + Math.round(room.gameTime * 10), playerId: target.id,
      nickname: target.nickname, color: target.color, x: target.x, y: target.y });
    attacker.killReadyAt = room.gameTime + 18;
    this._checkWin(room);
    this._touch(room);
    return roomView(room, attacker.id);
  }

  tick(seconds) {
    const changed = [];
    this.rooms.forEach(function (room) {
      if (room.phase !== 'PLAYING') return;
      room.gameTime += seconds;
      let dirty = false;
      room.players.forEach(function (bot) {
        if (!bot.isBot || !bot.alive || bot.role !== 'CREW' || bot.tasksDone >= bot.taskGoal) return;
        if (!bot.botTarget || bot.completedTaskIds.has(bot.botTarget)) {
          const available = TASKS.filter(function (t) { return !bot.completedTaskIds.has(t.id); });
          bot.botTarget = available[Math.floor(Math.random() * available.length)].id;
          bot.botWork = 0;
          bot.botPath = pathWaypoints(bot, TASKS.find(function (t) { return t.id === bot.botTarget; }).roomId);
        }
        const task = TASKS.find(function (t) { return t.id === bot.botTarget; });
        while (bot.botPath && bot.botPath.length && distance(bot, bot.botPath[0]) < 150) bot.botPath.shift();
        const destination = bot.botPath && bot.botPath.length ? bot.botPath[0] : task;
        const dx = destination.x - bot.x;
        const dy = destination.y - bot.y;
        const dist = Math.hypot(dx, dy);
        if (distance(bot, task) > 180 || (bot.botPath && bot.botPath.length)) {
          const speed = 590 * seconds;
          const step = Math.min(speed, dist);
          if (Math.abs(dx) >= Math.abs(dy) && dx) bot.facing = dx < 0 ? 'left' : 'right';
          else if (dy) bot.facing = dy < 0 ? 'up' : 'down';
          bot.movingUntil = room.gameTime + 0.24;
          const nextX = bot.x + dx / (dist || 1) * step;
          const nextY = bot.y + dy / (dist || 1) * step;
          if (isWalkable(nextX, bot.y, room)) bot.x = nextX;
          if (isWalkable(bot.x, nextY, room)) bot.y = nextY;
        } else {
          bot.botWork += seconds;
          if (bot.botWork >= 3) this._finishTask(room, bot, task.id);
        }
        dirty = true;
      }, this);
      if (dirty) {
        this._touch(room);
        changed.push(room.code);
      }
    }, this);
    return changed;
  }

  leave(token) {
    const found = this.byToken(token);
    found.room.players.delete(found.player.id);
    this.sessions.delete(token);
    if (!found.room.players.size || !Array.from(found.room.players.values()).some(function (p) { return !p.isBot; })) {
      this.rooms.delete(found.room.code);
      return null;
    }
    if (found.room.hostId === found.player.id) {
      found.room.hostId = Array.from(found.room.players.values()).find(function (p) { return !p.isBot; }).id;
    }
    this._touch(found.room);
    return found.room;
  }

  byToken(token) {
    const session = this.sessions.get(String(token || ''));
    if (!session) throw new Error('Session expired. Join again.');
    const room = this.rooms.get(session.roomCode);
    const player = room && room.players.get(session.playerId);
    if (!room || !player) throw new Error('Room not found.');
    return { room: room, player: player };
  }

  viewForToken(token) {
    const found = this.byToken(token);
    return roomView(found.room, found.player.id);
  }

  viewsForRoom(code) {
    const room = this.rooms.get(code);
    if (!room) return [];
    return Array.from(room.players.values()).filter(function (p) { return !p.isBot; }).map(function (p) {
      return { playerId: p.id, view: roomView(room, p.id) };
    });
  }

  _finishTask(room, player, taskId) {
    player.completedTaskIds.add(taskId);
    player.tasksDone += 1;
    room.tasksCompleted += 1;
    this._checkWin(room);
    this._touch(room);
  }

  _checkWin(room) {
    if (room.phase !== 'PLAYING') return;
    const alive = Array.from(room.players.values()).filter(function (player) { return player.alive; });
    const impostors = alive.filter(function (player) { return player.role === 'IMPOSTOR'; }).length;
    const crew = alive.filter(function (player) { return player.role === 'CREW'; }).length;
    if (impostors > 0 && impostors >= crew) {
      room.phase = 'ENDED';
      room.winner = 'IMPOSTOR';
      room.message = 'The impostors took control of the station.';
    } else if (room.tasksCompleted >= room.taskGoal) {
      room.phase = 'ENDED';
      room.winner = 'CREW';
      room.message = 'All tasks completed. Crew wins!';
    }
  }

  _human(input) {
    return {
      id: id(8), token: id(24), nickname: nickname(input.nickname),
      color: COLORS.indexOf(input.color) >= 0 ? input.color : COLORS[0],
      ready: false, connected: true, isBot: false, role: null, alive: true, killReadyAt: 0, facing: 'down', movingUntil: 0,
      x: 15000, y: 8000, tasksDone: 0, taskGoal: 0, completedTaskIds: new Set()
    };
  }

  _addBot(room) {
    const usedNames = new Set(Array.from(room.players.values()).map(function (p) { return p.nickname; }));
    const name = BOT_NAMES.find(function (n) { return !usedNames.has(n); }) || ('BOT-' + room.players.size);
    const color = COLORS.find(function (c) {
      return !Array.from(room.players.values()).some(function (p) { return p.color === c; });
    }) || COLORS[room.players.size % COLORS.length];
    const bot = {
      id: 'bot-' + id(5), token: null, nickname: name, color: color,
      ready: true, connected: true, isBot: true, role: 'CREW', alive: true, killReadyAt: 0, facing: 'down', movingUntil: 0,
      x: 15000, y: 8000, tasksDone: 0, taskGoal: 2, completedTaskIds: new Set(),
      botTarget: null, botWork: 0
    };
    room.players.set(bot.id, bot);
  }

  _removeBots(room) {
    Array.from(room.players.values()).forEach(function (p) { if (p.isBot) room.players.delete(p.id); });
  }

  _code() {
    let code;
    do {
      code = '';
      for (let i = 0; i < 6; i += 1) code += CODE_ALPHABET[crypto.randomBytes(1)[0] % CODE_ALPHABET.length];
    } while (this.rooms.has(code));
    return code;
  }

  _sessionResult(player, room) {
    return { token: player.token, playerId: player.id, room: roomView(room, player.id) };
  }

  _touch(room) { room.revision += 1; }
}

module.exports = { LobbyStore: LobbyStore, roomView: roomView, TASKS: TASKS, ROOMS: ROOMS,
  CORRIDORS: CORRIDORS, DOORS: DOORS, WORLD: WORLD, isWalkable: isWalkable, hasLineOfSight: hasLineOfSight };

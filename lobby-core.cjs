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
  { id: 'reactor', label: 'Calibrate reactor', x: 2800, y: 2100 },
  { id: 'engine', label: 'Prime engine', x: 7900, y: 1900 },
  { id: 'medical', label: 'Scan samples', x: 12600, y: 2200 },
  { id: 'laboratory', label: 'Sort specimens', x: 18100, y: 2100 },
  { id: 'navigation', label: 'Align navigation', x: 25800, y: 2200 },
  { id: 'electrical', label: 'Repair relay', x: 3500, y: 8400 },
  { id: 'security', label: 'Review sensors', x: 8900, y: 7900 },
  { id: 'command', label: 'Upload flight data', x: 15000, y: 8000 },
  { id: 'communications', label: 'Tune antenna', x: 22000, y: 8100 },
  { id: 'oxygen', label: 'Clean oxygen filter', x: 26900, y: 8100 },
  { id: 'waste', label: 'Empty waste chute', x: 3200, y: 15500 },
  { id: 'storage', label: 'Route supplies', x: 9000, y: 15300 },
  { id: 'quarters', label: 'Restore life support', x: 14900, y: 15300 },
  { id: 'cargo', label: 'Secure cargo', x: 20900, y: 15100 },
  { id: 'lifeboat', label: 'Inspect lifeboat', x: 26700, y: 15500 }
];
const SPAWNS = [
  [14300, 7600], [15000, 7600], [15700, 7600], [14300, 8400], [15000, 8400],
  [15700, 8400], [14650, 9100], [15350, 9100], [13600, 8400], [16400, 8400]
];

function id(bytes) { return crypto.randomBytes(bytes || 18).toString('hex'); }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

function nickname(value) {
  const name = String(value || '').trim().replace(/\s+/g, ' ');
  if (!name || name.length > 16 || /[<>]/.test(name)) throw new Error('Nickname must be 1-16 safe characters.');
  return name;
}

function roomView(room, viewerId) {
  const viewer = room.players.get(viewerId);
  const players = Array.from(room.players.values()).map(function (p) {
    return {
      id: p.id, nickname: p.nickname, color: p.color, ready: p.ready,
      connected: p.connected, isBot: p.isBot, x: p.x, y: p.y,
      tasksDone: p.tasksDone, taskGoal: p.taskGoal
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
    selfRole: room.phase === 'PLAYING' && viewer ? viewer.role : null,
    world: room.phase === 'PLAYING' ? WORLD : null,
    rooms: room.phase === 'PLAYING' ? ROOMS : [],
    tasks: room.phase === 'PLAYING' ? TASKS.map(function (task) {
      return { id: task.id, label: task.label, x: task.x, y: task.y };
    }) : [],
    taskProgress: room.taskGoal ? room.tasksCompleted / room.taskGoal : 0,
    winner: room.winner,
    message: room.message
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
      tasksCompleted: 0, taskGoal: 0, winner: null, message: ''
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
    const dx = clamp(Number(input.dx) || 0, -1, 1);
    const dy = clamp(Number(input.dy) || 0, -1, 1);
    const length = Math.hypot(dx, dy) || 1;
    found.player.x = clamp(found.player.x + (dx / length) * 180, 120, WORLD.width - 120);
    found.player.y = clamp(found.player.y + (dy / length) * 180, 120, WORLD.height - 120);
    this._touch(found.room);
    return roomView(found.room, found.player.id);
  }

  completeTask(token, taskId) {
    const found = this.byToken(token);
    const player = found.player;
    const task = TASKS.find(function (t) { return t.id === taskId; });
    if (found.room.phase !== 'PLAYING' || player.role !== 'CREW') throw new Error('Crew tasks only.');
    if (!task || distance(player, task) > 520) throw new Error('Move closer to the task station.');
    if (player.completedTaskIds.has(task.id)) throw new Error('Task already completed.');
    if (player.tasksDone >= player.taskGoal) throw new Error('Your tasks are complete.');
    this._finishTask(found.room, player, task.id);
    return roomView(found.room, player.id);
  }

  tick(seconds) {
    const changed = [];
    this.rooms.forEach(function (room) {
      if (room.phase !== 'PLAYING') return;
      let dirty = false;
      room.players.forEach(function (bot) {
        if (!bot.isBot || bot.role !== 'CREW' || bot.tasksDone >= bot.taskGoal) return;
        if (!bot.botTarget || bot.completedTaskIds.has(bot.botTarget)) {
          const available = TASKS.filter(function (t) { return !bot.completedTaskIds.has(t.id); });
          bot.botTarget = available[Math.floor(Math.random() * available.length)].id;
          bot.botWork = 0;
        }
        const task = TASKS.find(function (t) { return t.id === bot.botTarget; });
        const dx = task.x - bot.x;
        const dy = task.y - bot.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 180) {
          const speed = 760 * seconds;
          bot.x += dx / dist * Math.min(speed, dist);
          bot.y += dy / dist * Math.min(speed, dist);
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
    if (room.tasksCompleted >= room.taskGoal) {
      room.phase = 'ENDED';
      room.winner = 'CREW';
      room.message = 'All tasks completed. Crew wins!';
    }
    this._touch(room);
  }

  _human(input) {
    return {
      id: id(8), token: id(24), nickname: nickname(input.nickname),
      color: COLORS.indexOf(input.color) >= 0 ? input.color : COLORS[0],
      ready: false, connected: true, isBot: false, role: null,
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
      ready: true, connected: true, isBot: true, role: 'CREW',
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

module.exports = { LobbyStore: LobbyStore, roomView: roomView, TASKS: TASKS, ROOMS: ROOMS, WORLD: WORLD };

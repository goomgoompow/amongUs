'use strict';

const crypto = require('crypto');
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const COLORS = ['coral', 'amber', 'mint', 'sky', 'violet', 'rose', 'lime', 'navy', 'white', 'black',
  'teal', 'orange', 'magenta', 'cyan', 'brown', 'gray', 'gold', 'lavender', 'olive', 'maroon'];
const BOT_NAMES = ['Atlas', 'Pico', 'Luna', 'Bolt', 'Echo', 'Mochi', 'Pixel', 'Orbit'];
const WORLD = { width: 30000, height: 20000 };
const SPIRIT_DELAY = 30;
const INITIAL_KILL_COOLDOWN = 7;
const BOT_SPECIAL_INITIAL_COOLDOWN = 15;
const PLAYER_NOMINAL_SPEED = 1250;
const BOT_CREW_SPEED = PLAYER_NOMINAL_SPEED * 0.8;
const BOT_IMPOSTOR_SPEED = 590;
const SPIRIT_BASE_SPEED = 700;
const CREW_ROLES = ['CREWMATE', 'ENGINEER', 'TRACKER', 'DETECTIVE'];
const IMPOSTOR_ROLES = ['IMPOSTOR', 'PHANTOM', 'MELTER', 'SHAPESHIFTER'];
const TASKS_PER_CREW = 4;
const TASK_WORK_SECONDS = 5;
const TASK_REFRESH_SECONDS = 20;
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
const VENTS = [
  { id: 'vent-reactor', roomId: 'reactor', x: 1900, y: 2900, links: ['vent-security'] },
  { id: 'vent-security', roomId: 'security', x: 7800, y: 8600, links: ['vent-reactor', 'vent-command'] },
  { id: 'vent-command', roomId: 'command', x: 13500, y: 9200, links: ['vent-security'] },
  { id: 'vent-medical', roomId: 'medical', x: 11700, y: 2900, links: ['vent-laboratory'] },
  { id: 'vent-laboratory', roomId: 'laboratory', x: 19400, y: 3000, links: ['vent-medical', 'vent-navigation'] },
  { id: 'vent-navigation', roomId: 'navigation', x: 27500, y: 3000, links: ['vent-laboratory'] },
  { id: 'vent-electrical', roomId: 'electrical', x: 2500, y: 9000, links: ['vent-storage'] },
  { id: 'vent-storage', roomId: 'storage', x: 7600, y: 16100, links: ['vent-electrical', 'vent-cargo'] },
  { id: 'vent-cargo', roomId: 'cargo', x: 22200, y: 16200, links: ['vent-storage', 'vent-oxygen'] },
  { id: 'vent-oxygen', roomId: 'oxygen', x: 27800, y: 9000, links: ['vent-cargo'] }
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
  [15700, 8400], [14650, 9100], [15350, 9100], [13600, 8400], [16400, 8400],
  [13600, 7600], [16400, 7600], [14000, 9200], [16000, 9200], [15000, 9600],
  [13200, 8000], [16800, 8000], [13200, 8800], [16800, 8800], [15000, 7000]
];

function id(bytes) { return crypto.randomBytes(bytes || 18).toString('hex'); }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function shuffledCopy(values) {
  const shuffled = values.slice();
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = crypto.randomInt(index + 1);
    const value = shuffled[index]; shuffled[index] = shuffled[swapIndex]; shuffled[swapIndex] = value;
  }
  return shuffled;
}
function shuffledRoleDeck(count, roles) {
  const shuffled = shuffledCopy(roles);
  const deck = [];
  for (let index = 0; index < count; index += 1) deck.push(shuffled[index % shuffled.length]);
  return deck;
}
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
function hasLineOfSight(viewer, target, gameRoom, radiusOverride) {
  const radius = radiusOverride || (viewer.role === 'IMPOSTOR' ? 3600 : 2700);
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
  const points = [];
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
function normalizeRoomCode(value) {
  return String(value || '').normalize('NFKC').toUpperCase().replace(/[^ABCDEFGHJKLMNPQRSTUVWXYZ23456789]/g, '').slice(0, 6);
}

function roomView(room, viewerId) {
  const viewer = room.players.get(viewerId);
  const viewerIsGhost = Boolean(viewer && viewer.isGhost);
  const allPlayers = Array.from(room.players.values());
  const visiblePlayers = room.phase === 'PLAYING' && viewer
    ? allPlayers.filter(function (p) {
      if (p.isGhost) return viewerIsGhost;
      const hiddenPhantom = p.role === 'IMPOSTOR' && p.impostorRole === 'PHANTOM' && p.phantomUntil > room.gameTime &&
        viewer.id !== p.id && viewer.role !== 'IMPOSTOR' && !viewerIsGhost;
      return !hiddenPhantom && (viewerIsGhost || p.id === viewer.id || hasLineOfSight(viewer, p, room));
    })
    : allPlayers;
  const players = visiblePlayers.map(function (p) {
    const disguiseTarget = p.role === 'IMPOSTOR' && p.impostorRole === 'SHAPESHIFTER' && p.disguiseUntil > room.gameTime
      ? room.players.get(p.disguiseTargetId) : null;
    const concealDisguise = Boolean(disguiseTarget && viewer && !viewerIsGhost);
    return {
      id: p.id, nickname: concealDisguise ? disguiseTarget.nickname : p.nickname,
      color: concealDisguise ? disguiseTarget.color : p.color, ready: p.ready,
      connected: p.connected, isBot: p.isBot, x: p.x, y: p.y,
      tasksDone: p.tasksDone, taskGoal: p.taskGoal, alive: p.alive, isGhost: Boolean(p.isGhost),
      crewRole: p.id === viewerId && p.role === 'CREW' ? p.crewRole : null,
      isDisguised: Boolean(disguiseTarget && viewer && viewer.role === 'IMPOSTOR'),
      isPhantomActive: Boolean(p.role === 'IMPOSTOR' && p.impostorRole === 'PHANTOM' && p.phantomUntil > room.gameTime &&
        viewer && (viewer.id === p.id || viewer.role === 'IMPOSTOR')),
      facing: p.facing, moving: (p.movingUntil || 0) > (room.gameTime || 0),
      isImpostorAlly: Boolean(room.settings.revealImpostors !== false && viewer &&
        viewer.role === 'IMPOSTOR' && p.role === 'IMPOSTOR') || Boolean(viewerIsGhost && p.role === 'IMPOSTOR')
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
    selfRole: room.phase !== 'LOBBY' && viewer ? viewer.role : null,
    selfCrewRole: room.phase !== 'LOBBY' && viewer && viewer.role === 'CREW' ? viewer.crewRole : null,
    selfImpostorRole: room.phase !== 'LOBBY' && viewer && viewer.role === 'IMPOSTOR' ? viewer.impostorRole : null,
    selfAlive: viewer ? viewer.alive !== false : false,
    selfIsGhost: viewerIsGhost,
    selfCompletedTaskIds: viewer ? Array.from(viewer.completedTaskIds || []) : [],
    activeTask: viewer && viewer.activeTaskId ? {
      id: viewer.activeTaskId,
      progress: clamp(((room.gameTime || 0) - viewer.taskStartedAt) / TASK_WORK_SECONDS, 0, 1),
      remaining: Math.max(0, TASK_WORK_SECONDS - ((room.gameTime || 0) - viewer.taskStartedAt))
    } : null,
    nextTaskIn: viewer ? Math.max(0, (viewer.nextTaskAt || 0) - (room.gameTime || 0)) : 0,
    world: room.phase === 'LOBBY' ? null : WORLD,
    rooms: room.phase === 'LOBBY' ? [] : ROOMS,
    corridors: room.phase === 'LOBBY' ? [] : CORRIDORS,
    doors: room.phase === 'LOBBY' ? [] : DOORS.map(function (door) {
      return { id: door.id, x: door.x, y: door.y, w: door.w, h: door.h,
        closed: isDoorClosed(room, door.id), remaining: Math.max(0, (room.doorStates[door.id] || 0) - room.gameTime) };
    }),
    tasks: room.phase === 'PLAYING' && viewer && viewer.role === 'CREW' ? TASKS.filter(function (task) {
      return viewer.assignedTaskIds && viewer.assignedTaskIds.has(task.id);
    }).map(function (task) {
      return { id: task.id, label: task.label, x: task.x, y: task.y };
    }) : [],
    vents: room.phase === 'PLAYING' && viewer && viewer.role === 'IMPOSTOR' ? VENTS.map(function (vent) {
      const destinations = vent.links.map(function (linkId) {
        const linked = VENTS.find(function (candidate) { return candidate.id === linkId; });
        return { id: linked.id, roomId: linked.roomId, room: roomById(linked.roomId).label, x: linked.x, y: linked.y };
      });
      const destination = destinations[0];
      return { id: vent.id, roomId: vent.roomId, x: vent.x, y: vent.y, destinationId: destination.id,
        destinationRoom: destination.room, destinations: destinations };
    }) : [],
    bodies: room.phase !== 'LOBBY' && viewer ? room.bodies.filter(function (body) {
      return hasLineOfSight(viewer, body, room);
    }).map(function (body) { return Object.assign({}, body); }) : [],
    spirits: room.phase === 'PLAYING' ? (room.spirits || []).map(function (spirit) {
      return { id: spirit.id, nickname: spirit.nickname, x: spirit.x, y: spirit.y };
    }) : [],
    traps: room.phase === 'PLAYING' && viewer && viewer.crewRole === 'ENGINEER' ? (room.traps || [])
      .filter(function (trap) { return trap.ownerId === viewer.id; })
      .map(function (trap) { return { id: trap.id, x: trap.x, y: trap.y }; }) : [],
    spiritAnnouncementRemaining: Math.max(0, (room.spiritAnnouncementUntil || 0) - (room.gameTime || 0)),
    crewAbility: viewer && viewer.role === 'CREW' ? {
      role: viewer.crewRole,
      targets: allPlayers.filter(function (player) { return player.id !== viewer.id; }).map(function (player) {
        return { id: player.id, nickname: player.nickname, color: player.color };
      }),
      tracking: viewer.crewRole === 'TRACKER' && viewer.trackTargetId ? (function () {
        const target = room.players.get(viewer.trackTargetId);
        return target ? { id: target.id, nickname: target.nickname, x: target.x, y: target.y, alive: target.alive } : null;
      }()) : null,
      trackCooldown: Math.max(0, (viewer.trackReadyAt || 0) - (room.gameTime || 0)),
      detectCooldown: Math.max(0, (viewer.detectReadyAt || 0) - (room.gameTime || 0)),
      trapCooldown: Math.max(0, (viewer.trapReadyAt || 0) - (room.gameTime || 0)),
      trapActive: (room.traps || []).some(function (trap) { return trap.ownerId === viewer.id; }),
      trapView: viewer.crewRole === 'ENGINEER' ? (function () {
        const trap = (room.traps || []).find(function (candidate) { return candidate.ownerId === viewer.id; });
        if (!trap) return null;
        return { x: trap.x, y: trap.y, room: roomById(roomAt(trap.x, trap.y)).label,
          people: allPlayers.filter(function (player) { return player.alive && distance(player, trap) <= 2400; })
            .map(function (player) { return { id: player.id, nickname: player.nickname, color: player.color,
              x: player.x, y: player.y }; }) };
      }()) : null,
      snapshots: (viewer.trapSnapshots || []).map(function (snapshot) { return Object.assign({}, snapshot); }),
      investigations: (viewer.investigations || []).map(function (result) { return Object.assign({}, result); })
    } : null,
    impostorAbility: viewer && viewer.role === 'IMPOSTOR' ? {
      role: viewer.impostorRole,
      targets: allPlayers.filter(function (player) { return player.alive && player.role === 'CREW'; }).map(function (player) {
        return { id: player.id, nickname: player.nickname, color: player.color };
      }),
      phantomRemaining: Math.max(0, (viewer.phantomUntil || 0) - room.gameTime),
      phantomCooldown: Math.max(0, (viewer.phantomReadyAt || 0) - room.gameTime),
      disguiseRemaining: Math.max(0, (viewer.disguiseUntil || 0) - room.gameTime),
      disguiseCooldown: Math.max(0, (viewer.disguiseReadyAt || 0) - room.gameTime),
      disguiseTargetId: viewer.disguiseTargetId || null
    } : null,
    phantomReveals: room.phase === 'PLAYING' && viewer && viewer.role === 'CREW' ? allPlayers.filter(function (player) {
      const marker = player.phantomReveal;
      return marker && marker.until > room.gameTime && distance(viewer, marker) <= 3600 &&
        hasLineOfSight(viewer, marker, room, 3600);
    }).map(function (player) {
      return { x: player.phantomReveal.x, y: player.phantomReveal.y,
        remaining: player.phantomReveal.until - room.gameTime };
    }) : [],
    emergencyStation: room.phase === 'PLAYING' ? { x: 15000, y: 8150, radius: 700 } : null,
    emergencyMeetingsLeft: viewer ? Math.max(0, 1 - (viewer.emergencyMeetingsUsed || 0)) : 0,
    meeting: room.phase === 'MEETING' && room.meeting ? {
      id: room.meeting.id, type: room.meeting.type, callerId: room.meeting.callerId,
      callerName: room.meeting.callerName, reportedName: room.meeting.reportedName,
      stage: room.meeting.stage,
      votingRemaining: Math.max(0, (room.meeting.voteEndsAt || 0) - room.gameTime),
      resultRemaining: Math.max(0, (room.meeting.resultEndsAt || 0) - room.gameTime),
      hasVoted: viewer ? Object.prototype.hasOwnProperty.call(room.meeting.votes, viewer.id) : false,
      ownVote: viewer && Object.prototype.hasOwnProperty.call(room.meeting.votes, viewer.id) ? room.meeting.votes[viewer.id] : undefined,
      participation: Object.keys(room.meeting.votes).length,
      eligibleVoters: Array.from(room.players.values()).filter(function (player) { return player.alive; }).length,
      ejectThreshold: Math.max(1, Array.from(room.players.values()).filter(function (player) { return player.alive; }).length >= 5
        ? 3 : Math.floor(Array.from(room.players.values()).filter(function (player) { return player.alive; }).length / 2) + 1),
      messages: (room.meeting.messages || []).map(function (message) { return Object.assign({}, message); }),
      result: room.meeting.result ? Object.assign({}, room.meeting.result) : null
    } : null,
    taskProgress: room.taskGoal ? room.tasksCompleted / room.taskGoal : 0,
    tasksCompleted: room.tasksCompleted,
    totalTasks: room.taskGoal,
    winner: room.winner,
    message: room.message,
    impostorsRemaining: Array.from(room.players.values()).filter(function (player) {
      return player.alive && player.role === 'IMPOSTOR';
    }).length,
    visionRadius: viewerIsGhost ? 4200 : (viewer && viewer.role === 'IMPOSTOR' ? 3600 : 2700),
    sabotageCooldown: Math.max(0, (room.sabotageReadyAt || 0) - (room.gameTime || 0)),
    killCooldown: viewer && viewer.role === 'IMPOSTOR' ? Math.max(0, (viewer.killReadyAt || 0) - (room.gameTime || 0)) : 0,
    ventCooldown: viewer && viewer.role === 'IMPOSTOR' ? Math.max(0, (viewer.ventReadyAt || 0) - (room.gameTime || 0)) : 0
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
      settings: { targetPlayers: 4, impostors: 1, autoFillBots: true, vengefulSpirits: true, revealImpostors: true,
        phantomDuration: 8, meltDelay: 20, disguiseDuration: 12, disguiseCooldown: 35 },
      tasksCompleted: 0, taskGoal: 0, winner: null, message: '', gameTime: 0,
      doorStates: {}, sabotageReadyAt: 0, bodies: [], meeting: null, meetingSequence: 0,
      completedTaskIds: new Set(), taskStationReadyAt: {}, spirits: [], murderedCrew: [], spiritReadyAt: Infinity,
      spiritAnnouncementUntil: 0, spiritTimerResetPending: false, traps: []
    };
    this.rooms.set(code, room);
    this.sessions.set(player.token, { roomCode: code, playerId: player.id });
    return this._sessionResult(player, room);
  }

  join(input) {
    const normalizedCode = normalizeRoomCode(input.code);
    if (normalizedCode.length !== 6) throw new Error('Room code must contain 6 valid characters.');
    const room = this.rooms.get(normalizedCode);
    if (!room || room.phase !== 'LOBBY') throw new Error('Room is unavailable.');
    const humanCount = Array.from(room.players.values()).filter(function (p) { return !p.isBot; }).length;
    if (humanCount >= 20) throw new Error('Room is full.');
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
    const target = clamp(Number(input.targetPlayers) || 4, Math.max(4, humans), 20);
    const maxImpostors = target >= 16 ? 4 : (target >= 11 ? 3 : (target >= 7 ? 2 : 1));
    found.room.settings.targetPlayers = target;
    found.room.settings.impostors = clamp(Number(input.impostors) || 1, 1, maxImpostors);
    found.room.settings.autoFillBots = input.autoFillBots !== false;
    found.room.settings.vengefulSpirits = input.vengefulSpirits !== false;
    found.room.settings.revealImpostors = input.revealImpostors !== false;
    found.room.settings.phantomDuration = clamp(Number(input.phantomDuration) || 8, 3, 20);
    found.room.settings.meltDelay = clamp(Number(input.meltDelay) || 20, 5, 60);
    found.room.settings.disguiseDuration = clamp(Number(input.disguiseDuration) || 12, 5, 30);
    found.room.settings.disguiseCooldown = clamp(Number(input.disguiseCooldown) || 35, 15, 90);
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

    const candidates = shuffledCopy(Array.from(room.players.values()));
    const impostorCount = Math.min(room.settings.impostors, Math.max(1, candidates.length - 1));
    const impostorIds = new Set(candidates.slice(0, impostorCount).map(function (p) { return p.id; }));
    room.tasksCompleted = 0;
    room.taskGoal = 0;
    room.completedTaskIds = new Set();
    room.taskStationReadyAt = {};
    room.winner = null;
    room.message = '';
    room.gameTime = 0;
    room.doorStates = {};
    room.sabotageReadyAt = 0;
    room.bodies = [];
    room.spirits = [];
    room.murderedCrew = [];
    room.spiritReadyAt = Infinity;
    room.spiritAnnouncementUntil = 0;
    room.spiritTimerResetPending = false;
    room.meeting = null;
    room.traps = [];
    room.botActionsUnlocked = false;
    let spawn = 0;
    room.players.forEach(function (p) {
      p.role = impostorIds.has(p.id) ? 'IMPOSTOR' : 'CREW';
      p.crewRole = null;
      p.impostorRole = null;
      p.x = SPAWNS[spawn % SPAWNS.length][0];
      p.y = SPAWNS[spawn % SPAWNS.length][1];
      p.tasksDone = 0;
      p.taskGoal = 0;
      p.completedTaskIds = new Set();
      p.assignedTaskIds = new Set();
      p.botTarget = null;
      p.huntTargetId = null;
      p.huntTargetUntil = 0;
      p.huntTargetRoomId = null;
      p.botPathRefreshAt = 0;
      p.botWork = 0;
      p.alive = true;
      p.isGhost = false;
      p.introReady = p.isBot;
      p.killReadyAt = p.role === 'IMPOSTOR' ? room.gameTime + INITIAL_KILL_COOLDOWN : 0;
      p.ventReadyAt = p.isBot && p.role === 'IMPOSTOR' ? Infinity : 0;
      p.facing = 'down';
      p.movingUntil = 0;
      p.emergencyMeetingsUsed = 0;
      p.patrolIndex = spawn % ROOMS.length;
      p.patrolRoomId = null;
      p.stuckFor = 0;
      p.botStartDelay = p.isBot ? 0.5 + Math.random() * 4 : 0;
      p.suspectedImpostorId = null;
      p.suspectGroupIds = [];
      p.suspicionExpiresAt = 0;
      p.pendingReportBodyId = null;
      p.reportReadyAt = 0;
      p.phantomWitnessPlayerId = null;
      p.phantomWitnessName = null;
      p.phantomWitnessExpiresAt = 0;
      p.shapeshifterWitnessPlayerId = null;
      p.shapeshifterWitnessName = null;
      p.shapeshifterWitnessExpiresAt = 0;
      p.trackTargetId = null;
      p.trackReadyAt = 0;
      p.detectReadyAt = 0;
      p.trapReadyAt = 0;
      p.trapSnapshots = [];
      p.investigations = [];
      p.activeTaskId = null;
      p.taskStartedAt = 0;
      p.nextTaskAt = 0;
      p.phantomUntil = 0;
      p.phantomReadyAt = p.isBot && p.role === 'IMPOSTOR' ? Infinity : 0;
      p.phantomReveal = null;
      p.disguiseUntil = 0;
      p.disguiseReadyAt = p.isBot && p.role === 'IMPOSTOR' ? Infinity : 0;
      p.disguiseTargetId = null;
      spawn += 1;
    });
    const crew = Array.from(room.players.values()).filter(function (p) { return p.role === 'CREW'; });
    const orderedCrew = crew.slice().sort(function (a, b) { return Number(a.isBot) - Number(b.isBot); });
    const crewRoleDeck = shuffledRoleDeck(orderedCrew.length, CREW_ROLES);
    orderedCrew.forEach(function (player, index) {
      player.crewRole = crewRoleDeck[index];
    });
    const impostorPlayers = Array.from(room.players.values()).filter(function (p) { return p.role === 'IMPOSTOR'; });
    const impostorRoleDeck = shuffledRoleDeck(impostorPlayers.length, IMPOSTOR_ROLES);
    impostorPlayers.forEach(function (player, index) {
      player.impostorRole = impostorRoleDeck[index];
    });
    crew.forEach(function (player) { player.taskGoal = TASKS_PER_CREW; room.taskGoal += TASKS_PER_CREW; });
    crew.forEach(function (player) { this._assignTasks(room, player, 2); }, this);
    room.phase = 'PLAYING';
    this._touch(room);
    return roomView(room, found.player.id);
  }

  acknowledgeIntro(token) {
    const found = this.byToken(token);
    const room = found.room;
    if (room.phase !== 'PLAYING') return roomView(room, found.player.id);
    found.player.introReady = true;
    this._unlockBotActionsIfReady(room);
    this._touch(room);
    return roomView(room, found.player.id);
  }

  move(token, input) {
    const found = this.byToken(token);
    if (found.room.phase !== 'PLAYING') return roomView(found.room, found.player.id);
    if (!found.player.alive && !found.player.isGhost) throw new Error('Eliminated players cannot move.');
    const dx = clamp(Number(input.dx) || 0, -1, 1);
    const dy = clamp(Number(input.dy) || 0, -1, 1);
    const length = Math.hypot(dx, dy) || 1;
    const nextX = clamp(found.player.x + (dx / length) * 125, 120, WORLD.width - 120);
    const nextY = clamp(found.player.y + (dy / length) * 125, 120, WORLD.height - 120);
    if (Math.abs(dx) >= Math.abs(dy) && dx) found.player.facing = dx < 0 ? 'left' : 'right';
    else if (dy) found.player.facing = dy < 0 ? 'up' : 'down';
    if (dx || dy) found.player.movingUntil = found.room.gameTime + 0.24;
    if (found.player.isGhost || isWalkable(nextX, found.player.y, found.room)) found.player.x = nextX;
    if (found.player.isGhost || isWalkable(found.player.x, nextY, found.room)) found.player.y = nextY;
    this._touch(found.room);
    return roomView(found.room, found.player.id);
  }

  completeTask(token, taskId) {
    const found = this.byToken(token);
    const player = found.player;
    const task = TASKS.find(function (t) { return t.id === taskId; });
    if (found.room.phase !== 'PLAYING' || player.role !== 'CREW' || (!player.alive && !player.isGhost)) {
      throw new Error('Crew and crew ghosts can perform tasks only during play.');
    }
    if (!task || distance(player, task) > 520) throw new Error('Move closer to the task station.');
    if (!player.assignedTaskIds || !player.assignedTaskIds.has(task.id)) throw new Error('This task is assigned to another crew member.');
    if (found.room.completedTaskIds.has(task.id)) throw new Error('This task station is already complete.');
    if (player.completedTaskIds.has(task.id)) throw new Error('Task already completed.');
    if (player.tasksDone >= player.taskGoal) throw new Error('Your tasks are complete.');
    if (player.activeTaskId && player.activeTaskId !== task.id) throw new Error('Another task is already in progress.');
    if (!player.activeTaskId) {
      player.activeTaskId = task.id;
      player.taskStartedAt = found.room.gameTime;
      this._touch(found.room);
    }
    return roomView(found.room, player.id);
  }

  placeTrap(token) {
    const found = this.byToken(token);
    const room = found.room;
    const player = found.player;
    if (room.phase !== 'PLAYING' || !player.alive || player.role !== 'CREW' || player.crewRole !== 'ENGINEER') throw new Error('Engineer ability only.');
    if (player.trapReadyAt > room.gameTime) throw new Error('Trap is cooling down.');
    if (room.traps.some(function (trap) { return trap.ownerId === player.id; })) throw new Error('Your trap is already active.');
    room.traps.push({ id: 'trap-' + id(6), ownerId: player.id, x: player.x, y: player.y, placedAt: room.gameTime });
    player.trapReadyAt = room.gameTime + 20;
    this._touch(room);
    return roomView(room, player.id);
  }

  trackPlayer(token, targetId) {
    const found = this.byToken(token);
    const room = found.room;
    const player = found.player;
    const target = room.players.get(String(targetId || ''));
    if (room.phase !== 'PLAYING' || !player.alive || player.role !== 'CREW' || player.crewRole !== 'TRACKER') throw new Error('Tracker ability only.');
    if (player.trackReadyAt > room.gameTime) throw new Error('Tracker is cooling down.');
    if (!target || target.id === player.id) throw new Error('Tracking target is unavailable.');
    player.trackTargetId = target.id;
    player.trackReadyAt = room.gameTime + 10;
    this._touch(room);
    return roomView(room, player.id);
  }

  detectPlayer(token, targetId) {
    const found = this.byToken(token);
    const room = found.room;
    const player = found.player;
    const target = room.players.get(String(targetId || ''));
    if (room.phase !== 'PLAYING' || !player.alive || player.role !== 'CREW' || player.crewRole !== 'DETECTIVE') throw new Error('Detective ability only.');
    if (player.detectReadyAt > room.gameTime) throw new Error('Detect is cooling down.');
    if (!target || !target.alive || target.id === player.id || distance(player, target) > 800 || !hasLineOfSight(player, target, room)) {
      throw new Error('Move closer to the target.');
    }
    const identity = target.role === 'IMPOSTOR' ? 'IMPOSTOR' : (target.crewRole || 'CREWMATE');
    player.investigations.push({ id: id(6), targetId: target.id, nickname: target.nickname,
      color: target.color, identity: identity, at: Math.round(room.gameTime) });
    if (player.investigations.length > 8) player.investigations.shift();
    player.detectReadyAt = room.gameTime + 30;
    this._touch(room);
    return roomView(room, player.id);
  }

  activatePhantom(token) {
    const found = this.byToken(token);
    const room = found.room;
    const player = found.player;
    if (room.phase !== 'PLAYING' || !player.alive || player.role !== 'IMPOSTOR' || player.impostorRole !== 'PHANTOM') throw new Error('Phantom ability only.');
    if (player.phantomUntil > room.gameTime) throw new Error('Phantom is already hidden.');
    if (player.phantomReadyAt > room.gameTime) throw new Error('Phantom is cooling down.');
    player.phantomUntil = room.gameTime + room.settings.phantomDuration;
    player.phantomReveal = null;
    player.phantomReadyAt = player.phantomUntil + 20;
    this._touch(room);
    return roomView(room, player.id);
  }

  disguisePlayer(token, targetId) {
    const found = this.byToken(token);
    const room = found.room;
    const player = found.player;
    const target = room.players.get(String(targetId || ''));
    if (room.phase !== 'PLAYING' || !player.alive || player.role !== 'IMPOSTOR' || player.impostorRole !== 'SHAPESHIFTER') throw new Error('Shapeshifter ability only.');
    if (player.disguiseUntil > room.gameTime) throw new Error('Disguise is already active.');
    if (player.disguiseReadyAt > room.gameTime) throw new Error('Disguise is cooling down.');
    if (!target || !target.alive || target.role !== 'CREW') throw new Error('Disguise target is unavailable.');
    this._activateDisguise(room, player, target);
    this._touch(room);
    return roomView(room, player.id);
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

  useVent(token, ventId, destinationId) {
    const found = this.byToken(token);
    const room = found.room;
    const player = found.player;
    const vent = VENTS.find(function (candidate) { return candidate.id === ventId; });
    if (room.phase !== 'PLAYING' || player.role !== 'IMPOSTOR' || !player.alive) throw new Error('Living impostor ability only.');
    if (player.ventReadyAt > room.gameTime) throw new Error('Vent is cooling down.');
    if (!vent || distance(player, vent) > 520) throw new Error('Move closer to a vent.');
    const requested = destinationId && vent.links.indexOf(destinationId) >= 0 ? destinationId : vent.links[0];
    const destination = VENTS.find(function (candidate) { return candidate.id === requested; });
    if (!destination) throw new Error('Vent destination is unavailable.');
    player.x = destination.x;
    player.y = destination.y;
    player.facing = 'down';
    player.movingUntil = 0;
    player.ventReadyAt = room.gameTime + 4;
    this._touch(room);
    return roomView(room, player.id);
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
    room.completedTaskIds = new Set();
    room.taskStationReadyAt = {};
    room.winner = null;
    room.message = '';
    room.gameTime = 0;
    room.doorStates = {};
    room.sabotageReadyAt = 0;
    room.bodies = [];
    room.spirits = [];
    room.murderedCrew = [];
    room.spiritReadyAt = Infinity;
    room.spiritAnnouncementUntil = 0;
    room.spiritTimerResetPending = false;
    room.meeting = null;
    room.traps = [];
    room.players.forEach(function (player) {
      player.role = null;
      player.crewRole = null;
      player.impostorRole = null;
      player.alive = true;
      player.isGhost = false;
      player.ready = false;
      player.tasksDone = 0;
      player.taskGoal = 0;
      player.completedTaskIds = new Set();
      player.assignedTaskIds = new Set();
      player.killReadyAt = 0;
      player.ventReadyAt = 0;
      player.botTarget = null;
      player.botPath = [];
      player.botWork = 0;
      player.facing = 'down';
      player.movingUntil = 0;
      player.emergencyMeetingsUsed = 0;
      player.suspectedImpostorId = null;
      player.suspectGroupIds = [];
      player.suspicionExpiresAt = 0;
      player.pendingReportBodyId = null;
      player.reportReadyAt = 0;
      player.phantomWitnessPlayerId = null;
      player.phantomWitnessName = null;
      player.phantomWitnessExpiresAt = 0;
      player.shapeshifterWitnessPlayerId = null;
      player.shapeshifterWitnessName = null;
      player.shapeshifterWitnessExpiresAt = 0;
      player.trackTargetId = null;
      player.trapSnapshots = [];
      player.investigations = [];
      player.activeTaskId = null;
      player.taskStartedAt = 0;
      player.nextTaskAt = 0;
      player.phantomUntil = 0;
      player.phantomReveal = null;
      player.disguiseUntil = 0;
      player.disguiseTargetId = null;
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
    this._performElimination(room, attacker, target);
    return roomView(room, attacker.id);
  }

  reportBody(token, bodyId) {
    const found = this.byToken(token);
    const room = found.room;
    const reporter = found.player;
    if (room.phase !== 'PLAYING' || !reporter.alive) throw new Error('Only living players can report during play.');
    const bodyIndex = room.bodies.findIndex(function (body) { return body.id === bodyId; });
    const body = bodyIndex >= 0 ? room.bodies[bodyIndex] : null;
    if (!body || distance(reporter, body) > 1100 || !hasLineOfSight(reporter, body, room)) throw new Error('No reportable body nearby.');
    room.bodies.splice(bodyIndex, 1);
    this._beginMeeting(room, reporter, 'BODY_REPORT', body.nickname);
    return roomView(room, reporter.id);
  }

  callEmergencyMeeting(token) {
    const found = this.byToken(token);
    const room = found.room;
    const caller = found.player;
    const station = { x: 15000, y: 8150 };
    if (room.phase !== 'PLAYING' || !caller.alive) throw new Error('Only living players can call a meeting during play.');
    if (room.gameTime < 15) throw new Error('Emergency meetings unlock 15 seconds after the game starts.');
    if ((caller.emergencyMeetingsUsed || 0) >= 1) throw new Error('Your emergency meeting has already been used.');
    if (distance(caller, station) > 700) throw new Error('Move closer to the emergency console.');
    caller.emergencyMeetingsUsed += 1;
    this._beginMeeting(room, caller, 'EMERGENCY', null);
    return roomView(room, caller.id);
  }

  voteMeeting(token, targetId) {
    const found = this.byToken(token);
    const room = found.room;
    const voter = found.player;
    if (room.phase !== 'MEETING' || !room.meeting || room.meeting.stage !== 'VOTING') throw new Error('Voting is not active.');
    if (!voter.alive || voter.isBot) throw new Error('Only living human players can vote here.');
    if (Object.prototype.hasOwnProperty.call(room.meeting.votes, voter.id)) throw new Error('Your vote is already locked.');
    let target = null;
    if (targetId !== null && targetId !== undefined && targetId !== '') {
      target = room.players.get(String(targetId));
      if (!target || !target.alive) throw new Error('Vote target is unavailable.');
    }
    room.meeting.votes[voter.id] = target ? target.id : null;
    this._maybeResolveMeeting(room);
    this._touch(room);
    return roomView(room, voter.id);
  }

  sendMeetingMessage(token, value) {
    const found = this.byToken(token);
    const room = found.room;
    const sender = found.player;
    const text = String(value || '').trim().replace(/\s+/g, ' ').slice(0, 120);
    if (room.phase !== 'MEETING' || !room.meeting || room.meeting.stage !== 'VOTING') throw new Error('Meeting chat is not active.');
    if (!sender.alive || sender.isBot) throw new Error('Only living human players can chat.');
    if (!text) throw new Error('Enter a message.');
    room.meeting.messages.push({ id: id(6), senderId: sender.id, senderName: sender.nickname,
      color: sender.color, text: text, isBot: false });
    this._touch(room);
    return roomView(room, sender.id);
  }

  _beginMeeting(room, caller, type, reportedName) {
    room.phase = 'MEETING';
    // A meeting closes every body report from the previous play period. This
    // also prevents bots from reporting an older body after play resumes.
    room.bodies = [];
    room.players.forEach(function (player) {
      player.pendingReportBodyId = null;
      player.reportReadyAt = 0;
      player.phantomUntil = 0;
      player.phantomReveal = null;
      player.disguiseUntil = 0;
      player.disguiseTargetId = null;
      player.phantomWitnessPlayerId = null;
      player.phantomWitnessName = null;
      player.phantomWitnessExpiresAt = 0;
      player.shapeshifterWitnessPlayerId = null;
      player.shapeshifterWitnessName = null;
      player.shapeshifterWitnessExpiresAt = 0;
    });
    if (room.settings.vengefulSpirits) {
      (room.spirits || []).forEach(function (spirit) {
        const soul = (room.murderedCrew || []).find(function (candidate) { return candidate.playerId === spirit.playerId; });
        if (soul) soul.used = false;
      });
      room.spirits = [];
      room.spiritTimerResetPending = (room.murderedCrew || []).some(function (soul) { return !soul.used; });
      room.spiritReadyAt = Infinity;
      room.spiritAnnouncementUntil = 0;
    }
    room.meetingSequence += 1;
    const botPlans = {};
    room.players.forEach(function (player) {
      if (player.isBot && player.alive) {
        const suspectId = player.suspicionExpiresAt > room.gameTime ? player.suspectedImpostorId : null;
        const suspectIds = player.suspicionExpiresAt > room.gameTime ? (player.suspectGroupIds || []).slice() : [];
        const chatAt = room.gameTime + 0.5 + Math.random() * 2;
        botPlans[player.id] = { at: chatAt + 0.8 + Math.random() * 2, chatAt: chatAt,
          participate: Boolean(suspectId) || suspectIds.length > 0 || player.id === caller.id || Math.random() < 0.7,
          suspectId: suspectId, suspectIds: suspectIds, chatted: false, decided: false };
      }
    });
    room.meeting = { id: 'meeting-' + room.meetingSequence, type: type, callerId: caller.id,
      callerName: caller.nickname, reportedName: reportedName, stage: 'VOTING',
      voteEndsAt: room.gameTime + 30, resultEndsAt: 0, votes: {}, botPlans: botPlans, messages: [], result: null };
    room.doorStates = {};
    room.players.forEach(function (player) { player.movingUntil = 0; });
    this._touch(room);
  }

  tick(seconds) {
    const changed = [];
    this.rooms.forEach(function (room) {
      if (room.phase === 'MEETING') {
        room.gameTime += seconds;
        this._updateMeeting(room);
        this._touch(room);
        changed.push(room.code);
        return;
      }
      if (room.phase !== 'PLAYING') return;
      room.gameTime += seconds;
      let dirty = false;
      room.players.forEach(function (player) {
        if (player.impostorRole === 'PHANTOM' && player.phantomUntil > 0 && player.phantomUntil <= room.gameTime) {
          player.phantomUntil = 0;
          player.phantomReveal = { x: player.x, y: player.y, until: room.gameTime + 3 };
          room.players.forEach(function (witness) {
            if (!witness.isBot || !witness.alive || witness.role !== 'CREW' || distance(witness, player) > 3600 ||
                !hasLineOfSight(witness, player, room, 3600)) return;
            witness.suspectedImpostorId = player.id;
            witness.suspectGroupIds = [];
            witness.suspicionExpiresAt = room.gameTime + 45;
            witness.phantomWitnessPlayerId = player.id;
            witness.phantomWitnessName = player.nickname;
            witness.phantomWitnessExpiresAt = room.gameTime + 45;
            witness.botTarget = null;
            witness.botPath = pathWaypoints(witness, 'command');
          });
          dirty = true;
        }
        if (player.phantomReveal && player.phantomReveal.until <= room.gameTime) player.phantomReveal = null;
      });
      Object.keys(room.taskStationReadyAt || {}).forEach(function (taskId) {
        if (room.taskStationReadyAt[taskId] <= room.gameTime) {
          room.completedTaskIds.delete(taskId);
          delete room.taskStationReadyAt[taskId];
          dirty = true;
        }
      });
      room.players.forEach(function (player) {
        if ((!player.alive && !player.isGhost) || player.role !== 'CREW') return;
        if (player.activeTaskId) {
          const activeTask = TASKS.find(function (task) { return task.id === player.activeTaskId; });
          if (!activeTask || distance(player, activeTask) > 520) {
            player.activeTaskId = null;
            player.taskStartedAt = 0;
            dirty = true;
          } else if (room.gameTime - player.taskStartedAt >= TASK_WORK_SECONDS) {
            this._finishTask(room, player, activeTask.id);
            dirty = true;
          }
        }
        const outstanding = Array.from(player.assignedTaskIds).filter(function (taskId) {
          return !player.completedTaskIds.has(taskId);
        });
        if (!player.activeTaskId && !outstanding.length && player.tasksDone < player.taskGoal &&
            room.gameTime >= (player.nextTaskAt || 0)) {
          if (!this._assignTasks(room, player, 2)) player.nextTaskAt = room.gameTime + 3;
          dirty = true;
        }
      }, this);
      const bodyCount = room.bodies.length;
      room.bodies = room.bodies.filter(function (body) { return !body.meltAt || body.meltAt > room.gameTime; });
      if (room.bodies.length !== bodyCount) dirty = true;
      room.players.forEach(function (bot) {
        if (room.phase !== 'PLAYING') return;
        if (!bot.isBot || !bot.alive) return;
        if (!room.botActionsUnlocked) return;
        if (bot.role === 'IMPOSTOR') {
          const crewTargets = Array.from(room.players.values()).filter(function (player) {
            return player.alive && player.role === 'CREW';
          }).sort(function (a, b) { return distance(bot, a) - distance(bot, b); });
          let target = room.players.get(bot.huntTargetId);
          if (!target || !target.alive || target.role !== 'CREW' || room.gameTime >= (bot.huntTargetUntil || 0)) {
            const roamingCandidates = crewTargets.slice(0, Math.min(4, crewTargets.length));
            target = roamingCandidates.length ? roamingCandidates[crypto.randomInt(roamingCandidates.length)] : null;
            bot.huntTargetId = target ? target.id : null;
            bot.huntTargetUntil = room.gameTime + 6 + Math.random() * 5;
            bot.huntTargetRoomId = null;
            bot.botPathRefreshAt = 0;
          }
          if (!target || room.gameTime < (bot.botStartDelay || 0)) return;

          if (bot.impostorRole === 'PHANTOM' && bot.phantomUntil <= room.gameTime &&
              bot.phantomReadyAt <= room.gameTime && distance(bot, target) < 4200) {
            bot.phantomUntil = room.gameTime + room.settings.phantomDuration;
            bot.phantomReveal = null;
            bot.phantomReadyAt = bot.phantomUntil + 20;
          } else if (bot.impostorRole === 'SHAPESHIFTER' && bot.disguiseUntil <= room.gameTime &&
              bot.disguiseReadyAt <= room.gameTime && crewTargets.length) {
            const disguiseTarget = crewTargets[crypto.randomInt(crewTargets.length)];
            this._activateDisguise(room, bot, disguiseTarget);
          }

          const targetRoomId = roomAt(target.x, target.y);
          if (!bot.botPath || bot.huntTargetRoomId !== targetRoomId || room.gameTime >= (bot.botPathRefreshAt || 0)) {
            bot.botPath = pathWaypoints(bot, targetRoomId);
            bot.huntTargetRoomId = targetRoomId;
            bot.botPathRefreshAt = room.gameTime + 3.5;
            bot.stuckFor = 0;
          }
          if (room.gameTime >= bot.killReadyAt && distance(bot, target) <= 650 &&
              hasLineOfSight(bot, target, room)) {
            this._performElimination(room, bot, target);
            dirty = true;
            return;
          }
          this._moveBotToward(room, bot, target, targetRoomId, seconds);
          dirty = true;
          return;
        }
        if (bot.role !== 'CREW') return;
        if (bot.shapeshifterWitnessPlayerId && bot.shapeshifterWitnessExpiresAt > room.gameTime &&
            (bot.emergencyMeetingsUsed || 0) < 1) {
          const emergencyStation = { x: 15000, y: 8150 };
          if (room.gameTime >= 15 && distance(bot, emergencyStation) <= 700) {
            bot.emergencyMeetingsUsed += 1;
            const witnessedName = bot.shapeshifterWitnessName;
            bot.shapeshifterWitnessPlayerId = null;
            this._beginMeeting(room, bot, 'SHAPESHIFTER_REVEAL', witnessedName);
            dirty = true;
            return;
          }
          this._moveBotToward(room, bot, emergencyStation, 'command', seconds);
          dirty = true;
          return;
        }
        if (bot.phantomWitnessPlayerId && bot.phantomWitnessExpiresAt > room.gameTime &&
            (bot.emergencyMeetingsUsed || 0) < 1) {
          const emergencyStation = { x: 15000, y: 8150 };
          if (room.gameTime >= 15 && distance(bot, emergencyStation) <= 700) {
            bot.emergencyMeetingsUsed += 1;
            const witnessedName = bot.phantomWitnessName;
            bot.phantomWitnessPlayerId = null;
            this._beginMeeting(room, bot, 'PHANTOM_REVEAL', witnessedName);
            dirty = true;
            return;
          }
          this._moveBotToward(room, bot, emergencyStation, 'command', seconds);
          dirty = true;
          return;
        }
        const rememberedBody = bot.pendingReportBodyId && room.bodies.find(function (body) {
          return body.id === bot.pendingReportBodyId;
        });
        const visibleBody = room.bodies.find(function (body) {
          return distance(bot, body) <= 3000 && hasLineOfSight(bot, body, room, 3000);
        });
        const nearbyBody = rememberedBody || visibleBody;
        if (nearbyBody) {
          if (bot.pendingReportBodyId !== nearbyBody.id) {
            bot.pendingReportBodyId = nearbyBody.id;
            bot.reportReadyAt = room.gameTime + 0.8 + Math.random() * 0.7;
            bot.botPath = pathWaypoints(bot, roomAt(nearbyBody.x, nearbyBody.y));
          }
          if (distance(bot, nearbyBody) > 700) {
            this._moveBotToward(room, bot, nearbyBody, roomAt(nearbyBody.x, nearbyBody.y), seconds);
            dirty = true;
            return;
          }
          if (room.gameTime >= bot.reportReadyAt) {
            const bodyIndex = room.bodies.findIndex(function (body) { return body.id === bot.pendingReportBodyId; });
            if (bodyIndex >= 0) {
              const body = room.bodies.splice(bodyIndex, 1)[0];
              bot.pendingReportBodyId = null;
              this._beginMeeting(room, bot, 'BODY_REPORT', body.nickname);
              dirty = true;
              return;
            }
          }
        } else {
          bot.pendingReportBodyId = null;
        }
        if (room.gameTime < (bot.botStartDelay || 0)) return;
        if (bot.tasksDone < bot.taskGoal) {
          if (!bot.botTarget || bot.completedTaskIds.has(bot.botTarget) || !bot.assignedTaskIds.has(bot.botTarget)) {
            const available = TASKS.filter(function (task) {
              return bot.assignedTaskIds.has(task.id) && !bot.completedTaskIds.has(task.id) && !room.completedTaskIds.has(task.id);
            });
            available.sort(function () { return Math.random() - 0.5; });
            const task = available[0];
            if (!task) return;
            bot.botTarget = task.id;
            bot.botWork = 0;
            bot.botPath = pathWaypoints(bot, task.roomId);
            bot.stuckFor = 0;
          }
          const task = TASKS.find(function (candidate) { return candidate.id === bot.botTarget; });
          const arrived = this._moveBotToward(room, bot, task, task.roomId, seconds);
          if (arrived) {
            bot.botWork += seconds;
            if (bot.botWork >= TASK_WORK_SECONDS) this._finishTask(room, bot, task.id);
          }
        } else {
          const patrolFinished = bot.patrolRoomId && (!bot.botPath || !bot.botPath.length) &&
            distance(bot, roomCenter(bot.patrolRoomId)) < 180;
          if (!bot.patrolRoomId || patrolFinished) {
            bot.patrolIndex = ((bot.patrolIndex || 0) + 3) % ROOMS.length;
            bot.patrolRoomId = ROOMS[bot.patrolIndex].id;
            bot.botPath = pathWaypoints(bot, bot.patrolRoomId);
            bot.stuckFor = 0;
          }
          this._moveBotToward(room, bot, roomCenter(bot.patrolRoomId), bot.patrolRoomId, seconds);
        }
        dirty = true;
      }, this);
      if (room.phase === 'PLAYING') {
        if (!(room.spirits || []).length && room.gameTime >= room.spiritReadyAt) {
          const soul = (room.murderedCrew || []).find(function (candidate) { return !candidate.used; });
          const hasLivingImpostor = Array.from(room.players.values()).some(function (player) {
            return player.alive && player.role === 'IMPOSTOR';
          });
          if (soul && hasLivingImpostor) {
            soul.used = true;
            room.spirits.push({ id: 'spirit-' + soul.playerId, playerId: soul.playerId, nickname: soul.nickname,
              x: soul.x, y: soul.y, spawnedAt: room.gameTime, botPath: [], stuckFor: 0 });
            room.spiritReadyAt = Infinity;
            room.spiritAnnouncementUntil = room.gameTime + 6;
            dirty = true;
          }
        }
        (room.spirits || []).slice().forEach(function (spirit) {
          const target = Array.from(room.players.values()).filter(function (player) {
            return player.alive && player.role === 'IMPOSTOR';
          }).sort(function (a, b) { return distance(spirit, a) - distance(spirit, b); })[0];
          if (!target) return;
          spirit.targetId = target.id;
          this._moveSpiritToward(spirit, target, seconds, room.gameTime);
          if (distance(spirit, target) <= 380) {
            target.alive = false;
            target.botTarget = null;
            room.spirits = room.spirits.filter(function (candidate) { return candidate.id !== spirit.id; });
            room.spiritReadyAt = room.gameTime + SPIRIT_DELAY;
            this._checkWin(room);
          }
          dirty = true;
        }, this);
      }
      if (dirty) {
        this._touch(room);
        changed.push(room.code);
      }
    }, this);
    return changed;
  }

  _moveBotToward(room, bot, target, targetRoomId, seconds) {
    while (bot.botPath && bot.botPath.length && distance(bot, bot.botPath[0]) < 150) bot.botPath.shift();
    const destination = bot.botPath && bot.botPath.length ? bot.botPath[0] : target;
    if (distance(bot, target) <= 180 && (!bot.botPath || !bot.botPath.length)) return true;
    const dx = destination.x - bot.x;
    const dy = destination.y - bot.y;
    const dist = Math.hypot(dx, dy);
    const previousX = bot.x;
    const previousY = bot.y;
    const speed = bot.role === 'CREW' ? BOT_CREW_SPEED : BOT_IMPOSTOR_SPEED;
    const step = Math.min(speed * seconds, dist);
    if (Math.abs(dx) >= Math.abs(dy) && dx) bot.facing = dx < 0 ? 'left' : 'right';
    else if (dy) bot.facing = dy < 0 ? 'up' : 'down';
    bot.movingUntil = room.gameTime + 0.24;
    const nextX = bot.x + dx / (dist || 1) * step;
    const nextY = bot.y + dy / (dist || 1) * step;
    if (isWalkable(nextX, bot.y, room)) bot.x = nextX;
    if (isWalkable(bot.x, nextY, room)) bot.y = nextY;
    if (Math.hypot(bot.x - previousX, bot.y - previousY) < 0.5) bot.stuckFor = (bot.stuckFor || 0) + seconds;
    else bot.stuckFor = 0;
    if (bot.stuckFor >= 1.2) {
      bot.botPath = pathWaypoints(bot, targetRoomId);
      bot.stuckFor = 0;
    }
    return false;
  }

  _unlockBotActionsIfReady(room) {
    if (room.botActionsUnlocked) return;
    const humansReady = Array.from(room.players.values()).filter(function (player) {
      return !player.isBot;
    }).every(function (player) { return player.introReady; });
    if (!humansReady) return;
    room.botActionsUnlocked = true;
    room.players.forEach(function (bot) {
      if (!bot.isBot || !bot.alive) return;
      bot.botStartDelay = room.gameTime + 1;
      if (bot.role !== 'IMPOSTOR') return;
      bot.killReadyAt = room.gameTime + INITIAL_KILL_COOLDOWN;
      bot.ventReadyAt = room.gameTime + BOT_SPECIAL_INITIAL_COOLDOWN;
      bot.phantomUntil = 0;
      bot.phantomReveal = null;
      bot.phantomReadyAt = room.gameTime + BOT_SPECIAL_INITIAL_COOLDOWN;
      bot.disguiseUntil = 0;
      bot.disguiseTargetId = null;
      bot.disguiseReadyAt = room.gameTime + BOT_SPECIAL_INITIAL_COOLDOWN;
    });
  }

  _moveSpiritToward(spirit, target, seconds, gameTime) {
    const dx = target.x - spirit.x;
    const dy = target.y - spirit.y;
    const dist = Math.hypot(dx, dy);
    if (!dist) return;
    const age = Math.max(0, Number(gameTime || 0) - Number(spirit.spawnedAt || 0));
    const speedIncrease = Math.floor(age / 10) * 0.05;
    const speed = SPIRIT_BASE_SPEED * (1 + speedIncrease);
    const step = Math.min(speed * seconds, dist);
    spirit.x = clamp(spirit.x + dx / dist * step, 0, WORLD.width);
    spirit.y = clamp(spirit.y + dy / dist * step, 0, WORLD.height);
  }

  leave(token) {
    const found = this.byToken(token);
    const room = found.room;
    const player = found.player;
    if ((room.phase === 'PLAYING' || room.phase === 'MEETING') && player.role === 'CREW') {
      const remainingTasks = Math.max(0, (player.taskGoal || 0) - (player.tasksDone || 0));
      room.taskGoal = Math.max(room.tasksCompleted, room.taskGoal - remainingTasks);
    }
    if (room.meeting) {
      delete room.meeting.votes[player.id];
      if (room.meeting.botPlans) delete room.meeting.botPlans[player.id];
    }
    room.players.delete(player.id);
    this.sessions.delete(token);
    if (!room.players.size || !Array.from(room.players.values()).some(function (p) { return !p.isBot; })) {
      this.rooms.delete(room.code);
      return null;
    }
    if (room.hostId === player.id) {
      room.hostId = Array.from(room.players.values()).find(function (p) { return !p.isBot; }).id;
    }
    this._unlockBotActionsIfReady(room);
    this._checkWin(room);
    if (room.phase === 'MEETING') this._maybeResolveMeeting(room);
    this._touch(room);
    return room;
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

  listOpenRooms() {
    return Array.from(this.rooms.values()).filter(function (room) {
      return room.phase === 'LOBBY' && Array.from(room.players.values()).filter(function (player) {
        return !player.isBot;
      }).length < 20;
    }).map(function (room) {
      const humans = Array.from(room.players.values()).filter(function (player) { return !player.isBot; });
      const host = room.players.get(room.hostId);
      return { code: room.code, hostName: host ? host.nickname : 'Unknown', players: humans.length,
        targetPlayers: room.settings.targetPlayers, impostors: room.settings.impostors };
    }).sort(function (a, b) {
      return b.players - a.players || a.hostName.localeCompare(b.hostName);
    });
  }

  _finishTask(room, player, taskId) {
    if (room.completedTaskIds.has(taskId)) return false;
    room.completedTaskIds.add(taskId);
    room.taskStationReadyAt[taskId] = room.gameTime + TASK_REFRESH_SECONDS;
    player.completedTaskIds.add(taskId);
    player.tasksDone += 1;
    player.activeTaskId = null;
    player.taskStartedAt = 0;
    const outstanding = Array.from(player.assignedTaskIds).some(function (assignedId) {
      return !player.completedTaskIds.has(assignedId);
    });
    if (!outstanding && player.tasksDone < player.taskGoal) player.nextTaskAt = room.gameTime + TASK_REFRESH_SECONDS;
    room.tasksCompleted += 1;
    this._checkWin(room);
    this._touch(room);
    return true;
  }

  _assignTasks(room, player, count) {
    const reserved = new Set();
    room.players.forEach(function (candidate) {
      candidate.assignedTaskIds.forEach(function (taskId) {
        if (!candidate.completedTaskIds.has(taskId)) reserved.add(taskId);
      });
    });
    const available = TASKS.filter(function (task) {
      return !player.completedTaskIds.has(task.id) && !reserved.has(task.id) &&
        (!room.taskStationReadyAt[task.id] || room.taskStationReadyAt[task.id] <= room.gameTime);
    }).sort(function () { return Math.random() - 0.5; });
    const remaining = Math.max(0, player.taskGoal - player.tasksDone);
    const selected = available.slice(0, Math.min(count, remaining));
    selected.forEach(function (task) { player.assignedTaskIds.add(task.id); });
    if (selected.length) player.nextTaskAt = 0;
    return selected.length;
  }

  _captureTrapIncident(room, attacker, target) {
    const triggered = (room.traps || []).filter(function (trap) { return distance(trap, target) <= 2200; });
    triggered.forEach(function (trap) {
      const owner = room.players.get(trap.ownerId);
      if (!owner) return;
      const people = Array.from(room.players.values()).filter(function (player) {
        return player.alive && distance(player, trap) <= 2400;
      }).map(function (player) {
        const disguise = player.role === 'IMPOSTOR' && player.impostorRole === 'SHAPESHIFTER' &&
          player.disguiseUntil > room.gameTime ? room.players.get(player.disguiseTargetId) : null;
        return { id: player.id, nickname: disguise ? disguise.nickname : player.nickname,
          color: disguise ? disguise.color : player.color,
          x: Math.round(player.x), y: Math.round(player.y) };
      });
      owner.trapSnapshots.push({ id: id(6), at: Math.round(room.gameTime), room: roomById(roomAt(trap.x, trap.y)).label,
        victimName: target.nickname, people: people });
      if (owner.trapSnapshots.length > 5) owner.trapSnapshots.shift();
    });
    if (triggered.length) room.traps = room.traps.filter(function (trap) {
      return !triggered.some(function (used) { return used.id === trap.id; });
    });
  }

  _activateDisguise(room, impostor, target) {
    impostor.disguiseTargetId = target.id;
    impostor.disguiseUntil = room.gameTime + room.settings.disguiseDuration;
    impostor.disguiseReadyAt = room.gameTime + room.settings.disguiseCooldown;
    room.players.forEach(function (witness) {
      if (!witness.isBot || !witness.alive || witness.role !== 'CREW' ||
          distance(witness, impostor) > 3600 || !hasLineOfSight(witness, impostor, room, 3600)) return;
      witness.suspectedImpostorId = impostor.id;
      witness.suspectGroupIds = [];
      witness.suspicionExpiresAt = room.gameTime + 45;
      witness.shapeshifterWitnessPlayerId = impostor.id;
      witness.shapeshifterWitnessName = impostor.nickname;
      witness.shapeshifterWitnessExpiresAt = room.gameTime + 45;
      witness.botTarget = null;
      witness.botPath = pathWaypoints(witness, 'command');
    });
  }

  _performElimination(room, attacker, target) {
    const attackerWasPhantom = attacker.impostorRole === 'PHANTOM' && attacker.phantomUntil > room.gameTime;
    const activeDisguise = attacker.impostorRole === 'SHAPESHIFTER' && attacker.disguiseUntil > room.gameTime
      ? room.players.get(attacker.disguiseTargetId) : null;
    const observedAttackerId = attackerWasPhantom ? null : (activeDisguise ? activeDisguise.id : attacker.id);
    this._captureTrapIncident(room, attacker, target);
    target.alive = false;
    target.isGhost = target.role === 'CREW' && !target.isBot;
    target.activeTaskId = null;
    target.botTarget = null;
    room.players.forEach(function (witness) {
      if (!witness.isBot || !witness.alive || witness.role !== 'CREW' || witness.id === target.id) return;
      const witnessedVictim = distance(witness, target) <= 3400 && hasLineOfSight(witness, target, room, 3400);
      const witnessedAttacker = !attackerWasPhantom && distance(witness, attacker) <= 3400 && hasLineOfSight(witness, attacker, room, 3400);
      if (witnessedVictim && (witnessedAttacker || attackerWasPhantom)) {
        const sceneSuspects = Array.from(new Set(Array.from(room.players.values()).filter(function (player) {
          return player.alive && player.id !== witness.id && player.id !== target.id &&
            distance(player, target) <= 1800 && hasLineOfSight(witness, player, room, 3400) &&
            !(player.id === attacker.id && attackerWasPhantom);
        }).map(function (player) { return player.id === attacker.id ? observedAttackerId : player.id; }).filter(Boolean)));
        witness.suspectedImpostorId = sceneSuspects.length === 1 && sceneSuspects[0] === observedAttackerId
          ? observedAttackerId : null;
        witness.suspectGroupIds = sceneSuspects.length > 1 ? sceneSuspects : [];
        witness.suspicionExpiresAt = room.gameTime + 45;
      }
    });
    if (!target.isGhost) {
      const remainingTasks = Math.max(0, target.taskGoal - target.tasksDone);
      room.taskGoal = Math.max(room.tasksCompleted, room.taskGoal - remainingTasks);
    }
    room.bodies.push({ id: 'body-' + target.id + '-' + Math.round(room.gameTime * 10), playerId: target.id,
      nickname: target.nickname, color: target.color, x: target.x, y: target.y,
      meltAt: attacker.impostorRole === 'MELTER' ? room.gameTime + room.settings.meltDelay : null });
    if (room.settings.vengefulSpirits) {
      room.murderedCrew.push({ playerId: target.id, nickname: target.nickname, x: target.x, y: target.y, used: false });
      room.spiritReadyAt = room.gameTime + SPIRIT_DELAY;
    }
    attacker.killReadyAt = room.gameTime + 18;
    this._checkWin(room);
    this._touch(room);
  }

  _finishMeeting(room) {
    room.phase = 'PLAYING';
    room.meeting = null;
    this._checkWin(room);
    if (room.phase === 'ENDED') return;
    if (room.settings.vengefulSpirits && room.spiritTimerResetPending) {
      room.spiritReadyAt = room.gameTime + SPIRIT_DELAY;
      room.spiritTimerResetPending = false;
    }
    let spawn = 0;
    room.players.forEach(function (player) {
      if (!player.alive) return;
      player.x = SPAWNS[spawn % SPAWNS.length][0];
      player.y = SPAWNS[spawn % SPAWNS.length][1];
      player.facing = 'down';
      player.movingUntil = 0;
      if (player.role === 'IMPOSTOR') {
        player.killReadyAt = room.gameTime + INITIAL_KILL_COOLDOWN;
        if (player.isBot) {
          player.botStartDelay = room.gameTime + 1;
          player.ventReadyAt = Math.max(player.ventReadyAt || 0, room.gameTime + INITIAL_KILL_COOLDOWN);
          player.phantomReadyAt = Math.max(player.phantomReadyAt || 0, room.gameTime + INITIAL_KILL_COOLDOWN);
          player.disguiseReadyAt = Math.max(player.disguiseReadyAt || 0, room.gameTime + INITIAL_KILL_COOLDOWN);
        }
      }
      spawn += 1;
    });
  }

  _updateMeeting(room) {
    const meeting = room.meeting;
    if (!meeting) return;
    if (meeting.stage === 'RESULT') {
      if (room.gameTime >= meeting.resultEndsAt) {
        if (meeting.result && meeting.result.status === 'EJECTED') {
          meeting.stage = 'EJECTION';
          meeting.resultEndsAt = room.gameTime + 5;
        } else {
          this._finishMeeting(room);
        }
      }
      return;
    }
    if (meeting.stage === 'EJECTION') {
      if (room.gameTime >= meeting.resultEndsAt) this._finishMeeting(room);
      return;
    }
    Object.keys(meeting.botPlans).forEach(function (botId) {
      const plan = meeting.botPlans[botId];
      const bot = room.players.get(botId);
      if (!plan.chatted && room.gameTime >= plan.chatAt && bot && bot.alive) {
        plan.chatted = true;
        const suspect = plan.suspectId ? room.players.get(plan.suspectId) : null;
        let text = suspect ? suspect.nickname + '이 제거하는 장면을 봤어!' : '확실한 증거는 없어. 주변을 잘 확인해 줘.';
        if (!suspect && plan.suspectIds && plan.suspectIds.length) {
          const names = plan.suspectIds.map(function (suspectId) { return room.players.get(suspectId); })
            .filter(Boolean).map(function (player) { return player.nickname; });
          text = '현장에 사람이 많았어. ' + names.join(', ') + ' 중 한 명이 의심돼.';
        }
        if (bot.id === meeting.callerId && meeting.type === 'BODY_REPORT') text = meeting.reportedName + '의 시체를 발견했어!';
        if (bot.id === meeting.callerId && meeting.type === 'PHANTOM_REVEAL') {
          text = meeting.reportedName + '이 은신에서 풀리는 걸 봤어.';
        }
        if (bot.id === meeting.callerId && meeting.type === 'SHAPESHIFTER_REVEAL') {
          text = meeting.reportedName + '이 다른 크루원으로 변장하는 걸 봤어!';
        }
        meeting.messages.push({ id: id(6), senderId: bot.id, senderName: bot.nickname,
          color: bot.color, text: text, isBot: true });
      }
      if (plan.decided || room.gameTime < plan.at) return;
      plan.decided = true;
      if (!plan.participate || !bot || !bot.alive) return;
      const candidates = Array.from(room.players.values()).filter(function (player) {
        return player.alive && player.id !== bot.id;
      });
      const witnessedSuspect = plan.suspectId && candidates.some(function (candidate) { return candidate.id === plan.suspectId; });
      const groupCandidates = candidates.filter(function (candidate) {
        return plan.suspectIds && plan.suspectIds.indexOf(candidate.id) >= 0;
      });
      meeting.votes[botId] = witnessedSuspect ? plan.suspectId
        : (groupCandidates.length ? groupCandidates[Math.floor(Math.random() * groupCandidates.length)].id
          : (Math.random() < 0.15 || !candidates.length ? null : candidates[Math.floor(Math.random() * candidates.length)].id));
    });
    this._maybeResolveMeeting(room);
    if (room.phase === 'MEETING' && meeting.stage === 'VOTING' && room.gameTime >= meeting.voteEndsAt) this._resolveMeeting(room);
  }

  _maybeResolveMeeting(room) {
    const meeting = room.meeting;
    const humansDone = Array.from(room.players.values()).filter(function (player) {
      return player.alive && !player.isBot;
    }).every(function (player) { return Object.prototype.hasOwnProperty.call(meeting.votes, player.id); });
    const botsDone = Object.keys(meeting.botPlans).every(function (botId) { return meeting.botPlans[botId].decided; });
    if (humansDone && botsDone) this._resolveMeeting(room);
  }

  _resolveMeeting(room) {
    const meeting = room.meeting;
    if (!meeting || meeting.stage !== 'VOTING') return;
    const eligible = Array.from(room.players.values()).filter(function (player) { return player.alive; }).length;
    const participation = Object.keys(meeting.votes).length;
    const tally = {};
    Object.keys(meeting.votes).forEach(function (voterId) {
      const key = meeting.votes[voterId] || 'SKIP';
      tally[key] = (tally[key] || 0) + 1;
    });
    let result = { status: 'NO_EJECTION', participation: participation, eligibleVoters: eligible, tally: tally };
    if (participation <= eligible / 2) {
      result.status = 'INSUFFICIENT_PARTICIPATION';
    } else {
      const entries = Object.keys(tally).map(function (key) { return [key, tally[key]]; })
        .sort(function (a, b) { return b[1] - a[1]; });
      const uniqueTop = entries.length && (!entries[1] || entries[0][1] > entries[1][1]);
      const ejectThreshold = eligible >= 5 ? 3 : Math.floor(eligible / 2) + 1;
      if (uniqueTop && entries[0][0] !== 'SKIP' && entries[0][1] >= ejectThreshold) {
        const ejected = room.players.get(entries[0][0]);
        if (ejected && ejected.alive) {
          ejected.alive = false;
          ejected.isGhost = false;
          ejected.botTarget = null;
          room.taskGoal = Math.max(room.tasksCompleted, room.taskGoal - Math.max(0, ejected.taskGoal - ejected.tasksDone));
          result = { status: 'EJECTED', participation: participation, eligibleVoters: eligible, tally: tally,
            ejectedId: ejected.id, ejectedName: ejected.nickname, wasImpostor: ejected.role === 'IMPOSTOR' };
        }
      } else if (entries.length > 1 && entries[0][1] === entries[1][1]) {
        result.status = 'TIE';
      } else if (entries.length && entries[0][0] === 'SKIP') {
        result.status = 'SKIPPED';
      }
    }
    meeting.result = result;
    meeting.stage = 'RESULT';
    meeting.resultEndsAt = room.gameTime + 5;
  }

  _checkWin(room) {
    if (room.phase !== 'PLAYING' && room.phase !== 'MEETING') return;
    const alive = Array.from(room.players.values()).filter(function (player) { return player.alive; });
    const impostors = alive.filter(function (player) { return player.role === 'IMPOSTOR'; }).length;
    const crew = alive.filter(function (player) { return player.role === 'CREW'; }).length;
    if (impostors === 0) {
      room.phase = 'ENDED';
      room.winner = 'CREW';
      room.message = 'All impostors were removed. Crew wins!';
    } else if (impostors >= crew) {
      room.phase = 'ENDED';
      room.winner = 'IMPOSTOR';
      room.message = 'The impostors took control of the station.';
    } else if (room.tasksCompleted >= room.taskGoal) {
      room.phase = 'ENDED';
      room.winner = 'CREW';
      room.message = 'All tasks completed. Crew wins!';
    }
    if (room.phase === 'ENDED') room.spiritAnnouncementUntil = 0;
  }

  _human(input) {
    return {
      id: id(8), token: id(24), nickname: nickname(input.nickname),
      color: COLORS.indexOf(input.color) >= 0 ? input.color : COLORS[0],
      ready: false, connected: true, isBot: false, role: null, alive: true, isGhost: false, killReadyAt: 0, ventReadyAt: 0, facing: 'down', movingUntil: 0, emergencyMeetingsUsed: 0,
      x: 15000, y: 8000, tasksDone: 0, taskGoal: 0, completedTaskIds: new Set(), assignedTaskIds: new Set()
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
      ready: true, connected: true, isBot: true, role: 'CREW', alive: true, isGhost: false, killReadyAt: 0, ventReadyAt: 0, facing: 'down', movingUntil: 0, emergencyMeetingsUsed: 0,
      x: 15000, y: 8000, tasksDone: 0, taskGoal: 0, completedTaskIds: new Set(), assignedTaskIds: new Set(),
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

module.exports = { LobbyStore: LobbyStore, roomView: roomView, TASKS: TASKS, ROOMS: ROOMS, SPIRIT_DELAY: SPIRIT_DELAY,
  CORRIDORS: CORRIDORS, DOORS: DOORS, VENTS: VENTS, WORLD: WORLD, isWalkable: isWalkable, hasLineOfSight: hasLineOfSight };

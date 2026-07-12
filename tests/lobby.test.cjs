'use strict';

const assert = require('assert');
const gameCore = require('../lobby-core.cjs');
const LobbyStore = gameCore.LobbyStore;

const store = new LobbyStore();
const host = store.create({ nickname: 'Nova', color: 'sky' });
assert.strictEqual(host.room.settings.targetPlayers, 4);
assert.strictEqual(host.room.canStart, true);

const configured = store.updateSettings(host.token, { targetPlayers: 4, impostors: 2, autoFillBots: true });
assert.strictEqual(configured.settings.impostors, 1, 'Four-player games allow one impostor');

const guest = store.join({ code: host.room.code, nickname: 'Mira', color: 'mint' });
store.setReady(guest.token, true);
const started = store.start(host.token);
assert.strictEqual(started.phase, 'PLAYING');
assert.strictEqual(started.players.length, 4, 'Bots fill missing seats');
assert.strictEqual(started.players.filter(function (p) { return p.isBot; }).length, 2);
assert.strictEqual(started.selfRole === 'CREW' || started.selfRole === 'IMPOSTOR', true);
assert.strictEqual(gameCore.isWalkable(15000, 8000), true, 'Command hub is walkable');
assert.strictEqual(gameCore.isWalkable(50, 50), false, 'Empty space outside rooms is blocked');

const hostState = store.byToken(host.token).player;
hostState.x = 12400;
hostState.y = 6200;
const beforeWallMove = { x: hostState.x, y: hostState.y };
store.move(host.token, { dx: -1, dy: -1 });
assert.deepStrictEqual({ x: hostState.x, y: hostState.y }, beforeWallMove, 'Server rejects movement through a wall');

const roles = [store.viewForToken(host.token).selfRole, store.viewForToken(guest.token).selfRole];
assert.strictEqual(roles.filter(function (role) { return role === 'IMPOSTOR'; }).length, 1, 'Impostor is a human');
const impostorToken = roles[0] === 'IMPOSTOR' ? host.token : guest.token;
const crewToken = roles[0] === 'CREW' ? host.token : guest.token;
const testDoor = gameCore.DOORS[0];
const doorCenter = { x: testDoor.x + testDoor.w / 2, y: testDoor.y + testDoor.h / 2 };
Object.assign(store.byToken(impostorToken).player, doorCenter);
store.useDoor(impostorToken, testDoor.id);
assert.strictEqual(store.viewForToken(impostorToken).doors.find(function (d) { return d.id === testDoor.id; }).closed, true);
Object.assign(store.byToken(crewToken).player, doorCenter);
store.useDoor(crewToken, testDoor.id);
assert.strictEqual(store.viewForToken(crewToken).doors.find(function (d) { return d.id === testDoor.id; }).closed, false, 'Crew can open a locked nearby door');
assert.throws(function () { store.useDoor(crewToken, testDoor.id); }, /already open/, 'Crew cannot lock an open door');
store.sabotageDoors(impostorToken);
assert.strictEqual(store.viewForToken(impostorToken).doors.filter(function (d) { return d.closed; }).length, 5);
assert(store.viewForToken(impostorToken).sabotageCooldown > 0);
for (let i = 0; i < 160; i += 1) store.tick(0.1);
assert.strictEqual(store.viewForToken(impostorToken).doors.some(function (d) { return d.closed; }), false, 'Sabotaged doors reopen automatically');

Object.assign(store.byToken(crewToken).player, { x: 15000, y: 8000 });
Object.assign(store.byToken(impostorToken).player, { x: 2800, y: 2100 });
assert.strictEqual(store.viewForToken(crewToken).players.some(function (p) { return p.id === store.byToken(impostorToken).player.id; }), false, 'Distant players are not sent outside line of sight');

for (let i = 0; i < 1500 && store.viewForToken(host.token).phase === 'PLAYING'; i += 1) {
  store.tick(0.1);
}
const afterBots = store.viewForToken(host.token);
const rawBots = Array.from(store.byToken(host.token).room.players.values()).filter(function (p) { return p.isBot; });
assert.strictEqual(rawBots.every(function (p) { return !p.alive || p.tasksDone === 2; }), true);
assert(afterBots.taskProgress >= 0.5, 'Computer tasks contribute to shared progress');

const crewView = store.viewForToken(crewToken);
for (const task of crewView.tasks.slice(0, 2)) {
  const found = store.byToken(crewToken);
  found.player.x = task.x;
  found.player.y = task.y;
  store.completeTask(crewToken, task.id);
}
assert.strictEqual(store.viewForToken(crewToken).phase, 'ENDED');
assert.strictEqual(store.viewForToken(crewToken).winner, 'CREW');

const combatStore = new LobbyStore();
const loneImpostor = combatStore.create({ nickname: 'Hunter', color: 'coral' });
combatStore.start(loneImpostor.token);
const combatRoom = combatStore.byToken(loneImpostor.token).room;
const attacker = combatStore.byToken(loneImpostor.token).player;
assert.strictEqual(attacker.role, 'IMPOSTOR');
combatRoom.gameTime = attacker.killReadyAt;
const victims = Array.from(combatRoom.players.values()).filter(function (p) { return p.role === 'CREW'; });
Object.assign(victims[0], { x: attacker.x + 100, y: attacker.y });
combatStore.eliminate(loneImpostor.token, victims[0].id);
assert.strictEqual(victims[0].alive, false);
assert.strictEqual(combatRoom.bodies.length, 1);
assert.throws(function () { combatStore.eliminate(loneImpostor.token, victims[1].id); }, /cooling down/);
combatRoom.gameTime = attacker.killReadyAt;
Object.assign(victims[1], { x: attacker.x + 100, y: attacker.y });
combatStore.eliminate(loneImpostor.token, victims[1].id);
assert.strictEqual(combatStore.viewForToken(loneImpostor.token).phase, 'ENDED');
assert.strictEqual(combatStore.viewForToken(loneImpostor.token).winner, 'IMPOSTOR');

console.log('Lobby, roles, doors, combat, bots and victory tests passed.');

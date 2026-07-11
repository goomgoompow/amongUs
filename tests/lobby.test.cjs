'use strict';

const assert = require('assert');
const LobbyStore = require('../lobby-core.cjs').LobbyStore;

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

const roles = [store.viewForToken(host.token).selfRole, store.viewForToken(guest.token).selfRole];
assert.strictEqual(roles.filter(function (role) { return role === 'IMPOSTOR'; }).length, 1, 'Impostor is a human');

for (let i = 0; i < 1500 && store.viewForToken(host.token).phase === 'PLAYING'; i += 1) {
  store.tick(0.1);
}
const afterBots = store.viewForToken(host.token);
assert.strictEqual(afterBots.players.filter(function (p) { return p.isBot; }).every(function (p) { return p.tasksDone === 2; }), true);
assert(afterBots.taskProgress >= 0.5, 'Computer tasks contribute to shared progress');

const crewToken = roles[0] === 'CREW' ? host.token : guest.token;
const crewView = store.viewForToken(crewToken);
for (const task of crewView.tasks.slice(0, 2)) {
  const found = store.byToken(crewToken);
  found.player.x = task.x;
  found.player.y = task.y;
  store.completeTask(crewToken, task.id);
}
assert.strictEqual(store.viewForToken(crewToken).phase, 'ENDED');
assert.strictEqual(store.viewForToken(crewToken).winner, 'CREW');

console.log('Lobby, bots, roles, movement and task victory tests passed.');

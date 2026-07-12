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

const formattedCode = host.room.code.slice(0, 3).toLowerCase() + '-' + host.room.code.slice(3).toLowerCase();
const guest = store.join({ code: formattedCode, nickname: 'Mira', color: 'mint' });
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
Object.assign(hostState, { x: 15000, y: 8000, facing: 'down' });
store.move(host.token, { dx: 1, dy: 0 });
assert.strictEqual(hostState.x, 15125, 'Human movement uses the reduced speed');
assert.strictEqual(hostState.facing, 'right', 'Movement updates character facing');
assert.strictEqual(store.viewForToken(host.token).players.find(function (p) { return p.id === host.playerId; }).moving, true);
store.tick(0.3);
assert.strictEqual(store.viewForToken(host.token).players.find(function (p) { return p.id === host.playerId; }).moving, false, 'Walk animation stops after movement input ends');

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
const rematchLobby = store.rematch(host.token);
assert.strictEqual(rematchLobby.phase, 'LOBBY');
assert.strictEqual(rematchLobby.players.length, 2, 'Computer players are removed for the rematch lobby');
assert.strictEqual(rematchLobby.players.every(function (p) { return p.alive; }), true);
assert.strictEqual(store.byToken(host.token).room.players.values().toArray().every(function (p) { return p.role === null; }), true);
assert.strictEqual(rematchLobby.settings.targetPlayers, 4, 'Room settings survive a rematch');
assert.throws(function () { store.rematch(guest.token); }, /Only the host|not ended/);

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

const reportStore = new LobbyStore();
const reporterSession = reportStore.create({ nickname: 'Reporter', color: 'rose' });
reportStore.start(reporterSession.token);
const reportRoom = reportStore.byToken(reporterSession.token).room;
const reporter = reportStore.byToken(reporterSession.token).player;
const reportVictim = Array.from(reportRoom.players.values()).find(function (p) { return p.role === 'CREW'; });
reportRoom.gameTime = reporter.killReadyAt;
Object.assign(reportVictim, { x: reporter.x + 100, y: reporter.y });
reportStore.eliminate(reporterSession.token, reportVictim.id);
const reportBody = reportRoom.bodies[0];
reportStore.reportBody(reporterSession.token, reportBody.id);
assert.strictEqual(reportStore.viewForToken(reporterSession.token).phase, 'MEETING');
assert.strictEqual(reportStore.viewForToken(reporterSession.token).meeting.type, 'BODY_REPORT');
assert.strictEqual(reportRoom.bodies.length, 0, 'Reported body is removed from the map');
const frozenX = reporter.x;
reportStore.move(reporterSession.token, { dx: 1, dy: 0 });
assert.strictEqual(reporter.x, frozenX, 'Movement is frozen during meetings');
for (let i = 0; i < 451; i += 1) reportStore.tick(0.1);
assert.strictEqual(reportStore.viewForToken(reporterSession.token).phase, 'PLAYING');

const emergencyStore = new LobbyStore();
const emergencySession = emergencyStore.create({ nickname: 'Captain', color: 'amber' });
emergencyStore.start(emergencySession.token);
const emergencyRoom = emergencyStore.byToken(emergencySession.token).room;
const emergencyCaller = emergencyStore.byToken(emergencySession.token).player;
emergencyRoom.gameTime = 15;
Object.assign(emergencyCaller, { x: 15000, y: 8150 });
emergencyStore.callEmergencyMeeting(emergencySession.token);
assert.strictEqual(emergencyStore.viewForToken(emergencySession.token).meeting.type, 'EMERGENCY');
Object.keys(emergencyRoom.meeting.botPlans).forEach(function (botId) {
  emergencyRoom.meeting.botPlans[botId].decided = true;
  emergencyRoom.meeting.botPlans[botId].participate = false;
});
emergencyStore.voteMeeting(emergencySession.token, null);
for (let i = 0; i < 51; i += 1) emergencyStore.tick(0.1);
assert.strictEqual(emergencyStore.viewForToken(emergencySession.token).phase, 'PLAYING');
assert.throws(function () { emergencyStore.callEmergencyMeeting(emergencySession.token); }, /already been used/);

const lowTurnoutStore = new LobbyStore();
const lowTurnoutSession = lowTurnoutStore.create({ nickname: 'SoloVoter', color: 'white' });
lowTurnoutStore.start(lowTurnoutSession.token);
const lowTurnoutRoom = lowTurnoutStore.byToken(lowTurnoutSession.token).room;
lowTurnoutRoom.gameTime = 15;
Object.assign(lowTurnoutStore.byToken(lowTurnoutSession.token).player, { x: 15000, y: 8150 });
lowTurnoutStore.callEmergencyMeeting(lowTurnoutSession.token);
Object.keys(lowTurnoutRoom.meeting.botPlans).forEach(function (botId) {
  lowTurnoutRoom.meeting.botPlans[botId].decided = true;
  lowTurnoutRoom.meeting.botPlans[botId].participate = false;
});
lowTurnoutStore.voteMeeting(lowTurnoutSession.token, null);
assert.strictEqual(lowTurnoutStore.viewForToken(lowTurnoutSession.token).meeting.result.status, 'INSUFFICIENT_PARTICIPATION');
assert.strictEqual(lowTurnoutStore.viewForToken(lowTurnoutSession.token).meeting.hasVoted, true);
assert.strictEqual(lowTurnoutStore.viewForToken(lowTurnoutSession.token).meeting.ownVote, null);

const ejectStore = new LobbyStore();
const ejectSession = ejectStore.create({ nickname: 'LeadVoter', color: 'navy' });
ejectStore.start(ejectSession.token);
const ejectRoom = ejectStore.byToken(ejectSession.token).room;
const ejectCaller = ejectStore.byToken(ejectSession.token).player;
ejectRoom.gameTime = 15;
Object.assign(ejectCaller, { x: 15000, y: 8150 });
ejectStore.callEmergencyMeeting(ejectSession.token);
const ejectBots = Array.from(ejectRoom.players.values()).filter(function (p) { return p.isBot; });
Object.keys(ejectRoom.meeting.botPlans).forEach(function (botId) { ejectRoom.meeting.botPlans[botId].decided = true; });
ejectRoom.meeting.votes[ejectBots[0].id] = ejectBots[0].id;
ejectRoom.meeting.votes[ejectBots[1].id] = ejectBots[0].id;
ejectStore.voteMeeting(ejectSession.token, ejectBots[0].id);
assert.strictEqual(ejectRoom.meeting.result.status, 'EJECTED');
assert.strictEqual(ejectRoom.meeting.result.ejectedId, ejectBots[0].id);
assert.strictEqual(ejectBots[0].alive, false);

const largeStore = new LobbyStore();
const largeHost = largeStore.create({ nickname: 'BigHost', color: 'violet' });
const largeSettings = largeStore.updateSettings(largeHost.token, { targetPlayers: 20, impostors: 4, autoFillBots: true });
assert.strictEqual(largeSettings.settings.targetPlayers, 20);
assert.strictEqual(largeSettings.settings.impostors, 4);

const missionStore = new LobbyStore();
const missionHost = missionStore.create({ nickname: 'MissionHost', color: 'teal' });
const missionGuest = missionStore.join({ code: missionHost.room.code, nickname: 'MissionGuest', color: 'orange' });
missionStore.setReady(missionGuest.token, true);
missionStore.start(missionHost.token);
const missionTokens = [missionHost.token, missionGuest.token];
const missionCrewToken = missionTokens.find(function (token) { return missionStore.byToken(token).player.role === 'CREW'; });
const missionCrew = missionStore.byToken(missionCrewToken).player;
const firstMission = gameCore.TASKS[0];
Object.assign(missionCrew, { x: firstMission.x, y: firstMission.y });
missionStore.completeTask(missionCrewToken, firstMission.id);
const missionRoom = missionStore.byToken(missionCrewToken).room;
missionRoom.gameTime = 15;
Object.assign(missionCrew, { x: 15000, y: 8150 });
missionStore.callEmergencyMeeting(missionCrewToken);
missionRoom.meeting.voteEndsAt = missionRoom.gameTime;
missionStore.tick(0.1);
missionRoom.meeting.resultEndsAt = missionRoom.gameTime;
missionStore.tick(0.1);
assert.strictEqual(missionStore.viewForToken(missionCrewToken).phase, 'PLAYING');
assert.strictEqual(missionStore.viewForToken(missionCrewToken).selfCompletedTaskIds.includes(firstMission.id), true, 'Completed tasks remain identifiable after a meeting');

console.log('Lobby, voting, meetings, 20-player settings, missions, reports and combat tests passed.');

'use strict';

const assert = require('assert');
const gameCore = require('../lobby-core.cjs');
const LobbyStore = gameCore.LobbyStore;

function ensureHumanRole(store, token, role, protectedIds) {
  const found = store.byToken(token);
  const player = found.player;
  if (player.role === role) return player;
  const donor = Array.from(found.room.players.values()).find(function (candidate) {
    return candidate.role === role && !(protectedIds || []).includes(candidate.id);
  });
  assert(donor, 'A role donor must exist');
  const roleState = ['role', 'crewRole', 'impostorRole', 'taskGoal', 'tasksDone', 'completedTaskIds',
    'assignedTaskIds', 'activeTaskId', 'taskStartedAt', 'nextTaskAt', 'killReadyAt', 'phantomUntil',
    'phantomReadyAt', 'phantomReveal', 'disguiseUntil', 'disguiseReadyAt', 'disguiseTargetId'];
  roleState.forEach(function (key) {
    const value = player[key]; player[key] = donor[key]; donor[key] = value;
  });
  return player;
}

const store = new LobbyStore();
const host = store.create({ nickname: 'Nova', color: 'sky' });
assert.strictEqual(host.room.settings.targetPlayers, 4);
assert.strictEqual(host.room.settings.revealImpostors, true, 'Impostor identification is enabled by default');
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
const startedRoom = store.byToken(host.token).room;
assert.strictEqual(Array.from(startedRoom.players.values()).filter(function (player) {
  return player.role === 'IMPOSTOR';
}).every(function (player) {
  return player.killReadyAt - startedRoom.gameTime === 7;
}), true, 'Every human and bot impostor starts with a seven-second elimination cooldown');
const crewAssignments = Array.from(startedRoom.players.values()).filter(function (player) {
  return player.role === 'CREW';
}).flatMap(function (player) { return Array.from(player.assignedTaskIds); });
assert.strictEqual(new Set(crewAssignments).size, crewAssignments.length, 'Each task station is assigned to only one crew member');
assert.strictEqual(startedRoom.taskGoal, Array.from(startedRoom.players.values()).filter(function (player) {
  return player.role === 'CREW';
}).length * 4, 'Shared task goal includes refreshed task waves');

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

assert.strictEqual(Array.from(startedRoom.players.values()).filter(function (player) {
  return player.role === 'IMPOSTOR';
}).length, 1, 'The configured number of impostors is assigned across humans and bots');
ensureHumanRole(store, host.token, 'IMPOSTOR');
ensureHumanRole(store, guest.token, 'CREW');
const impostorToken = host.token;
const crewToken = guest.token;
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

for (let i = 0; i < 4000 && store.viewForToken(host.token).phase === 'PLAYING'; i += 1) {
  store.tick(0.1);
}
const afterBots = store.viewForToken(host.token);
const rawBots = Array.from(store.byToken(host.token).room.players.values()).filter(function (p) { return p.isBot; });
assert.strictEqual(rawBots.every(function (p) { return !p.alive || p.tasksDone === 4; }), true);
assert(afterBots.taskProgress >= 0.5, 'Computer tasks contribute to shared progress');
const patrolPositions = rawBots.map(function (bot) { return { id: bot.id, x: bot.x, y: bot.y }; });
for (let i = 0; i < 50; i += 1) store.tick(0.1);
assert.strictEqual(rawBots.some(function (bot) {
  const before = patrolPositions.find(function (position) { return position.id === bot.id; });
  return Math.hypot(bot.x - before.x, bot.y - before.y) > 50;
}), true, 'Bots patrol after completing their tasks');

let testedTaskCancellation = false;
while (store.viewForToken(crewToken).phase === 'PLAYING' && store.byToken(crewToken).player.tasksDone < store.byToken(crewToken).player.taskGoal) {
  let crewView = store.viewForToken(crewToken);
  let task = crewView.tasks.find(function (candidate) { return crewView.selfCompletedTaskIds.indexOf(candidate.id) < 0; });
  if (!task) {
    store.tick(Math.max(0.1, crewView.nextTaskIn + 0.1));
    crewView = store.viewForToken(crewToken);
    task = crewView.tasks.find(function (candidate) { return crewView.selfCompletedTaskIds.indexOf(candidate.id) < 0; });
  }
  const found = store.byToken(crewToken);
  found.player.x = task.x;
  found.player.y = task.y;
  const beforeTaskCount = found.room.tasksCompleted;
  store.completeTask(crewToken, task.id);
  assert.strictEqual(found.room.tasksCompleted, beforeTaskCount, 'Clicking starts work without completing the task instantly');
  if (!testedTaskCancellation) {
    found.player.x = task.x + 700;
    store.tick(0.2);
    assert.strictEqual(store.viewForToken(crewToken).activeTask, null, 'Leaving the station cancels task work');
    assert.strictEqual(found.room.tasksCompleted, beforeTaskCount);
    found.player.x = task.x;
    found.player.y = task.y;
    store.completeTask(crewToken, task.id);
    testedTaskCancellation = true;
  }
  store.tick(5.1);
  assert.strictEqual(found.room.tasksCompleted, beforeTaskCount + 1, 'A completed station increments shared progress once');
  assert.strictEqual(store._finishTask(found.room, found.player, task.id), false, 'A station cannot contribute progress twice');
  assert.strictEqual(found.room.tasksCompleted, beforeTaskCount + 1, 'Duplicate station completion does not change progress');
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

const leaveLobbyStore = new LobbyStore();
const leavingHost = leaveLobbyStore.create({ nickname: 'LeavingHost', color: 'gray' });
const nextHost = leaveLobbyStore.join({ code: leavingHost.room.code, nickname: 'NextHost', color: 'olive' });
const roomAfterHostLeave = leaveLobbyStore.leave(leavingHost.token);
assert.strictEqual(roomAfterHostLeave.hostId, nextHost.playerId, 'Leaving hosts transfer ownership to another human');
assert.throws(function () { leaveLobbyStore.byToken(leavingHost.token); }, /Session expired/);

const activeLeaveStore = new LobbyStore();
const activeLeaveHost = activeLeaveStore.create({ nickname: 'ActiveHost', color: 'teal' });
const activeLeaveGuest = activeLeaveStore.join({ code: activeLeaveHost.room.code, nickname: 'ActiveGuest', color: 'orange' });
activeLeaveStore.setReady(activeLeaveGuest.token, true);
activeLeaveStore.start(activeLeaveHost.token);
const activeCrewToken = [activeLeaveHost.token, activeLeaveGuest.token].find(function (token) {
  return activeLeaveStore.byToken(token).player.role === 'CREW';
});
const departingCrew = activeLeaveStore.byToken(activeCrewToken).player;
const activeLeaveRoom = activeLeaveStore.byToken(activeCrewToken).room;
const expectedTaskGoal = activeLeaveRoom.taskGoal - (departingCrew.taskGoal - departingCrew.tasksDone);
const roomAfterActiveLeave = activeLeaveStore.leave(activeCrewToken);
assert.strictEqual(roomAfterActiveLeave.taskGoal, expectedTaskGoal,
  'A departing crew member no longer leaves impossible tasks in the shared goal');

const combatStore = new LobbyStore();
const loneImpostor = combatStore.create({ nickname: 'Hunter', color: 'coral' });
combatStore.start(loneImpostor.token);
ensureHumanRole(combatStore, loneImpostor.token, 'IMPOSTOR');
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
ensureHumanRole(reportStore, reporterSession.token, 'IMPOSTOR');
const reportRoom = reportStore.byToken(reporterSession.token).room;
const reporter = reportStore.byToken(reporterSession.token).player;
const reportVictim = Array.from(reportRoom.players.values()).find(function (p) { return p.role === 'CREW'; });
const reportObservers = Array.from(reportRoom.players.values()).filter(function (player) {
  return player.role === 'CREW' && player.id !== reportVictim.id;
});
reportRoom.gameTime = reporter.killReadyAt;
Object.assign(reportVictim, { x: reporter.x + 100, y: reporter.y });
Object.assign(reportObservers[0], { x: reporter.x + 250, y: reporter.y });
Object.assign(reportObservers[1], { x: 26700, y: 15500 });
reportStore.eliminate(reporterSession.token, reportVictim.id);
const reportBody = reportRoom.bodies[0];
const eyewitnesses = Array.from(reportRoom.players.values()).filter(function (player) {
  return player.isBot && player.alive && player.suspectedImpostorId === reporter.id;
});
assert(eyewitnesses.length > 0, 'Bots in sight remember the killer');
reportStore.reportBody(reporterSession.token, reportBody.id);
assert.strictEqual(reportStore.viewForToken(reporterSession.token).phase, 'MEETING');
assert.strictEqual(reportStore.viewForToken(reporterSession.token).meeting.type, 'BODY_REPORT');
assert.strictEqual(reportRoom.bodies.length, 0, 'Reported body is removed from the map');
assert(Object.values(reportRoom.meeting.botPlans).some(function (plan) {
  return plan.suspectId === reporter.id && plan.participate;
}), 'Eyewitness bots plan to vote for the killer');
reportStore.sendMeetingMessage(reporterSession.token, '누가 봤나요?');
assert.strictEqual(reportRoom.meeting.messages[0].text, '누가 봤나요?', 'Living humans can chat during voting');
reportRoom.gameTime = Math.max.apply(null, Object.values(reportRoom.meeting.botPlans).map(function (plan) { return plan.chatAt; }));
reportStore.tick(0.01);
assert(reportRoom.meeting.messages.some(function (message) { return message.isBot; }), 'Bots contribute to meeting chat');
const frozenX = reporter.x;
reportStore.move(reporterSession.token, { dx: 1, dy: 0 });
assert.strictEqual(reporter.x, frozenX, 'Movement is frozen during meetings');
reportRoom.meeting.votes = {};
Object.keys(reportRoom.meeting.botPlans).forEach(function (botId) {
  reportRoom.meeting.botPlans[botId].decided = true;
  reportRoom.meeting.botPlans[botId].participate = false;
});
reportStore.voteMeeting(reporterSession.token, null);
for (let i = 0; i < 51; i += 1) reportStore.tick(0.1);
assert.strictEqual(reportStore.viewForToken(reporterSession.token).phase, 'PLAYING');

const crowdStore = new LobbyStore();
const crowdKillerSession = crowdStore.create({ nickname: 'CrowdedKiller', color: 'brown' });
crowdStore.start(crowdKillerSession.token);
ensureHumanRole(crowdStore, crowdKillerSession.token, 'IMPOSTOR');
const crowdRoom = crowdStore.byToken(crowdKillerSession.token).room;
const crowdKiller = crowdStore.byToken(crowdKillerSession.token).player;
const crowdCrew = Array.from(crowdRoom.players.values()).filter(function (player) { return player.role === 'CREW'; });
crowdRoom.gameTime = crowdKiller.killReadyAt;
Object.assign(crowdCrew[0], { x: crowdKiller.x + 100, y: crowdKiller.y });
Object.assign(crowdCrew[1], { x: crowdKiller.x + 250, y: crowdKiller.y });
Object.assign(crowdCrew[2], { x: crowdKiller.x + 350, y: crowdKiller.y });
crowdStore.eliminate(crowdKillerSession.token, crowdCrew[0].id);
const crowdWitnesses = crowdCrew.slice(1);
assert.strictEqual(crowdWitnesses.every(function (witness) { return witness.suspectedImpostorId === null; }), true,
  'Witnesses do not identify one killer in a crowded scene');
assert.strictEqual(crowdWitnesses.every(function (witness) {
  return witness.suspectGroupIds.indexOf(crowdKiller.id) >= 0 && witness.suspectGroupIds.length > 1;
}), true, 'Crowded witnesses remember a group of possible suspects');

const autoReportStore = new LobbyStore();
const autoKiller = autoReportStore.create({ nickname: 'SeenKiller', color: 'maroon' });
autoReportStore.start(autoKiller.token);
ensureHumanRole(autoReportStore, autoKiller.token, 'IMPOSTOR');
const autoRoom = autoReportStore.byToken(autoKiller.token).room;
const autoAttacker = autoReportStore.byToken(autoKiller.token).player;
const autoVictim = Array.from(autoRoom.players.values()).find(function (player) { return player.isBot; });
const autoObservers = Array.from(autoRoom.players.values()).filter(function (player) {
  return player.isBot && player.id !== autoVictim.id;
});
autoRoom.gameTime = autoAttacker.killReadyAt;
Object.assign(autoVictim, { x: autoAttacker.x + 100, y: autoAttacker.y });
Object.assign(autoObservers[0], { x: autoAttacker.x + 2200, y: autoAttacker.y });
Object.assign(autoObservers[1], { x: 26700, y: 15500 });
autoReportStore.eliminate(autoKiller.token, autoVictim.id);
autoRoom.players.forEach(function (player) {
  if (player.isBot && player.alive) player.botStartDelay = 999;
});
for (let i = 0; i < 70 && autoRoom.phase === 'PLAYING'; i += 1) autoReportStore.tick(0.1);
assert.strictEqual(autoRoom.phase, 'MEETING', 'A distant bot investigates and reports a body within its vision');
assert.strictEqual(autoRoom.meeting.type, 'BODY_REPORT');
const autoWitnessPlan = Object.values(autoRoom.meeting.botPlans).find(function (plan) { return plan.suspectId === autoAttacker.id; });
assert(autoWitnessPlan, 'The automatic report carries eyewitness suspicion into voting');
autoRoom.gameTime = autoWitnessPlan.at;
autoReportStore.tick(0.01);
assert(Object.values(autoRoom.meeting.votes).includes(autoAttacker.id), 'An eyewitness bot votes for the witnessed killer');

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
ensureHumanRole(ejectStore, ejectSession.token, 'IMPOSTOR');
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
assert.strictEqual(ejectRoom.meeting.stage, 'RESULT');
for (let i = 0; i < 51; i += 1) ejectStore.tick(0.1);
assert.strictEqual(ejectRoom.meeting.stage, 'EJECTION');
for (let i = 0; i < 51; i += 1) ejectStore.tick(0.1);
assert.strictEqual(ejectStore.viewForToken(ejectSession.token).phase, 'PLAYING');
assert.strictEqual(ejectStore.viewForToken(ejectSession.token).impostorsRemaining, 1, 'Resumed games show the remaining impostor count');

const thresholdStore = new LobbyStore();
const thresholdHost = thresholdStore.create({ nickname: 'Threshold', color: 'gold' });
thresholdStore.updateSettings(thresholdHost.token, { targetPlayers: 5, impostors: 1, autoFillBots: true, vengefulSpirits: true });
thresholdStore.start(thresholdHost.token);
const thresholdRoom = thresholdStore.byToken(thresholdHost.token).room;
thresholdRoom.gameTime = 15;
Object.assign(thresholdStore.byToken(thresholdHost.token).player, { x: 15000, y: 8150 });
thresholdStore.callEmergencyMeeting(thresholdHost.token);
const thresholdBots = Array.from(thresholdRoom.players.values()).filter(function (player) { return player.isBot; });
Object.keys(thresholdRoom.meeting.botPlans).forEach(function (botId) { thresholdRoom.meeting.botPlans[botId].decided = true; });
thresholdRoom.meeting.votes[thresholdBots[0].id] = thresholdBots[2].id;
thresholdRoom.meeting.votes[thresholdBots[1].id] = thresholdBots[2].id;
thresholdRoom.meeting.votes[thresholdBots[2].id] = null;
thresholdStore._resolveMeeting(thresholdRoom);
assert.strictEqual(thresholdRoom.meeting.result.status, 'NO_EJECTION', 'Two votes cannot eject someone when five players remain');
assert.strictEqual(thresholdStore.viewForToken(thresholdHost.token).meeting.ejectThreshold, 3);

const largeStore = new LobbyStore();
const largeHost = largeStore.create({ nickname: 'BigHost', color: 'violet' });
const largeSettings = largeStore.updateSettings(largeHost.token, { targetPlayers: 20, impostors: 4, autoFillBots: true });
assert.strictEqual(largeSettings.settings.targetPlayers, 20);
assert.strictEqual(largeSettings.settings.impostors, 4);

const hiddenAllyStore = new LobbyStore();
const hiddenAllyHost = hiddenAllyStore.create({ nickname: 'HiddenAlly', color: 'black' });
hiddenAllyStore.updateSettings(hiddenAllyHost.token, { targetPlayers: 4, impostors: 1, autoFillBots: true,
  revealImpostors: false });
hiddenAllyStore.start(hiddenAllyHost.token);
ensureHumanRole(hiddenAllyStore, hiddenAllyHost.token, 'IMPOSTOR');
assert.strictEqual(hiddenAllyStore.viewForToken(hiddenAllyHost.token).players.some(function (player) {
  return player.isImpostorAlly;
}), false, 'Disabling impostor identification removes every ally marker');

const roleStore = new LobbyStore();
const roleHost = roleStore.create({ nickname: 'RoleHost', color: 'coral' });
const roleGuests = [
  roleStore.join({ code: roleHost.room.code, nickname: 'RoleOne', color: 'mint' }),
  roleStore.join({ code: roleHost.room.code, nickname: 'RoleTwo', color: 'navy' }),
  roleStore.join({ code: roleHost.room.code, nickname: 'RoleThree', color: 'gold' })
];
roleGuests.forEach(function (guestSession) { roleStore.setReady(guestSession.token, true); });
roleStore.start(roleHost.token);
const roleTokens = [roleHost.token].concat(roleGuests.map(function (guestSession) { return guestSession.token; }));
const roleRoom = roleStore.byToken(roleHost.token).room;
const roleCrewTokens = roleTokens.filter(function (token) { return roleStore.byToken(token).player.role === 'CREW'; });
assert.strictEqual(roleCrewTokens.every(function (token) {
  return ['CREWMATE', 'ENGINEER', 'TRACKER', 'DETECTIVE'].includes(roleStore.byToken(token).player.crewRole);
}), true, 'Crew roles are selected from the random role pool');
['ENGINEER', 'TRACKER', 'DETECTIVE'].forEach(function (role, index) { roleStore.byToken(roleCrewTokens[index]).player.crewRole = role; });
const engineerToken = roleTokens.find(function (token) { return roleStore.byToken(token).player.crewRole === 'ENGINEER'; });
const trackerToken = roleTokens.find(function (token) { return roleStore.byToken(token).player.crewRole === 'TRACKER'; });
const detectiveToken = roleTokens.find(function (token) { return roleStore.byToken(token).player.crewRole === 'DETECTIVE'; });
const roleImpostorToken = roleTokens.find(function (token) { return roleStore.byToken(token).player.role === 'IMPOSTOR'; });
assert(engineerToken && trackerToken && detectiveToken && roleImpostorToken, 'Crew special roles are assigned separately');
const roleImpostor = roleStore.byToken(roleImpostorToken).player;
roleStore.trackPlayer(trackerToken, roleImpostor.id);
const trackingView = roleStore.viewForToken(trackerToken).crewAbility.tracking;
assert.strictEqual(trackingView.id, roleImpostor.id);
assert.strictEqual(trackingView.alive, true, 'Tracker sees target life status');
const detective = roleStore.byToken(detectiveToken).player;
Object.assign(detective, { x: roleImpostor.x + 100, y: roleImpostor.y });
roleStore.detectPlayer(detectiveToken, roleImpostor.id);
assert.strictEqual(roleStore.viewForToken(detectiveToken).crewAbility.investigations[0].identity, 'IMPOSTOR');
assert.throws(function () { roleStore.detectPlayer(detectiveToken, roleImpostor.id); }, /cooling down/);
const engineer = roleStore.byToken(engineerToken).player;
Object.assign(engineer, { x: roleImpostor.x + 200, y: roleImpostor.y });
roleStore.placeTrap(engineerToken);
assert.strictEqual(roleStore.viewForToken(engineerToken).crewAbility.trapActive, true);
const liveTrapView = roleStore.viewForToken(engineerToken).crewAbility.trapView;
assert(liveTrapView && liveTrapView.people.some(function (person) { return person.id === engineer.id; }),
  'Engineer receives a live, role-free view around the active trap');
const roleVictimToken = [trackerToken, detectiveToken].find(function (token) { return roleStore.byToken(token).player.alive; });
const roleVictim = roleStore.byToken(roleVictimToken).player;
roleRoom.gameTime = roleImpostor.killReadyAt;
Object.assign(roleVictim, { x: roleImpostor.x + 100, y: roleImpostor.y });
roleStore.eliminate(roleImpostorToken, roleVictim.id);
const engineerSnapshot = roleStore.viewForToken(engineerToken).crewAbility.snapshots[0];
assert(engineerSnapshot && engineerSnapshot.victimName === roleVictim.nickname, 'Engineer trap records an elimination snapshot');
assert(engineerSnapshot.people.some(function (person) { return person.id === roleImpostor.id; }), 'Trap snapshot records nearby people without revealing roles');
assert.strictEqual(roleStore.viewForToken(engineerToken).crewAbility.trapActive, false, 'Triggered trap is consumed');

const impostorRoleStore = new LobbyStore();
const impostorRoleHost = impostorRoleStore.create({ nickname: 'ImpHost', color: 'black' });
const impostorRoleGuests = [
  impostorRoleStore.join({ code: impostorRoleHost.room.code, nickname: 'ImpOne', color: 'maroon' }),
  impostorRoleStore.join({ code: impostorRoleHost.room.code, nickname: 'ImpTwo', color: 'magenta' }),
  impostorRoleStore.join({ code: impostorRoleHost.room.code, nickname: 'CrewViewer', color: 'white' })
];
impostorRoleGuests.forEach(function (session) { impostorRoleStore.setReady(session.token, true); });
impostorRoleStore.updateSettings(impostorRoleHost.token, { targetPlayers: 11, impostors: 3, autoFillBots: true,
  vengefulSpirits: false, phantomDuration: 4, meltDelay: 5, disguiseDuration: 6, disguiseCooldown: 18 });
impostorRoleStore.start(impostorRoleHost.token);
const impostorRoleTokens = [impostorRoleHost.token].concat(impostorRoleGuests.map(function (session) { return session.token; }));
const intendedImpostorIds = impostorRoleTokens.slice(0, 3).map(function (token) {
  return impostorRoleStore.byToken(token).player.id;
});
impostorRoleTokens.slice(0, 3).forEach(function (token) {
  ensureHumanRole(impostorRoleStore, token, 'IMPOSTOR', intendedImpostorIds);
});
const specialImpostorTokens = impostorRoleTokens.filter(function (token) { return impostorRoleStore.byToken(token).player.role === 'IMPOSTOR'; });
assert.strictEqual(specialImpostorTokens.every(function (token) {
  return ['IMPOSTOR', 'PHANTOM', 'MELTER', 'SHAPESHIFTER'].includes(impostorRoleStore.byToken(token).player.impostorRole);
}), true, 'Impostor roles are selected from the random role pool');
['PHANTOM', 'MELTER', 'SHAPESHIFTER'].forEach(function (role, index) {
  impostorRoleStore.byToken(specialImpostorTokens[index]).player.impostorRole = role;
});
const phantomToken = impostorRoleTokens.find(function (token) { return impostorRoleStore.byToken(token).player.impostorRole === 'PHANTOM'; });
const melterToken = impostorRoleTokens.find(function (token) { return impostorRoleStore.byToken(token).player.impostorRole === 'MELTER'; });
const shifterToken = impostorRoleTokens.find(function (token) { return impostorRoleStore.byToken(token).player.impostorRole === 'SHAPESHIFTER'; });
const impostorCrewToken = impostorRoleTokens.find(function (token) { return impostorRoleStore.byToken(token).player.role === 'CREW'; });
assert(phantomToken && melterToken && shifterToken && impostorCrewToken, 'Impostor special roles are assigned separately');
assert(impostorRoleStore.viewForToken(phantomToken).players.some(function (player) {
  return player.id !== impostorRoleStore.byToken(phantomToken).player.id && player.isImpostorAlly;
}), 'Impostors can identify a nearby impostor teammate when the option is enabled');
const impostorRoleRoom = impostorRoleStore.byToken(impostorRoleHost.token).room;
const phantom = impostorRoleStore.byToken(phantomToken).player;
const impostorCrewViewer = impostorRoleStore.byToken(impostorCrewToken).player;
Object.assign(phantom, { x: impostorCrewViewer.x + 100, y: impostorCrewViewer.y,
  phantomReadyAt: impostorRoleRoom.gameTime });
impostorRoleStore.activatePhantom(phantomToken);
assert(impostorRoleStore.viewForToken(phantomToken).impostorAbility.phantomRemaining > 0);
assert.strictEqual(impostorRoleStore.viewForToken(impostorCrewToken).players.some(function (player) { return player.id === phantom.id; }), false,
  'A vanished phantom is hidden from nearby crew');
const phantomSceneCrew = Array.from(impostorRoleRoom.players.values()).filter(function (player) { return player.isBot && player.role === 'CREW'; });
impostorRoleRoom.players.forEach(function (player) { if (player.id !== phantom.id) Object.assign(player, { x: 26700, y: 15500 }); });
Object.assign(phantom, { x: 15000, y: 8000, killReadyAt: impostorRoleRoom.gameTime });
Object.assign(phantomSceneCrew[0], { x: 15100, y: 8000 });
Object.assign(phantomSceneCrew[1], { x: 15300, y: 8000 });
impostorRoleStore.eliminate(phantomToken, phantomSceneCrew[0].id);
assert(phantom.phantomUntil > impostorRoleRoom.gameTime, 'Phantom remains vanished after an elimination');
assert.notStrictEqual(phantomSceneCrew[1].suspectedImpostorId, phantom.id, 'A witness cannot learn the real ID of a vanished killer');
impostorRoleRoom.bodies = [];
Object.assign(impostorCrewViewer, { x: phantom.x + 300, y: phantom.y });
impostorRoleStore.tick(phantom.phantomUntil - impostorRoleRoom.gameTime + 0.1);
const phantomRevealView = impostorRoleStore.viewForToken(impostorCrewToken).phantomReveals;
assert.strictEqual(phantomRevealView.length > 0, true, 'Nearby crew receive a red phantom reveal marker when vanish expires');
assert.strictEqual(Object.prototype.hasOwnProperty.call(phantomRevealView[0], 'playerId'), false, 'Minimap marker does not expose player ID');
assert.strictEqual(Object.prototype.hasOwnProperty.call(phantomRevealView[0], 'nickname'), false, 'Minimap marker does not expose the Phantom name');
impostorRoleStore.tick(3.1);
assert.strictEqual(impostorRoleStore.viewForToken(impostorCrewToken).phantomReveals.length, 0,
  'Phantom reveal marker expires after three seconds');
Object.assign(phantomSceneCrew[1], { x: 15000, y: 8150 });
impostorRoleRoom.gameTime = 15;
impostorRoleStore.tick(0.1);
assert.strictEqual(impostorRoleRoom.phase, 'MEETING', 'A bot that saw the reveal calls an emergency meeting');
assert.strictEqual(impostorRoleRoom.meeting.type, 'PHANTOM_REVEAL');
const phantomCallerPlan = impostorRoleRoom.meeting.botPlans[phantomSceneCrew[1].id];
impostorRoleRoom.gameTime = phantomCallerPlan.chatAt;
impostorRoleStore.tick(0.01);
assert(impostorRoleRoom.meeting.messages.some(function (message) {
  return message.senderId === phantomSceneCrew[1].id && message.text === phantom.nickname + '이 은신에서 풀리는 걸 봤어.';
}), 'Witness bot names the revealed Phantom in meeting chat');
impostorRoleStore._finishMeeting(impostorRoleRoom);
assert.strictEqual(Array.from(impostorRoleRoom.players.values()).filter(function (player) {
  return player.alive && player.role === 'IMPOSTOR';
}).every(function (player) {
  return player.killReadyAt - impostorRoleRoom.gameTime === 7;
}), true, 'Voting resets every living impostor to a seven-second elimination cooldown');
const shifter = impostorRoleStore.byToken(shifterToken).player;
Object.assign(shifter, { x: impostorCrewViewer.x + 100, y: impostorCrewViewer.y });
impostorRoleStore.disguisePlayer(shifterToken, impostorCrewViewer.id);
const disguisedView = impostorRoleStore.viewForToken(impostorCrewToken).players.find(function (player) { return player.id === shifter.id; });
assert.strictEqual(disguisedView.nickname, impostorCrewViewer.nickname);
assert.strictEqual(disguisedView.color, impostorCrewViewer.color, 'Shapeshifter copies the target name and appearance');
const selfDisguisedView = impostorRoleStore.viewForToken(shifterToken).players.find(function (player) { return player.id === shifter.id; });
assert.strictEqual(selfDisguisedView.nickname, impostorCrewViewer.nickname);
assert.strictEqual(selfDisguisedView.color, impostorCrewViewer.color, 'Shapeshifter sees the copied appearance on their own character');
assert(Array.from(impostorRoleRoom.players.values()).some(function (player) {
  return player.isBot && player.role === 'CREW' && player.shapeshifterWitnessPlayerId === shifter.id;
}), 'A bot crew member in sight remembers the shapeshifter transformation');
const disguiseSceneCrew = Array.from(impostorRoleRoom.players.values()).filter(function (player) {
  return player.isBot && player.role === 'CREW' && player.alive;
});
impostorRoleRoom.players.forEach(function (player) { if (player.id !== shifter.id) Object.assign(player, { x: 26700, y: 15500 }); });
Object.assign(shifter, { x: 15000, y: 8000, killReadyAt: impostorRoleRoom.gameTime });
Object.assign(disguiseSceneCrew[0], { x: 15100, y: 8000 });
Object.assign(disguiseSceneCrew[1], { x: 15300, y: 8000 });
impostorRoleStore.eliminate(shifterToken, disguiseSceneCrew[0].id);
assert.strictEqual(disguiseSceneCrew[1].suspectedImpostorId, impostorCrewViewer.id,
  'A witness remembers the copied crew identity instead of the shapeshifter real ID');
assert.notStrictEqual(disguiseSceneCrew[1].suspectedImpostorId, shifter.id);
impostorRoleRoom.bodies = [];
const melter = impostorRoleStore.byToken(melterToken).player;
const meltVictim = Array.from(impostorRoleRoom.players.values()).find(function (player) {
  return player.isBot && player.role === 'CREW' && player.alive;
});
impostorRoleRoom.players.forEach(function (player) {
  if (player.isBot && player.alive && player.id !== meltVictim.id) Object.assign(player, { x: 26700, y: 15500, botStartDelay: 999 });
});
impostorRoleRoom.gameTime = melter.killReadyAt;
Object.assign(meltVictim, { x: melter.x + 100, y: melter.y });
impostorRoleStore.eliminate(melterToken, meltVictim.id);
assert(impostorRoleRoom.bodies[0].meltAt > impostorRoleRoom.gameTime, 'Melter bodies receive a configured expiration time');
impostorRoleStore.tick(5.1);
assert.strictEqual(impostorRoleRoom.bodies.length, 0, 'A melted body can no longer be seen or reported');

const disguiseReportStore = new LobbyStore();
const disguiseReportHost = disguiseReportStore.create({ nickname: 'CaughtShifter', color: 'magenta' });
disguiseReportStore.start(disguiseReportHost.token);
ensureHumanRole(disguiseReportStore, disguiseReportHost.token, 'IMPOSTOR');
const disguiseReportRoom = disguiseReportStore.byToken(disguiseReportHost.token).room;
const caughtShifter = disguiseReportStore.byToken(disguiseReportHost.token).player;
caughtShifter.impostorRole = 'SHAPESHIFTER';
const disguiseTarget = Array.from(disguiseReportRoom.players.values()).find(function (player) {
  return player.isBot && player.role === 'CREW';
});
const disguiseWitness = Array.from(disguiseReportRoom.players.values()).find(function (player) {
  return player.isBot && player.role === 'CREW' && player.id !== disguiseTarget.id;
});
disguiseReportRoom.gameTime = 15;
Object.assign(caughtShifter, { x: 15000, y: 8150, disguiseReadyAt: 15 });
Object.assign(disguiseTarget, { x: 15100, y: 8150, botStartDelay: 999 });
Object.assign(disguiseWitness, { x: 14900, y: 8150, botStartDelay: 0 });
disguiseReportStore.disguisePlayer(disguiseReportHost.token, disguiseTarget.id);
disguiseReportStore.tick(0.1);
assert.strictEqual(disguiseReportRoom.phase, 'MEETING', 'A bot witness calls a meeting after seeing a transformation');
assert.strictEqual(disguiseReportRoom.meeting.type, 'SHAPESHIFTER_REVEAL');
const disguiseCallerId = disguiseReportRoom.meeting.callerId;
const disguiseWitnessPlan = disguiseReportRoom.meeting.botPlans[disguiseCallerId];
disguiseReportRoom.gameTime = disguiseWitnessPlan.chatAt;
disguiseReportStore.tick(0.01);
assert(disguiseReportRoom.meeting.messages.some(function (message) {
  return message.senderId === disguiseCallerId && message.text === caughtShifter.nickname + '이 다른 크루원으로 변장하는 걸 봤어!';
}), 'The bot witness explains the transformation in meeting chat');

const ventStore = new LobbyStore();
const ventHost = ventStore.create({ nickname: 'VentHost', color: 'maroon' });
const ventGuest = ventStore.join({ code: ventHost.room.code, nickname: 'VentGuest', color: 'cyan' });
ventStore.setReady(ventGuest.token, true);
ventStore.start(ventHost.token);
ensureHumanRole(ventStore, ventHost.token, 'IMPOSTOR');
ensureHumanRole(ventStore, ventGuest.token, 'CREW');
const ventTokens = [ventHost.token, ventGuest.token];
const ventImpostorToken = ventTokens.find(function (token) { return ventStore.byToken(token).player.role === 'IMPOSTOR'; });
const ventCrewToken = ventTokens.find(function (token) { return ventStore.byToken(token).player.role === 'CREW'; });
const sourceVent = gameCore.VENTS[0];
const destinationVent = gameCore.VENTS.find(function (vent) { return vent.id === sourceVent.links[0]; });
Object.assign(ventStore.byToken(ventImpostorToken).player, { x: sourceVent.x, y: sourceVent.y });
ventStore.useVent(ventImpostorToken, sourceVent.id, destinationVent.id);
assert.strictEqual(ventStore.byToken(ventImpostorToken).player.x, destinationVent.x);
assert.strictEqual(ventStore.byToken(ventImpostorToken).player.y, destinationVent.y);
assert(ventStore.viewForToken(ventImpostorToken).ventCooldown > 0);
assert.strictEqual(ventStore.viewForToken(ventImpostorToken).vents.length, gameCore.VENTS.length);
const branchingVent = ventStore.viewForToken(ventImpostorToken).vents.find(function (vent) { return vent.destinations.length > 1; });
assert(branchingVent, 'Branching vents expose every arrow destination');
assert.strictEqual(branchingVent.destinations.length, gameCore.VENTS.find(function (vent) { return vent.id === branchingVent.id; }).links.length);
Object.assign(ventStore.byToken(ventCrewToken).player, { x: sourceVent.x, y: sourceVent.y });
assert.throws(function () { ventStore.useVent(ventCrewToken, sourceVent.id, destinationVent.id); }, /impostor ability/);
assert.strictEqual(ventStore.viewForToken(ventCrewToken).vents.length, 0, 'Crew clients do not receive vent locations');

const spiritStore = new LobbyStore();
const spiritHost = spiritStore.create({ nickname: 'Haunted', color: 'black' });
spiritStore.updateSettings(spiritHost.token, { targetPlayers: 7, impostors: 1, autoFillBots: true });
spiritStore.start(spiritHost.token);
ensureHumanRole(spiritStore, spiritHost.token, 'IMPOSTOR');
const spiritRoom = spiritStore.byToken(spiritHost.token).room;
const spiritImpostor = spiritStore.byToken(spiritHost.token).player;
const spiritVictims = Array.from(spiritRoom.players.values()).filter(function (player) { return player.role === 'CREW'; });
spiritRoom.gameTime = spiritImpostor.killReadyAt;
Object.assign(spiritVictims[0], { x: spiritImpostor.x + 100, y: spiritImpostor.y });
spiritStore.eliminate(spiritHost.token, spiritVictims[0].id);
const firstSpiritDeadline = spiritRoom.spiritReadyAt;
spiritRoom.players.forEach(function (player) {
  if (player.isBot && player.alive) Object.assign(player, { x: 26700, y: 15500, botStartDelay: 999 });
});
spiritStore.tick(10);
spiritImpostor.killReadyAt = spiritRoom.gameTime;
Object.assign(spiritVictims[1], { x: spiritImpostor.x + 100, y: spiritImpostor.y });
spiritStore.eliminate(spiritHost.token, spiritVictims[1].id);
assert(spiritRoom.spiritReadyAt > firstSpiritDeadline, 'Another crew kill resets the spirit timer');
Object.assign(spiritImpostor, { x: 25800, y: 2200 });
spiritStore.tick(gameCore.SPIRIT_DELAY - 0.1);
assert.strictEqual(spiritRoom.spirits.length, 0, 'A spirit does not appear before the reset timer expires');
spiritStore.tick(0.2);
assert.strictEqual(spiritRoom.spirits.length, 1, 'A murdered crew soul becomes a vengeful spirit');
assert(spiritStore.viewForToken(spiritHost.token).spiritAnnouncementRemaining > 0, 'Spirit appearance sends a warning');
const spiritStart = { x: spiritRoom.spirits[0].x, y: spiritRoom.spirits[0].y };
spiritStore.tick(1);
assert(Math.hypot(spiritRoom.spirits[0].x - spiritStart.x, spiritRoom.spirits[0].y - spiritStart.y) > 20,
  'A spirit actively travels toward a distant impostor');
Object.assign(spiritImpostor, { x: 2800, y: 2100 });
const redirectedDistance = Math.hypot(spiritRoom.spirits[0].x - spiritImpostor.x, spiritRoom.spirits[0].y - spiritImpostor.y);
spiritStore.tick(1);
assert(Math.hypot(spiritRoom.spirits[0].x - spiritImpostor.x, spiritRoom.spirits[0].y - spiritImpostor.y) < redirectedDistance,
  'A spirit redirects immediately when the impostor changes position');
Object.assign(spiritRoom.spirits[0], { x: spiritImpostor.x, y: spiritImpostor.y, botPath: [] });
spiritStore.tick(0.1);
assert.strictEqual(spiritImpostor.alive, false, 'A spirit eliminates an impostor it catches');
assert.strictEqual(spiritRoom.spirits.length, 0, 'The spirit disappears after catching an impostor');
assert.strictEqual(spiritRoom.phase, 'ENDED');
assert.strictEqual(spiritRoom.winner, 'CREW');
assert.strictEqual(spiritRoom.spiritAnnouncementUntil, 0, 'Spirit warnings are cleared as soon as the game ends');

const noSpiritStore = new LobbyStore();
const noSpiritHost = noSpiritStore.create({ nickname: 'NoGhosts', color: 'white' });
noSpiritStore.updateSettings(noSpiritHost.token, { targetPlayers: 4, impostors: 1, autoFillBots: true, vengefulSpirits: false });
noSpiritStore.start(noSpiritHost.token);
ensureHumanRole(noSpiritStore, noSpiritHost.token, 'IMPOSTOR');
const noSpiritRoom = noSpiritStore.byToken(noSpiritHost.token).room;
const noSpiritKiller = noSpiritStore.byToken(noSpiritHost.token).player;
const noSpiritVictim = Array.from(noSpiritRoom.players.values()).find(function (player) { return player.role === 'CREW'; });
noSpiritRoom.gameTime = noSpiritKiller.killReadyAt;
Object.assign(noSpiritVictim, { x: noSpiritKiller.x + 100, y: noSpiritKiller.y });
noSpiritStore.eliminate(noSpiritHost.token, noSpiritVictim.id);
assert.strictEqual(noSpiritRoom.murderedCrew.length, 0, 'Disabling spirits prevents soul creation');
assert.strictEqual(noSpiritRoom.spiritReadyAt, Infinity, 'Disabling spirits prevents the appearance timer');

const meetingSpiritStore = new LobbyStore();
const meetingSpiritHost = meetingSpiritStore.create({ nickname: 'TimerReset', color: 'lavender' });
meetingSpiritStore.updateSettings(meetingSpiritHost.token, { targetPlayers: 7, impostors: 1, autoFillBots: true, vengefulSpirits: true });
meetingSpiritStore.start(meetingSpiritHost.token);
ensureHumanRole(meetingSpiritStore, meetingSpiritHost.token, 'IMPOSTOR');
const meetingSpiritRoom = meetingSpiritStore.byToken(meetingSpiritHost.token).room;
const meetingSpiritKiller = meetingSpiritStore.byToken(meetingSpiritHost.token).player;
const meetingSpiritVictim = Array.from(meetingSpiritRoom.players.values()).find(function (player) { return player.role === 'CREW'; });
meetingSpiritRoom.gameTime = meetingSpiritKiller.killReadyAt;
Object.assign(meetingSpiritVictim, { x: meetingSpiritKiller.x + 100, y: meetingSpiritKiller.y });
meetingSpiritStore.eliminate(meetingSpiritHost.token, meetingSpiritVictim.id);
meetingSpiritRoom.gameTime = meetingSpiritRoom.spiritReadyAt - 1;
Object.assign(meetingSpiritKiller, { x: 15000, y: 8150 });
meetingSpiritStore.callEmergencyMeeting(meetingSpiritHost.token);
assert.strictEqual(meetingSpiritRoom.spiritReadyAt, Infinity, 'Calling a meeting cancels the old spirit deadline');
meetingSpiritRoom.meeting.voteEndsAt = meetingSpiritRoom.gameTime + 100;
Object.values(meetingSpiritRoom.meeting.botPlans).forEach(function (plan) {
  plan.at = meetingSpiritRoom.gameTime + 100;
  plan.chatAt = meetingSpiritRoom.gameTime + 100;
});
meetingSpiritStore.tick(31);
assert.strictEqual(meetingSpiritRoom.spirits.length, 0, 'No spirit can spawn while voting or showing results');
if (meetingSpiritRoom.phase === 'MEETING') meetingSpiritStore._finishMeeting(meetingSpiritRoom);
assert.strictEqual(meetingSpiritRoom.phase, 'PLAYING');
assert(meetingSpiritRoom.spiritReadyAt >= meetingSpiritRoom.gameTime + gameCore.SPIRIT_DELAY - 0.2,
  'The full spirit timer starts again only after play resumes');

const missionStore = new LobbyStore();
const missionHost = missionStore.create({ nickname: 'MissionHost', color: 'teal' });
const missionGuest = missionStore.join({ code: missionHost.room.code, nickname: 'MissionGuest', color: 'orange' });
missionStore.setReady(missionGuest.token, true);
missionStore.start(missionHost.token);
const missionTokens = [missionHost.token, missionGuest.token];
const missionCrewToken = missionTokens.find(function (token) { return missionStore.byToken(token).player.role === 'CREW'; });
const missionCrew = missionStore.byToken(missionCrewToken).player;
const firstMissionId = Array.from(missionCrew.assignedTaskIds)[0];
const firstMission = gameCore.TASKS.find(function (task) { return task.id === firstMissionId; });
Object.assign(missionCrew, { x: firstMission.x, y: firstMission.y });
missionStore.completeTask(missionCrewToken, firstMission.id);
missionStore.tick(5.1);
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

console.log('Lobby, vents, smarter bots, ejection, voting, missions and combat tests passed.');

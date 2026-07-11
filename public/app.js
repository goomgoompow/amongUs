'use strict';

const COLORS = ['coral', 'amber', 'mint', 'sky', 'violet', 'rose', 'lime', 'navy', 'white', 'black'];
const state = {
  token: sessionStorage.getItem('station-token'),
  playerId: sessionStorage.getItem('station-player'),
  room: null, color: 'coral', stream: null, keys: new Set(), moving: false
};
const $ = function (selector) { return document.querySelector(selector); };
const sections = { home: $('#home'), lobby: $('#lobby'), game: $('#game') };

function show(name) {
  Object.keys(sections).forEach(function (key) { sections[key].classList.toggle('hidden', key !== name); });
}
function errorAt(selector, message) { $(selector).textContent = message || ''; }

async function api(path, body, token) {
  const response = await fetch(path, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { 'X-Session-Token': token } : {}),
    body: JSON.stringify(body || {})
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

function enter(result) {
  state.token = result.token;
  state.playerId = result.playerId;
  sessionStorage.setItem('station-token', state.token);
  sessionStorage.setItem('station-player', state.playerId);
  connectStream();
  render(result.room);
}

function connectStream() {
  if (state.stream) state.stream.close();
  state.stream = new EventSource('/api/events?token=' + encodeURIComponent(state.token));
  state.stream.addEventListener('room', function (event) { render(JSON.parse(event.data)); });
}

function render(room) {
  state.room = room;
  if (room.phase === 'LOBBY') renderLobby(room);
  else renderGame(room);
}

function renderLobby(room) {
  show('lobby');
  const me = room.players.find(function (p) { return p.id === state.playerId; });
  const isHost = room.hostId === state.playerId;
  $('#display-code').textContent = room.code;
  $('#player-count').textContent = room.players.length + ' / 10';
  $('#settings').classList.toggle('settings-locked', !isHost);
  $('#target-players').value = String(room.settings.targetPlayers);
  $('#impostors').value = String(room.settings.impostors);
  $('#impostors').querySelector('option[value="2"]').disabled = room.settings.targetPlayers < 7;
  $('#auto-bots').checked = room.settings.autoFillBots;
  ['target-players', 'impostors', 'auto-bots'].forEach(function (id) { $('#' + id).disabled = !isHost; });

  $('#players').innerHTML = '';
  room.players.forEach(function (player) {
    const item = document.createElement('li');
    item.innerHTML = '<span class="avatar ' + player.color + '"></span><span class="player-name"></span>' +
      (player.id === room.hostId ? '<span class="host-badge">HOST</span>' : '') +
      (player.isBot ? '<span class="bot-badge">CPU</span>' : '') +
      '<span class="ready-state ' + (player.id === room.hostId || player.ready ? 'is-ready' : '') + '">' +
      (player.id === room.hostId || player.ready ? 'READY' : 'WAITING') + '</span>';
    item.querySelector('.player-name').textContent = player.nickname + (player.id === state.playerId ? ' (YOU)' : '');
    $('#players').appendChild(item);
  });

  $('#ready').classList.toggle('hidden', isHost);
  $('#start').classList.toggle('hidden', !isHost);
  $('#ready').textContent = me && me.ready ? 'CANCEL READY' : 'READY';
  $('#start').disabled = !room.canStart;
  const missing = Math.max(0, room.settings.targetPlayers - room.players.length);
  $('#lobby-status').textContent = isHost
    ? (room.canStart ? (missing && room.settings.autoFillBots ? missing + ' computer players will join on start.' : 'Mission ready to launch.') : 'All human players must be ready.')
    : (me && me.ready ? 'Waiting for the host to start.' : 'Ready up when you are prepared.');
}

function renderGame(room) {
  show('game');
  const me = room.players.find(function (p) { return p.id === state.playerId; });
  const viewport = $('#map').getBoundingClientRect();
  const viewWidth = 3600;
  const scale = viewport.width / viewWidth;
  const viewHeight = viewport.height / scale;
  const cameraX = Math.max(viewWidth / 2, Math.min(room.world.width - viewWidth / 2, me ? me.x : room.world.width / 2));
  const cameraY = Math.max(viewHeight / 2, Math.min(room.world.height - viewHeight / 2, me ? me.y : room.world.height / 2));
  const left = cameraX - viewWidth / 2;
  const top = cameraY - viewHeight / 2;
  const visible = function (x, y, margin) {
    return x >= left - margin && x <= left + viewWidth + margin && y >= top - margin && y <= top + viewHeight + margin;
  };
  const place = function (node, x, y) {
    node.style.left = ((x - left) * scale) + 'px';
    node.style.top = ((y - top) * scale) + 'px';
  };
  $('#role').textContent = room.selfRole || 'CREW';
  $('#role').className = room.selfRole === 'IMPOSTOR' ? 'impostor-role' : 'crew-role';
  $('#game-code').textContent = room.code;
  $('#task-progress').style.width = Math.round(room.taskProgress * 100) + '%';
  $('#personal-tasks').textContent = me ? me.tasksDone + ' / ' + me.taskGoal + ' TASKS' : '';
  $('#position').textContent = me ? 'X ' + Math.round(me.x) + ' / Y ' + Math.round(me.y) : '';
  $('#minimap-player').style.left = (me ? me.x / room.world.width * 100 : 50) + '%';
  $('#minimap-player').style.top = (me ? me.y / room.world.height * 100 : 50) + '%';
  $('#corridors-layer').innerHTML = '';
  room.corridors.forEach(function (corridor) {
    const centerX = corridor.x + corridor.w / 2;
    const centerY = corridor.y + corridor.h / 2;
    if (!visible(centerX, centerY, Math.max(corridor.w, corridor.h))) return;
    const node = document.createElement('div');
    node.className = 'world-corridor';
    node.style.left = ((corridor.x - left) * scale) + 'px';
    node.style.top = ((corridor.y - top) * scale) + 'px';
    node.style.width = (corridor.w * scale) + 'px';
    node.style.height = (corridor.h * scale) + 'px';
    $('#corridors-layer').appendChild(node);
  });
  $('#rooms-layer').innerHTML = '';
  room.rooms.forEach(function (worldRoom) {
    const centerX = worldRoom.x + worldRoom.w / 2;
    const centerY = worldRoom.y + worldRoom.h / 2;
    if (!visible(centerX, centerY, Math.max(worldRoom.w, worldRoom.h))) return;
    const node = document.createElement('div');
    node.className = 'world-room';
    node.style.left = ((worldRoom.x - left) * scale) + 'px';
    node.style.top = ((worldRoom.y - top) * scale) + 'px';
    node.style.width = (worldRoom.w * scale) + 'px';
    node.style.height = (worldRoom.h * scale) + 'px';
    node.textContent = worldRoom.label;
    $('#rooms-layer').appendChild(node);
  });
  $('#players-layer').innerHTML = '';
  room.players.forEach(function (player) {
    if (!visible(player.x, player.y, 300)) return;
    const actor = document.createElement('div');
    actor.className = 'actor ' + player.color + (player.isBot ? ' bot' : '');
    place(actor, player.x, player.y);
    actor.innerHTML = '<i></i><span></span>';
    actor.querySelector('span').textContent = player.nickname + (player.isBot ? ' [CPU]' : '');
    $('#players-layer').appendChild(actor);
  });
  $('#tasks-layer').innerHTML = '';
  room.tasks.forEach(function (task) {
    if (!visible(task.x, task.y, 400)) return;
    const node = document.createElement('div');
    node.className = 'task-node';
    node.dataset.taskId = task.id;
    place(node, task.x, task.y);
    node.innerHTML = '<b>!</b><span></span>';
    node.querySelector('span').textContent = task.label;
    $('#tasks-layer').appendChild(node);
  });
  updateTaskButton(room, me);
  if (room.phase === 'ENDED') {
    $('#result').classList.remove('hidden');
    $('#result-title').textContent = room.winner + ' VICTORY';
    $('#result-message').textContent = room.message;
  }
}

function updateTaskButton(room, me) {
  let nearest = null;
  let nearestDistance = Infinity;
  if (me && room.selfRole === 'CREW' && me.tasksDone < me.taskGoal) {
    room.tasks.forEach(function (task) {
      const d = Math.hypot(me.x - task.x, me.y - task.y);
      if (d < nearestDistance) { nearestDistance = d; nearest = task; }
    });
  }
  $('#do-task').disabled = !nearest || nearestDistance > 520 || room.phase !== 'PLAYING';
  $('#do-task').dataset.taskId = nearest ? nearest.id : '';
}

for (let i = 4; i <= 10; i += 1) {
  const option = document.createElement('option'); option.value = String(i); option.textContent = String(i);
  $('#target-players').appendChild(option);
}
COLORS.forEach(function (color, index) {
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'color-choice ' + color + (index === 0 ? ' selected' : '');
  button.setAttribute('aria-label', color);
  button.addEventListener('click', function () {
    document.querySelectorAll('.color-choice').forEach(function (item) { item.classList.remove('selected'); });
    button.classList.add('selected'); state.color = color;
  });
  $('#colors').appendChild(button);
});

$('#create').addEventListener('click', async function () {
  try { enter(await api('/api/rooms', { nickname: $('#nickname').value, color: state.color })); }
  catch (e) { errorAt('#home-error', e.message); }
});
$('#join').addEventListener('click', async function () {
  try { enter(await api('/api/rooms/join', { code: $('#room-code').value, nickname: $('#nickname').value, color: state.color })); }
  catch (e) { errorAt('#home-error', e.message); }
});
$('#ready').addEventListener('click', async function () {
  const me = state.room.players.find(function (p) { return p.id === state.playerId; });
  try { await api('/api/ready', { ready: !me.ready }, state.token); } catch (e) { errorAt('#lobby-error', e.message); }
});

async function saveSettings() {
  try {
    await api('/api/settings', {
      targetPlayers: Number($('#target-players').value),
      impostors: Number($('#impostors').value),
      autoFillBots: $('#auto-bots').checked
    }, state.token);
  } catch (e) { errorAt('#lobby-error', e.message); }
}
$('#target-players').addEventListener('change', saveSettings);
$('#impostors').addEventListener('change', saveSettings);
$('#auto-bots').addEventListener('change', saveSettings);
$('#start').addEventListener('click', async function () {
  try { await api('/api/start', {}, state.token); } catch (e) { errorAt('#lobby-error', e.message); }
});
$('#copy-code').addEventListener('click', async function () {
  await navigator.clipboard.writeText(state.room.code); $('#copy-code').textContent = 'COPIED';
  setTimeout(function () { $('#copy-code').textContent = 'COPY'; }, 1000);
});
$('#leave').addEventListener('click', async function () {
  try { await api('/api/leave', {}, state.token); } catch (e) {}
  if (state.stream) state.stream.close(); sessionStorage.clear(); location.reload();
});
$('#room-code').addEventListener('input', function (event) {
  event.target.value = event.target.value.toUpperCase().replace(/[^A-Z2-9]/g, '');
});
$('#do-task').addEventListener('click', async function () {
  try { await api('/api/task', { taskId: $('#do-task').dataset.taskId }, state.token); }
  catch (e) { errorAt('#game-error', e.message); }
});

window.addEventListener('keydown', function (event) {
  const key = event.key.toLowerCase();
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].indexOf(key) >= 0) {
    event.preventDefault(); state.keys.add(key);
  }
});
window.addEventListener('keyup', function (event) { state.keys.delete(event.key.toLowerCase()); });
setInterval(async function () {
  if (!state.room || state.room.phase !== 'PLAYING' || state.moving) return;
  let dx = 0; let dy = 0;
  if (state.keys.has('a') || state.keys.has('arrowleft')) dx -= 1;
  if (state.keys.has('d') || state.keys.has('arrowright')) dx += 1;
  if (state.keys.has('w') || state.keys.has('arrowup')) dy -= 1;
  if (state.keys.has('s') || state.keys.has('arrowdown')) dy += 1;
  if (!dx && !dy) return;
  state.moving = true;
  try { await api('/api/move', { dx: dx, dy: dy }, state.token); } catch (e) {}
  state.moving = false;
}, 100);

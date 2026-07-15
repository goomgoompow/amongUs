'use strict';

const COLORS = ['coral', 'amber', 'mint', 'sky', 'violet', 'rose', 'lime', 'navy', 'white', 'black',
  'teal', 'orange', 'magenta', 'cyan', 'brown', 'gray', 'gold', 'lavender', 'olive', 'maroon'];
const state = {
  token: sessionStorage.getItem('station-token'),
  playerId: sessionStorage.getItem('station-player'),
  room: null, color: 'coral', stream: null, keys: new Set(), moving: false,
  meetingId: null, pendingVote: undefined, noticeUntil: 0, selectedVentId: null, trapMonitorOpen: false,
  joiningRoom: false
};
const $ = function (selector) { return document.querySelector(selector); };
const sections = { home: $('#home'), lobby: $('#lobby'), game: $('#game') };
const audio = { context: null, master: null, musicGain: null, started: false,
  muted: localStorage.getItem('station-muted') === 'true', musicMode: null, desiredMusicMode: null,
  musicTimer: null, musicStep: 0 };
const MUSIC_TRACKS = {
  lobby: { interval: 560, sustain: 0.5, type: 'sine', volume: 0.13,
    notes: [220, 277.18, 329.63, 415.3, 246.94, 293.66, 369.99, 440], bass: [110, 123.47] },
  play: { interval: 380, sustain: 0.32, type: 'triangle', volume: 0.105,
    notes: [220, 164.81, 246.94, 185, 220, 174.61, 261.63, 196], bass: [55, 61.74] },
  meeting: { interval: 260, sustain: 0.2, type: 'square', volume: 0.085,
    notes: [196, 233.08, 196, 174.61, 196, 261.63, 233.08, 174.61], bass: [98, 87.31] }
};

function ensureAudio() {
  if (audio.started) {
    if (audio.context && audio.context.state === 'suspended') {
      audio.context.resume().then(function () { restartMusic(); }).catch(function () {});
    } else if (audio.desiredMusicMode && !audio.musicTimer) restartMusic();
    return;
  }
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  audio.context = new AudioContext();
  audio.master = audio.context.createGain();
  audio.master.gain.value = audio.muted ? 0 : 0.82;
  audio.master.connect(audio.context.destination);
  audio.musicGain = audio.context.createGain();
  audio.musicGain.gain.value = 0.78;
  audio.musicGain.connect(audio.master);
  audio.started = true;
  audio.context.onstatechange = updateSoundButtons;
  if (audio.context.state === 'suspended') {
    audio.context.resume().then(function () { restartMusic(); updateSoundButtons(); }).catch(updateSoundButtons);
  } else { restartMusic(); updateSoundButtons(); }
}

function tone(frequency, duration, offset, type, volume, endFrequency) {
  if (!audio.started || audio.muted) return;
  const now = audio.context.currentTime + (offset || 0);
  const oscillator = audio.context.createOscillator();
  const gain = audio.context.createGain();
  oscillator.type = type || 'sine';
  oscillator.frequency.setValueAtTime(frequency, now);
  if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, now + duration);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume || 0.12, now + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.connect(gain); gain.connect(audio.master);
  oscillator.start(now); oscillator.stop(now + duration + 0.03);
}

function noise(duration, volume) {
  if (!audio.started || audio.muted) return;
  const length = Math.floor(audio.context.sampleRate * duration);
  const buffer = audio.context.createBuffer(1, length, audio.context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const source = audio.context.createBufferSource();
  const gain = audio.context.createGain();
  source.buffer = buffer; gain.gain.value = volume || 0.08;
  source.connect(gain); gain.connect(audio.master); source.start();
}

function musicTone(frequency, type, volume, sustain) {
  if (!audio.started || audio.muted || !audio.musicGain) return;
  const now = audio.context.currentTime;
  const oscillator = audio.context.createOscillator();
  const gain = audio.context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + sustain);
  oscillator.connect(gain); gain.connect(audio.musicGain);
  oscillator.start(now); oscillator.stop(now + sustain + 0.03);
}

function musicKick(volume) {
  if (!audio.started || audio.muted || !audio.musicGain) return;
  const now = audio.context.currentTime;
  const oscillator = audio.context.createOscillator();
  const gain = audio.context.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(105, now);
  oscillator.frequency.exponentialRampToValueAtTime(42, now + 0.16);
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
  oscillator.connect(gain); gain.connect(audio.musicGain);
  oscillator.start(now); oscillator.stop(now + 0.2);
}

function restartMusic() {
  if (audio.musicTimer) clearInterval(audio.musicTimer);
  audio.musicTimer = null;
  audio.musicMode = audio.desiredMusicMode;
  audio.musicStep = 0;
  const track = MUSIC_TRACKS[audio.musicMode];
  if (!audio.started || !track || audio.context.state !== 'running') return;
  function pulse() {
    const note = track.notes[audio.musicStep % track.notes.length];
    musicTone(note, track.type, track.volume, track.sustain);
    if (audio.musicStep % 2 === 0) {
      const bass = track.bass[Math.floor(audio.musicStep / 4) % track.bass.length];
      musicTone(bass, 'sine', track.volume * 0.82, Math.min(0.7, track.sustain * 1.7));
      musicKick(track.volume * 0.7);
    }
    if (audio.musicStep % 4 === 0) musicTone(note * 1.5, 'sine', track.volume * 0.38, track.sustain * 1.8);
    audio.musicStep += 1;
  }
  pulse();
  audio.musicTimer = setInterval(pulse, track.interval);
}

function setMusicMode(mode) {
  if (audio.desiredMusicMode === mode) return;
  audio.desiredMusicMode = mode;
  if (audio.started && audio.context.state === 'running') restartMusic();
}

function updateSoundButtons() {
  const running = audio.started && audio.context && audio.context.state === 'running';
  const label = audio.muted ? 'SOUND OFF' : (running ? 'MUSIC ON' : (audio.started ? 'RESUME MUSIC' : 'START MUSIC'));
  ['#home-sound-toggle', '#sound-toggle', '#lobby-sound-toggle'].forEach(function (selector) {
    const button = $(selector);
    if (!button) return;
    button.textContent = label;
    button.classList.toggle('is-playing', running && !audio.muted);
  });
}

function playSound(name) {
  if (!audio.started || audio.muted) return;
  if (name === 'meeting') { noise(0.3, 0.08); tone(620, .22, 0, 'square', .16, 420); tone(620, .22, .35, 'square', .16, 420); }
  else if (name === 'report') { tone(180, .7, 0, 'sawtooth', .16, 70); noise(.45, .1); }
  else if (name === 'spirit') { tone(95, 1.4, 0, 'sawtooth', .13, 38); tone(760, .8, .2, 'sine', .08, 220); }
  else if (name === 'eject') { tone(420, 1.5, 0, 'sine', .12, 55); }
  else if (name === 'victory') { [330, 440, 550, 660].forEach(function (f, i) { tone(f, .35, i * .18, 'triangle', .11); }); }
  else if (name === 'start') { tone(220, .35, 0, 'triangle', .1, 440); tone(440, .4, .25, 'triangle', .1, 660); }
  else if (name === 'danger') { tone(110, .45, 0, 'square', .1, 75); }
}
function normalizeRoomCode(value) {
  return String(value || '').normalize('NFKC').toUpperCase().replace(/[^ABCDEFGHJKLMNPQRSTUVWXYZ23456789]/g, '').slice(0, 6);
}

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

async function getJson(path) {
  const response = await fetch(path, { headers: { 'Accept': 'application/json' }, cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

function renderOpenRooms(rooms) {
  const list = $('#open-rooms');
  list.innerHTML = '';
  if (!rooms.length) {
    const empty = document.createElement('p');
    empty.textContent = '현재 입장 가능한 방이 없습니다. 새 방을 만들어 보세요.';
    list.appendChild(empty);
    return;
  }
  rooms.forEach(function (room) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'open-room';
    button.dataset.roomCode = room.code;
    const info = document.createElement('span');
    const title = document.createElement('strong');
    const detail = document.createElement('span');
    const enter = document.createElement('b');
    title.textContent = room.hostName + '님의 방';
    detail.textContent = room.players + ' / ' + room.targetPlayers + '명 · 임포스터 ' + room.impostors + '명';
    enter.textContent = '입장';
    info.appendChild(title); info.appendChild(detail);
    button.appendChild(info); button.appendChild(enter);
    list.appendChild(button);
  });
}

async function refreshOpenRooms() {
  if ($('#home').classList.contains('hidden')) return;
  try {
    const result = await getJson('/api/rooms/open');
    renderOpenRooms(result.rooms || []);
  } catch (error) {
    $('#open-rooms').innerHTML = '<p>방 목록을 불러오지 못했습니다.</p>';
  }
}

async function joinOpenRoom(code) {
  if (state.joiningRoom) return;
  state.joiningRoom = true;
  try {
    enter(await api('/api/rooms/join', { code: code, nickname: $('#nickname').value, color: state.color }));
  } catch (error) {
    errorAt('#home-error', error.message);
    state.joiningRoom = false;
    refreshOpenRooms();
  }
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
  const previousRoom = state.room;
  const returnedFromMeeting = previousRoom && previousRoom.phase === 'MEETING' && room.phase === 'PLAYING';
  if (returnedFromMeeting && isTypingTarget(document.activeElement) && $('#meeting').contains(document.activeElement)) {
    document.activeElement.blur();
  }
  state.room = room;
  setMusicMode(room.phase === 'LOBBY' ? 'lobby' : (room.phase === 'MEETING' ? 'meeting'
    : (room.phase === 'PLAYING' ? 'play' : null)));
  if (room.phase !== 'PLAYING') state.keys.clear();
  if (previousRoom) {
    if (room.phase === 'MEETING' && (!previousRoom.meeting || previousRoom.meeting.id !== room.meeting.id)) {
      playSound(room.meeting.type === 'BODY_REPORT' ? 'report' : 'meeting');
    }
    if (room.phase === 'MEETING' && room.meeting.stage === 'EJECTION' &&
        (!previousRoom.meeting || previousRoom.meeting.stage !== 'EJECTION')) playSound('eject');
    if (room.spiritAnnouncementRemaining > 0 && !(previousRoom.spiritAnnouncementRemaining > 0)) playSound('spirit');
    if (room.phase === 'ENDED' && previousRoom.phase !== 'ENDED') playSound('victory');
    if (room.phase === 'PLAYING' && previousRoom.phase === 'LOBBY') playSound('start');
    if ((room.bodies || []).length > (previousRoom.bodies || []).length) playSound('danger');
    if ((room.phantomReveals || []).length > (previousRoom.phantomReveals || []).length) playSound('danger');
  }
  if (returnedFromMeeting) state.noticeUntil = Date.now() + 2500;
  if (room.phase === 'LOBBY') renderLobby(room);
  else if (room.phase === 'MEETING') renderMeeting(room);
  else renderGame(room);
}

function renderMeeting(room) {
  state.trapMonitorOpen = false;
  $('#trap-monitor').classList.add('hidden');
  if (state.meetingId !== room.meeting.id) {
    state.meetingId = room.meeting.id;
    state.pendingVote = undefined;
  }
  show('game');
  $('#result').classList.add('hidden');
  $('#role-reveal').classList.add('hidden');
  if (room.meeting.stage === 'EJECTION') {
    const ejected = room.players.find(function (player) { return room.meeting.result && player.id === room.meeting.result.ejectedId; });
    $('#meeting').classList.add('hidden');
    $('#ejection').classList.remove('hidden');
    $('#ejection-character').className = 'ejection-character ' + (ejected ? ejected.color : 'gray');
    $('#ejection-title').textContent = room.meeting.result.ejectedName + ' 방출';
    $('#ejection-role').textContent = room.meeting.result.ejectedName + (room.meeting.result.wasImpostor
      ? '은 임포스터였습니다.' : '은 임포스터가 아니었습니다.');
    $('#ejection-timer').textContent = Math.ceil(room.meeting.resultRemaining);
    return;
  }
  $('#ejection').classList.add('hidden');
  $('#meeting').classList.remove('hidden');
  const result = room.meeting.result;
  $('#meeting-title').textContent = room.meeting.stage === 'RESULT' ? 'VOTE RESULT'
    : (room.meeting.type === 'BODY_REPORT' ? 'BODY REPORTED'
      : (room.meeting.type === 'PHANTOM_REVEAL' ? 'PHANTOM WITNESSED' : 'EMERGENCY MEETING'));
  let detail = room.meeting.type === 'BODY_REPORT'
    ? room.meeting.callerName + ' reported ' + room.meeting.reportedName + '.'
    : (room.meeting.type === 'PHANTOM_REVEAL' ? room.meeting.callerName + ' witnessed a Phantom becoming visible.'
      : room.meeting.callerName + ' called everyone together.');
  if (result) {
    if (result.status === 'EJECTED') detail = result.ejectedName + (result.wasImpostor
      ? '은 임포스터였습니다.' : '은 임포스터가 아니었습니다.');
    else if (result.status === 'INSUFFICIENT_PARTICIPATION') detail = 'Meeting canceled: not enough players voted.';
    else if (result.status === 'TIE') detail = 'No one was ejected because the vote was tied.';
    else if (result.status === 'SKIPPED') detail = 'The crew voted to skip.';
    else detail = 'No one was ejected.';
  }
  $('#meeting-detail').textContent = detail;
  $('#meeting-timer').textContent = Math.ceil(room.meeting.stage === 'RESULT' ? room.meeting.resultRemaining : room.meeting.votingRemaining);
  $('#meeting-participation').textContent = room.meeting.participation + ' / ' + room.meeting.eligibleVoters + ' participated';
  $('#meeting-rule').textContent = '방출 조건: 최소 ' + room.meeting.ejectThreshold + '표 + 투표 참여자 과반수';
  const messages = $('#meeting-messages');
  messages.innerHTML = '';
  (room.meeting.messages || []).forEach(function (message) {
    const line = document.createElement('p');
    line.className = message.isBot ? 'bot-message' : '';
    const name = document.createElement('b');
    name.className = message.color;
    name.textContent = message.senderName + (message.isBot ? ' [CPU]' : '');
    const copy = document.createElement('span');
    copy.textContent = message.text;
    line.append(name, copy);
    messages.appendChild(line);
  });
  messages.scrollTop = messages.scrollHeight;
  $('#meeting-chat-input').disabled = room.meeting.stage !== 'VOTING' || !room.selfAlive;
  let voteLabel = '';
  if (room.meeting.hasVoted) {
    const selected = room.meeting.ownVote ? room.players.find(function (player) { return player.id === room.meeting.ownVote; }) : null;
    voteLabel = 'VOTE SUBMITTED: ' + (selected ? selected.nickname : 'SKIP');
  } else if (state.pendingVote !== undefined) {
    const pending = state.pendingVote ? room.players.find(function (player) { return player.id === state.pendingVote; }) : null;
    voteLabel = 'SUBMITTING VOTE: ' + (pending ? pending.nickname : 'SKIP');
  } else if (room.meeting.stage === 'VOTING' && room.selfAlive) {
    voteLabel = 'SELECT A PLAYER OR SKIP';
  }
  $('#vote-status').textContent = voteLabel;
  $('#vote-status').classList.toggle('submitted', room.meeting.hasVoted);
  $('#meeting-roster').innerHTML = '';
  room.players.forEach(function (player) {
    const item = document.createElement('button');
    item.type = 'button';
    item.dataset.voteTarget = player.id;
    item.className = 'meeting-player ' + (!player.alive ? 'eliminated' : '');
    const selectedVote = room.meeting.stage === 'RESULT' && result ? result.ejectedId
      : (room.meeting.hasVoted ? room.meeting.ownVote : state.pendingVote);
    if (selectedVote === player.id) item.classList.add('selected-vote');
    item.innerHTML = '<i class="' + player.color + '"></i><span></span><b></b>';
    item.querySelector('span').textContent = player.nickname;
    const voteCount = result && result.tally ? (result.tally[player.id] || 0) : null;
    item.querySelector('b').textContent = voteCount !== null ? voteCount + ' VOTES'
      : (player.alive ? (player.isBot ? 'CPU' : 'VOTE') : 'ELIMINATED');
    item.disabled = room.meeting.stage !== 'VOTING' || room.meeting.hasVoted || state.pendingVote !== undefined || !room.selfAlive || !player.alive;
    $('#meeting-roster').appendChild(item);
  });
  $('#vote-skip').classList.toggle('hidden', room.meeting.stage !== 'VOTING');
  $('#vote-skip').disabled = room.meeting.hasVoted || state.pendingVote !== undefined || !room.selfAlive;
  $('#vote-skip').classList.toggle('selected-vote', (room.meeting.hasVoted ? room.meeting.ownVote : state.pendingVote) === null);
  if (result && result.tally && result.tally.SKIP) $('#meeting-participation').textContent += ' / SKIP ' + result.tally.SKIP;
}

async function submitVote(targetId) {
  if (!state.room || !state.room.meeting || state.room.meeting.hasVoted || state.pendingVote !== undefined) return;
  state.pendingVote = targetId;
  renderMeeting(state.room);
  try { await api('/api/meeting/vote', { targetId: targetId }, state.token); }
  catch (e) { state.pendingVote = undefined; errorAt('#game-error', e.message); renderMeeting(state.room); }
}

function renderLobby(room) {
  show('lobby');
  updateSoundButtons();
  sessionStorage.removeItem('role-seen-' + room.code);
  const me = room.players.find(function (p) { return p.id === state.playerId; });
  const isHost = room.hostId === state.playerId;
  $('#display-code').textContent = room.code;
  $('#player-count').textContent = room.players.length + ' / 20';
  $('#settings').classList.toggle('settings-locked', !isHost);
  $('#target-players').value = String(room.settings.targetPlayers);
  $('#impostors').value = String(room.settings.impostors);
  $('#impostors').querySelector('option[value="2"]').disabled = room.settings.targetPlayers < 7;
  $('#impostors').querySelector('option[value="3"]').disabled = room.settings.targetPlayers < 11;
  $('#impostors').querySelector('option[value="4"]').disabled = room.settings.targetPlayers < 16;
  $('#auto-bots').checked = room.settings.autoFillBots;
  $('#vengeful-spirits').checked = room.settings.vengefulSpirits !== false;
  $('#reveal-impostors').checked = room.settings.revealImpostors !== false;
  $('#phantom-duration').value = room.settings.phantomDuration;
  $('#melt-delay').value = room.settings.meltDelay;
  $('#disguise-duration').value = room.settings.disguiseDuration;
  $('#disguise-cooldown').value = room.settings.disguiseCooldown;
  ['target-players', 'impostors', 'auto-bots', 'vengeful-spirits', 'reveal-impostors', 'phantom-duration', 'melt-delay',
    'disguise-duration', 'disguise-cooldown'].forEach(function (id) { $('#' + id).disabled = !isHost; });

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
  $('#meeting').classList.add('hidden');
  $('#ejection').classList.add('hidden');
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
  $('#role').textContent = room.selfIsGhost ? 'CREW GHOST / TASKS REMAIN'
    : ((room.selfRole === 'CREW' ? (room.selfCrewRole || 'CREWMATE')
      : (room.selfImpostorRole || room.selfRole || 'CREW')) +
      (room.selfAlive ? ' / ALIVE' : ' / ELIMINATED'));
  $('#role').className = room.selfRole === 'IMPOSTOR' ? 'impostor-role' : 'crew-role';
  $('#game-code').textContent = room.code;
  updateSoundButtons();
  $('#task-progress').style.width = Math.round(room.taskProgress * 100) + '%';
  $('#task-count').textContent = room.tasksCompleted + ' / ' + room.totalTasks;
  $('#personal-tasks').textContent = me ? me.tasksDone + ' / ' + me.taskGoal + ' TASKS' : '';
  $('#position').textContent = me ? 'X ' + Math.round(me.x) + ' / Y ' + Math.round(me.y) : '';
  updateCooldownCountdown(room);
  const showNotice = room.phase === 'PLAYING' && Date.now() < state.noticeUntil;
  $('#game-notice').classList.toggle('hidden', !showNotice);
  $('#game-notice').textContent = showNotice ? '임포스터가 ' + room.impostorsRemaining + '명 있습니다.' : '';
  renderMinimap(room, me, left, top, viewWidth, viewHeight);
  if (room.emergencyStation) {
    $('#emergency-console').classList.remove('hidden');
    place($('#emergency-console'), room.emergencyStation.x, room.emergencyStation.y);
  } else {
    $('#emergency-console').classList.add('hidden');
  }
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
  $('#doors-layer').innerHTML = '';
  room.doors.forEach(function (door) {
    const centerX = door.x + door.w / 2;
    const centerY = door.y + door.h / 2;
    if (!visible(centerX, centerY, 500)) return;
    const node = document.createElement('div');
    node.className = 'world-door ' + (door.closed ? 'closed' : 'open');
    node.style.left = ((door.x - left) * scale) + 'px';
    node.style.top = ((door.y - top) * scale) + 'px';
    node.style.width = (door.w * scale) + 'px';
    node.style.height = (door.h * scale) + 'px';
    node.textContent = door.closed ? Math.ceil(door.remaining) : '';
    $('#doors-layer').appendChild(node);
  });
  $('#traps-layer').innerHTML = '';
  (room.traps || []).forEach(function (trap) {
    if (!visible(trap.x, trap.y, 300)) return;
    const node = document.createElement('div');
    node.className = 'engineer-trap';
    place(node, trap.x, trap.y);
    node.innerHTML = '<i></i><span>TRAP</span>';
    $('#traps-layer').appendChild(node);
  });
  $('#bodies-layer').innerHTML = '';
  room.bodies.forEach(function (body) {
    if (!visible(body.x, body.y, 350)) return;
    const node = document.createElement('div');
    node.className = 'body-marker ' + body.color;
    place(node, body.x, body.y);
    node.innerHTML = '<i></i><span></span>';
    node.querySelector('span').textContent = body.nickname;
    $('#bodies-layer').appendChild(node);
  });
  $('#spirits-layer').innerHTML = '';
  (room.spirits || []).forEach(function (spirit) {
    if (!visible(spirit.x, spirit.y, 400)) return;
    const node = document.createElement('div');
    node.className = 'vengeful-spirit';
    place(node, spirit.x, spirit.y);
    node.innerHTML = '<i><b></b><b></b></i><em></em><span></span>';
    node.querySelector('span').textContent = spirit.nickname + '의 악령';
    $('#spirits-layer').appendChild(node);
  });
  $('#spirit-warning').classList.toggle('hidden', room.phase !== 'PLAYING' || !(room.spiritAnnouncementRemaining > 0));
  const visiblePlayerIds = new Set();
  room.players.forEach(function (player) {
    if ((!player.alive && !player.isGhost) || !visible(player.x, player.y, 300)) return;
    visiblePlayerIds.add(player.id);
    let actor = $('#players-layer').querySelector('[data-player-id="' + player.id + '"]');
    if (!actor) {
      actor = document.createElement('div');
      actor.dataset.playerId = player.id;
      actor.innerHTML = '<b class="oxygen-tank"></b><i class="suit-body"></i><em class="suit-legs"><u></u><u></u></em><span></span>';
      $('#players-layer').appendChild(actor);
    }
    actor.className = 'actor facing-' + (player.facing || 'down') + ' ' + player.color +
      (player.isBot ? ' bot' : '') + (player.moving ? ' moving' : '') +
      (player.isGhost ? ' ghost' : '') + (player.isPhantomActive ? ' phantom-active' : '') +
      (player.isImpostorAlly ? ' impostor-ally' : '');
    place(actor, player.x, player.y);
    actor.querySelector('span').textContent = player.nickname + (player.isBot ? ' [CPU]' : '') +
      (player.isGhost ? ' [GHOST]' : '');
  });
  Array.from($('#players-layer').children).forEach(function (actor) {
    if (!visiblePlayerIds.has(actor.dataset.playerId)) actor.remove();
  });
  $('#vents-layer').innerHTML = '';
  room.vents.forEach(function (vent) {
    if (!visible(vent.x, vent.y, 350)) return;
    const node = document.createElement('div');
    node.className = 'vent-node';
    place(node, vent.x, vent.y);
    node.innerHTML = '<i></i><span>VENT</span>';
    $('#vents-layer').appendChild(node);
    if (!me || state.selectedVentId !== vent.id || Math.hypot(me.x - vent.x, me.y - vent.y) > 520 || room.ventCooldown > 0) return;
    (vent.destinations || []).forEach(function (destination) {
      const dx = destination.x - vent.x;
      const dy = destination.y - vent.y;
      const length = Math.hypot(dx, dy) || 1;
      const arrow = document.createElement('button');
      arrow.type = 'button';
      arrow.className = 'vent-destination';
      arrow.dataset.ventId = vent.id;
      arrow.dataset.destinationId = destination.id;
      arrow.style.left = ((vent.x - left) * scale + dx / length * 105) + 'px';
      arrow.style.top = ((vent.y - top) * scale + dy / length * 80) + 'px';
      arrow.innerHTML = '<b aria-hidden="true">➜</b><span></span>';
      arrow.querySelector('b').style.transform = 'rotate(' + Math.atan2(dy, dx) + 'rad)';
      arrow.querySelector('span').textContent = destination.room;
      async function travelToVent(event) {
        event.preventDefault();
        if (arrow.dataset.traveling === 'true') return;
        arrow.dataset.traveling = 'true';
        try {
          state.selectedVentId = null;
          await api('/api/vent', { ventId: vent.id, destinationId: destination.id }, state.token);
        }
        catch (e) { arrow.dataset.traveling = 'false'; errorAt('#game-error', e.message); }
      }
      arrow.addEventListener('pointerdown', travelToVent);
      arrow.addEventListener('click', travelToVent);
      $('#vents-layer').appendChild(arrow);
    });
  });
  $('#tasks-layer').innerHTML = '';
  room.tasks.forEach(function (task) {
    if (room.selfCompletedTaskIds.indexOf(task.id) >= 0) return;
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
  updateDoorButtons(room, me);
  updateAttackButton(room, me);
  updateVentButton(room, me);
  updateMeetingButtons(room, me);
  updateCrewAbility(room, me);
  updateImpostorAbility(room);
  const phantomActive = Boolean(room.impostorAbility && room.impostorAbility.role === 'PHANTOM' &&
    room.impostorAbility.phantomRemaining > 0);
  $('#phantom-veil').classList.toggle('hidden', !phantomActive);
  renderTrapMonitor(room);
  revealRole(room);
  $('#map').style.setProperty('--vision-size', Math.max(500, room.visionRadius * scale * 2) + 'px');
  if (room.phase === 'ENDED') {
    const resultPanel = $('#result');
    const impostorVictory = room.winner === 'IMPOSTOR';
    resultPanel.classList.remove('hidden');
    resultPanel.classList.toggle('impostor-victory', impostorVictory);
    resultPanel.classList.toggle('crew-victory', !impostorVictory);
    $('#result-title').textContent = impostorVictory ? 'IMPOSTOR VICTORY' : 'CREW VICTORY';
    $('#result-message').textContent = room.message;
    const isHost = room.hostId === state.playerId;
    $('#rematch').classList.toggle('hidden', !isHost);
    $('#rematch-status').textContent = isHost ? 'Return everyone to the lobby for another round.' : 'Waiting for the host to start another round.';
  } else {
    $('#result').classList.add('hidden');
    $('#result').classList.remove('impostor-victory', 'crew-victory');
  }
}

function renderMinimap(room, me, cameraLeft, cameraTop, viewWidth, viewHeight) {
  const terrain = $('#minimap-terrain');
  terrain.innerHTML = '';
  function addRect(className, item) {
    const node = document.createElement('i');
    node.className = className;
    node.style.left = (item.x / room.world.width * 100) + '%';
    node.style.top = (item.y / room.world.height * 100) + '%';
    node.style.width = (item.w / room.world.width * 100) + '%';
    node.style.height = (item.h / room.world.height * 100) + '%';
    terrain.appendChild(node);
  }
  room.corridors.forEach(function (corridor) { addRect('mini-corridor', corridor); });
  room.rooms.forEach(function (worldRoom) { addRect('mini-room', worldRoom); });
  room.doors.filter(function (door) { return door.closed; }).forEach(function (door) { addRect('mini-door', door); });
  room.tasks.forEach(function (task) {
    if (room.selfCompletedTaskIds.indexOf(task.id) >= 0) return;
    const node = document.createElement('b');
    node.className = 'mini-task';
    node.style.left = (task.x / room.world.width * 100) + '%';
    node.style.top = (task.y / room.world.height * 100) + '%';
    terrain.appendChild(node);
  });
  room.vents.forEach(function (vent) {
    const node = document.createElement('b');
    node.className = 'mini-vent';
    node.style.left = (vent.x / room.world.width * 100) + '%';
    node.style.top = (vent.y / room.world.height * 100) + '%';
    terrain.appendChild(node);
  });
  if (room.crewAbility && room.crewAbility.tracking) {
    const tracked = room.crewAbility.tracking;
    const node = document.createElement('b');
    node.className = 'mini-tracked ' + (tracked.alive ? 'alive' : 'dead');
    node.style.left = (tracked.x / room.world.width * 100) + '%';
    node.style.top = (tracked.y / room.world.height * 100) + '%';
    node.title = tracked.nickname + (tracked.alive ? ' / ALIVE' : ' / DEAD');
    terrain.appendChild(node);
  }
  (room.phantomReveals || []).forEach(function (reveal) {
    const node = document.createElement('b');
    node.className = 'mini-phantom-reveal';
    node.style.left = (reveal.x / room.world.width * 100) + '%';
    node.style.top = (reveal.y / room.world.height * 100) + '%';
    node.title = 'PHANTOM REVEAL LOCATION';
    terrain.appendChild(node);
  });
  $('#minimap-player').style.left = (me ? me.x / room.world.width * 100 : 50) + '%';
  $('#minimap-player').style.top = (me ? me.y / room.world.height * 100 : 50) + '%';
  $('#minimap-view').style.left = (cameraLeft / room.world.width * 100) + '%';
  $('#minimap-view').style.top = (cameraTop / room.world.height * 100) + '%';
  $('#minimap-view').style.width = (viewWidth / room.world.width * 100) + '%';
  $('#minimap-view').style.height = (viewHeight / room.world.height * 100) + '%';
}

function updateVentButton(room, me) {
  let nearest = null;
  let nearestDistance = Infinity;
  room.vents.forEach(function (vent) {
    const d = Math.hypot(me.x - vent.x, me.y - vent.y);
    if (d < nearestDistance) { nearestDistance = d; nearest = vent; }
  });
  $('#vent').classList.toggle('hidden', room.selfRole !== 'IMPOSTOR');
  $('#vent').disabled = room.selfRole !== 'IMPOSTOR' || !room.selfAlive || !nearest || nearestDistance > 520 || room.ventCooldown > 0;
  $('#vent').dataset.ventId = nearest ? nearest.id : '';
  $('#vent').dataset.destinationId = nearest ? nearest.destinationId : '';
  if (!nearest || nearestDistance > 520) state.selectedVentId = null;
  $('#vent').textContent = room.ventCooldown > 0 ? 'VENT ' + Math.ceil(room.ventCooldown)
    : (state.selectedVentId ? 'CLOSE VENT ROUTES' : (nearest && nearestDistance <= 520 ? 'CHOOSE VENT' : 'VENT'));
}

function updateMeetingButtons(room, me) {
  let nearestBody = null;
  let nearestDistance = Infinity;
  room.bodies.forEach(function (body) {
    const d = Math.hypot(me.x - body.x, me.y - body.y);
    if (d < nearestDistance) { nearestDistance = d; nearestBody = body; }
  });
  $('#report').disabled = !room.selfAlive || !nearestBody || nearestDistance > 1100 || room.phase !== 'PLAYING';
  $('#report').dataset.bodyId = nearestBody ? nearestBody.id : '';
  const station = room.emergencyStation;
  const stationDistance = station ? Math.hypot(me.x - station.x, me.y - station.y) : Infinity;
  $('#emergency').disabled = !room.selfAlive || !station || stationDistance > station.radius ||
    room.emergencyMeetingsLeft < 1 || room.phase !== 'PLAYING';
  $('#emergency').textContent = room.emergencyMeetingsLeft > 0 ? 'EMERGENCY (' + room.emergencyMeetingsLeft + ')' : 'EMERGENCY USED';
}

function updateCrewAbility(room) {
  const ability = room.crewAbility;
  const panel = $('#crew-ability');
  panel.classList.toggle('hidden', !ability || ability.role === 'CREWMATE' || !room.selfAlive || room.phase !== 'PLAYING');
  if (!ability || ability.role === 'CREWMATE') return;
  $('#crew-role').textContent = ability.role;
  const select = $('#ability-target');
  syncTargetSelect(select, ability.targets, 'SELECT PLAYER');
  select.classList.toggle('hidden', ability.role === 'ENGINEER');
  $('#place-trap').classList.toggle('hidden', ability.role !== 'ENGINEER');
  $('#view-trap').classList.toggle('hidden', ability.role !== 'ENGINEER');
  $('#track-player').classList.toggle('hidden', ability.role !== 'TRACKER');
  $('#detect-player').classList.toggle('hidden', ability.role !== 'DETECTIVE');
  $('#place-trap').disabled = ability.trapActive || ability.trapCooldown > 0;
  $('#view-trap').disabled = !ability.trapActive;
  $('#track-player').disabled = !select.value || ability.trackCooldown > 0;
  $('#detect-player').disabled = !select.value || ability.detectCooldown > 0;
  let info = '';
  if (ability.role === 'ENGINEER') {
    if (ability.trapActive) info = 'Trap active in this area.';
    else if (ability.trapCooldown > 0) info = 'Trap cooldown ' + Math.ceil(ability.trapCooldown) + 's';
    const snapshot = ability.snapshots[ability.snapshots.length - 1];
    if (snapshot) info = 'SNAPSHOT: ' + snapshot.room + ' / ' + snapshot.victimName + ' eliminated / nearby: ' +
      snapshot.people.map(function (person) { return person.nickname; }).join(', ');
  } else if (ability.role === 'TRACKER') {
    if (ability.tracking) info = 'Tracking ' + ability.tracking.nickname + ': ' + (ability.tracking.alive ? 'ALIVE' : 'DEAD');
    if (ability.trackCooldown > 0) info += ' / switch in ' + Math.ceil(ability.trackCooldown) + 's';
  } else if (ability.role === 'DETECTIVE') {
    if (ability.detectCooldown > 0) info = 'Detect cooldown ' + Math.ceil(ability.detectCooldown) + 's';
    const result = ability.investigations[ability.investigations.length - 1];
    if (result) info += (info ? ' / ' : '') + result.nickname + ' is ' + result.identity;
  }
  $('#ability-info').textContent = info;
}

function updateCooldownCountdown(room) {
  const cooldowns = [];
  function add(label, remaining) {
    if (remaining > 0 && remaining <= 3) cooldowns.push({ label: label, remaining: remaining });
  }
  add('ELIMINATE', room.killCooldown);
  add('VENT', room.ventCooldown);
  add('LOCKDOWN', room.sabotageCooldown);
  if (room.crewAbility) {
    add('TRAP', room.crewAbility.trapCooldown);
    add('TRACK', room.crewAbility.trackCooldown);
    add('DETECT', room.crewAbility.detectCooldown);
  }
  if (room.impostorAbility) {
    add('VANISH', room.impostorAbility.phantomCooldown);
    add('DISGUISE', room.impostorAbility.disguiseCooldown);
  }
  cooldowns.sort(function (a, b) { return a.remaining - b.remaining; });
  const current = cooldowns[0];
  const node = $('#cooldown-countdown');
  node.classList.toggle('hidden', !current || room.phase !== 'PLAYING');
  node.textContent = current ? current.label + ' 사용 가능 ' + Math.max(1, Math.ceil(current.remaining)) + '초' : '';
}

function renderTrapMonitor(room) {
  const view = room.crewAbility && room.crewAbility.trapView;
  if (!state.trapMonitorOpen || !view || room.phase !== 'PLAYING') {
    $('#trap-monitor').classList.add('hidden');
    if (!view) state.trapMonitorOpen = false;
    return;
  }
  $('#trap-monitor').classList.remove('hidden');
  $('#trap-monitor-room').textContent = view.room;
  const feed = $('#trap-monitor-feed');
  feed.innerHTML = '';
  view.people.forEach(function (person) {
    const actor = document.createElement('div');
    actor.className = 'trap-feed-person ' + person.color;
    actor.style.left = (50 + Math.max(-45, Math.min(45, (person.x - view.x) / 48))) + '%';
    actor.style.top = (50 + Math.max(-42, Math.min(42, (person.y - view.y) / 48))) + '%';
    actor.innerHTML = '<i></i><span></span>';
    actor.querySelector('span').textContent = person.nickname;
    feed.appendChild(actor);
  });
}

function updateImpostorAbility(room) {
  const ability = room.impostorAbility;
  const panel = $('#impostor-ability');
  panel.classList.toggle('hidden', !ability || ability.role === 'IMPOSTOR' || !room.selfAlive || room.phase !== 'PLAYING');
  if (!ability || ability.role === 'IMPOSTOR') return;
  $('#impostor-role').textContent = ability.role;
  const select = $('#disguise-target');
  syncTargetSelect(select, ability.targets, 'SELECT CREW');
  select.classList.toggle('hidden', ability.role !== 'SHAPESHIFTER');
  $('#phantom-hide').classList.toggle('hidden', ability.role !== 'PHANTOM');
  $('#disguise-player').classList.toggle('hidden', ability.role !== 'SHAPESHIFTER');
  $('#phantom-hide').disabled = ability.phantomRemaining > 0 || ability.phantomCooldown > 0;
  $('#disguise-player').disabled = !select.value || ability.disguiseRemaining > 0 || ability.disguiseCooldown > 0;
  let info = ability.role === 'MELTER' ? 'Bodies you create melt after ' + room.settings.meltDelay + ' seconds.' : '';
  if (ability.role === 'PHANTOM') info = ability.phantomRemaining > 0 ? 'Invisible for ' + Math.ceil(ability.phantomRemaining) + 's'
    : (ability.phantomCooldown > 0 ? 'Vanish cooldown ' + Math.ceil(ability.phantomCooldown) + 's' : 'Ready to vanish.');
  if (ability.role === 'SHAPESHIFTER') info = ability.disguiseRemaining > 0 ? 'Disguised for ' + Math.ceil(ability.disguiseRemaining) + 's'
    : (ability.disguiseCooldown > 0 ? 'Disguise cooldown ' + Math.ceil(ability.disguiseCooldown) + 's' : 'Select a crew identity.');
  $('#impostor-ability-info').textContent = info;
}

function syncTargetSelect(select, targets, placeholder) {
  const signature = targets.map(function (target) { return target.id + ':' + target.nickname; }).join('|');
  if (select.dataset.targetSignature === signature) return;
  const selected = select.value;
  select.innerHTML = '';
  const empty = document.createElement('option'); empty.value = ''; empty.textContent = placeholder;
  select.appendChild(empty);
  targets.forEach(function (target) {
    const option = document.createElement('option'); option.value = target.id; option.textContent = target.nickname;
    select.appendChild(option);
  });
  if (targets.some(function (target) { return target.id === selected; })) select.value = selected;
  select.dataset.targetSignature = signature;
}

function revealRole(room) {
  const key = 'role-seen-' + room.code;
  const roleSignature = room.selfRole === 'CREW' ? room.selfRole + ':' + room.selfCrewRole
    : room.selfRole + ':' + room.selfImpostorRole;
  if (!room.selfRole || sessionStorage.getItem(key) === roleSignature) return;
  $('#role-reveal').classList.remove('hidden');
  $('#role-reveal').classList.toggle('impostor', room.selfRole === 'IMPOSTOR');
  $('#role-reveal-title').textContent = room.selfRole;
  if (room.selfRole === 'CREW') $('#role-reveal-title').textContent = room.selfCrewRole || 'CREWMATE';
  if (room.selfRole === 'IMPOSTOR') $('#role-reveal-title').textContent = room.selfImpostorRole || 'IMPOSTOR';
  $('#role-reveal-copy').textContent = room.selfRole === 'IMPOSTOR'
    ? (room.selfImpostorRole === 'PHANTOM' ? 'Vanish temporarily and move unseen by the crew.'
      : (room.selfImpostorRole === 'MELTER' ? 'Bodies you create melt automatically after the configured delay.'
        : (room.selfImpostorRole === 'SHAPESHIFTER' ? 'Copy a living crew identity for a limited time.'
          : 'Blend in, lock doors, and eliminate the crew.')))
    : (room.selfCrewRole === 'ENGINEER' ? 'Place a trap and review a snapshot when an elimination happens nearby.'
      : (room.selfCrewRole === 'TRACKER' ? 'Select a player to reveal their position and life status on the minimap.'
        : (room.selfCrewRole === 'DETECTIVE' ? 'Approach a player and detect their identity every 30 seconds.'
          : 'Complete tasks and survive the impostor.')));
}

function updateAttackButton(room, me) {
  let nearest = null;
  let nearestDistance = Infinity;
  if (room.selfRole === 'IMPOSTOR' && room.selfAlive) {
    room.players.forEach(function (player) {
      if (player.id === state.playerId || !player.alive || player.isImpostorAlly) return;
      const d = Math.hypot(me.x - player.x, me.y - player.y);
      if (d < nearestDistance) { nearestDistance = d; nearest = player; }
    });
  }
  $('#attack').classList.toggle('hidden', room.selfRole !== 'IMPOSTOR');
  $('#attack').disabled = !nearest || nearestDistance > 650 || room.killCooldown > 0 || room.phase !== 'PLAYING' || !room.selfAlive;
  $('#attack').dataset.targetId = nearest ? nearest.id : '';
  $('#attack').textContent = room.killCooldown > 0 ? 'ELIMINATE ' + Math.ceil(room.killCooldown) : 'ELIMINATE [SPACE]';
  $('#attack').title = 'Keyboard shortcut: Space';
}

function updateDoorButtons(room, me) {
  let nearest = null;
  let nearestDistance = Infinity;
  room.doors.forEach(function (door) {
    const d = Math.hypot(me.x - (door.x + door.w / 2), me.y - (door.y + door.h / 2));
    if (d < nearestDistance) { nearestDistance = d; nearest = door; }
  });
  const canUse = nearest && nearestDistance <= 850 && room.selfAlive &&
    ((room.selfRole === 'IMPOSTOR' && !nearest.closed) || (room.selfRole !== 'IMPOSTOR' && nearest.closed));
  $('#use-door').disabled = !canUse || room.phase !== 'PLAYING';
  $('#use-door').dataset.doorId = nearest ? nearest.id : '';
  $('#use-door').textContent = nearest && nearest.closed ? 'OPEN DOOR' : 'LOCK DOOR';
  $('#sabotage').classList.toggle('hidden', room.selfRole !== 'IMPOSTOR');
  $('#sabotage').disabled = room.selfRole !== 'IMPOSTOR' || room.sabotageCooldown > 0 || room.phase !== 'PLAYING';
  $('#sabotage').textContent = room.sabotageCooldown > 0 ? 'LOCKDOWN ' + Math.ceil(room.sabotageCooldown) : 'LOCKDOWN';
}

function updateTaskButton(room, me) {
  let nearest = null;
  let nearestDistance = Infinity;
  if (me && (me.alive || me.isGhost) && room.selfRole === 'CREW' && me.tasksDone < me.taskGoal) {
    room.tasks.forEach(function (task) {
      if (room.selfCompletedTaskIds.indexOf(task.id) >= 0) return;
      const d = Math.hypot(me.x - task.x, me.y - task.y);
      if (d < nearestDistance) { nearestDistance = d; nearest = task; }
    });
  }
  if (room.activeTask) {
    $('#do-task').disabled = true;
    $('#do-task').textContent = 'WORKING ' + Math.round(room.activeTask.progress * 100) + '% · STAY NEARBY';
  } else {
    $('#do-task').disabled = !nearest || nearestDistance > 520 || room.phase !== 'PLAYING';
    $('#do-task').textContent = room.nextTaskIn > 0 && !nearest
      ? 'NEXT TASK IN ' + Math.ceil(room.nextTaskIn) + 's' : 'USE / START TASK';
  }
  $('#do-task').dataset.taskId = nearest ? nearest.id : '';
}

for (let i = 4; i <= 20; i += 1) {
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
$('#open-rooms').addEventListener('pointerdown', function (event) {
  const roomButton = event.target.closest('[data-room-code]');
  if (!roomButton) return;
  event.preventDefault();
  joinOpenRoom(roomButton.dataset.roomCode);
});
$('#refresh-rooms').addEventListener('click', refreshOpenRooms);
$('#ready').addEventListener('click', async function () {
  const me = state.room.players.find(function (p) { return p.id === state.playerId; });
  try { await api('/api/ready', { ready: !me.ready }, state.token); } catch (e) { errorAt('#lobby-error', e.message); }
});

async function saveSettings() {
  try {
    await api('/api/settings', {
      targetPlayers: Number($('#target-players').value),
      impostors: Number($('#impostors').value),
      autoFillBots: $('#auto-bots').checked,
      vengefulSpirits: $('#vengeful-spirits').checked,
      revealImpostors: $('#reveal-impostors').checked,
      phantomDuration: Number($('#phantom-duration').value),
      meltDelay: Number($('#melt-delay').value),
      disguiseDuration: Number($('#disguise-duration').value),
      disguiseCooldown: Number($('#disguise-cooldown').value)
    }, state.token);
  } catch (e) { errorAt('#lobby-error', e.message); }
}
$('#target-players').addEventListener('change', saveSettings);
$('#impostors').addEventListener('change', saveSettings);
$('#auto-bots').addEventListener('change', saveSettings);
$('#vengeful-spirits').addEventListener('change', saveSettings);
$('#reveal-impostors').addEventListener('change', saveSettings);
['phantom-duration', 'melt-delay', 'disguise-duration', 'disguise-cooldown'].forEach(function (id) {
  $('#' + id).addEventListener('change', saveSettings);
});
$('#start').addEventListener('click', async function () {
  try { await api('/api/start', {}, state.token); } catch (e) { errorAt('#lobby-error', e.message); }
});
$('#copy-code').addEventListener('click', async function () {
  await navigator.clipboard.writeText(state.room.code); $('#copy-code').textContent = 'COPIED';
  setTimeout(function () { $('#copy-code').textContent = 'COPY'; }, 1000);
});
async function leaveRoom() {
  if (!state.token || !window.confirm('방에서 나가시겠습니까?')) return;
  try { await api('/api/leave', {}, state.token); } catch (e) {}
  if (state.stream) state.stream.close();
  sessionStorage.removeItem('station-token');
  sessionStorage.removeItem('station-player');
  if (state.room) sessionStorage.removeItem('role-seen-' + state.room.code);
  location.reload();
}
$('#leave').addEventListener('click', leaveRoom);
$('#game-leave').addEventListener('click', leaveRoom);
$('#meeting-leave').addEventListener('click', leaveRoom);
$('#do-task').addEventListener('click', async function () {
  try { await api('/api/task', { taskId: $('#do-task').dataset.taskId }, state.token); }
  catch (e) { errorAt('#game-error', e.message); }
});
$('#ability-target').addEventListener('change', function () { if (state.room) updateCrewAbility(state.room); });
$('#place-trap').addEventListener('click', async function () {
  try { await api('/api/ability/trap', {}, state.token); } catch (e) { errorAt('#game-error', e.message); }
});
$('#view-trap').addEventListener('click', function () {
  state.trapMonitorOpen = true;
  if (state.room) renderTrapMonitor(state.room);
});
$('#close-trap-monitor').addEventListener('click', function () {
  state.trapMonitorOpen = false;
  $('#trap-monitor').classList.add('hidden');
});
$('#track-player').addEventListener('click', async function () {
  try { await api('/api/ability/track', { targetId: $('#ability-target').value }, state.token); }
  catch (e) { errorAt('#game-error', e.message); }
});
$('#detect-player').addEventListener('click', async function () {
  try { await api('/api/ability/detect', { targetId: $('#ability-target').value }, state.token); }
  catch (e) { errorAt('#game-error', e.message); }
});
$('#disguise-target').addEventListener('change', function () { if (state.room) updateImpostorAbility(state.room); });
$('#phantom-hide').addEventListener('click', async function () {
  try { await api('/api/ability/phantom', {}, state.token); } catch (e) { errorAt('#game-error', e.message); }
});
$('#disguise-player').addEventListener('click', async function () {
  try { await api('/api/ability/disguise', { targetId: $('#disguise-target').value }, state.token); }
  catch (e) { errorAt('#game-error', e.message); }
});
$('#use-door').addEventListener('click', async function () {
  try { await api('/api/door', { doorId: $('#use-door').dataset.doorId }, state.token); }
  catch (e) { errorAt('#game-error', e.message); }
});
$('#sabotage').addEventListener('click', async function () {
  try { await api('/api/sabotage/doors', {}, state.token); }
  catch (e) { errorAt('#game-error', e.message); }
});
$('#vent').addEventListener('click', function () {
  const ventId = $('#vent').dataset.ventId;
  if (!ventId || $('#vent').disabled) return;
  state.selectedVentId = state.selectedVentId === ventId ? null : ventId;
  renderGame(state.room);
});
$('#meeting-chat-form').addEventListener('submit', async function (event) {
  event.preventDefault();
  const input = $('#meeting-chat-input');
  const message = input.value.trim();
  if (!message) return;
  try { await api('/api/meeting/chat', { message: message }, state.token); input.value = ''; }
  catch (e) { errorAt('#game-error', e.message); }
});
$('#report').addEventListener('click', async function () {
  try { await api('/api/report', { bodyId: $('#report').dataset.bodyId }, state.token); }
  catch (e) { errorAt('#game-error', e.message); }
});
$('#emergency').addEventListener('click', async function () {
  try { await api('/api/meeting/emergency', {}, state.token); }
  catch (e) { errorAt('#game-error', e.message); }
});
$('#meeting-roster').addEventListener('pointerdown', function (event) {
  const button = event.target.closest('[data-vote-target]');
  if (!button || button.disabled) return;
  event.preventDefault();
  submitVote(button.dataset.voteTarget);
});
$('#meeting-roster').addEventListener('keydown', function (event) {
  const button = event.target.closest('[data-vote-target]');
  if (!button || button.disabled || (event.key !== 'Enter' && event.key !== ' ')) return;
  event.preventDefault();
  submitVote(button.dataset.voteTarget);
});
$('#vote-skip').addEventListener('pointerdown', function (event) { event.preventDefault(); submitVote(null); });
async function eliminateNearest() {
  const button = $('#attack');
  if (button.disabled || !button.dataset.targetId || !state.room || state.room.phase !== 'PLAYING') return;
  try { await api('/api/eliminate', { targetId: $('#attack').dataset.targetId }, state.token); }
  catch (e) { errorAt('#game-error', e.message); }
}
$('#attack').addEventListener('click', eliminateNearest);
$('#role-reveal-close').addEventListener('click', async function () {
  const button = $('#role-reveal-close');
  button.disabled = true;
  try {
    await api('/api/intro/ready', {}, state.token);
    if (state.room && state.room.selfRole) sessionStorage.setItem('role-seen-' + state.room.code,
      state.room.selfRole === 'CREW' ? state.room.selfRole + ':' + state.room.selfCrewRole
        : state.room.selfRole + ':' + state.room.selfImpostorRole);
    $('#role-reveal').classList.add('hidden');
  } catch (e) { errorAt('#game-error', e.message); }
  button.disabled = false;
});
$('#rematch').addEventListener('click', async function () {
  try {
    sessionStorage.removeItem('role-seen-' + state.room.code);
    await api('/api/rematch', {}, state.token);
  } catch (e) { errorAt('#game-error', e.message); }
});
$('#result-leave').addEventListener('click', leaveRoom);
function toggleSound() {
  if (!audio.started) {
    audio.muted = false;
    localStorage.setItem('station-muted', 'false');
    ensureAudio();
    if (audio.context) {
      audio.context.resume().then(function () {
        restartMusic();
        playSound('start');
        updateSoundButtons();
      }).catch(updateSoundButtons);
    }
    updateSoundButtons();
    return;
  }
  if (audio.context && audio.context.state !== 'running') {
    audio.muted = false;
    localStorage.setItem('station-muted', 'false');
    audio.context.resume().then(function () {
      audio.master.gain.setTargetAtTime(0.82, audio.context.currentTime, 0.04);
      restartMusic();
      playSound('start');
      updateSoundButtons();
    }).catch(updateSoundButtons);
    return;
  }
  audio.muted = !audio.muted;
  localStorage.setItem('station-muted', String(audio.muted));
  if (audio.master) audio.master.gain.setTargetAtTime(audio.muted ? 0 : 0.82, audio.context.currentTime, 0.04);
  updateSoundButtons();
  if (!audio.muted) { restartMusic(); playSound('start'); }
}
$('#home-sound-toggle').addEventListener('click', toggleSound);
$('#sound-toggle').addEventListener('click', toggleSound);
$('#lobby-sound-toggle').addEventListener('click', toggleSound);

document.addEventListener('pointerdown', function (event) {
  if (!event.target.closest('.sound-toggle')) ensureAudio();
}, { capture: true });
document.addEventListener('keydown', function (event) {
  if (!event.target.closest || !event.target.closest('.sound-toggle')) ensureAudio();
}, { capture: true });
updateSoundButtons();

function isTypingTarget(target) {
  return Boolean(target && (target.matches('input, textarea, select') || target.isContentEditable));
}
function clearMovementInput() {
  state.keys.clear();
}
function movementKey(event) {
  const byCode = { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', ArrowUp: 'arrowup',
    ArrowDown: 'arrowdown', ArrowLeft: 'arrowleft', ArrowRight: 'arrowright' };
  return byCode[event.code] || String(event.key || '').toLowerCase();
}
window.addEventListener('keydown', function (event) {
  if (isTypingTarget(event.target)) { clearMovementInput(); return; }
  if (event.code === 'Space') {
    if (event.target && event.target.closest && event.target.closest('button')) return;
    event.preventDefault();
    clearMovementInput();
    const overlayOpen = !$('#role-reveal').classList.contains('hidden') ||
      !$('#meeting').classList.contains('hidden') || !$('#ejection').classList.contains('hidden') ||
      !$('#result').classList.contains('hidden');
    if (!event.repeat && !overlayOpen && state.room && state.room.selfRole === 'IMPOSTOR' && state.room.selfAlive) {
      eliminateNearest();
    }
    return;
  }
  const key = movementKey(event);
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].indexOf(key) >= 0) {
    event.preventDefault(); state.keys.add(key);
  }
});
window.addEventListener('keyup', function (event) { state.keys.delete(movementKey(event)); });
window.addEventListener('blur', clearMovementInput);
document.addEventListener('focusin', function (event) {
  if (isTypingTarget(event.target)) clearMovementInput();
});
document.addEventListener('pointerdown', function (event) {
  if (event.target.closest('input, textarea, select, button')) clearMovementInput();
}, true);
document.addEventListener('visibilitychange', function () {
  if (document.hidden) clearMovementInput();
});
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

refreshOpenRooms();
setInterval(refreshOpenRooms, 2000);

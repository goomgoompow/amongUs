'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const LobbyStore = require('./lobby-core.cjs').LobbyStore;

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC_DIR = path.join(__dirname, 'public');
const store = new LobbyStore();
const streams = new Map();

function sendJson(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(body);
}

function readBody(req) {
  return new Promise(function (resolve, reject) {
    let body = '';
    req.on('data', function (chunk) {
      body += chunk;
      if (body.length > 8192) reject(new Error('Request is too large.'));
    });
    req.on('end', function () {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (error) { reject(new Error('Invalid JSON request.')); }
    });
    req.on('error', reject);
  });
}

function sessionToken(req, requestUrl) {
  return req.headers['x-session-token'] || requestUrl.searchParams.get('token') || '';
}

function publishRoom(code) {
  store.viewsForRoom(code).forEach(function (entry) {
    const response = streams.get(entry.playerId);
    if (response) response.write('event: room\ndata: ' + JSON.stringify(entry.view) + '\n\n');
  });
}

function publishForToken(token) {
  const found = store.byToken(token);
  publishRoom(found.room.code);
}

function serveStatic(res, pathname) {
  const routes = { '/': 'index.html', '/app.js': 'app.js', '/styles.css': 'styles.css' };
  const file = routes[pathname];
  if (!file) return false;
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
  fs.readFile(path.join(PUBLIC_DIR, file), function (error, content) {
    if (error) return sendJson(res, 500, { error: 'Static file unavailable.' });
    res.writeHead(200, { 'Content-Type': types[path.extname(file)], 'Cache-Control': 'no-cache' });
    res.end(content);
  });
  return true;
}

const server = http.createServer(async function (req, res) {
  const requestUrl = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  const pathname = requestUrl.pathname;
  try {
    if (req.method === 'GET' && serveStatic(res, pathname)) return;
    if (req.method === 'GET' && pathname === '/api/health') return sendJson(res, 200, { ok: true });

    if (req.method === 'GET' && pathname === '/api/events') {
      const token = sessionToken(req, requestUrl);
      const found = store.byToken(token);
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });
      streams.set(found.player.id, res);
      res.write('event: room\ndata: ' + JSON.stringify(store.viewForToken(token)) + '\n\n');
      req.on('close', function () {
        if (streams.get(found.player.id) === res) streams.delete(found.player.id);
      });
      return;
    }

    const body = req.method === 'POST' ? await readBody(req) : {};
    const token = sessionToken(req, requestUrl);
    let result;
    if (req.method === 'POST' && pathname === '/api/rooms') {
      result = store.create(body);
      return sendJson(res, 201, result);
    }
    if (req.method === 'POST' && pathname === '/api/rooms/join') {
      result = store.join(body);
      publishRoom(result.room.code);
      return sendJson(res, 200, result);
    }
    if (req.method === 'POST' && pathname === '/api/ready') {
      result = store.setReady(token, body.ready);
      publishForToken(token);
      return sendJson(res, 200, { room: result });
    }
    if (req.method === 'POST' && pathname === '/api/settings') {
      result = store.updateSettings(token, body);
      publishForToken(token);
      return sendJson(res, 200, { room: result });
    }
    if (req.method === 'POST' && pathname === '/api/start') {
      result = store.start(token);
      publishForToken(token);
      return sendJson(res, 200, { room: result });
    }
    if (req.method === 'POST' && pathname === '/api/move') {
      result = store.move(token, body);
      publishForToken(token);
      return sendJson(res, 200, { room: result });
    }
    if (req.method === 'POST' && pathname === '/api/task') {
      result = store.completeTask(token, body.taskId);
      publishForToken(token);
      return sendJson(res, 200, { room: result });
    }
    if (req.method === 'POST' && pathname === '/api/door') {
      result = store.useDoor(token, body.doorId);
      publishForToken(token);
      return sendJson(res, 200, { room: result });
    }
    if (req.method === 'POST' && pathname === '/api/sabotage/doors') {
      result = store.sabotageDoors(token);
      publishForToken(token);
      return sendJson(res, 200, { room: result });
    }
    if (req.method === 'POST' && pathname === '/api/eliminate') {
      result = store.eliminate(token, body.targetId);
      publishForToken(token);
      return sendJson(res, 200, { room: result });
    }
    if (req.method === 'POST' && pathname === '/api/rematch') {
      result = store.rematch(token);
      publishForToken(token);
      return sendJson(res, 200, { room: result });
    }
    if (req.method === 'POST' && pathname === '/api/leave') {
      const room = store.leave(token);
      if (room) publishRoom(room.code);
      return sendJson(res, 200, { ok: true });
    }
    return sendJson(res, 404, { error: 'Route not found.' });
  } catch (error) {
    return sendJson(res, 400, { error: error.message || 'Request failed.' });
  }
});

setInterval(function () {
  store.tick(0.1).forEach(publishRoom);
}, 100);

server.on('error', function (error) {
  if (error && error.code === 'EADDRINUSE') {
    console.error('Port ' + PORT + ' is already in use. Stop the old game server first.');
    process.exit(1);
  }
  throw error;
});

server.listen(PORT, HOST, function () {
  console.log('Game server: http://localhost:' + PORT);
  console.log('LAN players: http://192.168.0.2:' + PORT);
});

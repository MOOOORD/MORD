import { WebSocketServer } from 'ws';

const PORT = process.env.PORT || 3000;
const ROOM_EXPIRE_MS = 10 * 60 * 1000; // 10 min inactivity

const rooms = new Map();

function genCode() {
  for (let i = 0; i < 100; i++) {
    const code = String(Math.floor(1000 + Math.random() * 9000));
    if (!rooms.has(code)) return code;
  }
  return null;
}

function cleanupRoom(code) {
  const room = rooms.get(code);
  if (!room) return;
  clearTimeout(room.expireTimer);
  rooms.delete(code);
}

const wss = new WebSocketServer({ port: PORT });
console.log(`[server] WebSocket relay running on ws://0.0.0.0:${PORT}`);

wss.on('connection', (ws) => {
  let myRoom = null;
  let myRole = null; // 'host' | 'client'

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.type) {

      case 'create_room': {
        const code = genCode();
        if (!code) { ws.send(JSON.stringify({ type: 'error', message: '服务器繁忙，请重试' })); return; }
        myRoom = code;
        myRole = 'host';
        rooms.set(code, {
          code,
          host: ws,
          client: null,
          createdAt: Date.now(),
          expireTimer: setTimeout(() => {
            const r = rooms.get(code);
            if (r && !r.client) {
              if (r.host.readyState === 1) r.host.send(JSON.stringify({ type: 'error', message: '房间已过期' }));
              cleanupRoom(code);
            }
          }, ROOM_EXPIRE_MS),
        });
        ws.send(JSON.stringify({ type: 'room_created', code }));
        break;
      }

      case 'join_room': {
        const room = rooms.get(msg.code);
        if (!room) { ws.send(JSON.stringify({ type: 'error', message: '房间不存在' })); return; }
        if (room.client) { ws.send(JSON.stringify({ type: 'error', message: '房间已满' })); return; }
        myRoom = msg.code;
        myRole = 'client';
        room.client = ws;
        clearTimeout(room.expireTimer);
        room.host.send(JSON.stringify({ type: 'peer_joined' }));
        ws.send(JSON.stringify({ type: 'room_joined', code: msg.code }));
        break;
      }

      // Transparent relay: host <-> client
      case 'player_input':
      case 'state_sync':
      case 'game_event': {
        if (!myRoom) return;
        const room = rooms.get(myRoom);
        if (!room) return;
        const peer = myRole === 'host' ? room.client : room.host;
        if (peer && peer.readyState === 1) {
          peer.send(JSON.stringify(msg));
        }
        break;
      }

      case 'ping': {
        ws.send(JSON.stringify({ type: 'pong' }));
        break;
      }
    }
  });

  ws.on('close', () => {
    if (!myRoom) return;
    const room = rooms.get(myRoom);
    if (!room) return;
    const peer = myRole === 'host' ? room.client : room.host;
    if (peer && peer.readyState === 1) {
      peer.send(JSON.stringify({ type: 'peer_disconnected' }));
    }
    // If host left, notify client and clean up
    if (myRole === 'host') {
      cleanupRoom(myRoom);
    } else {
      // Client left — mark slot as open, host can wait for new client
      room.client = null;
      room.expireTimer = setTimeout(() => {
        if (room.host.readyState === 1) room.host.send(JSON.stringify({ type: 'error', message: '房间已过期' }));
        cleanupRoom(myRoom);
      }, ROOM_EXPIRE_MS);
    }
  });

  ws.on('error', () => {});
});

// Periodic cleanup of stale rooms
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (now - room.createdAt > ROOM_EXPIRE_MS && !room.client) {
      if (room.host.readyState === 1) room.host.send(JSON.stringify({ type: 'error', message: '房间已过期' }));
      cleanupRoom(code);
    }
  }
}, 60000);

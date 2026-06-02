// start-server.js — 一键启动联机中继服务器
// 用法: node start-server.js [--tunnel]

import { spawn } from 'child_process';
import { WebSocketServer } from 'ws';

const USE_TUNNEL = process.argv.includes('--tunnel');
const PORT = process.env.PORT || 3000;

// 1. 启动 WebSocket 中继服务器
const wss = new WebSocketServer({ port: PORT });

const rooms = new Map();
const ROOM_EXPIRE_MS = 10 * 60 * 1000;

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

wss.on('connection', (ws) => {
  let myRoom = null;
  let myRole = null;

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
          code, host: ws, client: null, createdAt: Date.now(),
          expireTimer: setTimeout(() => {
            const r = rooms.get(code);
            if (r && !r.client) {
              if (r.host.readyState === 1) r.host.send(JSON.stringify({ type: 'error', message: '房间已过期' }));
              cleanupRoom(code);
            }
          }, ROOM_EXPIRE_MS),
        });
        ws.send(JSON.stringify({ type: 'room_created', code }));
        console.log(`  [房间] ${code} 已创建 (房主已连接)`);
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
        console.log(`  [房间] ${msg.code} 对手已加入`);
        break;
      }

      case 'player_input':
      case 'state_sync':
      case 'game_event': {
        if (!myRoom) return;
        const room = rooms.get(myRoom);
        if (!room) return;
        const peer = myRole === 'host' ? room.client : room.host;
        if (peer && peer.readyState === 1) peer.send(JSON.stringify(msg));
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
    if (peer && peer.readyState === 1) peer.send(JSON.stringify({ type: 'peer_disconnected' }));
    if (myRole === 'host') {
      cleanupRoom(myRoom);
    } else {
      room.client = null;
      room.expireTimer = setTimeout(() => {
        if (room.host.readyState === 1) room.host.send(JSON.stringify({ type: 'error', message: '房间已过期' }));
        cleanupRoom(myRoom);
      }, ROOM_EXPIRE_MS);
    }
  });

  ws.on('error', () => {});
});

setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (now - room.createdAt > ROOM_EXPIRE_MS && !room.client) {
      if (room.host.readyState === 1) room.host.send(JSON.stringify({ type: 'error', message: '房间已过期' }));
      cleanupRoom(code);
    }
  }
}, 60000);

console.log('╔══════════════════════════════════╗');
console.log('║   🎮 飞出生天 · 联机服务器       ║');
console.log('╚══════════════════════════════════╝');
console.log('');
console.log(`  本地地址: ws://localhost:${PORT}`);
console.log('');

// 2. 可选: 启动 localtunnel 内网穿透
if (USE_TUNNEL) {
  console.log('  正在启动内网穿透...');
  const lt = spawn('npx', ['localtunnel', '--port', String(PORT)], {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  });

  lt.stdout.on('data', (data) => {
    const text = data.toString();
    const match = text.match(/https:\/\/[a-z0-9-]+\.loca\.lt/);
    if (match) {
      const tunnelUrl = match[0].replace('https://', 'wss://');
      console.log(`  外网地址: ${tunnelUrl}`);
      console.log('');
      console.log('  房主: 打开游戏 → 双人对战 → 创建房间');
      console.log(`  客机: 浏览器打开游戏，地址栏加 ?server=${encodeURIComponent(tunnelUrl)}`);
      console.log('        或者在游戏大厅连接前，按 F12 输入:');
      console.log(`        SERVER_URL = '${tunnelUrl}'`);
    }
  });

  lt.stderr.on('data', (data) => {
    // localtunnel sometimes outputs info to stderr
    const text = data.toString();
    if (text.includes('your url is')) {
      const match = text.match(/https:\/\/[a-z0-9-]+\.loca\.lt/);
      if (match) {
        const tunnelUrl = match[0].replace('https://', 'wss://');
        console.log(`  外网地址: ${tunnelUrl}`);
        console.log('');
        console.log('  房主: 打开游戏 → 双人对战 → 创建房间');
        console.log(`  客机: 在游戏 URL 后加 ?server=${encodeURIComponent(tunnelUrl)}`);
      }
    }
  });

  process.on('SIGINT', () => {
    lt.kill();
    wss.close();
    console.log('\n  服务器已关闭');
    process.exit(0);
  });
} else {
  console.log('  房主: 打开游戏 → 双人对战 → 创建房间');
  console.log('  客机: 需要内网穿透才能从外网连接');
  console.log(`  启动穿透: node start-server.js --tunnel`);
  console.log('');
  console.log('  按 Ctrl+C 关闭服务器');
}

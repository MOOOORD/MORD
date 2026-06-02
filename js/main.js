// main.js
import { CANVAS_WIDTH, CANVAS_HEIGHT, STATE, GAME_MODE, MAP_TYPE, PLAYER_ROLE } from './constants.js';
import { Game } from './game.js';
import { Renderer } from './renderer.js';
import { MapEditor } from './editor.js';
import { NetworkClient } from './network.js';
import { Lobby } from './lobby.js';

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

const params = new URLSearchParams(window.location.search);
const urlParam = params.get('server');
const STORAGE_KEY = 'foe_server_url';
let serverUrl = urlParam || localStorage.getItem(STORAGE_KEY) || 'ws://localhost:3000';
if (urlParam) localStorage.setItem(STORAGE_KEY, urlParam);

const FIXED_DT = 1000 / 60;
let game = new Game();
let renderer = new Renderer();
let lastTime = 0;
let accumulator = 0;
let gameModeSelection = GAME_MODE.ESCAPE;
let mapTypeSelection = MAP_TYPE.HYBRID;
let customMapData = null;
let editor = null;

// Multiplayer
let network = null;
let lobby = null;
let isMultiplayerGame = false;

const QUOTES = [
  '这喷不了这是真处！',
  '以后会加入ai队友，这样就可以一个架前面一个架后面。',
  '感觉阴沟不是很友善啊！',
  '我就是为了装逼才做的这个。',
  '我说假如加入江神她一定是空军有没有懂的。',
  '感觉没办法啊！',
  '目前来说因为没有队友所以队友很不舒服！',
  '我说cc来一分钟三挂去世献祭流了有没有懂的。',
  '妙手神偷！',
  '有没有人觉得阴沟很可爱的！',
  '陈飞飞说首页是适当热身，但是我不想改了！',
  '阴沟在哪发财呢！',
  '傻呗zbw为什么不跟我们玩！！',
  '瑶宝也很可爱！比阴沟可爱多了！',
  '如果你想在这里有其他的什么内容可以给我投稿！',
];

let quoteInterval = null;

function startQuoteRotation() {
  const bar = document.getElementById('quote-bar');
  if (!bar) return;
  const pick = () => {
    const q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
    bar.style.opacity = '0';
    setTimeout(() => {
      bar.textContent = q;
      bar.style.opacity = '0.9';
    }, 500);
  };
  pick();
  bar.onclick = pick;
  if (quoteInterval) clearInterval(quoteInterval);
  quoteInterval = setInterval(pick, 10000);
}

const menuScreen = document.getElementById('menu-screen');
const gameScreen = document.getElementById('game-screen');
const resultScreen = document.getElementById('result-screen');
const menuButtons = document.getElementById('menu-buttons');

// --- Pixel Avatar Sprites (16x16, drawn at 5x = 80x80) ---
const SURVIVOR_SPRITE = [
  // Hair spikes (brown)
  [5,0,'#6b3a2a'],[6,0,'#6b3a2a'],[7,0,'#8b5a3a'],[8,0,'#8b5a3a'],[9,0,'#6b3a2a'],[10,0,'#6b3a2a'],
  [4,1,'#6b3a2a'],[5,1,'#8b5a3a'],[6,1,'#a0704a'],[7,1,'#8b5a3a'],[8,1,'#8b5a3a'],[9,1,'#a0704a'],[10,1,'#8b5a3a'],[11,1,'#6b3a2a'],
  [3,2,'#6b3a2a'],[4,2,'#a0704a'],[5,2,'#ffcc99'],[6,2,'#ffcc99'],[7,2,'#ffcc99'],[8,2,'#ffcc99'],[9,2,'#ffcc99'],[10,2,'#ffcc99'],[11,2,'#a0704a'],[12,2,'#6b3a2a'],
  // Face
  [3,3,'#a0704a'],[4,3,'#ffcc99'],[5,3,'#ffcc99'],[6,3,'#fff'],[7,3,'#333'],[8,3,'#333'],[9,3,'#fff'],[10,3,'#ffcc99'],[11,3,'#ffcc99'],[12,3,'#a0704a'],
  [3,4,'#a0704a'],[4,4,'#ffcc99'],[5,4,'#ffcc99'],[6,4,'#ffcc99'],[7,4,'#333'],[8,4,'#333'],[9,4,'#ffcc99'],[10,4,'#ffcc99'],[11,4,'#ffcc99'],[12,4,'#a0704a'],
  // Mouth + chin
  [4,5,'#ffcc99'],[5,5,'#ffcc99'],[6,5,'#e88060'],[7,5,'#ffcc99'],[8,5,'#ffcc99'],[9,5,'#e88060'],[10,5,'#ffcc99'],[11,5,'#ffcc99'],
  // Scarf (flowing teal)
  [2,6,'#4ecdc4'],[3,6,'#4ecdc4'],[4,6,'#4ecdc4'],[5,6,'#4ecdc4'],[6,6,'#3db8b0'],[7,6,'#3db8b0'],[8,6,'#3db8b0'],[9,6,'#4ecdc4'],[10,6,'#4ecdc4'],[11,6,'#4ecdc4'],[12,6,'#4ecdc4'],
  [1,7,'#4ecdc4'],[2,7,'#3db8b0'],[3,7,'#3db8b0'],[4,7,'#ffcc99'],[5,7,'#4ecdc4'],[6,7,'#4ecdc4'],[7,7,'#4ecdc4'],[8,7,'#4ecdc4'],[9,7,'#4ecdc4'],[10,7,'#4ecdc4'],[11,7,'#3db8b0'],
  // Body (teal jacket)
  [3,8,'#4ecdc4'],[4,8,'#4ecdc4'],[5,8,'#4ecdc4'],[6,8,'#3db8b0'],[7,8,'#3db8b0'],[8,8,'#3db8b0'],[9,8,'#4ecdc4'],[10,8,'#4ecdc4'],[11,8,'#4ecdc4'],
  [3,9,'#4ecdc4'],[4,9,'#4ecdc4'],[5,9,'#4ecdc4'],[6,9,'#4ecdc4'],[7,9,'#4ecdc4'],[8,9,'#4ecdc4'],[9,9,'#4ecdc4'],[10,9,'#4ecdc4'],[11,9,'#4ecdc4'],
  // Arms spread (flying pose)
  [1,10,'#ffcc99'],[2,10,'#ffcc99'],[3,10,'#4ecdc4'],[4,10,'#4ecdc4'],[5,10,'#4ecdc4'],[6,10,'#4ecdc4'],[7,10,'#4ecdc4'],[8,10,'#4ecdc4'],[9,10,'#4ecdc4'],[10,10,'#4ecdc4'],[11,10,'#ffcc99'],[12,10,'#ffcc99'],
  [2,11,'#ffcc99'],[3,11,'#4ecdc4'],[4,11,'#4ecdc4'],[5,11,'#4ecdc4'],[6,11,'#4ecdc4'],[7,11,'#4ecdc4'],[8,11,'#4ecdc4'],[9,11,'#4ecdc4'],[10,11,'#4ecdc4'],[11,11,'#ffcc99'],
  // Belt
  [3,12,'#333'],[4,12,'#333'],[5,12,'#f0c040'],[6,12,'#333'],[7,12,'#333'],[8,12,'#f0c040'],[9,12,'#333'],[10,12,'#333'],
  // Legs
  [3,13,'#336'],[4,13,'#336'],[5,13,'#336'],[6,13,'#336'],[7,13,'#336'],[8,13,'#336'],[9,13,'#336'],[10,13,'#336'],
  [3,14,'#336'],[4,14,'#336'],[5,14,'#336'],[6,14,'#336'],[7,14,'#336'],[8,14,'#336'],[9,14,'#336'],[10,14,'#336'],
  // Shoes
  [2,15,'#222'],[3,15,'#222'],[4,15,'#222'],[5,15,'#222'],[8,15,'#222'],[9,15,'#222'],[10,15,'#222'],[11,15,'#222'],
];

const KILLER_SPRITE = [
  // Hood top
  [4,0,'#111'],[5,0,'#111'],[6,0,'#1a1a1a'],[7,0,'#1a1a1a'],[8,0,'#1a1a1a'],[9,0,'#111'],[10,0,'#111'],
  [3,1,'#111'],[4,1,'#1a1a1a'],[5,1,'#222'],[6,1,'#222'],[7,1,'#222'],[8,1,'#222'],[9,1,'#222'],[10,1,'#1a1a1a'],[11,1,'#111'],
  [2,2,'#111'],[3,2,'#222'],[4,2,'#1a1a1a'],[5,2,'#0a0a0a'],[6,2,'#0a0a0a'],[7,2,'#0a0a0a'],[8,2,'#0a0a0a'],[9,2,'#0a0a0a'],[10,2,'#1a1a1a'],[11,2,'#222'],[12,2,'#111'],
  // Shadow face
  [2,3,'#222'],[3,3,'#1a1a1a'],[4,3,'#0a0a0a'],[5,3,'#0a0a0a'],[6,3,'#0a0a0a'],[7,3,'#0a0a0a'],[8,3,'#0a0a0a'],[9,3,'#0a0a0a'],[10,3,'#0a0a0a'],[11,3,'#1a1a1a'],[12,3,'#222'],
  // Glowing red eyes
  [3,4,'#1a1a1a'],[4,4,'#0a0a0a'],[5,4,'#e94560'],[6,4,'#600'],[7,4,'#600'],[8,4,'#e94560'],[9,4,'#0a0a0a'],[10,4,'#0a0a0a'],[11,4,'#1a1a1a'],
  [3,5,'#1a1a1a'],[4,5,'#0a0a0a'],[5,5,'#f00'],[6,5,'#e94560'],[7,5,'#e94560'],[8,5,'#f00'],[9,5,'#0a0a0a'],[10,5,'#0a0a0a'],[11,5,'#1a1a1a'],
  // Cloak body
  [2,6,'#222'],[3,6,'#1a1a1a'],[4,6,'#111'],[5,6,'#111'],[6,6,'#1a1a1a'],[7,6,'#1a1a1a'],[8,6,'#111'],[9,6,'#111'],[10,6,'#1a1a1a'],[11,6,'#222'],
  [2,7,'#222'],[3,7,'#111'],[4,7,'#1a1a1a'],[5,7,'#1a1a1a'],[6,7,'#1a1a1a'],[7,7,'#1a1a1a'],[8,7,'#1a1a1a'],[9,7,'#1a1a1a'],[10,7,'#111'],[11,7,'#222'],
  [2,8,'#1a1a1a'],[3,8,'#111'],[4,8,'#1a1a1a'],[5,8,'#1a1a1a'],[6,8,'#e94560'],[7,8,'#e94560'],[8,8,'#1a1a1a'],[9,8,'#1a1a1a'],[10,8,'#111'],[11,8,'#1a1a1a'],
  // Arms reaching out
  [1,9,'#1a1a1a'],[2,9,'#111'],[3,9,'#111'],[4,9,'#1a1a1a'],[5,9,'#1a1a1a'],[6,9,'#e94560'],[7,9,'#e94560'],[8,9,'#1a1a1a'],[9,9,'#1a1a1a'],[10,9,'#111'],[11,9,'#111'],[12,9,'#1a1a1a'],
  [0,10,'#222'],[1,10,'#111'],[2,10,'#1a1a1a'],[3,10,'#1a1a1a'],[4,10,'#1a1a1a'],[5,10,'#1a1a1a'],[6,10,'#1a1a1a'],[7,10,'#1a1a1a'],[8,10,'#1a1a1a'],[9,10,'#1a1a1a'],[10,10,'#1a1a1a'],[11,10,'#111'],[12,10,'#222'],
  [0,11,'#222'],[1,11,'#111'],[2,11,'#1a1a1a'],[3,11,'#1a1a1a'],[4,11,'#1a1a1a'],[5,11,'#1a1a1a'],[6,11,'#1a1a1a'],[7,11,'#1a1a1a'],[8,11,'#1a1a1a'],[9,11,'#1a1a1a'],[10,11,'#1a1a1a'],[11,11,'#111'],[12,11,'#222'],
  // Cloak hem
  [1,12,'#222'],[2,12,'#111'],[3,12,'#1a1a1a'],[4,12,'#1a1a1a'],[5,12,'#1a1a1a'],[6,12,'#222'],[7,12,'#222'],[8,12,'#1a1a1a'],[9,12,'#1a1a1a'],[10,12,'#1a1a1a'],[11,12,'#111'],[12,12,'#222'],
  // Dark legs
  [2,13,'#111'],[3,13,'#111'],[4,13,'#111'],[5,13,'#555'],[6,13,'#111'],[7,13,'#111'],[8,13,'#555'],[9,13,'#111'],[10,13,'#111'],[11,13,'#111'],[12,13,'#111'],
  [2,14,'#111'],[3,14,'#111'],[4,14,'#111'],[5,14,'#555'],[6,14,'#111'],[7,14,'#111'],[8,14,'#555'],[9,14,'#111'],[10,14,'#111'],[11,14,'#111'],
  // Boots
  [1,15,'#222'],[2,15,'#222'],[3,15,'#222'],[4,15,'#333'],[5,15,'#222'],[6,15,'#222'],[8,15,'#222'],[9,15,'#333'],[10,15,'#222'],[11,15,'#222'],[12,15,'#222'],
];

function drawAvatar(canvasId, spriteData, bgColor) {
  const c = document.getElementById(canvasId);
  if (!c) return;
  const cx = c.getContext('2d');
  cx.fillStyle = bgColor;
  cx.fillRect(0, 0, 80, 80);
  for (const [px, py, color] of spriteData) {
    cx.fillStyle = color;
    cx.fillRect(px * 5, py * 5, 5, 5);
  }
}

function drawAvatars() {
  drawAvatar('avatar-survivor', SURVIVOR_SPRITE, '#1a2a3a');
  drawAvatar('avatar-killer', KILLER_SPRITE, '#1a0a0a');
}

function drawCatAvatar() {
  const c = document.getElementById('cat-avatar');
  if (!c) return;
  const ctx = c.getContext('2d');
  const s = 4;
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, 56, 56);

  // Long hair — dark purple cascading sides
  ctx.fillStyle = '#3a2540';
  // Left hair flow
  ctx.fillRect(0, 3*s, 1*s, 8*s);
  ctx.fillRect(1*s, 2*s, 1*s, 10*s);
  ctx.fillRect(0, 10*s, 2*s, 3*s);
  ctx.fillRect(0, 13*s, 1*s, 1*s);
  // Right hair flow
  ctx.fillRect(13*s, 3*s, 1*s, 8*s);
  ctx.fillRect(12*s, 2*s, 1*s, 10*s);
  ctx.fillRect(12*s, 10*s, 2*s, 3*s);
  ctx.fillRect(13*s, 13*s, 1*s, 1*s);

  // Bangs
  ctx.fillStyle = '#3a2540';
  ctx.fillRect(2*s, 2*s, 10*s, 2*s);
  ctx.fillRect(1*s, 3*s, 2*s, 1*s);
  ctx.fillRect(11*s, 3*s, 2*s, 1*s);

  // Cat ears poking through hair
  ctx.fillStyle = '#3a2540';
  ctx.fillRect(2*s, 0, 2*s, 2*s);       // left ear outer
  ctx.fillRect(10*s, 0, 2*s, 2*s);      // right ear outer
  ctx.fillStyle = '#ffbbaa';
  ctx.fillRect(3*s, 1*s, 1*s, 1*s);     // left ear inner
  ctx.fillRect(10*s, 1*s, 1*s, 1*s);    // right ear inner

  // Face — softer rounded shape (11x8 → shaped)
  ctx.fillStyle = '#ffccbb';
  // Core face
  ctx.fillRect(2*s, 4*s, 10*s, 6*s);
  // Round cheeks: widen middle
  ctx.fillRect(1*s, 5*s, 1*s, 2*s);
  ctx.fillRect(12*s, 5*s, 1*s, 2*s);
  // Tapered chin
  ctx.fillRect(3*s, 10*s, 8*s, 1*s);
  ctx.fillRect(4*s, 11*s, 6*s, 1*s);
  // Jaw curve — trim corners
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(2*s, 11*s, 2*s, 1*s);
  ctx.fillRect(10*s, 11*s, 2*s, 1*s);
  ctx.fillRect(1*s, 10*s, 1*s, 2*s);
  ctx.fillRect(12*s, 10*s, 1*s, 2*s);

  // Restore skin at chin
  ctx.fillStyle = '#ffccbb';
  ctx.fillRect(4*s, 11*s, 6*s, 1*s);

  // Eyes — large cute
  ctx.fillStyle = '#fff';
  ctx.fillRect(3*s, 5*s, 3*s, 2*s);     // left eye
  ctx.fillRect(8*s, 5*s, 3*s, 2*s);     // right eye
  ctx.fillStyle = '#5a4080';
  ctx.fillRect(4*s, 5*s, 2*s, 2*s);     // left iris
  ctx.fillRect(9*s, 5*s, 2*s, 2*s);     // right iris
  ctx.fillStyle = '#111';
  ctx.fillRect(5*s, 5*s, 1*s, 1*s);     // left pupil
  ctx.fillRect(10*s, 5*s, 1*s, 1*s);    // right pupil
  // Eye shine
  ctx.fillStyle = '#fff';
  ctx.fillRect(5*s, 6*s, 1*s, 1*s);
  ctx.fillRect(10*s, 6*s, 1*s, 1*s);

  // Eyelashes
  ctx.fillStyle = '#3a2540';
  ctx.fillRect(2*s, 4*s, 4*s, 1*s);
  ctx.fillRect(8*s, 4*s, 4*s, 1*s);

  // Soft blush
  ctx.fillStyle = 'rgba(255, 140, 150, 0.45)';
  ctx.fillRect(2*s, 7*s, 2*s, 1*s);
  ctx.fillRect(10*s, 7*s, 2*s, 1*s);

  // Tiny cute mouth
  ctx.fillStyle = '#cc7766';
  ctx.fillRect(6*s, 8*s, 2*s, 1*s);

  // Hair strands over shoulders in front
  ctx.fillStyle = '#3a2540';
  ctx.fillRect(1*s, 9*s, 2*s, 4*s);
  ctx.fillRect(11*s, 9*s, 2*s, 4*s);
  ctx.fillRect(2*s, 12*s, 2*s, 1*s);
  ctx.fillRect(10*s, 12*s, 2*s, 1*s);
}

function setupCatTooltip() {
  const avatar = document.getElementById('cat-avatar');
  const tooltip = document.getElementById('cat-tooltip');
  if (!avatar || !tooltip) return;

  avatar.addEventListener('click', (e) => {
    e.stopPropagation();
    tooltip.classList.toggle('show');
    if (tooltip.classList.contains('show')) {
      setTimeout(() => tooltip.classList.remove('show'), 2500);
    }
  });
}

function buildMenu() {
  menuButtons.innerHTML = '';
  setTimeout(drawAvatars, 10);

  const modeLabel = document.createElement('p');
  modeLabel.style.cssText = 'font-size:12px;color:#888;margin:24px 0 8px';
  modeLabel.textContent = '—— 选择模式 ——';
  menuButtons.appendChild(modeLabel);

  const btnEscape = document.createElement('button');
  btnEscape.className = 'pixel-btn';
  btnEscape.textContent = '逃生模式';
  btnEscape.onclick = () => { gameModeSelection = GAME_MODE.ESCAPE; buildMapSelect(); };
  menuButtons.appendChild(btnEscape);

  const btnScore = document.createElement('button');
  btnScore.className = 'pixel-btn';
  btnScore.textContent = '分数模式';
  btnScore.onclick = () => { gameModeSelection = GAME_MODE.SCORE; buildMapSelect(); };
  menuButtons.appendChild(btnScore);

  const bottomLabel = document.createElement('p');
  bottomLabel.style.cssText = 'font-size:12px;color:#888;margin:24px 0 8px';
  bottomLabel.textContent = '—— 其他 ——';
  menuButtons.appendChild(bottomLabel);

  const btnTutorial = document.createElement('button');
  btnTutorial.className = 'pixel-btn';
  btnTutorial.textContent = '游戏教程';
  btnTutorial.onclick = () => showScreen('tutorial-screen');
  menuButtons.appendChild(btnTutorial);

  const btnMultiplayer = document.createElement('button');
  btnMultiplayer.className = 'pixel-btn';
  btnMultiplayer.textContent = '双人对战';
  btnMultiplayer.onclick = () => {
    showScreen('lobby-screen');
    initLobby();
  };
  menuButtons.appendChild(btnMultiplayer);

  const btnEditor = document.createElement('button');
  btnEditor.className = 'pixel-btn';
  btnEditor.textContent = '地图编辑器';
  btnEditor.onclick = () => {
    showScreen('editor-screen');
    initEditor();
  };
  menuButtons.appendChild(btnEditor);
}

function buildMapSelect() {
  menuButtons.innerHTML = '';

  const mapLabel = document.createElement('p');
  mapLabel.style.cssText = 'font-size:12px;color:#888;margin:24px 0 8px';
  mapLabel.textContent = '—— 选择地图 ——';
  menuButtons.appendChild(mapLabel);

  const maps = [
    { type: MAP_TYPE.ROOMS, label: '房间走廊' },
    { type: MAP_TYPE.OPEN, label: '开阔场地' },
    { type: MAP_TYPE.HYBRID, label: '混合式' },
  ];
  for (const m of maps) {
    const btn = document.createElement('button');
    btn.className = 'pixel-btn';
    btn.textContent = m.label;
    btn.onclick = () => { mapTypeSelection = m.type; startGame(); };
    menuButtons.appendChild(btn);
  }

  const backBtn = document.createElement('button');
  backBtn.className = 'pixel-btn';
  backBtn.textContent = '← 返回';
  backBtn.onclick = buildMenu;
  menuButtons.appendChild(backBtn);
}

function startGame() {
  if (mapTypeSelection === MAP_TYPE.CUSTOM && customMapData) {
    game.init(mapTypeSelection, gameModeSelection, customMapData);
  } else {
    game.init(mapTypeSelection, gameModeSelection);
  }
  showScreen('game-screen');
  lastTime = 0;
  accumulator = 0;
}

function initEditor() {
  const editorCanvas = document.getElementById('editor-canvas');
  const editorStatus = document.getElementById('editor-status');
  if (!editor) {
    editor = new MapEditor(editorCanvas, editorStatus);
  }

  document.getElementById('btn-editor-test').onclick = () => {
    customMapData = editor.getMapData();
    mapTypeSelection = MAP_TYPE.CUSTOM;
    startGame();
  };

  document.getElementById('btn-editor-back').onclick = () => {
    showScreen('menu-screen');
    buildMenu();
  };
}

function initLobby() {
  if (!network) {
    network = new NetworkClient(serverUrl);
    network.connect();
  }
  if (!lobby) {
    lobby = new Lobby(network, (isHost, role) => {
      startMultiplayerGame(isHost, role);
    }, () => serverUrl, (newUrl) => {
      serverUrl = newUrl;
      localStorage.setItem(STORAGE_KEY, newUrl);
      network.disconnect();
      network = new NetworkClient(serverUrl);
      network.connect();
      // Re-attach lobby to new network
      lobby.network = network;
    });
  }
  lobby.render(
    document.getElementById('lobby-content'),
    document.getElementById('lobby-status')
  );
}

function startMultiplayerGame(isHost, role) {
  isMultiplayerGame = true;

  const mapData = (mapTypeSelection === MAP_TYPE.CUSTOM && customMapData) ? customMapData : null;

  if (isHost) {
    if (mapTypeSelection === MAP_TYPE.CUSTOM && customMapData) {
      game.init(mapTypeSelection, gameModeSelection, customMapData);
    } else {
      game.init(mapTypeSelection, gameModeSelection);
    }
    game.initMultiplayer(mapTypeSelection, gameModeSelection, mapData, role || PLAYER_ROLE.SURVIVOR, true, network);
    // Send game start with map data to client
    const mapJson = game.map.toJSON();
    network.send('game_event', { event: 'game_start', mapType: mapTypeSelection, mode: gameModeSelection, mapData: mapJson, hostRole: role });
    showScreen('game-screen');
    lastTime = 0;
    accumulator = 0;
    resultShown = false;
  } else {
    // Client waits for game_start from host
    network.on('game_event', function onGameStart(msg) {
      if (msg.event === 'game_start') {
        network.off('game_event', onGameStart);
        const mData = msg.mapData ? JSON.parse(msg.mapData) : null;
        const mType = msg.mapType || MAP_TYPE.HYBRID;
        const mode = msg.mode || GAME_MODE.ESCAPE;
        const clientRole = msg.hostRole === PLAYER_ROLE.SURVIVOR ? PLAYER_ROLE.KILLER : PLAYER_ROLE.SURVIVOR;
        game.init(mType, mode, mData);
        game.initMultiplayer(mType, mode, mData, clientRole, false, network);
        showScreen('game-screen');
        lastTime = 0;
        accumulator = 0;
        resultShown = false;
      }
    });
  }
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
  if (id === 'menu-screen') startQuoteRotation();
}

function showResult() {
  const titleEl = document.getElementById('result-title');
  const iconEl = document.getElementById('result-icon');

  titleEl.textContent = game.resultTitle;
  titleEl.className = 'result-title ' + game.resultType;

  const icons = { escape: '🏆', dead: '💀', timeout: '⏰' };
  iconEl.textContent = icons[game.resultType] || '🎮';

  let stats = {};
  try { stats = JSON.parse(game.resultDetail); } catch (e) {}

  document.getElementById('stat-mode').textContent = stats.mode || '-';
  document.getElementById('stat-map').textContent = stats.map || '-';
  document.getElementById('stat-time').textContent = stats.time || '-';
  document.getElementById('stat-gens').textContent = stats.gens != null ? `${stats.gens} 台` : '-';
  document.getElementById('stat-score').textContent = stats.score != null ? stats.score : '-';

  const healthEl = document.getElementById('stat-health');
  healthEl.textContent = stats.health || '-';
  healthEl.style.color = stats.health === '幸存' || stats.health === '存活' ? '#4ecca3' : '#e94560';

  showScreen('result-screen');
}

document.getElementById('btn-restart').onclick = () => {
  if (isMultiplayerGame) {
    // Disconnect and go back to lobby
    game = new Game();
    showScreen('lobby-screen');
    initLobby();
    return;
  }
  if (mapTypeSelection === MAP_TYPE.CUSTOM && customMapData) {
    game.init(mapTypeSelection, gameModeSelection, customMapData);
  } else {
    game.init(mapTypeSelection, gameModeSelection);
  }
  showScreen('game-screen');
  lastTime = 0;
  accumulator = 0;
};

document.getElementById('btn-menu').onclick = () => {
  if (isMultiplayerGame) {
    network.disconnect();
    isMultiplayerGame = false;
    game = new Game();
  }
  showScreen('menu-screen');
  buildMenu();
};

document.getElementById('btn-tutorial-back').onclick = () => {
  showScreen('menu-screen');
  buildMenu();
};

document.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && (game.state === STATE.PLAYING || game.state === STATE.PAUSED)) {
    e.preventDefault();
    game.togglePause();
    return;
  }
  game.handleKeyDown(e.code);
});

document.addEventListener('keyup', (e) => {
  game.handleKeyUp(e.code);
});

let resultShown = false;

function gameLoop(timestamp) {
  if (lastTime === 0) {
    lastTime = timestamp;
    requestAnimationFrame(gameLoop);
    return;
  }
  const elapsed = Math.min(timestamp - lastTime, 200);
  lastTime = timestamp;

  if (game.state === STATE.PLAYING) {
    // Host or single-player: full simulation with fixed timestep
    // Client: game.update() handles input prediction + sending
    accumulator += elapsed;
    while (accumulator >= FIXED_DT) {
      game.update(FIXED_DT / 1000);
      accumulator -= FIXED_DT;
    }
  }

  renderer.render(game);

  if (game.state === STATE.RESULT && !resultShown) {
    resultShown = true;
    showResult();
  }
  if (game.state !== STATE.RESULT) {
    resultShown = false;
  }

  requestAnimationFrame(gameLoop);
}

showScreen('menu-screen');
buildMenu();
drawAvatars();
drawCatAvatar();
setupCatTooltip();
requestAnimationFrame(gameLoop);

export { canvas, ctx };

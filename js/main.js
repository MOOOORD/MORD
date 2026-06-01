// main.js
import { CANVAS_WIDTH, CANVAS_HEIGHT, STATE, GAME_MODE, MAP_TYPE } from './constants.js';
import { Game } from './game.js';
import { Renderer } from './renderer.js';

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

const FIXED_DT = 1000 / 60;
let game = new Game();
let renderer = new Renderer();
let lastTime = 0;
let accumulator = 0;
let gameModeSelection = GAME_MODE.ESCAPE;
let mapTypeSelection = MAP_TYPE.HYBRID;

const menuScreen = document.getElementById('menu-screen');
const gameScreen = document.getElementById('game-screen');
const resultScreen = document.getElementById('result-screen');
const resultTitle = document.getElementById('result-title');
const resultDetail = document.getElementById('result-detail');
const menuButtons = document.getElementById('menu-buttons');

function buildMenu() {
  menuButtons.innerHTML = '';

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
  game.init(mapTypeSelection, gameModeSelection);
  showScreen('game-screen');
  lastTime = 0;
  accumulator = 0;
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

function showResult() {
  resultTitle.textContent = game.resultTitle;
  resultDetail.textContent = game.resultDetail;
  showScreen('result-screen');
}

document.getElementById('btn-restart').onclick = () => {
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
requestAnimationFrame(gameLoop);

export { canvas, ctx };

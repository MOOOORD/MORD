// main.js
import { CANVAS_WIDTH, CANVAS_HEIGHT, STATE, GAME_MODE, MAP_TYPE } from './constants.js';

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

const FIXED_DT = 1000 / 60; // 60fps
let gameState = STATE.MENU;
let gameMode = GAME_MODE.ESCAPE;
let mapType = MAP_TYPE.HYBRID;
let lastTime = 0;
let accumulator = 0;

function update(dt) {
  // delegate to game.js update
}

function render() {
  ctx.fillStyle = '#16213e';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  // delegate to game.js render
}

function gameLoop(timestamp) {
  if (lastTime === 0) lastTime = timestamp;
  const elapsed = timestamp - lastTime;
  lastTime = timestamp;

  if (gameState === STATE.PLAYING) {
    accumulator += elapsed;
    while (accumulator >= FIXED_DT) {
      update(FIXED_DT / 1000); // pass dt in seconds
      accumulator -= FIXED_DT;
    }
  }

  render();
  requestAnimationFrame(gameLoop);
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

function startGame() {
  showScreen('game-screen');
  gameState = STATE.PLAYING;
  // game.js init will be called after all modules load
}

// Bootstrap: show menu
showScreen('menu-screen');
requestAnimationFrame(gameLoop);

export { canvas, ctx, gameState, gameMode, mapType, startGame, showScreen };

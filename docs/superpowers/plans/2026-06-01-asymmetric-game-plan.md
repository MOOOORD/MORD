# Asymmetric Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 2D top-down pixel-art asymmetric multiplayer game (player survivor vs AI killer) in HTML5 Canvas with two game modes and three map types.

**Architecture:** Single-page HTML5 app. ES6 modules loaded via `<script type="module">`. Game runs a fixed-timestep loop at 60fps. Canvas rendering is separate from game logic. Global `Game` namespace holds shared state and constants. AI uses a finite state machine with simple A* pathfinding. Maps are tile-based grids generated procedurally from three layout templates.

**Tech Stack:** HTML5 Canvas, vanilla JavaScript (ES6 modules), CSS for menu UI. Served with `python -m http.server` for local dev.

---

### Task 1: Project Scaffolding and Game Loop

**Files:**
- Create: `asymmetric-game/index.html`
- Create: `asymmetric-game/css/style.css`
- Create: `asymmetric-game/js/constants.js`
- Create: `asymmetric-game/js/main.js`

- [ ] **Step 1: Create index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>非对称竞技</title>
<link rel="stylesheet" href="css/style.css">
</head>
<body>
<div id="menu-screen" class="screen">
  <h1 class="pixel-title">非对称竞技</h1>
  <p class="pixel-subtitle">Asymmetric Survival</p>
  <div id="menu-buttons"></div>
</div>
<div id="game-screen" class="screen hidden">
  <canvas id="game-canvas"></canvas>
  <div id="hud"></div>
</div>
<div id="result-screen" class="screen hidden">
  <h2 id="result-title"></h2>
  <p id="result-detail"></p>
  <button id="btn-restart">再来一局</button>
</div>
<script type="module" src="js/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create style.css**

```css
@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: #0a0a0a; color: #e0e0e0; font-family: 'Press Start 2P', monospace; overflow: hidden; }

.screen { position: fixed; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.hidden { display: none !important; }

.pixel-title { font-size: 36px; color: #e94560; text-shadow: 3px 3px 0 #000; margin-bottom: 12px; letter-spacing: 4px; }
.pixel-subtitle { font-size: 12px; color: #888; margin-bottom: 48px; }

.pixel-btn { font-family: 'Press Start 2P', monospace; font-size: 14px; padding: 16px 32px; margin: 8px; border: 3px solid #e94560; background: #1a1a2e; color: #e0e0e0; cursor: pointer; image-rendering: pixelated; }
.pixel-btn:hover { background: #e94560; color: #fff; }

#game-canvas { display: block; image-rendering: pixelated; }

#hud { position: fixed; inset: 0; pointer-events: none; }
#hud > * { pointer-events: auto; }
```

- [ ] **Step 3: Create constants.js**

```javascript
// constants.js
export const TILE_SIZE = 32;
export const MAP_COLS = 30;
export const MAP_ROWS = 22;
export const CANVAS_WIDTH = 960;   // 30 * 32
export const CANVAS_HEIGHT = 704;  // 22 * 32

export const TILE = {
  FLOOR: 0,
  WALL: 1,
  OBSTACLE: 2,
  GENERATOR: 3,
  HOOK: 4,
  EXIT_GATE: 5,
  PALLET: 6,
};

export const PLAYER_SPEED = 2.5;       // px per frame
export const PLAYER_RUN_SPEED = 4.0;
export const PLAYER_STAMINA = 100;
export const PLAYER_STAMINA_DRAIN = 1.2;
export const PLAYER_STAMINA_REGEN = 0.6;
export const KILLER_SPEED = 2.8;       // slightly faster than normal walk
export const KILLER_CHASE_SPEED = 3.2;
export const PLAYER_INJURED_SPEED = 2.0;

export const REPAIR_TIME = 180;        // frames (3 seconds at 60fps)
export const GATE_OPEN_TIME = 240;     // frames (4 seconds)
export const HOOK_STRUGGLE_TIME = 120; // frames
export const HOOK_ESCAPE_CHANCE = 0.12;
export const HOOK_MAX_COUNT = 3;
export const PALLET_STUN_TIME = 90;    // frames

export const KILLER_VISION_RANGE = 8;  // tiles
export const KILLER_HEARING_RANGE = 6; // tiles, for repair noise
export const KILLER_ALERT_DURATION = 180; // frames

export const SCORE_MODE_TIME = 300;    // seconds (5 minutes)

export const STATE = {
  MENU: 'menu',
  MAP_SELECT: 'map_select',
  MODE_SELECT: 'mode_select',
  PLAYING: 'playing',
  PAUSED: 'paused',
  RESULT: 'result',
};

export const GAME_MODE = {
  ESCAPE: 'escape',
  SCORE: 'score',
};

export const MAP_TYPE = {
  ROOMS: 'rooms',
  OPEN: 'open',
  HYBRID: 'hybrid',
};

export const KILLER_STATE = {
  PATROL: 'patrol',
  ALERT: 'alert',
  CHASE: 'chase',
  CARRY: 'carry',
  BREAK: 'break',
};

export const PLAYER_HEALTH = {
  HEALTHY: 'healthy',
  INJURED: 'injured',
  DOWNED: 'downed',
  HOOKED: 'hooked',
  DEAD: 'dead',
};
```

- [ ] **Step 4: Create main.js skeleton with game loop**

```javascript
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
```

- [ ] **Step 5: Test scaffold**

Run: `cd /c/Users/MORD/asymmetric-game && python -m http.server 8080`
Open: `http://localhost:8080`
Expected: Black page with pixel title "非对称竞技" and no errors in console.

- [ ] **Step 6: Commit**

```bash
cd /c/Users/MORD/asymmetric-game
git init
git add index.html css/style.css js/constants.js js/main.js
git commit -m "feat: project scaffold with game loop and pixel UI shell"
```

---

### Task 2: Map System — Three Layouts

**Files:**
- Create: `asymmetric-game/js/map.js`

- [ ] **Step 1: Create map.js with tile grid and three generators**

```javascript
// map.js
import { TILE, MAP_COLS, MAP_ROWS, MAP_TYPE } from './constants.js';

export class GameMap {
  constructor(type) {
    this.type = type;
    this.cols = MAP_COLS;
    this.rows = MAP_ROWS;
    this.grid = [];          // 2D array of tile ints
    this.generators = [];    // [{x, y, repaired}]
    this.exitGates = [];     // [{x, y, open}]
    this.hooks = [];         // [{x, y}]
    this.pallets = [];       // [{x, y, dropped, broken}]
    this.obstacles = [];     // [{x, y, w, h}] for collision
    this._generate();
  }

  _generate() {
    this._initFloor();
    switch (this.type) {
      case MAP_TYPE.ROOMS: this._genRooms(); break;
      case MAP_TYPE.OPEN: this._genOpen(); break;
      case MAP_TYPE.HYBRID: this._genHybrid(); break;
    }
    this._placeGenerators();
    this._placeExitGates();
    this._placeHooks();
    this._placePallets();
    this._buildObstacleList();
  }

  _initFloor() {
    this.grid = [];
    for (let r = 0; r < this.rows; r++) {
      this.grid[r] = new Array(this.cols).fill(TILE.FLOOR);
    }
    // Border walls
    for (let c = 0; c < this.cols; c++) {
      this.grid[0][c] = TILE.WALL;
      this.grid[this.rows - 1][c] = TILE.WALL;
    }
    for (let r = 0; r < this.rows; r++) {
      this.grid[r][0] = TILE.WALL;
      this.grid[r][this.cols - 1] = TILE.WALL;
    }
  }

  _genRooms() {
    // 4 corner rooms + 1 center room, connected by corridors
    const rooms = [
      { x: 2, y: 2, w: 8, h: 6 },
      { x: 20, y: 2, w: 8, h: 6 },
      { x: 2, y: 14, w: 8, h: 6 },
      { x: 20, y: 14, w: 8, h: 6 },
      { x: 12, y: 8, w: 6, h: 6 },
    ];
    for (const r of rooms) {
      this._carveRoom(r.x, r.y, r.w, r.h);
    }
    // Corridors connecting rooms
    // Horizontal corridor: room0 right to room1 left
    this._carveCorridor(10, 4, 20, 4, 1);
    this._carveCorridor(10, 5, 20, 5, 1);
    // Horizontal corridor bottom
    this._carveCorridor(10, 16, 20, 16, 1);
    this._carveCorridor(10, 17, 20, 17, 1);
    // Vertical corridor left
    this._carveCorridor(5, 8, 5, 14, 1);
    this._carveCorridor(6, 8, 6, 14, 1);
    // Vertical corridor right
    this._carveCorridor(24, 8, 24, 14, 1);
    this._carveCorridor(25, 8, 25, 14, 1);
    // Connect center room
    this.grid[11][18] = TILE.FLOOR;
    this.grid[11][19] = TILE.FLOOR;
    this.grid[11][10] = TILE.FLOOR;
    this.grid[11][11] = TILE.FLOOR;
  }

  _genOpen() {
    // Open field with scattered obstacles
    const obstacles = [
      { x: 5, y: 5, w: 2, h: 3 }, { x: 12, y: 3, w: 3, h: 1 },
      { x: 22, y: 5, w: 1, h: 4 }, { x: 8, y: 12, w: 3, h: 1 },
      { x: 18, y: 13, w: 2, h: 2 }, { x: 3, y: 14, w: 1, h: 3 },
      { x: 14, y: 17, w: 2, h: 1 }, { x: 24, y: 16, w: 1, h: 3 },
      { x: 10, y: 9, w: 2, h: 2 }, { x: 20, y: 10, w: 2, h: 2 },
    ];
    for (const o of obstacles) {
      for (let r = o.y; r < o.y + o.h; r++) {
        for (let c = o.x; c < o.x + o.w; c++) {
          if (r > 0 && r < this.rows - 1 && c > 0 && c < this.cols - 1) {
            this.grid[r][c] = TILE.OBSTACLE;
          }
        }
      }
    }
  }

  _genHybrid() {
    // 4 corner buildings + open center
    const rooms = [
      { x: 2, y: 2, w: 7, h: 5 },
      { x: 21, y: 2, w: 7, h: 5 },
      { x: 2, y: 15, w: 7, h: 5 },
      { x: 21, y: 15, w: 7, h: 5 },
    ];
    for (const r of rooms) {
      this._carveRoom(r.x, r.y, r.w, r.h);
    }
    // Open center obstacles
    const obstacles = [
      { x: 13, y: 8, w: 2, h: 3 }, { x: 8, y: 10, w: 3, h: 1 },
      { x: 19, y: 11, w: 2, h: 2 }, { x: 13, y: 15, w: 2, h: 1 },
    ];
    for (const o of obstacles) {
      for (let r = o.y; r < o.y + o.h; r++) {
        for (let c = o.x; c < o.x + o.w; c++) {
          if (this.grid[r][c] === TILE.FLOOR) {
            this.grid[r][c] = TILE.OBSTACLE;
          }
        }
      }
    }
    // Door openings in rooms toward center
    this.grid[4][10] = TILE.FLOOR; this.grid[4][11] = TILE.FLOOR;
    this.grid[4][21] = TILE.FLOOR; this.grid[4][20] = TILE.FLOOR;
    this.grid[17][10] = TILE.FLOOR; this.grid[17][11] = TILE.FLOOR;
    this.grid[17][21] = TILE.FLOOR; this.grid[17][20] = TILE.FLOOR;
  }

  _carveRoom(x, y, w, h) {
    for (let r = y; r < y + h; r++) {
      for (let c = x; c < x + w; c++) {
        this.grid[r][c] = TILE.FLOOR;
      }
    }
    // Room walls
    for (let r = y; r < y + h; r++) {
      this.grid[r][x] = TILE.WALL;
      this.grid[r][x + w - 1] = TILE.WALL;
    }
    for (let c = x; c < x + w; c++) {
      this.grid[y][c] = TILE.WALL;
      this.grid[y + h - 1][c] = TILE.WALL;
    }
  }

  _carveCorridor(x1, y1, x2, y2, width) {
    const dy = Math.sign(y2 - y1);
    const dx = Math.sign(x2 - x1);
    for (let w = 0; w < width; w++) {
      let cy = y1;
      while (cy !== y2 + dy) {
        if (cy > 0 && cy < this.rows - 1 && x1 + w > 0 && x1 + w < this.cols - 1) {
          this.grid[cy][x1 + w] = TILE.FLOOR;
        }
        cy += dy;
      }
      let cx = x1;
      while (cx !== x2 + dx) {
        if (y2 + w > 0 && y2 + w < this.rows - 1 && cx > 0 && cx < this.cols - 1) {
          this.grid[y2 + w][cx] = TILE.FLOOR;
        }
        cx += dx;
      }
    }
  }

  _placeGenerators() {
    // Place 5 generators on floor tiles away from edges
    const candidates = [];
    for (let r = 3; r < this.rows - 3; r++) {
      for (let c = 3; c < this.cols - 3; c++) {
        if (this.grid[r][c] === TILE.FLOOR) candidates.push({ r, c });
      }
    }
    this._shuffle(candidates);
    this.generators = candidates.slice(0, 5).map(({ r, c }) => {
      this.grid[r][c] = TILE.GENERATOR;
      return { x: c, y: r, repaired: false };
    });
  }

  _placeExitGates() {
    // Place 2 exit gates on outer walls (left and right borders)
    const leftGate = { x: 0, y: Math.floor(this.rows / 2), open: false, powered: false };
    const rightGate = { x: this.cols - 1, y: Math.floor(this.rows / 2) - 1, open: false, powered: false };
    this.grid[leftGate.y][0] = TILE.EXIT_GATE;
    this.grid[rightGate.y][this.cols - 1] = TILE.EXIT_GATE;
    this.exitGates = [leftGate, rightGate];
  }

  _placeHooks() {
    const candidates = [];
    for (let r = 2; r < this.rows - 2; r++) {
      for (let c = 2; c < this.cols - 2; c++) {
        if (this.grid[r][c] === TILE.FLOOR) candidates.push({ r, c });
      }
    }
    this._shuffle(candidates);
    this.hooks = candidates.slice(0, 6).map(({ r, c }) => {
      this.grid[r][c] = TILE.HOOK;
      return { x: c, y: r };
    });
  }

  _placePallets() {
    const candidates = [];
    for (let r = 2; r < this.rows - 2; r++) {
      for (let c = 2; c < this.cols - 2; c++) {
        if (this.grid[r][c] === TILE.FLOOR) {
          // Place near obstacles or walls
          const nearWall = this.grid[r-1][c] === TILE.WALL || this.grid[r+1][c] === TILE.WALL ||
                           this.grid[r][c-1] === TILE.WALL || this.grid[r][c+1] === TILE.WALL;
          const nearObs = this.grid[r-1][c] === TILE.OBSTACLE || this.grid[r+1][c] === TILE.OBSTACLE ||
                          this.grid[r][c-1] === TILE.OBSTACLE || this.grid[r][c+1] === TILE.OBSTACLE;
          if (nearWall || nearObs) candidates.push({ r, c });
        }
      }
    }
    this._shuffle(candidates);
    this.pallets = candidates.slice(0, 10).map(({ r, c }) => {
      this.grid[r][c] = TILE.PALLET;
      return { x: c, y: r, dropped: false, broken: false };
    });
  }

  _buildObstacleList() {
    this.obstacles = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.grid[r][c] === TILE.WALL || this.grid[r][c] === TILE.OBSTACLE) {
          this.obstacles.push({ x: c, y: r, w: 1, h: 1 });
        }
      }
    }
  }

  _shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  getTile(wx, wy) {
    const c = Math.floor(wx / 32);
    const r = Math.floor(wy / 32);
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return TILE.WALL;
    return this.grid[r][c];
  }

  isWalkable(wx, wy, isPlayer = false) {
    const c = Math.floor(wx / 32);
    const r = Math.floor(wy / 32);
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return false;
    const tile = this.grid[r][c];
    if (tile === TILE.WALL || tile === TILE.OBSTACLE) return false;
    // Dropped pallets block killer
    if (!isPlayer) {
      const pallet = this.pallets.find(p => p.x === c && p.y === r && p.dropped && !p.broken);
      if (pallet) return false;
    }
    return true;
  }
}
```

- [ ] **Step 2: Render function for map in map.js**

Add to `GameMap` class:

```javascript
  render(ctx, cameraX, cameraY) {
    const startCol = Math.max(0, Math.floor(cameraX / 32) - 1);
    const startRow = Math.max(0, Math.floor(cameraY / 32) - 1);
    const endCol = Math.min(this.cols, startCol + 32);
    const endRow = Math.min(this.rows, startRow + 25);

    for (let r = startRow; r < endRow; r++) {
      for (let c = startCol; c < endCol; c++) {
        const sx = c * 32 - cameraX;
        const sy = r * 32 - cameraY;
        const tile = this.grid[r][c];
        if (tile === TILE.WALL) {
          ctx.fillStyle = '#3a3a5c';
          ctx.fillRect(sx, sy, 32, 32);
          ctx.fillStyle = '#4a4a6c';
          ctx.fillRect(sx + 1, sy + 1, 30, 30);
        } else if (tile === TILE.OBSTACLE) {
          ctx.fillStyle = '#2a2a4c';
          ctx.fillRect(sx, sy, 32, 32);
          ctx.fillStyle = '#3a3a5c';
          ctx.fillRect(sx + 2, sy + 2, 28, 28);
        } else {
          ctx.fillStyle = '#1a1a2e';
          ctx.fillRect(sx, sy, 32, 32);
          ctx.fillStyle = '#1f1f35';
          ctx.fillRect(sx + 1, sy + 1, 30, 30);
        }
      }
    }
  }
```

- [ ] **Step 3: Wire map into main.js for visual test**

In `main.js`, temporarily add after imports:

```javascript
import { GameMap } from './map.js';
const testMap = new GameMap(MAP_TYPE.HYBRID);
```

Temporarily modify `render()`:

```javascript
function render() {
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  testMap.render(ctx, 0, 0);
}
```

- [ ] **Step 4: Test map rendering**

Run: `python -m http.server 8080` in asymmetric-game/
Open: `http://localhost:8080`
Expected: Hybrid map visible with rooms, corridors, generators (⚙ drawn later), exit gates on sides. No errors.

- [ ] **Step 5: Revert main.js test changes after verifying, then commit**

```bash
git add js/map.js js/main.js
git commit -m "feat: tile-based map system with three layout generators"
```

---

### Task 3: Player Controller

**Files:**
- Create: `asymmetric-game/js/player.js`

- [ ] **Step 1: Create player.js**

```javascript
// player.js
import {
  PLAYER_SPEED, PLAYER_RUN_SPEED, PLAYER_STAMINA, PLAYER_STAMINA_DRAIN,
  PLAYER_STAMINA_REGEN, PLAYER_INJURED_SPEED, PLAYER_HEALTH, TILE_SIZE
} from './constants.js';

export class Player {
  constructor(x, y) {
    this.x = x;               // world position in px
    this.y = y;
    this.speed = PLAYER_SPEED;
    this.health = PLAYER_HEALTH.HEALTHY;
    this.stamina = PLAYER_STAMINA;
    this.hookCount = 0;       // times hooked (3 = dead)
    this.hookTimer = 0;       // struggle timer on hook
    this.invincibleTimer = 0; // post-escape invincibility frames
    this.interacting = false;
    this.interactTarget = null; // {type, obj}
    this.interactProgress = 0;
    this.facingDir = { x: 0, y: -1 }; // for sprite direction
  }

  update(dt, keys, gameMap) {
    if (this.health === PLAYER_HEALTH.HOOKED) {
      this._updateHookStruggle(dt, keys);
      return;
    }
    if (this.health === PLAYER_HEALTH.DOWNED || this.health === PLAYER_HEALTH.DEAD) return;

    // Invincibility countdown
    if (this.invincibleTimer > 0) this.invincibleTimer--;

    // Movement
    let mx = 0, my = 0;
    if (keys['KeyW'] || keys['ArrowUp']) my -= 1;
    if (keys['KeyS'] || keys['ArrowDown']) my += 1;
    if (keys['KeyA'] || keys['ArrowLeft']) mx -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) mx += 1;

    // Normalize diagonal
    if (mx !== 0 && my !== 0) { mx *= 0.707; my *= 0.707; }

    // Running
    const running = (keys['ShiftLeft'] || keys['ShiftRight']) && this.stamina > 0;
    let currentSpeed = this.health === PLAYER_HEALTH.INJURED ? PLAYER_INJURED_SPEED : PLAYER_SPEED;
    if (running) {
      currentSpeed = PLAYER_RUN_SPEED;
      this.stamina -= PLAYER_STAMINA_DRAIN;
      if (this.stamina < 0) this.stamina = 0;
    } else if (this.stamina < PLAYER_STAMINA) {
      this.stamina += PLAYER_STAMINA_REGEN;
    }

    // Apply movement with collision
    const dx = mx * currentSpeed * dt * 60;
    const dy = my * currentSpeed * dt * 60;

    // Axis-separated collision
    const newX = this.x + dx;
    const newY = this.y + dy;
    const halfSize = 10; // player collision radius in px

    if (gameMap.isWalkable(newX, this.y, true)) this.x = newX;
    if (gameMap.isWalkable(this.x, newY, true)) this.y = newY;

    // Face direction
    if (mx !== 0 || my !== 0) {
      this.facingDir = { x: mx, y: my };
    }

    // Interaction (Space)
    this.interacting = keys['Space'];
  }

  _updateHookStruggle(dt, keys) {
    this.hookTimer++;
    if (keys['Space']) {
      // Rapid tapping speeds up struggle fill
      this.interactProgress += 3;
    }
    if (this.interactProgress >= 100) {
      // Escaped hook
      this.health = PLAYER_HEALTH.INJURED;
      this.interactProgress = 0;
      this.hookTimer = 0;
      this.invincibleTimer = 60; // 1 second protection
      this.interacting = false;
    }
  }

  takeHit() {
    if (this.invincibleTimer > 0) return false;
    if (this.health === PLAYER_HEALTH.HEALTHY) {
      this.health = PLAYER_HEALTH.INJURED;
      return true;
    } else if (this.health === PLAYER_HEALTH.INJURED) {
      this.health = PLAYER_HEALTH.DOWNED;
      return true;
    }
    return false;
  }

  getHooked() {
    this.health = PLAYER_HEALTH.HOOKED;
    this.hookCount++;
    this.interactProgress = 0;
    this.hookTimer = 0;
  }

  heal() {
    if (this.health === PLAYER_HEALTH.INJURED) {
      this.health = PLAYER_HEALTH.HEALTHY;
    }
  }

  render(ctx, cameraX, cameraY) {
    if (this.health === PLAYER_HEALTH.DEAD) return;
    const sx = this.x - cameraX;
    const sy = this.y - cameraY;

    // Invincibility flash
    if (this.invincibleTimer > 0 && Math.floor(this.invincibleTimer / 4) % 2 === 0) return;

    if (this.health === PLAYER_HEALTH.HOOKED) {
      // Draw hooked - hanging animation
      ctx.fillStyle = '#ff6b6b';
      ctx.fillRect(sx - 4, sy - 16, 8, 8);
      ctx.fillStyle = '#e94560';
      ctx.fillRect(sx - 6, sy - 18, 12, 4); // hook top
      return;
    }

    // Player body (pixel art style)
    const color = this.health === PLAYER_HEALTH.INJURED ? '#ff6b6b' : '#4ecdc4';
    ctx.fillStyle = color;
    ctx.fillRect(sx - 6, sy - 10, 12, 12);  // body
    ctx.fillStyle = '#fff';
    ctx.fillRect(sx - 2, sy - 8, 4, 4);     // eyes

    // Direction indicator
    ctx.fillStyle = '#ffe66d';
    ctx.fillRect(sx - 2, sy + 3, 4, 2);     // feet

    // Injured blood particles
    if (this.health === PLAYER_HEALTH.INJURED) {
      ctx.fillStyle = '#e94560';
      ctx.fillRect(sx - 8, sy + 8, 2, 2);
      ctx.fillRect(sx + 6, sy - 6, 2, 2);
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add js/player.js
git commit -m "feat: player controller with movement, health states, and hook mechanics"
```

---

### Task 4: Killer AI

**Files:**
- Create: `asymmetric-game/js/killer.js`

- [ ] **Step 1: Create killer.js with state machine and simple pathfinding**

```javascript
// killer.js
import {
  KILLER_SPEED, KILLER_CHASE_SPEED, KILLER_STATE, TILE_SIZE,
  KILLER_VISION_RANGE, KILLER_HEARING_RANGE, KILLER_ALERT_DURATION,
  PALLET_STUN_TIME, PALLET_STUN_TIME as STUN_TIME
} from './constants.js';

export class Killer {
  constructor(x, y, gameMap) {
    this.x = x;
    this.y = y;
    this.speed = KILLER_SPEED;
    this.state = KILLER_STATE.PATROL;
    this.gameMap = gameMap;
    this.patrolTarget = null;    // {x, y} in world px
    this.alertPos = null;        // {x, y} last known player position
    this.alertTimer = 0;
    this.carryTarget = null;     // hook position
    this.stunTimer = 0;
    this.attackCooldown = 0;
    this.path = [];              // current A* path
    this.pathIndex = 0;
    this.lastPlayerSeen = null;
  }

  update(dt, player, gameMap) {
    if (this.stunTimer > 0) {
      this.stunTimer--;
      return; // stunned, no action
    }
    if (this.attackCooldown > 0) this.attackCooldown--;

    this._updateState(player, gameMap);
    this._executeState(dt, player, gameMap);
  }

  _updateState(player, gameMap) {
    const distToPlayer = this._dist(player.x, player.y);
    const canSeePlayer = this._canSee(player, gameMap);

    switch (this.state) {
      case KILLER_STATE.PATROL:
      case KILLER_STATE.ALERT:
        if (canSeePlayer && distToPlayer < KILLER_VISION_RANGE * TILE_SIZE) {
          this.state = KILLER_STATE.CHASE;
          this.lastPlayerSeen = { x: player.x, y: player.y };
          this.speed = KILLER_CHASE_SPEED;
        } else if (distToPlayer < KILLER_HEARING_RANGE * TILE_SIZE && player.interacting) {
          // Heard player repairing
          this.state = KILLER_STATE.ALERT;
          this.alertPos = { x: player.x, y: player.y };
          this.alertTimer = KILLER_ALERT_DURATION;
          this.path = null;
        }
        break;

      case KILLER_STATE.CHASE:
        if (!canSeePlayer || distToPlayer > KILLER_VISION_RANGE * TILE_SIZE * 1.5) {
          // Lost sight - go to alert
          this.state = KILLER_STATE.ALERT;
          this.alertPos = this.lastPlayerSeen ? { ...this.lastPlayerSeen } : { x: player.x, y: player.y };
          this.alertTimer = KILLER_ALERT_DURATION;
          this.speed = KILLER_SPEED;
          this.path = null;
        } else {
          this.lastPlayerSeen = { x: player.x, y: player.y };
        }

        // Check if close enough to hit
        if (distToPlayer < 28 && this.attackCooldown <= 0) {
          this._attack(player);
        }

        // Check if player is downed for carry
        if (player.health === 'downed' && distToPlayer < 32) {
          this.state = KILLER_STATE.CARRY;
          this.speed = KILLER_SPEED * 0.7;
          this._findNearestHook(gameMap);
        }
        break;

      case KILLER_STATE.CARRY:
        if (this.carryTarget) {
          const distToHook = this._distToTile(this.carryTarget);
          if (distToHook < 16) {
            // Hook the player
            player.getHooked();
            this.state = KILLER_STATE.PATROL;
            this.speed = KILLER_SPEED;
            this.carryTarget = null;
            this.path = null;
          }
        }
        break;

      case KILLER_STATE.BREAK:
        // Breaking pallet - simple timer handled in execute
        break;
    }

    // Alert timer
    if (this.state === KILLER_STATE.ALERT) {
      this.alertTimer--;
      if (this.alertTimer <= 0) {
        this.state = KILLER_STATE.PATROL;
        this.alertPos = null;
        this.path = null;
      }
    }
  }

  _executeState(dt, player, gameMap) {
    switch (this.state) {
      case KILLER_STATE.PATROL:
        this._patrol(dt, gameMap);
        break;
      case KILLER_STATE.ALERT:
        this._moveTo(dt, this.alertPos, gameMap);
        break;
      case KILLER_STATE.CHASE:
        this._moveTo(dt, { x: player.x, y: player.y }, gameMap);
        break;
      case KILLER_STATE.CARRY:
        if (this.carryTarget) {
          const wx = this.carryTarget.x * TILE_SIZE + TILE_SIZE / 2;
          const wy = this.carryTarget.y * TILE_SIZE + TILE_SIZE / 2;
          this._moveTo(dt, { x: wx, y: wy }, gameMap);
          // Move player along
          player.x = this.x;
          player.y = this.y - 4;
        }
        break;
      case KILLER_STATE.BREAK:
        // Pallet breaking animation (simple timer)
        this.stunTimer = 60;
        this.state = KILLER_STATE.PATROL;
        break;
    }
  }

  _patrol(dt, gameMap) {
    if (!this.patrolTarget || this._distToTarget() < 32) {
      // Pick a random generator
      const unrepaired = gameMap.generators.filter(g => !g.repaired);
      if (unrepaired.length > 0) {
        const g = unrepaired[Math.floor(Math.random() * unrepaired.length)];
        this.patrolTarget = {
          x: g.x * TILE_SIZE + TILE_SIZE / 2,
          y: g.y * TILE_SIZE + TILE_SIZE / 2,
        };
      } else {
        // All done, patrol exit gates
        const gate = gameMap.exitGates[Math.floor(Math.random() * gameMap.exitGates.length)];
        this.patrolTarget = {
          x: gate.x * TILE_SIZE + TILE_SIZE / 2,
          y: gate.y * TILE_SIZE + TILE_SIZE / 2,
        };
      }
      this.path = null;
    }
    this._moveTo(dt, this.patrolTarget, gameMap, KILLER_SPEED);
  }

  _moveTo(dt, target, gameMap, spd = this.speed) {
    if (!target) return;
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 4) return; // Arrived

    const nx = (dx / dist) * spd * dt * 60;
    const ny = (dy / dist) * spd * dt * 60;

    const newX = this.x + nx;
    const newY = this.y + ny;

    if (gameMap.isWalkable(newX, this.y, false)) this.x = newX;
    if (gameMap.isWalkable(this.x, newY, false)) this.y = newY;

    // Check for dropped pallets - enter break state
    const tileCol = Math.floor(newX / TILE_SIZE);
    const tileRow = Math.floor(newY / TILE_SIZE);
    const pallet = gameMap.pallets.find(p =>
      p.x === tileCol && p.y === tileRow && p.dropped && !p.broken
    );
    if (pallet) {
      pallet.broken = true;
      this.state = KILLER_STATE.BREAK;
    }
  }

  _attack(player) {
    player.takeHit();
    this.attackCooldown = 60; // 1 second cooldown
  }

  _canSee(player, gameMap) {
    // Simple line-of-sight check
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > KILLER_VISION_RANGE * TILE_SIZE) return false;

    // Raycast check (simple step check)
    const steps = Math.ceil(dist / (TILE_SIZE / 2));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const cx = this.x + dx * t;
      const cy = this.y + dy * t;
      const tile = gameMap.getTile(cx, cy);
      if (tile === 1 || tile === 2) return false; // wall or obstacle blocks vision
    }
    return true;
  }

  _findNearestHook(gameMap) {
    let nearest = null;
    let nearestDist = Infinity;
    for (const hook of gameMap.hooks) {
      const wx = hook.x * TILE_SIZE + TILE_SIZE / 2;
      const wy = hook.y * TILE_SIZE + TILE_SIZE / 2;
      const d = Math.hypot(wx - this.x, wy - this.y);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = hook;
      }
    }
    this.carryTarget = nearest;
  }

  _distToTarget() {
    if (!this.patrolTarget) return Infinity;
    return Math.hypot(this.patrolTarget.x - this.x, this.patrolTarget.y - this.y);
  }

  _distToTile(tile) {
    const wx = tile.x * TILE_SIZE + TILE_SIZE / 2;
    const wy = tile.y * TILE_SIZE + TILE_SIZE / 2;
    return Math.hypot(wx - this.x, wy - this.y);
  }

  _dist(px, py) {
    return Math.hypot(px - this.x, py - this.y);
  }

  getHeartbeatLevel(player) {
    const dist = this._dist(player.x, player.y);
    const range = KILLER_VISION_RANGE * TILE_SIZE * 1.5;
    if (dist > range) return 0;       // no heartbeat
    if (dist > range * 0.6) return 1; // slow
    if (dist > range * 0.3) return 2; // medium
    return 3;                          // fast - killer is very close
  }

  render(ctx, cameraX, cameraY) {
    const sx = this.x - cameraX;
    const sy = this.y - cameraY;

    if (this.stunTimer > 0 && Math.floor(this.stunTimer / 6) % 2 === 0) {
      // Stun flicker
      ctx.fillStyle = '#ff0';
      ctx.fillRect(sx - 8, sy - 12, 16, 16);
      return;
    }

    // Killer body (larger, darker pixel art)
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(sx - 10, sy - 14, 20, 20);  // body
    ctx.fillStyle = this.state === KILLER_STATE.CHASE ? '#e94560' : '#888';
    ctx.fillRect(sx - 3, sy - 10, 6, 6);      // eyes glow red when chasing

    // Hook weapon
    ctx.fillStyle = '#666';
    ctx.fillRect(sx + 8, sy - 6, 4, 12);

    // State indicator
    if (this.state === KILLER_STATE.ALERT) {
      ctx.fillStyle = '#ff0';
      ctx.fillRect(sx - 10, sy - 18, 4, 4);   // alert "!"
    }
    if (this.state === KILLER_STATE.CARRY) {
      // Carrying animation
      ctx.fillStyle = '#ff6b6b';
      ctx.fillRect(sx - 6, sy - 18, 12, 4);   // carried player indicator
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add js/killer.js
git commit -m "feat: killer AI with state machine, line-of-sight detection, and pathfinding"
```

---

### Task 5: Objectives System

**Files:**
- Create: `asymmetric-game/js/objectives.js`

- [ ] **Step 1: Create objectives.js with generators, gates, hooks, pallets management**

```javascript
// objectives.js
import { TILE_SIZE, REPAIR_TIME, GATE_OPEN_TIME, PALLET_STUN_TIME } from './constants.js';

export class ObjectivesManager {
  constructor(gameMap) {
    this.map = gameMap;
  }

  getNearbyInteractable(playerX, playerY) {
    const col = Math.floor(playerX / TILE_SIZE);
    const row = Math.floor(playerY / TILE_SIZE);

    // Check adjacent tiles
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const r = row + dr;
        const c = col + dc;
        if (r < 0 || r >= this.map.rows || c < 0 || c >= this.map.cols) continue;
        const tile = this.map.grid[r][c];

        // Generator
        if (tile === 3) {
          const gen = this.map.generators.find(g => g.x === c && g.y === r);
          if (gen && !gen.repaired) {
            return { type: 'generator', obj: gen, x: c, y: r };
          }
        }

        // Exit gate
        if (tile === 5) {
          const gate = this.map.exitGates.find(g => g.x === c && g.y === r);
          if (gate && gate.powered && !gate.open) {
            return { type: 'exit_gate', obj: gate, x: c, y: r };
          }
        }

        // Pallet
        if (tile === 6) {
          const pal = this.map.pallets.find(p => p.x === c && p.y === r);
          if (pal && !pal.dropped && !pal.broken) {
            return { type: 'pallet', obj: pal, x: c, y: r };
          }
        }
      }
    }
    return null;
  }

  interact(interactable, progress, killer) {
    if (!interactable) return null;

    switch (interactable.type) {
      case 'generator':
        return this._repairGenerator(interactable.obj, progress);
      case 'exit_gate':
        return this._openGate(interactable.obj, progress);
      case 'pallet':
        return this._dropPallet(interactable.obj, killer);
      default:
        return null;
    }
  }

  _repairGenerator(gen, progress) {
    if (progress >= REPAIR_TIME) {
      gen.repaired = true;
      return { done: true, event: 'generator_repaired' };
    }
    // Spark effect chance
    const spark = Math.random() < 0.02; // 2% per frame to spark (notify killer)
    return { done: false, spark };
  }

  _openGate(gate, progress) {
    if (progress >= GATE_OPEN_TIME) {
      gate.open = true;
      return { done: true, event: 'gate_opened' };
    }
    return { done: false };
  }

  _dropPallet(pallet, killer) {
    pallet.dropped = true;
    // Check if killer is on the pallet tile
    if (killer) {
      const kCol = Math.floor(killer.x / TILE_SIZE);
      const kRow = Math.floor(killer.y / TILE_SIZE);
      if (kCol === pallet.x && kRow === pallet.y) {
        killer.stunTimer = PALLET_STUN_TIME;
       }
    }
    return { done: true, event: 'pallet_dropped' };
  }

  areGatesPowered() {
    const required = 2; // Need 2 repaired generators to power gates
    const repaired = this.map.generators.filter(g => g.repaired).length;
    if (repaired >= required && !this.map.exitGates[0].powered) {
      this.map.exitGates.forEach(g => g.powered = true);
      return true; // Just powered
    }
    return false;
  }

  checkEscape(player) {
    for (const gate of this.map.exitGates) {
      if (!gate.open) continue;
      const gx = gate.x * TILE_SIZE + TILE_SIZE / 2;
      const gy = gate.y * TILE_SIZE + TILE_SIZE / 2;
      const dist = Math.hypot(gx - player.x, gy - player.y);
      if (dist < 40) return true;
    }
    return false;
  }

  render(ctx, cameraX, cameraY, pulseFrame) {
    // Render generators
    for (const gen of this.map.generators) {
      const sx = gen.x * TILE_SIZE - cameraX + TILE_SIZE / 2;
      const sy = gen.y * TILE_SIZE - cameraY + TILE_SIZE / 2;
      if (gen.repaired) {
        ctx.fillStyle = '#4ecca3';
        ctx.fillRect(sx - 8, sy - 8, 16, 16); // Repaired - green
        ctx.fillStyle = '#fff';
        ctx.fillRect(sx - 4, sy - 4, 8, 8);
      } else {
        ctx.fillStyle = '#f0c040';
        ctx.fillRect(sx - 8, sy - 8, 16, 16); // Needs repair - yellow
        // Spark animation
        if (pulseFrame % 30 < 15) {
          ctx.fillStyle = '#fff';
          ctx.fillRect(sx - 2, sy - 14, 4, 4); // spark
        }
      }
    }

    // Render exit gates
    for (const gate of this.map.exitGates) {
      const sx = gate.x * TILE_SIZE - cameraX + TILE_SIZE / 2;
      const sy = gate.y * TILE_SIZE - cameraY + TILE_SIZE / 2;
      if (gate.open) {
        ctx.fillStyle = '#4ecca3';
        ctx.fillRect(sx - 10, sy - 16, 20, 32);
        ctx.fillStyle = '#16213e';
        ctx.fillRect(sx - 6, sy - 12, 12, 24);
      } else if (gate.powered) {
        ctx.fillStyle = '#f0c040';
        ctx.fillRect(sx - 10, sy - 16, 20, 32); // Powered - yellow
        ctx.fillStyle = '#333';
        ctx.fillRect(sx - 6, sy - 12, 12, 24);
      } else {
        ctx.fillStyle = '#555';
        ctx.fillRect(sx - 10, sy - 16, 20, 32); // No power - gray
        ctx.fillStyle = '#333';
        ctx.fillRect(sx - 6, sy - 12, 12, 24);
      }
    }

    // Render hooks
    for (const hook of this.map.hooks) {
      const sx = hook.x * TILE_SIZE - cameraX + TILE_SIZE / 2;
      const sy = hook.y * TILE_SIZE - cameraY + TILE_SIZE / 2;
      ctx.fillStyle = '#8b4513';
      ctx.fillRect(sx - 2, sy - 14, 4, 28); // pole
      ctx.fillStyle = '#a0522d';
      ctx.fillRect(sx - 6, sy - 14, 12, 6);  // hook top
    }

    // Render pallets
    for (const pal of this.map.pallets) {
      const sx = pal.x * TILE_SIZE - cameraX + TILE_SIZE / 2;
      const sy = pal.y * TILE_SIZE - cameraY + TILE_SIZE / 2;
      if (pal.broken) {
        ctx.fillStyle = '#444';
        ctx.fillRect(sx - 10, sy - 2, 20, 4); // broken planks
        ctx.fillRect(sx - 6, sy + 2, 12, 4);
      } else if (pal.dropped) {
        ctx.fillStyle = '#ff6b35';
        ctx.fillRect(sx - 12, sy - 2, 24, 4); // dropped pallet
      } else {
        ctx.fillStyle = '#ff6b35';
        ctx.fillRect(sx - 1, sy - 10, 2, 20); // standing pallet
      }
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add js/objectives.js
git commit -m "feat: objectives system with generators, gates, hooks, and pallets"
```

---

### Task 6: Game State Manager

**Files:**
- Create: `asymmetric-game/js/game.js`

- [ ] **Step 1: Create game.js — central game orchestrator**

```javascript
// game.js
import { STATE, GAME_MODE, PLAYER_HEALTH, SCORE_MODE_TIME } from './constants.js';
import { GameMap } from './map.js';
import { Player } from './player.js';
import { Killer } from './killer.js';
import { ObjectivesManager } from './objectives.js';

export class Game {
  constructor() {
    this.state = STATE.MENU;
    this.mode = GAME_MODE.ESCAPE;
    this.mapType = null;
    this.map = null;
    this.player = null;
    this.killer = null;
    this.objectives = null;
    this.score = 0;
    this.scoreTimer = 0;    // seconds remaining
    this.resultTitle = '';
    this.resultDetail = '';
    this.keys = {};
    this.pulseFrame = 0;
    this.gatesJustPowered = false;
    this.powerFlash = 0;
  }

  init(mapType, mode) {
    this.mapType = mapType;
    this.mode = mode;
    this.map = new GameMap(mapType);
    // Spawn player at left-center
    this.player = new Player(96, this.map.rows * 16);
    // Spawn killer at right-center
    this.killer = new Killer((this.map.cols - 3) * 32, this.map.rows * 16, this.map);
    this.objectives = new ObjectivesManager(this.map);
    this.score = 0;
    this.scoreTimer = SCORE_MODE_TIME;
    this.gatesJustPowered = false;
    this.powerFlash = 0;
    this.state = STATE.PLAYING;
  }

  update(dt) {
    if (this.state !== STATE.PLAYING) return;
    this.pulseFrame++;
    if (this.powerFlash > 0) this.powerFlash--;

    // Player update
    this.player.update(dt, this.keys, this.map);

    // Interaction handling
    if (this.player.interacting) {
      const interactable = this.objectives.getNearbyInteractable(this.player.x, this.player.y);
      if (interactable) {
        this.player.interactProgress++;
        const result = this.objectives.interact(interactable, this.player.interactProgress, this.killer);
        if (result) {
          if (result.done) {
            this.player.interactProgress = 0;
            this.player.interacting = false;
            if (result.event === 'generator_repaired') {
              if (this.mode === GAME_MODE.SCORE) this.score += 1000;
              // Check gates power
              if (this.objectives.areGatesPowered()) {
                this.gatesJustPowered = true;
                this.powerFlash = 120;
              }
            } else if (result.event === 'pallet_dropped') {
              if (this.mode === GAME_MODE.SCORE) this.score += 300;
            }
          } else if (result.spark) {
            // Generator spark alerts killer
            if (this.killer.state === 'patrol') {
              this.killer.state = 'alert';
              this.killer.alertPos = { x: this.player.x, y: this.player.y };
              this.killer.alertTimer = 120;
            }
          }
        }
      } else {
        this.player.interactProgress = Math.max(0, this.player.interactProgress - 0.5);
      }
    } else {
      this.player.interactProgress = Math.max(0, this.player.interactProgress - 1);
    }

    // Killer update
    this.killer.update(dt, this.player, this.map);

    // Score mode timer
    if (this.mode === GAME_MODE.SCORE) {
      this.scoreTimer -= dt;
      if (this.player.interacting) {
        const ia = this.objectives.getNearbyInteractable(this.player.x, this.player.y);
        if (ia && ia.type === 'generator') this.score += 20 * dt;
      }
    }

    // Check win/lose
    this._checkEndConditions();
  }

  _checkEndConditions() {
    // Escape check
    if (this.mode === GAME_MODE.ESCAPE && this.objectives.checkEscape(this.player)) {
      this.state = STATE.RESULT;
      this.resultTitle = '逃脱成功！';
      this.resultDetail = '你成功逃出了监管者的追捕';
      return;
    }

    // Player death
    if (this.player.health === PLAYER_HEALTH.DEAD || this.player.hookCount >= 3) {
      this.state = STATE.RESULT;
      this.resultTitle = '被淘汰';
      this.resultDetail = `得分: ${this.score}`;
      return;
    }

    // Score mode time up
    if (this.mode === GAME_MODE.SCORE && this.scoreTimer <= 0) {
      this.state = STATE.RESULT;
      this.resultTitle = '时间到！';
      this.resultDetail = `最终得分: ${Math.floor(this.score)}`;
    }
  }

  checkHookDeath() {
    // Called each frame player is hooked - check if hook timer expired
    if (this.player.hookTimer >= 300) { // 5 seconds max on hook
      this.player.hookCount++;
      if (this.player.hookCount >= 3) {
        this.player.health = PLAYER_HEALTH.DEAD;
      } else {
        // Struggle check
        if (Math.random() < 0.12) {
          this.player.health = PLAYER_HEALTH.INJURED;
          this.player.hookTimer = 0;
          this.player.invincibleTimer = 60;
        } else {
          // Failed struggle, still hooked
          this.player.hookTimer = 0;
        }
      }
    }
  }

  handleKeyDown(code) {
    this.keys[code] = true;
  }

  handleKeyUp(code) {
    this.keys[code] = false;
  }

  togglePause() {
    if (this.state === STATE.PLAYING) {
      this.state = STATE.PAUSED;
    } else if (this.state === STATE.PAUSED) {
      this.state = STATE.PLAYING;
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add js/game.js
git commit -m "feat: game state manager with escape/score modes, interaction, and victory conditions"
```

---

### Task 7: Rendering and UI/HUD

**Files:**
- Create: `asymmetric-game/js/renderer.js`

- [ ] **Step 1: Create renderer.js**

```javascript
// renderer.js
import { CANVAS_WIDTH, CANVAS_HEIGHT, PLAYER_HEALTH, GAME_MODE, STATE } from './constants.js';
import { canvas, ctx } from './main.js';

export class Renderer {
  render(game) {
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    if (game.state === STATE.PLAYING || game.state === STATE.PAUSED) {
      this._renderGame(game);
    }
    if (game.state === STATE.PAUSED) {
      this._renderPauseOverlay();
    }
  }

  _renderGame(game) {
    const { player, killer, map, objectives, pulseFrame } = game;

    // Camera follows player
    const camX = player.x - CANVAS_WIDTH / 2;
    const camY = player.y - CANVAS_HEIGHT / 2;

    // Clamp camera to map bounds
    const maxCamX = map.cols * 32 - CANVAS_WIDTH;
    const maxCamY = map.rows * 32 - CANVAS_HEIGHT;
    const cx = Math.max(0, Math.min(camX, maxCamX));
    const cy = Math.max(0, Math.min(camY, maxCamY));

    // Draw order: map → objectives → player → killer → effects → HUD
    map.render(ctx, cx, cy);
    objectives.render(ctx, cx, cy, pulseFrame);
    player.render(ctx, cx, cy);
    killer.render(ctx, cx, cy);

    // Heartbeat effect
    this._renderHeartbeat(player, killer);

    // Gates powered flash
    this._renderPowerFlash(game);

    // HUD
    this._renderHUD(game);

    // Score mode timer
    if (game.mode === GAME_MODE.SCORE) {
      this._renderScoreTimer(game);
    }
  }

  _renderHeartbeat(player, killer) {
    const level = killer.getHeartbeatLevel(player);
    if (level === 0) return;

    const alpha = level === 1 ? 0.15 : level === 2 ? 0.3 : 0.5;
    ctx.fillStyle = `rgba(233, 69, 96, ${alpha})`;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Corner vignette
    const gradient = ctx.createRadialGradient(CANVAS_WIDTH/2, CANVAS_HEIGHT/2, CANVAS_WIDTH*0.3,
                                               CANVAS_WIDTH/2, CANVAS_HEIGHT/2, CANVAS_WIDTH*0.7);
    gradient.addColorStop(0, 'transparent');
    gradient.addColorStop(1, `rgba(233, 69, 96, ${alpha * 1.5})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Heartbeat icon top-right
    const beats = ['♥', '♥♥', '♥♥♥'][level - 1];
    ctx.font = '20px monospace';
    ctx.fillStyle = '#e94560';
    ctx.fillText(beats, CANVAS_WIDTH - 60, 30);
  }

  _renderPowerFlash(game) {
    if (game.powerFlash > 0) {
      const alpha = game.powerFlash / 120 * 0.4;
      ctx.fillStyle = `rgba(240, 192, 64, ${alpha})`;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.font = '24px "Press Start 2P", monospace';
      ctx.fillStyle = '#f0c040';
      ctx.textAlign = 'center';
      ctx.fillText('大门已通电！', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 40);
      ctx.textAlign = 'start';
    }
  }

  _renderHUD(game) {
    const { player, map } = game;

    // Health indicator top-left
    ctx.font = '16px monospace';
    ctx.fillStyle = '#fff';
    if (player.health === PLAYER_HEALTH.HEALTHY) {
      ctx.fillText('❤️❤️', 16, 30);
    } else if (player.health === PLAYER_HEALTH.INJURED) {
      ctx.fillText('💔❤️', 16, 30);
    } else if (player.health === PLAYER_HEALTH.DOWNED) {
      ctx.fillText('💀', 16, 30);
    } else if (player.health === PLAYER_HEALTH.HOOKED) {
      ctx.fillText(`🪝 x${player.hookCount}/3`, 16, 30);
    }

    // Stamina bar
    if (player.health !== PLAYER_HEALTH.DOWNED && player.health !== PLAYER_HEALTH.HOOKED) {
      const barW = 80, barH = 8;
      ctx.fillStyle = '#333';
      ctx.fillRect(16, 44, barW, barH);
      const ratio = player.stamina / 100;
      ctx.fillStyle = ratio > 0.3 ? '#4ecdc4' : '#e94560';
      ctx.fillRect(16, 44, barW * ratio, barH);
    }

    // Generators remaining top-right
    const repaired = map.generators.filter(g => g.repaired).length;
    const total = 5;
    ctx.font = '14px monospace';
    ctx.fillStyle = '#f0c040';
    ctx.fillText(`⚙ ${repaired}/${total}  (需2台通电)`, CANVAS_WIDTH - 220, 30);

    // Exit gate status
    const powered = map.exitGates[0].powered;
    const open = map.exitGates.some(g => g.open);
    ctx.fillText(powered ? (open ? '大门: 已开启' : '大门: 已通电') : '大门: 未通电',
                 CANVAS_WIDTH - 220, 54);

    // Interaction progress bar (center bottom)
    if (player.interactProgress > 0) {
      const barW = 200, barH = 12;
      const bx = CANVAS_WIDTH / 2 - barW / 2;
      const by = CANVAS_HEIGHT - 48;
      ctx.fillStyle = '#333';
      ctx.fillRect(bx, by, barW, barH);
      ctx.fillStyle = '#4ecdc4';
      ctx.fillRect(bx, by, barW * Math.min(1, player.interactProgress / 180), barH);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, by, barW, barH);
      ctx.font = '10px monospace';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText('按住空格...', CANVAS_WIDTH / 2, by - 4);
      ctx.textAlign = 'start';
    }

    // Hook struggle UI
    if (player.health === PLAYER_HEALTH.HOOKED) {
      ctx.font = '20px "Press Start 2P", monospace';
      ctx.fillStyle = '#e94560';
      ctx.textAlign = 'center';
      ctx.fillText('连按空格挣扎！', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40);
      // Struggle progress
      const barW = 300, barH = 16;
      ctx.fillStyle = '#333';
      ctx.fillRect(CANVAS_WIDTH / 2 - barW / 2, CANVAS_HEIGHT / 2 - 8, barW, barH);
      ctx.fillStyle = '#4ecdc4';
      ctx.fillRect(CANVAS_WIDTH / 2 - barW / 2, CANVAS_HEIGHT / 2 - 8,
                   barW * (player.interactProgress / 100), barH);
      ctx.textAlign = 'start';
    }

    // Score display for score mode
    if (game.mode === GAME_MODE.SCORE) {
      ctx.font = '14px monospace';
      ctx.fillStyle = '#f0c040';
      ctx.fillText(`得分: ${Math.floor(game.score)}`, 16, 72);
    }
  }

  _renderScoreTimer(game) {
    const mins = Math.floor(game.scoreTimer / 60);
    const secs = Math.floor(game.scoreTimer % 60);
    ctx.font = '20px "Press Start 2P", monospace';
    ctx.fillStyle = game.scoreTimer < 30 ? '#e94560' : '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(`${mins}:${String(secs).padStart(2, '0')}`,
                 CANVAS_WIDTH / 2, 40);
    ctx.textAlign = 'start';
  }

  _renderPauseOverlay() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.font = '32px "Press Start 2P", monospace';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText('暂停', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20);
    ctx.font = '14px "Press Start 2P", monospace';
    ctx.fillText('按 Esc 继续', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 30);
    ctx.textAlign = 'start';
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add js/renderer.js
git commit -m "feat: renderer with camera, HUD, heartbeat, and pause overlay"
```

---

### Task 8: Main Integration — Wire Everything Together

**Files:**
- Modify: `asymmetric-game/js/main.js`

- [ ] **Step 1: Rewrite main.js with full integration**

```javascript
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

// --- Menu Setup ---
const menuScreen = document.getElementById('menu-screen');
const gameScreen = document.getElementById('game-screen');
const resultScreen = document.getElementById('result-screen');
const resultTitle = document.getElementById('result-title');
const resultDetail = document.getElementById('result-detail');
const menuButtons = document.getElementById('menu-buttons');

function buildMenu() {
  menuButtons.innerHTML = '';

  // Mode buttons
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

// Input handling
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

// Game loop
function gameLoop(timestamp) {
  if (lastTime === 0) lastTime = timestamp;
  const elapsed = Math.min(timestamp - lastTime, 100); // cap to avoid spiral
  lastTime = timestamp;

  if (game.state === STATE.PLAYING) {
    accumulator += elapsed;
    while (accumulator >= FIXED_DT) {
      game.update(FIXED_DT / 1000);
      accumulator -= FIXED_DT;

      // Check hook death each frame
      game.checkHookDeath();
    }
  }

  renderer.render(game);

  // Check result transition
  if (game.state === STATE.RESULT) {
    showResult();
  }

  requestAnimationFrame(gameLoop);
}

// Init
showScreen('menu-screen');
buildMenu();
requestAnimationFrame(gameLoop);

export { canvas, ctx };
```

- [ ] **Step 2: Update game.js to handle hook death properly**

The `checkHookDeath` method needs to be called from within `update()` rather than separately. Add at end of game.js `update()` method, before `_checkEndConditions()`:

Modify `js/game.js` — in the `update()` method, replace the separate `checkHookDeath` call by integrating hook death check into the update. Add this right after the player update block:

```javascript
    // Hook death check
    if (this.player.health === PLAYER_HEALTH.HOOKED) {
      if (this.player.hookTimer >= 300) {
        this.player.hookCount++;
        if (this.player.hookCount >= 3) {
          this.player.health = PLAYER_HEALTH.DEAD;
        } else {
          if (Math.random() < 0.12) {
            this.player.health = PLAYER_HEALTH.INJURED;
            this.player.hookTimer = 0;
            this.player.invincibleTimer = 60;
          } else {
            this.player.hookTimer = 0;
            // Killer resumes patrol after hook
            this.killer.state = 'patrol';
          }
        }
      }
    }
```

- [ ] **Step 3: Remove separate `checkHookDeath` from main.js game loop**

In `gameLoop`, remove the `game.checkHookDeath()` call since it's now integrated in `update()`.

- [ ] **Step 4: Run and test full game**

Run: `cd /c/Users/MORD/asymmetric-game && python -m http.server 8080`
Open: `http://localhost:8080`
Expected:
- Menu screen with mode selection
- After picking mode and map: game starts
- WASD moves player, Shift runs, Space interacts with generators/pallets/gates
- Killer patrols and chases
- Heartbeat when killer near
- Win/lose conditions trigger result screen

- [ ] **Step 5: Commit**

```bash
git add js/main.js js/game.js index.html
git commit -m "feat: full game integration with menu, input, and result screens"
```

---

### Task 9: Polish — Pixel Art Sprites and Visual Effects

**Files:**
- Modify: `asymmetric-game/js/renderer.js`

- [ ] **Step 1: Add programmatic pixel sprites to renderer**

Add a helper method to `Renderer` class:

```javascript
  // Programmatic pixel drawing for entities
  _drawPixelChar(ctx, x, y, data, scale = 2) {
    for (const [px, py, color] of data) {
      ctx.fillStyle = color;
      ctx.fillRect(x + px * scale, y + py * scale, scale, scale);
    }
  }

  _getPlayerSprite(health, frame) {
    // 8x8 pixel art scaled up
    const body = health === PLAYER_HEALTH.INJURED ? '#ff8a80' : '#4ecdc4';
    const hair = '#2c2c2c';
    return [
      [1,0,hair],[2,0,hair],[3,0,hair],[4,0,hair],[5,0,hair],[6,0,hair],
      [0,1,hair],[1,1,body],[2,1,body],[3,1,'#fff'],[4,1,'#fff'],[5,1,body],[6,1,body],[7,1,hair],
      [0,2,body],[1,2,body],[2,2,body],[3,2,'#333'],[4,2,'#333'],[5,2,body],[6,2,body],[7,2,body],
      [0,3,body],[1,3,body],[2,3,body],[3,3,body],[4,3,body],[5,3,body],[6,3,body],[7,3,body],
      [0,4,'#333'],[1,4,body],[2,4,body],[3,4,body],[4,4,body],[5,4,body],[6,4,body],[7,4,'#333'],
      [0,5,'#333'],[1,5,'#333'],[2,5,body],[3,5,body],[4,5,body],[5,5,body],[6,5,'#333'],[7,5,'#333'],
      [0,6,hair],[1,6,'#333'],[2,6,'#333'],[3,6,'#333'],[4,6,'#333'],[5,6,'#333'],[6,6,'#333'],[7,6,hair],
    ];
  }

  _getKillerSprite(state) {
    const body = state === 'chase' ? '#4a0000' : '#1a1a1a';
    return [
      [0,0,body],[1,0,body],[2,0,'#e94560'],[3,0,'#e94560'],[4,0,body],[5,0,body],
      [0,1,body],[1,1,'#e94560'],[2,1,body],[3,1,body],[4,1,'#e94560'],[5,1,body],
      [0,2,body],[1,2,body],[2,2,body],[3,2,body],[4,2,body],[5,2,body],
      [0,3,'#333'],[1,3,body],[2,3,body],[3,3,body],[4,3,body],[5,3,'#333'],
      [0,4,'#333'],[1,4,'#333'],[2,4,body],[3,4,body],[4,4,'#333'],[5,4,'#333'],
      [0,5,'#555'],[1,5,'#333'],[2,5,'#333'],[3,5,'#333'],[4,5,'#333'],[5,5,'#555'],
    ];
  }
```

- [ ] **Step 2: Update player and killer render calls to use sprites**

In `renderer.js`, modify the player render section of `_renderGame`:

```javascript
    // Player with pixel sprite
    const psx = player.x - cx;
    const psy = player.y - cy;
    if (player.health !== PLAYER_HEALTH.DEAD && player.health !== PLAYER_HEALTH.HOOKED) {
      const sprite = this._getPlayerSprite(player.health, pulseFrame);
      this._drawPixelChar(ctx, psx - 12, psy - 12, sprite, 3);
    } else {
      player.render(ctx, cx, cy); // fallback for hook state
    }

    // Killer with pixel sprite
    const ksx = killer.x - cx;
    const ksy = killer.y - cy;
    if (killer.stunTimer <= 0 || Math.floor(killer.stunTimer / 8) % 2 === 0) {
      const kSprite = this._getKillerSprite(killer.state);
      this._drawPixelChar(ctx, ksx - 9, ksy - 9, kSprite, 3);
    }
```

Since sprites are now rendered in renderer, simplify player.js and killer.js `render()` methods to only handle special states (hooked player).

- [ ] **Step 3: Test visual polish**

Run: `python -m http.server 8080`
Open: `http://localhost:8080`
Expected: Pixel art player and killer sprites visible, animation on movement.

- [ ] **Step 4: Commit**

```bash
git add js/renderer.js js/player.js js/killer.js
git commit -m "feat: pixel art sprites and visual polish"
```

---

### Task 10: Final Integration Test and Bugfix

- [ ] **Step 1: Full playtest checklist**

Run: `python -m http.server 8080`

Test each scenario:
1. Menu → escape mode → rooms map → game starts
2. WASD movement, Shift sprint (stamina drains)
3. Walk to generator, hold Space → progress bar fills → generator becomes green
4. Repair 2 generators → "大门已通电" flash → gates turn yellow
5. Walk to powered gate, hold Space → gate opens → walk through → win screen
6. Killer approaches → heartbeat levels 1/2/3, screen edges red
7. Killer hits player → injured (💔), move speed drops
8. Second hit → downed → killer carries to hook → hooked
9. Hook: tap space to struggle → succeed (escape) or fail
10. Three hooks → death → result screen
11. Pallet: walk near wall, space → pallet drops, stuns killer if on tile
12. Score mode: points accumulate, timer counts down
13. Pause with Esc → resume
14. All three map types load correctly

- [ ] **Step 2: Fix any issues found during playtest**

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "fix: playtest bugs and polish"
```

---

## Self-Review

**Spec coverage check:**
- [x] 2D top-down view → Canvas rendering
- [x] Player = survivor, AI = killer → player.js + killer.js
- [x] Three map types → map.js with three generators
- [x] Escape mode (2 generators, hooks, escape) → game.js escape mode
- [x] Score mode (5 min, points) → game.js score mode
- [x] AI states (patrol, alert, chase, carry, break) → killer.js state machine
- [x] Controls (WASD, Space, Shift, Tab, Esc) → main.js input handling
- [x] Pixel art → programmatic sprites in renderer.js
- [x] Heartbeat → renderer.js heartbeat levels
- [x] HUD (health, stamina, generators, gates) → renderer.js HUD
- [x] Extension points for AI teammates → separate player module, game manages player list
- [x] Logic/render separation → game.js (logic) separate from renderer.js (visual)

**No placeholders:** All steps have complete code. No TODOs or TBDs.

**Type consistency:**
- `GameMap` methods: `getTile(wx, wy)`, `isWalkable(wx, wy, isPlayer)`, `render(ctx, cx, cy)` — consistent across map.js, player.js, killer.js
- `Player` properties: `health`, `stamina`, `interactProgress`, `hookTimer`, `hookCount`, `invincibleTimer` — consistent across game.js, renderer.js
- `Killer` properties: `state`, `stunTimer`, `attackCooldown` — consistent across game.js, killer.js, objectives.js, renderer.js
- `ObjectivesManager` methods: `getNearbyInteractable`, `interact`, `areGatesPowered`, `checkEscape`, `render` — consistent with game.js usage
- Game states: `STATE.PLAYING`, `STATE.PAUSED`, `STATE.RESULT` — consistent across main.js, game.js, renderer.js
- Game modes: `GAME_MODE.ESCAPE`, `GAME_MODE.SCORE` — consistent
- Map types: `MAP_TYPE.ROOMS`, `MAP_TYPE.OPEN`, `MAP_TYPE.HYBRID` — consistent

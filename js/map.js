// map.js
import { TILE, MAP_COLS, MAP_ROWS, MAP_TYPE, TILE_SIZE, CANVAS_WIDTH, CANVAS_HEIGHT } from './constants.js';

export class GameMap {
  constructor(type, data = null) {
    this.type = type;
    this.cols = MAP_COLS;
    this.rows = MAP_ROWS;
    this.grid = [];          // 2D array of tile ints
    this.generators = [];    // [{x, y, repaired}]
    this.exitGates = [];     // [{x, y, open, powered}]
    this.hooks = [];         // [{x, y}]
    this.pallets = [];       // [{x, y, dropped, broken}]
    this.obstacles = [];     // [{x, y, w, h}] for collision

    if (data !== null) {
      this._loadFromData(data);
    } else {
      this._generate();
    }
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
    this._ensureCorridorPallets();
    this._placeWindows();
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
    // Corridors connecting rooms — 1 tile wide to create chokepoints
    this._carveCorridor(9, 4, 20, 4, 1);
    this._carveCorridor(9, 16, 20, 16, 1);
    this._carveCorridor(5, 7, 5, 14, 1);
    this._carveCorridor(24, 7, 24, 14, 1);
    // Connect center room — carve 1-wide openings through its walls
    this.grid[11][12] = TILE.FLOOR; // left wall
    this.grid[11][17] = TILE.FLOOR; // right wall
  }

  _genOpen() {
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
    const rooms = [
      { x: 2, y: 2, w: 7, h: 5 },
      { x: 21, y: 2, w: 7, h: 5 },
      { x: 2, y: 15, w: 7, h: 5 },
      { x: 21, y: 15, w: 7, h: 5 },
    ];
    for (const r of rooms) {
      this._carveRoom(r.x, r.y, r.w, r.h);
    }
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
    // Door openings in room walls — 1-wide chokepoints
    // Top-left room (2,2,7,5): right wall x=8, bottom wall y=6
    this.grid[4][8] = TILE.FLOOR;
    this.grid[6][4] = TILE.FLOOR;
    // Top-right room (21,2,7,5): left wall x=21, bottom wall y=6
    this.grid[4][21] = TILE.FLOOR;
    this.grid[6][24] = TILE.FLOOR;
    // Bottom-left room (2,15,7,5): right wall x=8, top wall y=15
    this.grid[17][8] = TILE.FLOOR;
    this.grid[15][4] = TILE.FLOOR;
    // Bottom-right room (21,15,7,5): left wall x=21, top wall y=15
    this.grid[17][21] = TILE.FLOOR;
    this.grid[15][24] = TILE.FLOOR;
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
    const isBlocked = t => t === TILE.WALL || t === TILE.OBSTACLE;

    for (let r = 2; r < this.rows - 2; r++) {
      for (let c = 2; c < this.cols - 2; c++) {
        if (this.grid[r][c] !== TILE.FLOOR) continue;
        const n = isBlocked(this.grid[r-1][c]), s = isBlocked(this.grid[r+1][c]);
        const w = isBlocked(this.grid[r][c-1]), e = isBlocked(this.grid[r][c+1]);
        const blocked = n + s + w + e;
        if (blocked >= 2) {
          candidates.push({ r, c, blocked });
        }
      }
    }
    candidates.sort((a, b) => b.blocked - a.blocked);
    this.pallets = candidates.slice(0, 16).map(({ r, c }) => {
      this.grid[r][c] = TILE.PALLET;
      return { x: c, y: r, dropped: false, broken: false };
    });
  }

  _placeWindows() {
    const candidates = [];
    for (let r = 1; r < this.rows - 1; r++) {
      for (let c = 1; c < this.cols - 1; c++) {
        if (this.grid[r][c] !== TILE.WALL) continue;
        const left = this.grid[r][c - 1], right = this.grid[r][c + 1];
        const up = this.grid[r - 1][c], down = this.grid[r + 1][c];
        const isFloor = t => t === TILE.FLOOR || t === TILE.GENERATOR || t === TILE.PALLET;
        if ((isFloor(left) && isFloor(right)) || (isFloor(up) && isFloor(down))) {
          candidates.push({ r, c });
        }
      }
    }
    this._shuffle(candidates);
    const count = Math.min(12, candidates.length);
    for (let i = 0; i < count; i++) {
      this.grid[candidates[i].r][candidates[i].c] = TILE.WINDOW;
    }
  }

  _ensureCorridorPallets() {
    // Place a pallet in every narrow corridor segment
    for (let r = 2; r < this.rows - 2; r++) {
      for (let c = 2; c < this.cols - 2; c++) {
        if (this.grid[r][c] !== TILE.FLOOR) continue;
        const nWall = this.grid[r - 1][c] === TILE.WALL;
        const sWall = this.grid[r + 1][c] === TILE.WALL;
        const wWall = this.grid[r][c - 1] === TILE.WALL;
        const eWall = this.grid[r][c + 1] === TILE.WALL;
        const isCorridor = (nWall && sWall) || (wWall && eWall);
        if (!isCorridor) continue;
        const hasPalletNear = this.pallets.some(p =>
          Math.abs(p.x - c) <= 3 && Math.abs(p.y - r) <= 3
        );
        if (!hasPalletNear && this.pallets.length < 16) {
          this.grid[r][c] = TILE.PALLET;
          this.pallets.push({ x: c, y: r, dropped: false, broken: false });
        }
      }
    }
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

  _rebuildFromGrid() {
    this.generators = [];
    this.exitGates = [];
    this.hooks = [];
    this.pallets = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        switch (this.grid[r][c]) {
          case TILE.GENERATOR:
            this.generators.push({ x: c, y: r, repaired: false });
            break;
          case TILE.HOOK:
            this.hooks.push({ x: c, y: r });
            break;
          case TILE.EXIT_GATE:
            this.exitGates.push({ x: c, y: r, open: false, powered: false });
            break;
          case TILE.PALLET:
            this.pallets.push({ x: c, y: r, dropped: false, broken: false });
            break;
        }
      }
    }
  }

  _loadFromData(data) {
    if (data.grid && Array.isArray(data.grid) && data.grid.length === this.rows) {
      this.grid = data.grid.map(row => [...row]);
    } else {
      this._initFloor();
    }
    this._rebuildFromGrid();
    this._buildObstacleList();
  }

  toJSON() {
    return JSON.stringify({
      version: 1,
      name: 'custom',
      grid: this.grid,
    }, null, 2);
  }

  static fromJSON(jsonString) {
    const data = JSON.parse(jsonString);
    if (!data.grid || !Array.isArray(data.grid)) {
      throw new Error('无效的地图数据：缺少 grid');
    }
    return new GameMap(MAP_TYPE.CUSTOM, data);
  }

  render(ctx, cameraX, cameraY) {
    const startCol = Math.max(0, Math.floor(cameraX / TILE_SIZE));
    const startRow = Math.max(0, Math.floor(cameraY / TILE_SIZE));
    const endCol = Math.min(this.cols, startCol + Math.ceil(CANVAS_WIDTH / TILE_SIZE) + 1);
    const endRow = Math.min(this.rows, startRow + Math.ceil(CANVAS_HEIGHT / TILE_SIZE) + 1);

    for (let r = startRow; r < endRow; r++) {
      for (let c = startCol; c < endCol; c++) {
        const tile = this.grid[r][c];
        const sx = c * TILE_SIZE - cameraX;
        const sy = r * TILE_SIZE - cameraY;

        switch (tile) {
          case TILE.WALL:
            ctx.fillStyle = '#16213e';
            ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
            ctx.fillStyle = '#1a1a40';
            ctx.fillRect(sx + 2, sy + 2, TILE_SIZE - 4, TILE_SIZE - 4);
            break;
          case TILE.WINDOW:
            ctx.fillStyle = '#16213e';
            ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
            ctx.fillStyle = '#2a4a6a';
            ctx.fillRect(sx + 2, sy + 2, TILE_SIZE - 4, TILE_SIZE - 4);
            ctx.fillStyle = '#5a8ab5';
            ctx.fillRect(sx + 4, sy + 4, TILE_SIZE - 8, TILE_SIZE - 8);
            ctx.fillStyle = '#1a1a2e';
            ctx.fillRect(sx + 6, sy, 4, TILE_SIZE);
            ctx.fillRect(sx + TILE_SIZE - 10, sy, 4, TILE_SIZE);
            break;
          case TILE.OBSTACLE:
            ctx.fillStyle = '#0f3460';
            ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
            ctx.fillStyle = '#1a1a3e';
            ctx.fillRect(sx + 1, sy + 1, TILE_SIZE - 2, TILE_SIZE - 2);
            break;
          default:
            ctx.fillStyle = '#1a1a2e';
            ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
            break;
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
    const c = Math.floor(wx / TILE_SIZE);
    const r = Math.floor(wy / TILE_SIZE);
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return TILE.WALL;
    return this.grid[r][c];
  }

  isWalkable(wx, wy, isPlayer = false) {
    const c = Math.floor(wx / TILE_SIZE);
    const r = Math.floor(wy / TILE_SIZE);
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return false;
    const tile = this.grid[r][c];
    if (tile === TILE.WALL || tile === TILE.OBSTACLE) return false;
    if (tile === TILE.WINDOW && isPlayer) return false;
    return true;
  }
}

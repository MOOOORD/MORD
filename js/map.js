// map.js
import { TILE, MAP_COLS, MAP_ROWS, MAP_TYPE, TILE_SIZE } from './constants.js';

export class GameMap {
  constructor(type) {
    this.type = type;
    this.cols = MAP_COLS;
    this.rows = MAP_ROWS;
    this.grid = [];          // 2D array of tile ints
    this.generators = [];    // [{x, y, repaired}]
    this.exitGates = [];     // [{x, y, open, powered}]
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
    this._carveCorridor(10, 4, 20, 4, 1);
    this._carveCorridor(10, 5, 20, 5, 1);
    this._carveCorridor(10, 16, 20, 16, 1);
    this._carveCorridor(10, 17, 20, 17, 1);
    this._carveCorridor(5, 8, 5, 14, 1);
    this._carveCorridor(6, 8, 6, 14, 1);
    this._carveCorridor(24, 8, 24, 14, 1);
    this._carveCorridor(25, 8, 25, 14, 1);
    // Connect center room
    this.grid[11][18] = TILE.FLOOR;
    this.grid[11][19] = TILE.FLOOR;
    this.grid[11][10] = TILE.FLOOR;
    this.grid[11][11] = TILE.FLOOR;
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
    for (let r = 2; r < this.rows - 2; r++) {
      for (let c = 2; c < this.cols - 2; c++) {
        if (this.grid[r][c] === TILE.FLOOR) {
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
    if (!isPlayer) {
      const pallet = this.pallets.find(p => p.x === c && p.y === r && p.dropped && !p.broken);
      if (pallet) return false;
    }
    return true;
  }
}

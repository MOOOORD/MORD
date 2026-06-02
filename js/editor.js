// editor.js
import { TILE, MAP_COLS, MAP_ROWS, EDITOR_TILE_SIZE, TILE_LABELS, MAP_TYPE } from './constants.js';
import { GameMap } from './map.js';

export class MapEditor {
  constructor(canvas, statusEl) {
    this.canvas = canvas;
    this.canvas.width = MAP_COLS * EDITOR_TILE_SIZE;
    this.canvas.height = MAP_ROWS * EDITOR_TILE_SIZE;
    this.ctx = canvas.getContext('2d');
    this.statusEl = statusEl;
    this.tileSize = EDITOR_TILE_SIZE;
    this.grid = [];
    this.selectedTile = TILE.WALL;
    this.isPainting = false;
    this.lastPlacedCol = -1;
    this.lastPlacedRow = -1;
    this.isErasing = false;

    this._initEmpty();
    this._buildPalette();
    this._setupEvents();
    this._setupActionButtons();
    this.render();
  }

  // ---- Grid ----

  _initEmpty() {
    this.grid = [];
    for (let r = 0; r < MAP_ROWS; r++) {
      this.grid[r] = new Array(MAP_COLS).fill(TILE.FLOOR);
    }
    for (let c = 0; c < MAP_COLS; c++) {
      this.grid[0][c] = TILE.WALL;
      this.grid[MAP_ROWS - 1][c] = TILE.WALL;
    }
    for (let r = 0; r < MAP_ROWS; r++) {
      this.grid[r][0] = TILE.WALL;
      this.grid[r][MAP_COLS - 1] = TILE.WALL;
    }
  }

  _isBorder(col, row) {
    return row === 0 || row === MAP_ROWS - 1 || col === 0 || col === MAP_COLS - 1;
  }

  placeTile(col, row) {
    if (col < 0 || col >= MAP_COLS || row < 0 || row >= MAP_ROWS) return;
    const current = this.grid[row][col];
    const sel = this.selectedTile;

    if (current === sel) return;

    const isBorder = this._isBorder(col, row);

    switch (sel) {
      case TILE.FLOOR:
        if (isBorder) return;
        this.grid[row][col] = TILE.FLOOR;
        break;

      case TILE.WALL:
        this.grid[row][col] = TILE.WALL;
        break;

      case TILE.OBSTACLE:
        if (isBorder) return;
        this.grid[row][col] = TILE.OBSTACLE;
        break;

      case TILE.GENERATOR:
      case TILE.HOOK:
      case TILE.PALLET:
        if (current !== TILE.FLOOR) return;
        this.grid[row][col] = sel;
        break;

      case TILE.EXIT_GATE:
        if (current !== TILE.WALL) return;
        this.grid[row][col] = TILE.EXIT_GATE;
        break;

      case TILE.WINDOW:
        if (current !== TILE.WALL) return;
        if (isBorder) return;
        this.grid[row][col] = TILE.WINDOW;
        break;
    }

    this.render();
  }

  eraseTile(col, row) {
    if (col < 0 || col >= MAP_COLS || row < 0 || row >= MAP_ROWS) return;
    if (this._isBorder(col, row)) return;
    if (this.grid[row][col] === TILE.FLOOR) return;
    this.grid[row][col] = TILE.FLOOR;
    this.render();
  }

  // ---- Palette ----

  _buildPalette() {
    const palette = document.getElementById('editor-palette');
    palette.innerHTML = '';

    const tileOrder = [TILE.FLOOR, TILE.WALL, TILE.OBSTACLE, TILE.GENERATOR, TILE.HOOK, TILE.EXIT_GATE, TILE.PALLET, TILE.WINDOW];

    for (const tile of tileOrder) {
      const info = TILE_LABELS[tile];
      const btn = document.createElement('button');
      btn.className = 'editor-tile-btn';
      if (tile === this.selectedTile) btn.classList.add('selected');
      btn.dataset.tile = tile;

      const swatch = document.createElement('div');
      swatch.className = 'tile-swatch';
      swatch.style.background = info.color;
      btn.appendChild(swatch);

      const label = document.createElement('span');
      label.textContent = info.name;
      btn.appendChild(label);

      btn.addEventListener('click', () => {
        this.selectedTile = tile;
        palette.querySelectorAll('.editor-tile-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      });

      palette.appendChild(btn);
    }
  }

  // ---- Mouse Events ----

  _setupEvents() {
    this.canvas.addEventListener('mousedown', (e) => this._onMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this._onMouseMove(e));
    this.canvas.addEventListener('mouseup', () => this._onMouseUp());
    this.canvas.addEventListener('mouseleave', () => this._onMouseUp());
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _tileFromEvent(e) {
    const rect = this.canvas.getBoundingClientRect();
    const col = Math.floor((e.clientX - rect.left) / this.tileSize);
    const row = Math.floor((e.clientY - rect.top) / this.tileSize);
    return { col, row };
  }

  _onMouseDown(e) {
    const { col, row } = this._tileFromEvent(e);
    this.isPainting = true;
    this.isErasing = (e.button === 2);
    if (this.isErasing) {
      this.eraseTile(col, row);
    } else {
      this.placeTile(col, row);
    }
    this.lastPlacedCol = col;
    this.lastPlacedRow = row;
  }

  _onMouseMove(e) {
    if (!this.isPainting) return;
    const { col, row } = this._tileFromEvent(e);
    if (col === this.lastPlacedCol && row === this.lastPlacedRow) return;
    this.lastPlacedCol = col;
    this.lastPlacedRow = row;
    if (this.isErasing) {
      this.eraseTile(col, row);
    } else {
      this.placeTile(col, row);
    }
  }

  _onMouseUp() {
    this.isPainting = false;
    this.isErasing = false;
    this.lastPlacedCol = -1;
    this.lastPlacedRow = -1;
  }

  // ---- Rendering ----

  render() {
    const ctx = this.ctx;
    const ts = this.tileSize;

    for (let r = 0; r < MAP_ROWS; r++) {
      for (let c = 0; c < MAP_COLS; c++) {
        const tile = this.grid[r][c];
        const sx = c * ts;
        const sy = r * ts;

        switch (tile) {
          case TILE.WALL:
            ctx.fillStyle = '#16213e';
            ctx.fillRect(sx, sy, ts, ts);
            ctx.fillStyle = '#1a1a40';
            ctx.fillRect(sx + 2, sy + 2, ts - 4, ts - 4);
            break;

          case TILE.WINDOW:
            ctx.fillStyle = '#16213e';
            ctx.fillRect(sx, sy, ts, ts);
            ctx.fillStyle = '#2a4a6a';
            ctx.fillRect(sx + 2, sy + 2, ts - 4, ts - 4);
            ctx.fillStyle = '#5a8ab5';
            ctx.fillRect(sx + 4, sy + 4, ts - 8, ts - 8);
            ctx.fillStyle = '#1a1a2e';
            ctx.fillRect(sx + 5, sy, 3, ts);
            ctx.fillRect(sx + ts - 8, sy, 3, ts);
            break;

          case TILE.OBSTACLE:
            ctx.fillStyle = '#0f3460';
            ctx.fillRect(sx, sy, ts, ts);
            ctx.fillStyle = '#1a1a3e';
            ctx.fillRect(sx + 1, sy + 1, ts - 2, ts - 2);
            break;

          case TILE.GENERATOR:
            ctx.fillStyle = '#1a1a2e';
            ctx.fillRect(sx, sy, ts, ts);
            ctx.fillStyle = '#f0c040';
            ctx.beginPath();
            ctx.moveTo(sx + ts / 2, sy + 3);
            ctx.lineTo(sx + ts - 3, sy + ts / 2);
            ctx.lineTo(sx + ts / 2, sy + ts - 3);
            ctx.lineTo(sx + 3, sy + ts / 2);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.fillRect(sx + ts / 2 - 2, sy + ts / 2 - 2, 4, 4);
            break;

          case TILE.HOOK:
            ctx.fillStyle = '#1a1a2e';
            ctx.fillRect(sx, sy, ts, ts);
            ctx.fillStyle = '#8b4513';
            ctx.fillRect(sx + ts / 2 - 2, sy + 4, 4, ts - 12);
            ctx.fillRect(sx + ts / 2 - 2, sy + 4, 10, 3);
            break;

          case TILE.EXIT_GATE:
            ctx.fillStyle = '#555';
            ctx.fillRect(sx, sy, ts, ts);
            ctx.fillStyle = '#4ecca3';
            ctx.fillRect(sx + 4, sy + 3, ts - 8, ts - 6);
            ctx.fillStyle = '#1a1a2e';
            ctx.fillRect(sx + ts / 2 - 2, sy + 6, 4, ts - 12);
            break;

          case TILE.PALLET:
            ctx.fillStyle = '#1a1a2e';
            ctx.fillRect(sx, sy, ts, ts);
            ctx.fillStyle = '#ff8c42';
            ctx.fillRect(sx + 2, sy + 6, ts - 4, 5);
            ctx.fillRect(sx + 6, sy + 6, 3, ts - 10);
            ctx.fillRect(sx + ts - 9, sy + 6, 3, ts - 10);
            break;

          default: // FLOOR
            ctx.fillStyle = '#1a1a2e';
            ctx.fillRect(sx, sy, ts, ts);
            break;
        }

        // Grid lines
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(sx, sy, ts, ts);
      }
    }
  }

  // ---- Actions ----

  _setupActionButtons() {
    document.getElementById('btn-editor-export').addEventListener('click', () => this._exportJSON());
    document.getElementById('btn-editor-import').addEventListener('click', () => this._triggerImport());
    document.getElementById('btn-editor-clear').addEventListener('click', () => this._clear());
    document.getElementById('btn-editor-validate').addEventListener('click', () => this._validate());
    document.getElementById('editor-file-input').addEventListener('change', (e) => this._importJSON(e));
  }

  _setStatus(msg, isGood = false) {
    this.statusEl.textContent = msg;
    this.statusEl.style.color = isGood ? '#4ecca3' : '#e94560';
  }

  _exportJSON() {
    const map = new GameMap('custom', { grid: this.grid });
    const json = map.toJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'custom-map.json';
    a.click();
    URL.revokeObjectURL(url);
    this._setStatus('地图已导出！', true);
  }

  _triggerImport() {
    document.getElementById('editor-file-input').click();
  }

  _importJSON(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data.grid || !Array.isArray(data.grid) || data.grid.length !== MAP_ROWS) {
          throw new Error('地图尺寸不匹配');
        }
        for (let r = 0; r < MAP_ROWS; r++) {
          if (!Array.isArray(data.grid[r]) || data.grid[r].length !== MAP_COLS) {
            throw new Error(`第 ${r} 行长度不匹配`);
          }
        }
        this.grid = data.grid.map(row => [...row]);
        this.render();
        this._setStatus('地图已导入！', true);
      } catch (err) {
        this._setStatus(`导入失败：${err.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  _clear() {
    this._initEmpty();
    this.render();
    this._setStatus('地图已清空', true);
  }

  _validate() {
    const issues = [];

    // Border walls
    let borderOk = true;
    for (let c = 0; c < MAP_COLS; c++) {
      if (this.grid[0][c] !== TILE.WALL || this.grid[MAP_ROWS - 1][c] !== TILE.WALL) {
        borderOk = false;
        break;
      }
    }
    for (let r = 0; r < MAP_ROWS; r++) {
      if (this.grid[r][0] !== TILE.WALL || this.grid[r][MAP_COLS - 1] !== TILE.WALL) {
        borderOk = false;
        break;
      }
    }
    if (!borderOk) issues.push('边界墙不完整');

    // Count objectives
    let genCount = 0, gateCount = 0, hookCount = 0;
    for (let r = 0; r < MAP_ROWS; r++) {
      for (let c = 0; c < MAP_COLS; c++) {
        switch (this.grid[r][c]) {
          case TILE.GENERATOR: genCount++; break;
          case TILE.EXIT_GATE: gateCount++; break;
          case TILE.HOOK: hookCount++; break;
        }
      }
    }
    if (genCount < 2) issues.push(`发电机不足（${genCount}/2）`);
    if (gateCount < 1) issues.push(`出口大门不足（${gateCount}/1）`);
    if (hookCount < 2) issues.push(`钩子不足（${hookCount}/2）`);

    // BFS reachability from (1,1)
    let floorCount = 0;
    for (let r = 1; r < MAP_ROWS - 1; r++) {
      for (let c = 1; c < MAP_COLS - 1; c++) {
        if (this.grid[r][c] !== TILE.WALL && this.grid[r][c] !== TILE.OBSTACLE) {
          floorCount++;
        }
      }
    }
    if (floorCount > 0) {
      const visited = new Set();
      const queue = [{ r: 1, c: 1 }];
      visited.add('1,1');
      while (queue.length > 0) {
        const { r, c } = queue.shift();
        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const nr = r + dr, nc = c + dc;
          const key = `${nr},${nc}`;
          if (visited.has(key)) continue;
          if (nr < 0 || nr >= MAP_ROWS || nc < 0 || nc >= MAP_COLS) continue;
          const t = this.grid[nr][nc];
          if (t === TILE.WALL || t === TILE.OBSTACLE) continue;
          visited.add(key);
          queue.push({ r: nr, c: nc });
        }
      }
      const passable = new Set();
      for (let r = 1; r < MAP_ROWS - 1; r++) {
        for (let c = 1; c < MAP_COLS - 1; c++) {
          const t = this.grid[r][c];
          if (t !== TILE.WALL && t !== TILE.OBSTACLE) passable.add(`${r},${c}`);
        }
      }
      const unreachable = [...passable].filter(k => !visited.has(k)).length;
      if (unreachable > passable.size * 0.5) {
        issues.push(`大面积不可达（${unreachable}/${passable.size}）`);
      }
    }

    if (issues.length === 0) {
      this._setStatus('地图验证通过！', true);
    } else {
      this._setStatus(issues.join('\n'));
    }
  }

  // ---- Public API ----

  getMapData() {
    return { grid: this.grid.map(row => [...row]) };
  }
}

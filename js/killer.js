// killer.js - AI Killer with 5-state finite state machine + smart patrol
import {
  KILLER_SPEED, KILLER_CHASE_SPEED, KILLER_STATE, TILE, TILE_SIZE,
  KILLER_VISION_RANGE, KILLER_HEARING_RANGE, KILLER_ALERT_DURATION,
  KILLER_ATTACK_WARNING, KILLER_MISS_WIPE, KILLER_HIT_WIPE,
  KILLER_BREAK_TIME, PALLET_STUN_TIME, KILLER_CHASE_RANGE,
  MAP_COLS, MAP_ROWS, PLAYER_HEALTH,
} from './constants.js';

export class Killer {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.speed = KILLER_SPEED;
    this.state = KILLER_STATE.PATROL;
    this.patrolTarget = null;
    this.alertPos = null;
    this.alertTimer = 0;
    this.carryTarget = null;
    this.stunTimer = 0;
    this.attackPhase = 'idle';    // 'idle' | 'warning' | 'wipe'
    this.attackTimer = 0;
    this.attackHit = false;       // whether the attack connected
    this.breakTimer = 0;          // pallet break animation countdown
    this.breakTarget = null;      // pallet being broken
    this.preBreakState = null;    // state to resume after breaking pallet
    this.stuckFrames = 0;         // frames spent stuck in same spot
    this.lastPos = { x, y };      // last recorded position
    this.windowSlowTimer = 0;     // slowdown frames after vaulting a window
    this._lastTile = -1;
    this._path = null;            // A* path waypoints
    this._pathKey = '';           // cache key for path target
    this._pathIndex = 0;
    this._pathTimer = 0;          // frames since last path compute
    this._useSmartPath = false;   // fallback to A* when stuck
    this._pathLockTimer = 0;     // hysteresis: stay in current movement mode
    this.lastPlayerSeen = null;
    this.visitedGens = [];
    this.patrolPause = 0;
    this.searchPoints = [];
    this.searchIndex = 0;
    this.susAreas = [];          // suspicious areas to check
  }

  update(dt, player, gameMap) {
    if (this.stunTimer > 0) {
      this.stunTimer--;
      this.attackPhase = 'idle';
      this.attackTimer = 0;
      return;
    }

    // Pallet break animation
    if (this.state === KILLER_STATE.BREAK) {
      this.breakTimer--;
      if (this.breakTimer <= 0) {
        if (this.breakTarget && this.breakTarget.dropped && !this.breakTarget.broken) {
          this.breakTarget.broken = true;
        }
        this.breakTarget = null;
        this.state = this.preBreakState || KILLER_STATE.PATROL;
        this.speed = this.state === KILLER_STATE.CHASE ? KILLER_CHASE_SPEED : KILLER_SPEED;
        this.preBreakState = null;
        this._clearPath();
      }
      return;
    }

    this._updateAttack(player, gameMap);
    this._updateState(player, gameMap);
    this._executeState(dt, player, gameMap);

    // Stuck detection — escalate to smarter pathfinding when blocked
    const moved = Math.hypot(this.x - this.lastPos.x, this.y - this.lastPos.y);
    if (moved < 0.5) {
      this.stuckFrames++;
      if (this.stuckFrames === 30) {
        // Stage 1: clear path and recompute with A*
        this._clearPath();
        this._useSmartPath = true;
      } else if (this.stuckFrames >= 60 && this.stuckFrames % 15 === 0) {
        // Stage 2: jitter position slightly to escape corners
        this._nudgeOut(gameMap);
      }
    } else {
      this.stuckFrames = 0;
      this._useSmartPath = false;
    }
    this.lastPos = { x: this.x, y: this.y };

    if (this.windowSlowTimer > 0) this.windowSlowTimer--;
    const curTile = gameMap.getTile(this.x, this.y);
    if (curTile === TILE.WINDOW && this._lastTile !== TILE.WINDOW) {
      this.windowSlowTimer = 25;
    }
    this._lastTile = curTile;
  }

  // Player-controlled update — replaces AI with keyboard input.
  // Called instead of update() when a human player controls the killer.
  updatePlayerControlled(dt, keys, player, gameMap) {
    if (this.stunTimer > 0) {
      this.stunTimer--;
      this.attackPhase = 'idle';
      this.attackTimer = 0;
      return;
    }

    // Pallet break animation
    if (this.state === KILLER_STATE.BREAK) {
      this.breakTimer--;
      if (this.breakTimer <= 0) {
        if (this.breakTarget && this.breakTarget.dropped && !this.breakTarget.broken) {
          this.breakTarget.broken = true;
        }
        this.breakTarget = null;
        this.state = this.preBreakState || KILLER_STATE.PATROL;
        this.speed = KILLER_SPEED;
        this.preBreakState = null;
      }
      return;
    }

    // Attack update (warning → hit/miss → wipe)
    this._updateAttack(player, gameMap);

    // Carry state: player-controlled movement, hook when near hook + press E
    if (this.state === KILLER_STATE.CARRY) {
      // Hook survivor when near a hook and pressing E
      if (keys['KeyE']) {
        const tileCol = Math.floor(this.x / TILE_SIZE);
        const tileRow = Math.floor(this.y / TILE_SIZE);
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const r = tileRow + dr;
            const c = tileCol + dc;
            if (r < 0 || r >= gameMap.rows || c < 0 || c >= gameMap.cols) continue;
            if (gameMap.grid[r][c] === 4) { // TILE.HOOK
              player.getHooked();
              this.state = KILLER_STATE.PATROL;
              this.speed = KILLER_SPEED;
              this.carryTarget = null;
              return;
            }
          }
        }
      }
      // WASD movement while carrying (falls through to normal movement below)
      // Player follows killer
      player.x = this.x;
      player.y = this.y - 4;
    }

    // WASD movement (blocked during attack animation)
    if (this.attackPhase === 'idle') {
      let mx = 0, my = 0;
      if (keys['KeyW'] || keys['ArrowUp']) my -= 1;
      if (keys['KeyS'] || keys['ArrowDown']) my += 1;
      if (keys['KeyA'] || keys['ArrowLeft']) mx -= 1;
      if (keys['KeyD'] || keys['ArrowRight']) mx += 1;

      if (mx !== 0 && my !== 0) { mx *= 0.707; my *= 0.707; }

      let moveMult = 1;
      if (this.windowSlowTimer > 0) moveMult = 0.4;

      const speed = this.speed * dt * 60 * moveMult;
      const newX = this.x + mx * speed;
      const newY = this.y + my * speed;

      if (gameMap.isWalkable(newX, this.y, false)) this.x = newX;
      if (gameMap.isWalkable(this.x, newY, false)) this.y = newY;

      // Attack trigger (Space)
      if (keys['Space'] && this.attackPhase === 'idle') {
        const dist = this._dist(player.x, player.y);
        if (dist < 32) {
          this._attack(player);
        }
      }

      // Interact trigger (E) — pick up downed player or break pallet
      if (keys['KeyE']) {
        const distToPlayer = this._dist(player.x, player.y);
        // Pick up downed player (only if not already carrying)
        if (this.state !== KILLER_STATE.CARRY && player.health === PLAYER_HEALTH.DOWNED && distToPlayer < 32) {
          this.state = KILLER_STATE.CARRY;
          this.speed = KILLER_SPEED * 0.95;
          this._findNearestHook(gameMap);
        } else {
          // Break nearby pallet (only if not picking up)
          const tileCol = Math.floor(this.x / TILE_SIZE);
          const tileRow = Math.floor(this.y / TILE_SIZE);
          const pallet = gameMap.pallets.find(p =>
            p.x === tileCol && p.y === tileRow && p.dropped && !p.broken
          );
          if (pallet) {
            this.preBreakState = this.state;
            this.state = KILLER_STATE.BREAK;
            this.breakTimer = KILLER_BREAK_TIME;
            this.breakTarget = pallet;
          }
        }
      }
    }

    if (this.windowSlowTimer > 0) this.windowSlowTimer--;
    const curTile = gameMap.getTile(this.x, this.y);
    if (curTile === TILE.WINDOW && this._lastTile !== TILE.WINDOW) {
      this.windowSlowTimer = 25;
    }
    this._lastTile = curTile;
  }

  _updateAttack(player, gameMap) {
    if (this.attackPhase === 'idle') return;
    this.attackTimer--;
    if (this.attackTimer <= 0) {
      if (this.attackPhase === 'warning') {
        const dist = this._dist(player.x, player.y);
        if (dist < 32 && this._canSee(player, gameMap)) {
          const wasInjured = player.health === PLAYER_HEALTH.INJURED;
          player.takeHit();
          this.attackPhase = 'wipe';
          this.attackTimer = KILLER_HIT_WIPE;
          this.attackHit = true;
          if (wasInjured && player.health === PLAYER_HEALTH.DOWNED) {
            this.state = KILLER_STATE.CARRY;
            this.speed = KILLER_SPEED * 0.95;
            this._findNearestHook(gameMap);
            this._clearPath();
          }
        } else {
          this.attackPhase = 'wipe';
          this.attackTimer = KILLER_MISS_WIPE;
          this.attackHit = false;
        }
      } else if (this.attackPhase === 'wipe') {
        this.attackPhase = 'idle';
        this.attackHit = false;
      }
    }
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
          this.state = KILLER_STATE.ALERT;
          this.alertPos = { x: player.x, y: player.y };
          this.alertTimer = KILLER_ALERT_DURATION;
        }
        break;

      case KILLER_STATE.CHASE:
        if (!canSeePlayer || distToPlayer > KILLER_CHASE_RANGE * TILE_SIZE) {
          this.state = KILLER_STATE.ALERT;
          this.alertPos = this.lastPlayerSeen ? { ...this.lastPlayerSeen } : { x: player.x, y: player.y };
          this.alertTimer = KILLER_ALERT_DURATION;
          this.speed = KILLER_SPEED;
          this._clearPath();
        } else {
          this.lastPlayerSeen = { x: player.x, y: player.y };
        }
        if (distToPlayer < 28 && this.attackPhase === 'idle') {
          this._attack(player);
        }
        if (player.health === 'downed' && distToPlayer < 32 && this.attackPhase === 'idle') {
          this.state = KILLER_STATE.CARRY;
          this.speed = KILLER_SPEED * 0.95;
          this._findNearestHook(gameMap);
        }
        break;

      case KILLER_STATE.CARRY:
        if (this.carryTarget) {
          const distToHook = this._distToTile(this.carryTarget);
          if (distToHook < 16) {
            player.getHooked();
            this.state = KILLER_STATE.PATROL;
            this.speed = KILLER_SPEED;
            this.carryTarget = null;
            this._clearPath();
          }
        }
        break;

      case KILLER_STATE.BREAK:
        break;
    }

    // Global: if player is downed, always try to pick them up
    if (player.health === 'downed' && this.attackPhase === 'idle'
        && this.state !== KILLER_STATE.CARRY && this.state !== KILLER_STATE.BREAK) {
      if (distToPlayer < 64) {
        this.state = KILLER_STATE.CARRY;
        this.speed = KILLER_SPEED * 0.95;
        this._findNearestHook(gameMap);
      } else if (canSeePlayer) {
        // Player downed but far — chase them first
        this.state = KILLER_STATE.CHASE;
        this.speed = KILLER_CHASE_SPEED;
        this.lastPlayerSeen = { x: player.x, y: player.y };
      }
    }

    if (this.state === KILLER_STATE.ALERT) {
      this.alertTimer--;
      if (this.alertTimer <= 0) {
        // Generate search pattern around last known position before giving up
        if (this.alertPos && this.searchPoints.length === 0) {
          this._generateSearchPoints(this.alertPos, gameMap);
          this.searchIndex = 0;
          this._addSusArea(this.alertPos.x, this.alertPos.y);
        }
        // Execute search pattern
        if (this.searchPoints.length > 0 && this.searchIndex < this.searchPoints.length) {
          const sp = this.searchPoints[this.searchIndex];
          if (Math.hypot(sp.x - this.x, sp.y - this.y) < 32) {
            this.searchIndex++;
          }
          this.alertTimer = 1; // stay in alert during search
        } else {
          this.state = KILLER_STATE.PATROL;
          this.alertPos = null;
          this.searchPoints = [];
          this.searchIndex = 0;
        }
      }
    }
  }

  _executeState(dt, player, gameMap) {
    switch (this.state) {
      case KILLER_STATE.PATROL:
        this._patrol(dt, gameMap);
        break;
      case KILLER_STATE.ALERT:
        if (this.searchPoints.length > 0 && this.searchIndex < this.searchPoints.length) {
          this._moveTo(dt, this.searchPoints[this.searchIndex], gameMap);
        } else if (this.alertPos) {
          this._moveTo(dt, this.alertPos, gameMap);
        }
        break;
      case KILLER_STATE.CHASE:
        this._moveTo(dt, { x: player.x, y: player.y }, gameMap);
        break;
      case KILLER_STATE.CARRY:
        if (this.carryTarget) {
          const wx = this.carryTarget.x * TILE_SIZE + TILE_SIZE / 2;
          const wy = this.carryTarget.y * TILE_SIZE + TILE_SIZE / 2;
          this._moveTo(dt, { x: wx, y: wy }, gameMap);
          player.x = this.x;
          player.y = this.y - 4;
        }
        break;
      case KILLER_STATE.BREAK:
        break;
    }
  }

  _patrol(dt, gameMap) {
    // Pause briefly at each patrol stop to "inspect"
    if (this.patrolPause > 0) {
      this.patrolPause--;
      return;
    }

    if (!this.patrolTarget || this._distToTarget() < 32) {
      if (this.patrolTarget) {
        this._markVisited(this.patrolTarget);
        this.patrolPause = 50 + Math.floor(Math.random() * 40); // 0.8-1.5s inspection
      }

      // Pick next target: prefer unvisited, far generators to cover ground
      const unrepaired = gameMap.generators.filter(g => !g.repaired);
      if (unrepaired.length > 0) {
        const g = this._pickBestPatrolTarget(unrepaired);
        this.patrolTarget = { x: g.x * TILE_SIZE + TILE_SIZE / 2, y: g.y * TILE_SIZE + TILE_SIZE / 2 };
      } else {
        // All gens repaired — patrol between exit gates
        const gates = gameMap.exitGates;
        const gate = gates[Math.floor(Math.random() * gates.length)];
        this.patrolTarget = { x: gate.x * TILE_SIZE + TILE_SIZE / 2, y: gate.y * TILE_SIZE + TILE_SIZE / 2 };
      }
    }
    this._moveTo(dt, this.patrolTarget, gameMap);
  }

  _pickBestPatrolTarget(generators) {
    const now = Date.now();
    let best = null;
    let bestScore = -Infinity;

    for (const g of generators) {
      const wx = g.x * TILE_SIZE + TILE_SIZE / 2;
      const wy = g.y * TILE_SIZE + TILE_SIZE / 2;
      const dist = Math.hypot(wx - this.x, wy - this.y);

      // Penalty for recently visited (decays over 25s)
      const visit = this.visitedGens.find(v => v.x === g.x && v.y === g.y);
      const visitedPenalty = visit
        ? Math.max(0, 1 - (now - visit.time) / 25000)
        : 0;

      // Score: favor unvisited + farther targets (covers more map area)
      const score = dist * (1 - visitedPenalty * 0.85);
      if (score > bestScore) {
        bestScore = score;
        best = g;
      }
    }
    return best;
  }

  _markVisited(target) {
    const tx = Math.floor(target.x / TILE_SIZE);
    const ty = Math.floor(target.y / TILE_SIZE);
    const existing = this.visitedGens.find(v => v.x === tx && v.y === ty);
    if (existing) {
      existing.time = Date.now();
    } else {
      this.visitedGens.push({ x: tx, y: ty, time: Date.now() });
    }
    if (this.visitedGens.length > 20) this.visitedGens.shift();
  }

  _addSusArea(x, y) {
    // Remember suspicious locations to revisit later
    this.susAreas.push({ x, y, time: Date.now() });
    if (this.susAreas.length > 5) this.susAreas.shift();
  }

  _moveTo(dt, target, gameMap) {
    if (!target) return;

    let moveMult = 1;
    if (this.attackPhase === 'warning') moveMult = 0.7;
    if (this.attackPhase === 'wipe') moveMult = 0.2;
    if (this.windowSlowTimer > 0) moveMult = Math.min(moveMult, 0.4);

    // Use A* if walls block direct line to target (e.g. killer in room, target outside).
    // Hysteresis: once in pathfinding, stay at least 30f; once in direct, stay at least 20f.
    const blocked = !this._hasLineOfSight(this.x, this.y, target.x, target.y, gameMap);
    if (blocked && this._pathLockTimer <= 0) {
      this._pathLockTimer = 30;
    } else if (!blocked && this._pathLockTimer > 0) {
      this._pathLockTimer--;
    }
    const needPath = this.state === KILLER_STATE.CHASE || this.state === KILLER_STATE.CARRY
                     || this._useSmartPath || this._pathLockTimer > 15;
    if (needPath) {
      this._moveWithPathfinding(dt, target, gameMap, moveMult);
    } else {
      this._moveDirect(dt, target, gameMap, moveMult);
    }

    // Check for dropped pallets — spend 1 second breaking through
    const tileCol = Math.floor(this.x / TILE_SIZE);
    const tileRow = Math.floor(this.y / TILE_SIZE);
    const pallet = gameMap.pallets.find(p =>
      p.x === tileCol && p.y === tileRow && p.dropped && !p.broken
    );
    if (pallet) {
      this.preBreakState = this.state;
      this.state = KILLER_STATE.BREAK;
      this.breakTimer = KILLER_BREAK_TIME;
      this.breakTarget = pallet;
      this._clearPath();
    }
  }

  _moveDirect(dt, target, gameMap, moveMult) {
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 4) return;

    const speed = this.speed * dt * 60 * moveMult;
    const nx = (dx / dist) * speed;
    const ny = (dy / dist) * speed;

    const newX = this.x + nx;
    const newY = this.y + ny;

    const canMoveX = gameMap.isWalkable(newX, this.y, false);
    const canMoveY = gameMap.isWalkable(this.x, newY, false);

    if (canMoveX) this.x = newX;
    if (canMoveY) this.y = newY;

    if (!canMoveX && !canMoveY) {
      // Wall-slide: try all 4 cardinal directions, pick best toward target
      const dirs = [[speed, 0], [-speed, 0], [0, speed], [0, -speed]];
      let bestDir = null;
      let bestDist = Infinity;
      for (const [sx, sy] of dirs) {
        const tx = this.x + sx;
        const ty = this.y + sy;
        if (gameMap.isWalkable(tx, ty, false)) {
          const d = Math.hypot(tx - target.x, ty - target.y);
          if (d < bestDist) { bestDist = d; bestDir = [tx, ty]; }
        }
      }
      if (bestDir) { this.x = bestDir[0]; this.y = bestDir[1]; }
    }
  }

  _moveWithPathfinding(dt, target, gameMap, moveMult) {
    const tx = Math.floor(target.x / TILE_SIZE);
    const ty = Math.floor(target.y / TILE_SIZE);
    const pathKey = `${tx},${ty}`;

    this._pathTimer++;
    if (!this._path || this._pathKey !== pathKey || this._pathTimer > 45) {
      this._path = this._findPath(gameMap, tx, ty);
      this._pathKey = pathKey;
      this._pathIndex = 0;
      this._pathTimer = 0;
    }

    if (!this._path || this._path.length === 0) {
      this._moveDirect(dt, target, gameMap, moveMult);
      return;
    }

    // Advance past reached waypoints
    while (this._pathIndex < this._path.length) {
      const wp = this._path[this._pathIndex];
      if (Math.hypot(wp.x - this.x, wp.y - this.y) < 12) {
        this._pathIndex++;
      } else break;
    }

    if (this._pathIndex >= this._path.length) {
      this._moveDirect(dt, target, gameMap, moveMult);
      return;
    }

    this._moveDirect(dt, this._path[this._pathIndex], gameMap, moveMult);
  }

  _findPath(gameMap, ex, ey) {
    const sx = Math.floor(this.x / TILE_SIZE);
    const sy = Math.floor(this.y / TILE_SIZE);
    if (sx === ex && sy === ey) return null;

    const key = (x, y) => `${x},${y}`;
    const h = (x, y) => Math.abs(x - ex) + Math.abs(y - ey);

    const open = [{ x: sx, y: sy, g: 0, f: h(sx, sy) }];
    const cameFrom = {};
    const gScore = { [key(sx, sy)]: 0 };
    const closed = new Set();

    while (open.length > 0 && open.length < 600) {
      let best = 0;
      for (let i = 1; i < open.length; i++)
        if (open[i].f < open[best].f) best = i;
      const cur = open.splice(best, 1)[0];
      const ck = key(cur.x, cur.y);

      if (cur.x === ex && cur.y === ey) {
        const path = [];
        let k = ck;
        while (k !== key(sx, sy)) {
          const [cx, cy] = k.split(',').map(Number);
          path.unshift({ x: cx * TILE_SIZE + TILE_SIZE / 2, y: cy * TILE_SIZE + TILE_SIZE / 2 });
          k = cameFrom[k];
        }
        return path;
      }

      closed.add(ck);
      const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
      for (const [dx, dy] of dirs) {
        const nx = cur.x + dx, ny = cur.y + dy;
        const nk = key(nx, ny);
        if (nx < 0 || nx >= MAP_COLS || ny < 0 || ny >= MAP_ROWS) continue;
        if (closed.has(nk)) continue;
        const wx = nx * TILE_SIZE + TILE_SIZE / 2;
        const wy = ny * TILE_SIZE + TILE_SIZE / 2;
        if (!gameMap.isWalkable(wx, wy, false)) continue;

        const moveCost = gameMap.grid[ny][nx] === TILE.WINDOW ? 0.3 : 1;
        const tg = gScore[ck] + moveCost;
        if (tg < (gScore[nk] || Infinity)) {
          gScore[nk] = tg;
          cameFrom[nk] = ck;
          const f = tg + h(nx, ny);
          const existing = open.find(o => o.x === nx && o.y === ny);
          if (existing) { existing.g = tg; existing.f = f; }
          else open.push({ x: nx, y: ny, g: tg, f: f });
        }
      }
    }

    return null; // no path found
  }

  _clearPath() {
    this._path = null;
    this._pathKey = '';
    this._pathIndex = 0;
    this._pathTimer = 0;
  }

  _nudgeOut(gameMap) {
    // Tiny step in a random direction to escape tight corners.
    // Does NOT teleport — max displacement is 8px (~0.25 tiles).
    const offsets = [
      [8, 0], [-8, 0], [0, 8], [0, -8],
      [6, 6], [-6, 6], [6, -6], [-6, -6],
    ];
    for (let i = offsets.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [offsets[i], offsets[j]] = [offsets[j], offsets[i]];
    }
    for (const [dx, dy] of offsets) {
      const tx = this.x + dx;
      const ty = this.y + dy;
      if (gameMap.isWalkable(tx, ty, false)) {
        this.x = tx;
        this.y = ty;
        return;
      }
    }
  }

  _attack(player) {
    this.attackPhase = 'warning';
    this.attackTimer = KILLER_ATTACK_WARNING;
  }

  _canSee(player, gameMap) {
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > KILLER_VISION_RANGE * TILE_SIZE) return false;

    const steps = Math.ceil(dist / (TILE_SIZE / 2));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const cx = this.x + dx * t;
      const cy = this.y + dy * t;
      const tile = gameMap.getTile(cx, cy);
      if (tile === 1 || tile === 2) return false;
    }
    return true;
  }

  _hasLineOfSight(x1, y1, x2, y2, gameMap) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.ceil(dist / (TILE_SIZE / 2));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const tile = gameMap.getTile(x1 + dx * t, y1 + dy * t);
      if (tile === TILE.WALL || tile === TILE.OBSTACLE) return false;
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

  _generateSearchPoints(center, gameMap) {
    this.searchPoints = [];
    const cx = center.x;
    const cy = center.y;
    const steps = [80, 130]; // inner ring + outer ring
    const angles = [0, Math.PI / 4, Math.PI / 2, 3 * Math.PI / 4, Math.PI, 5 * Math.PI / 4, 3 * Math.PI / 2, 7 * Math.PI / 4];
    for (const r of steps) {
      for (const a of angles) {
        const wx = cx + Math.cos(a) * r;
        const wy = cy + Math.sin(a) * r;
        const maxW = gameMap.cols * TILE_SIZE;
        const maxH = gameMap.rows * TILE_SIZE;
        if (wx > 32 && wy > 32 && wx < maxW - 32 && wy < maxH - 32) {
          if (gameMap.isWalkable(wx, wy, false)) {
            this.searchPoints.push({ x: wx, y: wy });
          }
        }
      }
    }
    // Shuffle search points for unpredictable movement
    for (let i = this.searchPoints.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.searchPoints[i], this.searchPoints[j]] = [this.searchPoints[j], this.searchPoints[i]];
    }
  }

  _distToPoint(pt) {
    return Math.hypot(pt.x - this.x, pt.y - this.y);
  }

  getHeartbeatLevel(player) {
    const dist = this._dist(player.x, player.y);
    const range = KILLER_VISION_RANGE * TILE_SIZE * 1.5;
    if (dist > range) return 0;
    if (dist > range * 0.6) return 1;
    if (dist > range * 0.3) return 2;
    return 3;
  }

  render(ctx, cameraX, cameraY) {
    const sx = this.x - cameraX;
    const sy = this.y - cameraY;

    if (this.stunTimer > 0 && Math.floor(this.stunTimer / 6) % 2 === 0) return;

    // Pallet break animation
    if (this.state === KILLER_STATE.BREAK) {
      const progress = 1 - this.breakTimer / KILLER_BREAK_TIME;
      ctx.save();
      ctx.fillStyle = '#ff8c42';
      ctx.globalAlpha = 0.3 + Math.sin(progress * Math.PI * 2) * 0.2;
      ctx.beginPath();
      ctx.arc(sx, sy, 16, 0, Math.PI * 2);
      ctx.fill();
      // Cracking lines
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(sx - 8, sy + 8); ctx.lineTo(sx + 4, sy - 6);
      ctx.moveTo(sx + 6, sy + 10); ctx.lineTo(sx - 6, sy - 4);
      ctx.stroke();
      ctx.restore();
    }

    // Attack warning indicator — pulsing red ring
    if (this.attackPhase === 'warning') {
      const progress = 1 - this.attackTimer / KILLER_ATTACK_WARNING;
      const pulse = Math.sin(progress * Math.PI * 4) * 0.3 + 0.5;
      ctx.save();
      ctx.strokeStyle = '#ff3333';
      ctx.lineWidth = 3;
      ctx.globalAlpha = pulse;
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(sx, sy, 22, 0, Math.PI * 2);
      ctx.stroke();
      // Inner fill
      ctx.fillStyle = '#ff0000';
      ctx.globalAlpha = 0.15 + progress * 0.15;
      ctx.beginPath();
      ctx.arc(sx, sy, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Wipe effect — red glow on hit, white flash on miss
    if (this.attackPhase === 'wipe') {
      ctx.save();
      ctx.globalAlpha = 0.3 + Math.sin(this.attackTimer * 0.3) * 0.2;
      ctx.fillStyle = this.attackHit ? '#e94560' : '#888';
      ctx.beginPath();
      ctx.arc(sx, sy, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(sx - 10, sy - 14, 20, 20);
    ctx.fillStyle = this.state === KILLER_STATE.CHASE ? '#e94560' : '#888';
    ctx.fillRect(sx - 3, sy - 10, 6, 6);

    ctx.fillStyle = '#666';
    ctx.fillRect(sx + 8, sy - 6, 4, 12);

    if (this.state === KILLER_STATE.ALERT) {
      ctx.fillStyle = '#ff0';
      ctx.fillRect(sx - 10, sy - 18, 4, 4);
    }
    if (this.state === KILLER_STATE.CARRY) {
      ctx.fillStyle = '#ff6b6b';
      ctx.fillRect(sx - 6, sy - 18, 12, 4);
    }
  }
}

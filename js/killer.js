// killer.js - AI Killer with 5-state finite state machine + smart patrol
import {
  KILLER_SPEED, KILLER_CHASE_SPEED, KILLER_STATE, TILE, TILE_SIZE,
  KILLER_VISION_RANGE, KILLER_HEARING_RANGE, KILLER_ALERT_DURATION,
  KILLER_ATTACK_WINDUP, KILLER_MISS_WIPE, KILLER_HIT_WIPE,
  MAP_COLS, MAP_ROWS,
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
    this.attackPhase = 'idle';    // 'idle' | 'swing' | 'wipe'
    this.attackTimer = 0;
    this.attackHit = false;       // whether the swing connected
    this.windowSlowTimer = 0;     // slowdown frames after vaulting a window
    this._lastTile = -1;
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
    this._updateAttack(player, gameMap);
    this._updateState(player, gameMap);
    this._executeState(dt, player, gameMap);

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
      if (this.attackPhase === 'swing') {
        const dist = this._dist(player.x, player.y);
        if (dist < 32 && this._canSee(player, gameMap)) {
          player.takeHit();
          this.attackPhase = 'wipe';
          this.attackTimer = KILLER_HIT_WIPE;
          this.attackHit = true;
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
        if (!canSeePlayer || distToPlayer > KILLER_VISION_RANGE * TILE_SIZE * 1.5) {
          this.state = KILLER_STATE.ALERT;
          this.alertPos = this.lastPlayerSeen ? { ...this.lastPlayerSeen } : { x: player.x, y: player.y };
          this.alertTimer = KILLER_ALERT_DURATION;
          this.speed = KILLER_SPEED;
        } else {
          this.lastPlayerSeen = { x: player.x, y: player.y };
        }
        if (distToPlayer < 28 && this.attackPhase === 'idle') {
          this._attack(player);
        }
        if (player.health === 'downed' && distToPlayer < 32 && this.attackPhase === 'idle') {
          this.state = KILLER_STATE.CARRY;
          this.speed = KILLER_SPEED * 0.7;
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
          }
        }
        break;

      case KILLER_STATE.BREAK:
        break;
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
        this.stunTimer = 60;
        this.state = KILLER_STATE.PATROL;
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
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 4) return;

    let moveMult = 1;
    if (this.attackPhase === 'swing') moveMult = 0.5;
    if (this.attackPhase === 'wipe') moveMult = 0.2;
    if (this.windowSlowTimer > 0) moveMult = Math.min(moveMult, 0.4);

    const nx = (dx / dist) * this.speed * dt * 60 * moveMult;
    const ny = (dy / dist) * this.speed * dt * 60 * moveMult;

    const newX = this.x + nx;
    const newY = this.y + ny;

    if (gameMap.isWalkable(newX, this.y, false)) this.x = newX;
    if (gameMap.isWalkable(this.x, newY, false)) this.y = newY;

    // Check for dropped pallets — break them
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
    this.attackPhase = 'swing';
    this.attackTimer = KILLER_ATTACK_WINDUP;
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

    // Attack swing arc
    if (this.attackPhase === 'swing') {
      const progress = 1 - this.attackTimer / KILLER_ATTACK_WINDUP;
      ctx.save();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.4 + progress * 0.6;
      ctx.beginPath();
      ctx.arc(sx, sy, 24, -0.6, 0.6);
      ctx.stroke();
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

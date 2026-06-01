// killer.js - AI Killer with 5-state finite state machine
import {
  KILLER_SPEED, KILLER_CHASE_SPEED, KILLER_STATE, TILE_SIZE,
  KILLER_VISION_RANGE, KILLER_HEARING_RANGE, KILLER_ALERT_DURATION,
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
    this.attackCooldown = 0;
    this.lastPlayerSeen = null;
  }

  update(dt, player, gameMap) {
    if (this.stunTimer > 0) {
      this.stunTimer--;
      return;
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
        if (distToPlayer < 28 && this.attackCooldown <= 0) {
          this._attack(player);
        }
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
        this.state = KILLER_STATE.PATROL;
        this.alertPos = null;
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
    if (!this.patrolTarget || this._distToTarget() < 32) {
      const unrepaired = gameMap.generators.filter(g => !g.repaired);
      if (unrepaired.length > 0) {
        const g = unrepaired[Math.floor(Math.random() * unrepaired.length)];
        this.patrolTarget = { x: g.x * TILE_SIZE + TILE_SIZE / 2, y: g.y * TILE_SIZE + TILE_SIZE / 2 };
      } else {
        const gate = gameMap.exitGates[Math.floor(Math.random() * gameMap.exitGates.length)];
        this.patrolTarget = { x: gate.x * TILE_SIZE + TILE_SIZE / 2, y: gate.y * TILE_SIZE + TILE_SIZE / 2 };
      }
    }
    this._moveTo(dt, this.patrolTarget, gameMap);
  }

  _moveTo(dt, target, gameMap) {
    if (!target) return;
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 4) return;

    const nx = (dx / dist) * this.speed * dt * 60;
    const ny = (dy / dist) * this.speed * dt * 60;

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
    player.takeHit();
    this.attackCooldown = 60;
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

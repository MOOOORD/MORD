// player.js
import {
  PLAYER_SPEED, PLAYER_RUN_SPEED, PLAYER_STAMINA, PLAYER_STAMINA_DRAIN,
  PLAYER_STAMINA_REGEN, PLAYER_INJURED_SPEED, PLAYER_HEALTH
} from './constants.js';

export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.speed = PLAYER_SPEED;
    this.health = PLAYER_HEALTH.HEALTHY;
    this.stamina = PLAYER_STAMINA;
    this.hookCount = 0;
    this.hookTimer = 0;
    this.invincibleTimer = 0;
    this.interacting = false;
    this.interactTarget = null;
    this.interactProgress = 0;
    this.facingDir = { x: 0, y: -1 };
  }

  update(dt, keys, gameMap) {
    if (this.health === PLAYER_HEALTH.HOOKED) {
      this._updateHookStruggle(dt, keys);
      return;
    }
    if (this.health === PLAYER_HEALTH.DOWNED || this.health === PLAYER_HEALTH.DEAD) return;

    if (this.invincibleTimer > 0) this.invincibleTimer--;

    let mx = 0, my = 0;
    if (keys['KeyW'] || keys['ArrowUp']) my -= 1;
    if (keys['KeyS'] || keys['ArrowDown']) my += 1;
    if (keys['KeyA'] || keys['ArrowLeft']) mx -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) mx += 1;

    if (mx !== 0 && my !== 0) { mx *= 0.707; my *= 0.707; }

    const running = (keys['ShiftLeft'] || keys['ShiftRight']) && this.stamina > 0;
    let currentSpeed = this.health === PLAYER_HEALTH.INJURED ? PLAYER_INJURED_SPEED : PLAYER_SPEED;
    if (running) {
      currentSpeed = PLAYER_RUN_SPEED;
      this.stamina -= PLAYER_STAMINA_DRAIN;
      if (this.stamina < 0) this.stamina = 0;
    } else if (this.stamina < PLAYER_STAMINA) {
      this.stamina += PLAYER_STAMINA_REGEN;
    }

    const dx = mx * currentSpeed * dt * 60;
    const dy = my * currentSpeed * dt * 60;

    const newX = this.x + dx;
    const newY = this.y + dy;

    if (gameMap.isWalkable(newX, this.y, true)) this.x = newX;
    if (gameMap.isWalkable(this.x, newY, true)) this.y = newY;

    if (mx !== 0 || my !== 0) {
      this.facingDir = { x: mx, y: my };
    }

    this.interacting = keys['Space'];
  }

  _updateHookStruggle(dt, keys) {
    this.hookTimer++;
    if (keys['Space']) {
      this.interactProgress += 3;
    }
    if (this.interactProgress >= 100) {
      this.health = PLAYER_HEALTH.INJURED;
      this.interactProgress = 0;
      this.hookTimer = 0;
      this.invincibleTimer = 60;
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

    if (this.invincibleTimer > 0 && Math.floor(this.invincibleTimer / 4) % 2 === 0) return;

    if (this.health === PLAYER_HEALTH.HOOKED) {
      ctx.fillStyle = '#ff6b6b';
      ctx.fillRect(sx - 4, sy - 16, 8, 8);
      ctx.fillStyle = '#e94560';
      ctx.fillRect(sx - 6, sy - 18, 12, 4);
      return;
    }

    const color = this.health === PLAYER_HEALTH.INJURED ? '#ff6b6b' : '#4ecdc4';
    ctx.fillStyle = color;
    ctx.fillRect(sx - 6, sy - 10, 12, 12);
    ctx.fillStyle = '#fff';
    ctx.fillRect(sx - 2, sy - 8, 4, 4);

    ctx.fillStyle = '#ffe66d';
    ctx.fillRect(sx - 2, sy + 3, 4, 2);

    if (this.health === PLAYER_HEALTH.INJURED) {
      ctx.fillStyle = '#e94560';
      ctx.fillRect(sx - 8, sy + 8, 2, 2);
      ctx.fillRect(sx + 6, sy - 6, 2, 2);
    }
  }
}

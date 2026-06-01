// objectives.js
import { TILE_SIZE, REPAIR_TIME, GATE_OPEN_TIME } from './constants.js';

export class ObjectivesManager {
  constructor(gameMap) {
    this.map = gameMap;
  }

  getNearbyInteractable(playerX, playerY) {
    const col = Math.floor(playerX / TILE_SIZE);
    const row = Math.floor(playerY / TILE_SIZE);

    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const r = row + dr;
        const c = col + dc;
        if (r < 0 || r >= this.map.rows || c < 0 || c >= this.map.cols) continue;
        const tile = this.map.grid[r][c];

        if (tile === 3) {
          const gen = this.map.generators.find(g => g.x === c && g.y === r);
          if (gen && !gen.repaired) {
            return { type: 'generator', obj: gen, x: c, y: r };
          }
        }

        if (tile === 5) {
          const gate = this.map.exitGates.find(g => g.x === c && g.y === r);
          if (gate && gate.powered && !gate.open) {
            return { type: 'exit_gate', obj: gate, x: c, y: r };
          }
        }

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
    const spark = Math.random() < 0.02;
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
    if (killer) {
      const kCol = Math.floor(killer.x / TILE_SIZE);
      const kRow = Math.floor(killer.y / TILE_SIZE);
      if (kCol === pallet.x && kRow === pallet.y) {
        killer.stunTimer = 90;
      }
    }
    return { done: true, event: 'pallet_dropped' };
  }

  areGatesPowered() {
    const required = 2;
    const repaired = this.map.generators.filter(g => g.repaired).length;
    if (repaired >= required && !this.map.exitGates[0].powered) {
      this.map.exitGates.forEach(g => g.powered = true);
      return true;
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
    // Generators
    for (const gen of this.map.generators) {
      const sx = gen.x * TILE_SIZE - cameraX + TILE_SIZE / 2;
      const sy = gen.y * TILE_SIZE - cameraY + TILE_SIZE / 2;
      if (gen.repaired) {
        ctx.fillStyle = '#4ecca3';
        ctx.fillRect(sx - 8, sy - 8, 16, 16);
        ctx.fillStyle = '#fff';
        ctx.fillRect(sx - 4, sy - 4, 8, 8);
      } else {
        ctx.fillStyle = '#f0c040';
        ctx.fillRect(sx - 8, sy - 8, 16, 16);
        if (pulseFrame % 30 < 15) {
          ctx.fillStyle = '#fff';
          ctx.fillRect(sx - 2, sy - 14, 4, 4);
        }
      }
    }

    // Exit gates
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
        ctx.fillRect(sx - 10, sy - 16, 20, 32);
        ctx.fillStyle = '#333';
        ctx.fillRect(sx - 6, sy - 12, 12, 24);
      } else {
        ctx.fillStyle = '#555';
        ctx.fillRect(sx - 10, sy - 16, 20, 32);
        ctx.fillStyle = '#333';
        ctx.fillRect(sx - 6, sy - 12, 12, 24);
      }
    }

    // Hooks
    for (const hook of this.map.hooks) {
      const sx = hook.x * TILE_SIZE - cameraX + TILE_SIZE / 2;
      const sy = hook.y * TILE_SIZE - cameraY + TILE_SIZE / 2;
      ctx.fillStyle = '#8b4513';
      ctx.fillRect(sx - 2, sy - 14, 4, 28);
      ctx.fillStyle = '#a0522d';
      ctx.fillRect(sx - 6, sy - 14, 12, 6);
    }

    // Pallets
    for (const pal of this.map.pallets) {
      const sx = pal.x * TILE_SIZE - cameraX + TILE_SIZE / 2;
      const sy = pal.y * TILE_SIZE - cameraY + TILE_SIZE / 2;
      if (pal.broken) {
        ctx.fillStyle = '#444';
        ctx.fillRect(sx - 10, sy - 2, 20, 4);
        ctx.fillRect(sx - 6, sy + 2, 12, 4);
      } else if (pal.dropped) {
        ctx.fillStyle = '#ff6b35';
        ctx.fillRect(sx - 12, sy - 2, 24, 4);
      } else {
        ctx.fillStyle = '#ff6b35';
        ctx.fillRect(sx - 1, sy - 10, 2, 20);
      }
    }
  }
}

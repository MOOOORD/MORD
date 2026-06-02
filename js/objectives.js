// objectives.js
import { TILE_SIZE, REPAIR_TIME, REPAIR_PHASES, GATE_OPEN_TIME, PALLET_STUN_TIME } from './constants.js';

export class ObjectivesManager {
  constructor(gameMap) {
    this.map = gameMap;
    this.windowCooldowns = {};  // key: "col,row" → remaining frames
  }

  update() {
    for (const key in this.windowCooldowns) {
      this.windowCooldowns[key]--;
      if (this.windowCooldowns[key] <= 0) delete this.windowCooldowns[key];
    }
  }

  getNearbyInteractable(playerX, playerY, types = null) {
    const col = Math.floor(playerX / TILE_SIZE);
    const row = Math.floor(playerY / TILE_SIZE);

    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const r = row + dr;
        const c = col + dc;
        if (r < 0 || r >= this.map.rows || c < 0 || c >= this.map.cols) continue;
        const tile = this.map.grid[r][c];

        if (tile === 3 && (!types || types.includes('generator'))) {
          const gen = this.map.generators.find(g => g.x === c && g.y === r);
          if (gen && !gen.repaired) {
            return { type: 'generator', obj: gen, x: c, y: r };
          }
        }

        if (tile === 5 && (!types || types.includes('exit_gate'))) {
          const gate = this.map.exitGates.find(g => g.x === c && g.y === r);
          if (gate && gate.powered && !gate.open) {
            return { type: 'exit_gate', obj: gate, x: c, y: r };
          }
        }

        if (tile === 6 && (!types || types.includes('pallet'))) {
          const pal = this.map.pallets.find(p => p.x === c && p.y === r);
          if (pal && !pal.dropped && !pal.broken) {
            return { type: 'pallet', obj: pal, x: c, y: r };
          }
        }

        if (tile === 7 && (!types || types.includes('window'))) {
          const key = `${c},${r}`;
          if (this.windowCooldowns[key] && this.windowCooldowns[key] > 0) continue;
          const dest = this._getVaultDest(c, r, col, row);
          if (dest) {
            return { type: 'window', x: c, y: r, dest };
          }
        }
      }
    }
    return null;
  }

  interact(interactable, progress, killer, player) {
    if (!interactable) return null;

    switch (interactable.type) {
      case 'generator':
        return this._repairGenerator(interactable.obj, progress);
      case 'exit_gate':
        return this._openGate(interactable.obj, progress);
      case 'pallet':
        return this._dropPallet(interactable.obj, killer);
      case 'window':
        return this._vaultWindow(interactable, player);
      default:
        return null;
    }
  }

  _repairGenerator(gen, progress) {
    // Initialize phase tracking on first interaction
    if (gen.phase === undefined) gen.phase = -1;

    const phaseSize = REPAIR_TIME / REPAIR_PHASES; // 300 frames per phase
    const currentPhase = Math.min(REPAIR_PHASES - 1, Math.floor(progress / phaseSize));

    // Fire alert on each new phase reached (except final completion)
    if (currentPhase > gen.phase && currentPhase < REPAIR_PHASES - 1) {
      gen.phase = currentPhase;
      return { done: false, event: 'phase_alert', phase: currentPhase + 1, phaseTotal: REPAIR_PHASES };
    }

    if (currentPhase > gen.phase) {
      gen.phase = currentPhase;
    }

    // Generator fully repaired
    if (progress >= REPAIR_TIME) {
      gen.repaired = true;
      gen.phase = REPAIR_PHASES;
      return { done: true, event: 'generator_repaired' };
    }

    // Spark chance increases with phase progress
    const sparkChance = 0.01 + gen.phase * 0.03; // 1%, 4%, 7% per phase
    const spark = Math.random() < sparkChance;
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
        killer.stunTimer = PALLET_STUN_TIME;
      }
    }
    return { done: true, event: 'pallet_dropped' };
  }

  _getVaultDest(wx, wy, px, py) {
    const dc = wx - px;
    const dr = wy - py;
    const destC = wx + dc;
    const destR = wy + dr;
    if (destR < 0 || destR >= this.map.rows || destC < 0 || destC >= this.map.cols) return null;
    const tile = this.map.grid[destR][destC];
    const walkable = t => t === 0 || t === 3 || t === 4 || t === 5 || t === 6;
    if (walkable(tile)) {
      return { x: destC * TILE_SIZE + TILE_SIZE / 2, y: destR * TILE_SIZE + TILE_SIZE / 2 };
    }
    return null;
  }

  _vaultWindow(windowInfo, player) {
    if (windowInfo.dest) {
      player.x = windowInfo.dest.x;
      player.y = windowInfo.dest.y;
      player.invincibleTimer = 15;
      const key = `${windowInfo.x},${windowInfo.y}`;
      this.windowCooldowns[key] = 180; // 3 seconds before same window can be vaulted again
    }
    return { done: true, event: 'window_vaulted' };
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
      const phase = gen.phase || 0;

      if (gen.repaired) {
        // Fully repaired — green
        ctx.fillStyle = '#4ecca3';
        ctx.fillRect(sx - 10, sy - 10, 20, 20);
        ctx.fillStyle = '#fff';
        ctx.fillRect(sx - 5, sy - 5, 10, 10);
      } else {
        // Phase-based color: yellow → orange → red-orange
        const colors = ['#f0c040', '#f0a030', '#f06030'];
        ctx.fillStyle = colors[phase] || '#f0c040';
        ctx.fillRect(sx - 10, sy - 10, 20, 20);

        // Phase indicator pips (small dots showing progress)
        for (let p = 0; p < REPAIR_PHASES; p++) {
          ctx.fillStyle = p <= phase ? '#fff' : '#333';
          ctx.fillRect(sx - 6 + p * 6, sy - 16, 4, 3);
        }

        // Sparking — faster at higher phases
        const sparkIntervals = [40, 25, 12]; // phase 0, 1, 2
        const interval = sparkIntervals[phase] || 40;
        if (pulseFrame % interval < interval / 2) {
          ctx.fillStyle = '#fff';
          ctx.fillRect(sx - 2, sy - 18, 4, 5); // spark above generator
        }

        // Repair progress bar (only show if started repairing)
        const rp = gen.repairProgress || 0;
        if (rp > 0) {
          const barW = 20;
          const barH = 4;
          const barX = sx - barW / 2;
          const barY = sy + 12;
          const pct = Math.min(1, rp / REPAIR_TIME);
          ctx.fillStyle = '#333';
          ctx.fillRect(barX, barY, barW, barH);
          ctx.fillStyle = '#4ecca3';
          ctx.fillRect(barX, barY, barW * pct, barH);
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

    // Pallets — prominent with glow
    for (const pal of this.map.pallets) {
      const sx = pal.x * TILE_SIZE - cameraX + TILE_SIZE / 2;
      const sy = pal.y * TILE_SIZE - cameraY + TILE_SIZE / 2;
      if (pal.broken) {
        ctx.fillStyle = '#444';
        ctx.fillRect(sx - 10, sy - 2, 20, 4);
        ctx.fillRect(sx - 6, sy + 2, 12, 4);
      } else if (pal.dropped) {
        ctx.fillStyle = '#ff6b35';
        ctx.fillRect(sx - 12, sy - 3, 24, 6);
        ctx.fillStyle = '#ffaa55';
        ctx.fillRect(sx - 12, sy - 1, 24, 2);
      } else {
        // Standing pallet — brighter, thicker
        ctx.fillStyle = '#ff8c42';
        ctx.fillRect(sx - 3, sy - 12, 6, 24);
        ctx.fillStyle = '#deb887';
        ctx.fillRect(sx - 5, sy - 14, 10, 4);
        // Subtle glow
        ctx.fillStyle = 'rgba(255, 140, 66, 0.25)';
        ctx.fillRect(sx - 5, sy - 12, 10, 24);
      }
    }

    // Windows — subtle vault indicator, cooldown display
    for (let r = 0; r < this.map.rows; r++) {
      for (let c = 0; c < this.map.cols; c++) {
        if (this.map.grid[r][c] !== 7) continue;
        const sx = c * TILE_SIZE - cameraX + TILE_SIZE / 2;
        const sy = r * TILE_SIZE - cameraY + TILE_SIZE / 2;
        const key = `${c},${r}`;
        const cd = this.windowCooldowns[key] || 0;

        if (cd > 0) {
          // On cooldown — dim red
          ctx.fillStyle = 'rgba(180, 80, 60, 0.3)';
          ctx.fillRect(sx - 8, sy - 6, 16, 12);
          ctx.fillStyle = 'rgba(200, 100, 80, 0.4)';
          ctx.fillRect(sx - 4, sy - 2, 8, 4);
          // Cooldown bar
          const cdPct = cd / 180;
          ctx.fillStyle = '#333';
          ctx.fillRect(sx - 8, sy - 14, 16, 3);
          ctx.fillStyle = '#e94560';
          ctx.fillRect(sx - 8, sy - 14, 16 * cdPct, 3);
        } else {
          ctx.fillStyle = 'rgba(120, 180, 220, 0.3)';
          ctx.fillRect(sx - 8, sy - 6, 16, 12);
          ctx.fillStyle = 'rgba(180, 220, 255, 0.5)';
          ctx.fillRect(sx - 4, sy - 2, 8, 4);
        }
      }
    }
  }
}

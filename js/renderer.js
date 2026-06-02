// renderer.js
import { CANVAS_WIDTH, CANVAS_HEIGHT, PLAYER_HEALTH, GAME_MODE, STATE, PLAYER_VISION_RADIUS, REPAIR_TIME } from './constants.js';
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

    // Focal entity for camera: killer sees from killer's perspective
    const focal = (game.isMultiplayer && game.localRole === 'killer') ? killer : player;
    const camX = focal.x - CANVAS_WIDTH / 2;
    const camY = focal.y - CANVAS_HEIGHT / 2;
    const maxCamX = map.cols * 32 - CANVAS_WIDTH;
    const maxCamY = map.rows * 32 - CANVAS_HEIGHT;
    const cx = Math.max(0, Math.min(camX, maxCamX));
    const cy = Math.max(0, Math.min(camY, maxCamY));

    map.render(ctx, cx, cy);
    objectives.render(ctx, cx, cy, pulseFrame);

    // Player pixel sprite
    const psx = player.x - cx;
    const psy = player.y - cy;
    if (player.health !== 'dead' && player.health !== 'hooked') {
      if (!(player.invincibleTimer > 0 && Math.floor(player.invincibleTimer / 4) % 2 === 0)) {
        const sprite = this._getPlayerSprite(player.health);
        this._drawPixelChar(ctx, psx - 12, psy - 12, sprite, 3);
      }
    } else if (player.health === 'hooked') {
      ctx.fillStyle = '#ff6b6b';
      ctx.fillRect(psx - 4, psy - 16, 8, 8);
      ctx.fillStyle = '#e94560';
      ctx.fillRect(psx - 6, psy - 18, 12, 4);
    }

    // Killer pixel sprite
    const ksx = killer.x - cx;
    const ksy = killer.y - cy;
    if (killer.stunTimer <= 0 || Math.floor(killer.stunTimer / 8) % 2 === 0) {
      const kSprite = this._getKillerSprite(killer.state);
      this._drawPixelChar(ctx, ksx - 9, ksy - 9, kSprite, 3);
    }

    // Survivor-only effects
    if (!game.isMultiplayer || game.localRole === 'survivor') {
      this._renderVisionMask(game, cx, cy);
      this._renderHeartbeat(player, killer);
    }

    this._renderPowerFlash(game);
    this._renderHUD(game);

    // Multiplayer status
    if (game.isMultiplayer) {
      this._renderNetworkStatus(game);
    }

    if (game.mode === GAME_MODE.SCORE) {
      this._renderScoreTimer(game);
    }
  }

  _renderVisionMask(game, camX, camY) {
    const { player } = game;
    const px = player.x - camX;
    const py = player.y - camY;
    const R = PLAYER_VISION_RADIUS;

    // Solid dark overlay with circular vision hole (evenodd fill rule)
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.arc(px, py, R, 0, Math.PI * 2, true); // counter-clockwise = hole
    ctx.fillStyle = 'rgba(0, 0, 0, 0.88)';
    ctx.fill('evenodd');
    ctx.restore();

    // Soft fade at the vision edge
    ctx.save();
    const fade = ctx.createRadialGradient(px, py, R - 25, px, py, R);
    fade.addColorStop(0, 'rgba(0,0,0,0)');
    fade.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.beginPath();
    ctx.arc(px, py, R, 0, Math.PI * 2);
    ctx.fillStyle = fade;
    ctx.fill();
    ctx.restore();
  }

  _renderHeartbeat(player, killer) {
    const level = killer.getHeartbeatLevel(player);
    if (level === 0) return;

    const alpha = level === 1 ? 0.25 : level === 2 ? 0.45 : 0.7;
    const cx = CANVAS_WIDTH / 2;
    const cy = CANVAS_HEIGHT / 2;
    const maxR = Math.hypot(cx, cy);

    // Vignette: center clear, red fades in at edges only
    const gradient = ctx.createRadialGradient(cx, cy, maxR * 0.3, cx, cy, maxR);
    gradient.addColorStop(0, 'transparent');
    gradient.addColorStop(0.5, 'transparent');
    gradient.addColorStop(0.78, `rgba(233, 69, 96, ${alpha * 0.5})`);
    gradient.addColorStop(1, `rgba(233, 69, 96, ${alpha})`);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const beats = ['♥', '♥♥', '♥♥♥'][level - 1];
    ctx.font = '26px monospace';
    ctx.fillStyle = '#e94560';
    ctx.fillText(beats, CANVAS_WIDTH - 70, 34);
  }

  _renderPowerFlash(game) {
    if (game.powerFlash > 0) {
      const alpha = game.powerFlash / 120 * 0.4;
      ctx.fillStyle = `rgba(240, 192, 64, ${alpha})`;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.font = '30px "Press Start 2P", monospace';
      ctx.fillStyle = '#f0c040';
      ctx.textAlign = 'center';
      ctx.fillText('大门已通电！', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 40);
      ctx.textAlign = 'start';
    }
  }

  _renderHUD(game) {
    const { player, map } = game;

    ctx.font = '22px monospace';
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

    if (player.health !== PLAYER_HEALTH.DOWNED && player.health !== PLAYER_HEALTH.HOOKED) {
      const barW = 80, barH = 8;
      ctx.fillStyle = '#333';
      ctx.fillRect(16, 44, barW, barH);
      const ratio = player.stamina / 100;
      ctx.fillStyle = ratio > 0.3 ? '#4ecdc4' : '#e94560';
      ctx.fillRect(16, 44, barW * ratio, barH);
    }

    const repaired = map.generators.filter(g => g.repaired).length;
    ctx.font = '18px monospace';
    ctx.fillStyle = '#f0c040';
    ctx.fillText(`⚙ ${repaired}/5  (需2台通电)`, CANVAS_WIDTH - 240, 30);

    const powered = map.exitGates[0].powered;
    const open = map.exitGates.some(g => g.open);
    ctx.fillText(powered ? (open ? '大门: 已开启' : '大门: 已通电') : '大门: 未通电',
                 CANVAS_WIDTH - 220, 54);

    if (player.interactProgress > 0) {
      const barW = 200, barH = 12;
      const bx = CANVAS_WIDTH / 2 - barW / 2;
      const by = CANVAS_HEIGHT - 48;
      ctx.fillStyle = '#333';
      ctx.fillRect(bx, by, barW, barH);
      const maxProgress = player.health === PLAYER_HEALTH.HOOKED ? 100 : REPAIR_TIME;
      ctx.fillStyle = '#4ecdc4';
      ctx.fillRect(bx, by, barW * Math.min(1, player.interactProgress / maxProgress), barH);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, by, barW, barH);
      ctx.font = '14px monospace';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText('按住空格...', CANVAS_WIDTH / 2, by - 4);
      ctx.textAlign = 'start';
    }

    // Generator repair progress bar (bottom of screen)
    const nearGen = game.objectives
      ? game.objectives.getNearbyInteractable(player.x, player.y, ['generator'])
      : null;
    if (nearGen && (nearGen.obj.repairProgress || 0) > 0) {
      const barW = 280, barH = 14;
      const bx = CANVAS_WIDTH / 2 - barW / 2;
      const by = CANVAS_HEIGHT - 32;
      const pct = Math.min(1, (nearGen.obj.repairProgress || 0) / REPAIR_TIME);
      ctx.fillStyle = '#222';
      ctx.fillRect(bx, by, barW, barH);
      ctx.fillStyle = '#f0c040';
      ctx.fillRect(bx, by, barW * pct, barH);
      ctx.strokeStyle = '#888';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, by, barW, barH);
      ctx.font = '13px monospace';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText(`修理中... ${Math.floor(pct * 100)}%`, CANVAS_WIDTH / 2, by - 4);
      ctx.textAlign = 'start';
    }

    if (player.health === PLAYER_HEALTH.HOOKED) {
      ctx.font = '26px "Press Start 2P", monospace';
      ctx.fillStyle = '#e94560';
      ctx.textAlign = 'center';
      ctx.fillText('连按空格挣扎！', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 50);
      const barW = 300, barH = 16;
      ctx.fillStyle = '#333';
      ctx.fillRect(CANVAS_WIDTH / 2 - barW / 2, CANVAS_HEIGHT / 2 - 8, barW, barH);
      ctx.fillStyle = '#4ecdc4';
      ctx.fillRect(CANVAS_WIDTH / 2 - barW / 2, CANVAS_HEIGHT / 2 - 8,
                   barW * (player.interactProgress / 100), barH);
      ctx.textAlign = 'start';
    }

    if (game.mode === GAME_MODE.SCORE) {
      ctx.font = '18px monospace';
      ctx.fillStyle = '#f0c040';
      ctx.fillText(`得分: ${Math.floor(game.score)}`, 16, 76);
    }
  }

  _renderScoreTimer(game) {
    const mins = Math.floor(game.scoreTimer / 60);
    const secs = Math.floor(game.scoreTimer % 60);
    ctx.font = '26px "Press Start 2P", monospace';
    ctx.fillStyle = game.scoreTimer < 30 ? '#e94560' : '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(`${mins}:${String(secs).padStart(2, '0')}`,
                 CANVAS_WIDTH / 2, 44);
    ctx.textAlign = 'start';
  }

  _renderNetworkStatus(game) {
    const nc = game.network;
    const status = nc ? nc.connectionState : 'disconnected';
    const colors = { connected: '#4ecca3', connecting: '#f0c040', disconnected: '#e94560' };
    const labels = { connected: '● 已连接', connecting: '◐ 连接中', disconnected: '○ 已断开' };
    ctx.font = '12px monospace';
    ctx.fillStyle = colors[status] || '#888';
    ctx.fillText(labels[status] || status, CANVAS_WIDTH - 130, CANVAS_HEIGHT - 12);

    // Role label
    const roleLabel = game.localRole === 'survivor' ? '陈飞飞 (逃生者)' : '阴沟 (监管者)';
    ctx.fillStyle = game.localRole === 'survivor' ? '#4ecdc4' : '#e94560';
    ctx.fillText(roleLabel, 16, CANVAS_HEIGHT - 12);
  }

  _renderPauseOverlay() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.font = '42px "Press Start 2P", monospace';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText('暂停', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 24);
    ctx.font = '18px "Press Start 2P", monospace';
    ctx.fillText('按 Esc 继续', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 36);
    ctx.textAlign = 'start';
  }

  _drawPixelChar(ctx, x, y, data, scale = 3) {
    for (const [px, py, color] of data) {
      ctx.fillStyle = color;
      ctx.fillRect(x + px * scale, y + py * scale, scale, scale);
    }
  }

  _getPlayerSprite(health) {
    const body = health === 'injured' ? '#ff8a80' : '#4ecdc4';
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
}

// renderer.js
import { CANVAS_WIDTH, CANVAS_HEIGHT, PLAYER_HEALTH, GAME_MODE, STATE } from './constants.js';
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

    const camX = player.x - CANVAS_WIDTH / 2;
    const camY = player.y - CANVAS_HEIGHT / 2;
    const maxCamX = map.cols * 32 - CANVAS_WIDTH;
    const maxCamY = map.rows * 32 - CANVAS_HEIGHT;
    const cx = Math.max(0, Math.min(camX, maxCamX));
    const cy = Math.max(0, Math.min(camY, maxCamY));

    map.render(ctx, cx, cy);
    objectives.render(ctx, cx, cy, pulseFrame);
    player.render(ctx, cx, cy);
    killer.render(ctx, cx, cy);

    this._renderHeartbeat(player, killer);
    this._renderPowerFlash(game);
    this._renderHUD(game);

    if (game.mode === GAME_MODE.SCORE) {
      this._renderScoreTimer(game);
    }
  }

  _renderHeartbeat(player, killer) {
    const level = killer.getHeartbeatLevel(player);
    if (level === 0) return;

    const alpha = level === 1 ? 0.15 : level === 2 ? 0.3 : 0.5;
    ctx.fillStyle = `rgba(233, 69, 96, ${alpha})`;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const gradient = ctx.createRadialGradient(CANVAS_WIDTH/2, CANVAS_HEIGHT/2, CANVAS_WIDTH*0.3,
                                               CANVAS_WIDTH/2, CANVAS_HEIGHT/2, CANVAS_WIDTH*0.7);
    gradient.addColorStop(0, 'transparent');
    gradient.addColorStop(1, `rgba(233, 69, 96, ${alpha * 1.5})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const beats = ['♥', '♥♥', '♥♥♥'][level - 1];
    ctx.font = '20px monospace';
    ctx.fillStyle = '#e94560';
    ctx.fillText(beats, CANVAS_WIDTH - 60, 30);
  }

  _renderPowerFlash(game) {
    if (game.powerFlash > 0) {
      const alpha = game.powerFlash / 120 * 0.4;
      ctx.fillStyle = `rgba(240, 192, 64, ${alpha})`;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.font = '24px "Press Start 2P", monospace';
      ctx.fillStyle = '#f0c040';
      ctx.textAlign = 'center';
      ctx.fillText('大门已通电！', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 40);
      ctx.textAlign = 'start';
    }
  }

  _renderHUD(game) {
    const { player, map } = game;

    ctx.font = '16px monospace';
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
    ctx.font = '14px monospace';
    ctx.fillStyle = '#f0c040';
    ctx.fillText(`⚙ ${repaired}/5  (需2台通电)`, CANVAS_WIDTH - 220, 30);

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
      const maxProgress = player.health === PLAYER_HEALTH.HOOKED ? 100 : 180;
      ctx.fillStyle = '#4ecdc4';
      ctx.fillRect(bx, by, barW * Math.min(1, player.interactProgress / maxProgress), barH);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, by, barW, barH);
      ctx.font = '10px monospace';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText('按住空格...', CANVAS_WIDTH / 2, by - 4);
      ctx.textAlign = 'start';
    }

    if (player.health === PLAYER_HEALTH.HOOKED) {
      ctx.font = '20px "Press Start 2P", monospace';
      ctx.fillStyle = '#e94560';
      ctx.textAlign = 'center';
      ctx.fillText('连按空格挣扎！', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40);
      const barW = 300, barH = 16;
      ctx.fillStyle = '#333';
      ctx.fillRect(CANVAS_WIDTH / 2 - barW / 2, CANVAS_HEIGHT / 2 - 8, barW, barH);
      ctx.fillStyle = '#4ecdc4';
      ctx.fillRect(CANVAS_WIDTH / 2 - barW / 2, CANVAS_HEIGHT / 2 - 8,
                   barW * (player.interactProgress / 100), barH);
      ctx.textAlign = 'start';
    }

    if (game.mode === GAME_MODE.SCORE) {
      ctx.font = '14px monospace';
      ctx.fillStyle = '#f0c040';
      ctx.fillText(`得分: ${Math.floor(game.score)}`, 16, 72);
    }
  }

  _renderScoreTimer(game) {
    const mins = Math.floor(game.scoreTimer / 60);
    const secs = Math.floor(game.scoreTimer % 60);
    ctx.font = '20px "Press Start 2P", monospace';
    ctx.fillStyle = game.scoreTimer < 30 ? '#e94560' : '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(`${mins}:${String(secs).padStart(2, '0')}`,
                 CANVAS_WIDTH / 2, 40);
    ctx.textAlign = 'start';
  }

  _renderPauseOverlay() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.font = '32px "Press Start 2P", monospace';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText('暂停', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20);
    ctx.font = '14px "Press Start 2P", monospace';
    ctx.fillText('按 Esc 继续', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 30);
    ctx.textAlign = 'start';
  }
}

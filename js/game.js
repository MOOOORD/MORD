// game.js
import { STATE, GAME_MODE, PLAYER_HEALTH, SCORE_MODE_TIME, KILLER_SPEED, REPAIR_DECAY_RATE, REPAIR_DECAY_FAST } from './constants.js';
import { GameMap } from './map.js';
import { Player } from './player.js';
import { Killer } from './killer.js';
import { ObjectivesManager } from './objectives.js';

export class Game {
  constructor() {
    this.state = STATE.MENU;
    this.mode = GAME_MODE.ESCAPE;
    this.mapType = null;
    this.map = null;
    this.player = null;
    this.killer = null;
    this.objectives = null;
    this.score = 0;
    this.scoreTimer = 0;
    this.survivalTime = 0;
    this.gensRepaired = 0;
    this.resultTitle = '';
    this.resultDetail = '';
    this.resultType = '';   // 'escape' | 'dead' | 'timeout'
    this.keys = {};
    this.pulseFrame = 0;
    this.gatesJustPowered = false;
    this.powerFlash = 0;
  }

  init(mapType, mode, mapData = null) {
    this.mapType = mapType;
    this.mode = mode;
    this.map = new GameMap(mapType, mapData);
    this.player = new Player(96, this.map.rows * 16);
    this.killer = new Killer((this.map.cols - 3) * 32, this.map.rows * 16);
    this.objectives = new ObjectivesManager(this.map);
    this.score = 0;
    this.scoreTimer = SCORE_MODE_TIME;
    this.survivalTime = 0;
    this.gensRepaired = 0;
    this.resultType = '';
    this.gatesJustPowered = false;
    this.powerFlash = 0;
    this.state = STATE.PLAYING;
  }

  update(dt) {
    if (this.state !== STATE.PLAYING) return;
    this.pulseFrame++;
    this.survivalTime += dt;
    if (this.powerFlash > 0) this.powerFlash--;
    this.objectives.update();

    this.player.update(dt, this.keys, this.map);

    // E key — repair generators
    if (this.keys['KeyE']) {
      const genTarget = this.objectives.getNearbyInteractable(this.player.x, this.player.y, ['generator']);
      if (genTarget) {
        this.player.interactProgress++;
        this.player.interacting = true;
        const result = this.objectives.interact(genTarget, this.player.interactProgress, this.killer, this.player);
        if (result) {
          if (result.done) {
            this.player.interactProgress = 0;
            this.player.interacting = false;
            if (result.event === 'generator_repaired') {
              this.gensRepaired++;
              if (this.mode === GAME_MODE.SCORE) this.score += 1000;
              if (this.objectives.areGatesPowered()) {
                this.gatesJustPowered = true;
                this.powerFlash = 120;
              }
            }
          } else {
            if (result.event === 'phase_alert') {
              this._alertKillerToPlayer();
            } else if (result.spark) {
              if (this.killer.state === 'patrol') {
                this.killer.state = 'alert';
                this.killer.alertPos = { x: this.player.x, y: this.player.y };
                this.killer.alertTimer = 120;
              }
            }
          }
        }
      } else {
        this.player.interactProgress = Math.max(0, this.player.interactProgress - REPAIR_DECAY_FAST);
        this.player.interacting = false;
      }
    } else if (this.keys['Space']) {
      // Space — vault windows, drop pallets, open gates, struggle on hook
      if (this.player.health !== PLAYER_HEALTH.HOOKED) {
        const interactable = this.objectives.getNearbyInteractable(this.player.x, this.player.y, ['window', 'pallet', 'exit_gate']);
        if (interactable) {
          this.player.interactProgress++;
          this.player.interacting = true;
          const result = this.objectives.interact(interactable, this.player.interactProgress, this.killer, this.player);
          if (result) {
            if (result.done) {
              this.player.interactProgress = 0;
              this.player.interacting = false;
              if (result.event === 'pallet_dropped') {
                if (this.mode === GAME_MODE.SCORE) this.score += 300;
              }
            }
          }
        } else {
          this.player.interactProgress = Math.max(0, this.player.interactProgress - REPAIR_DECAY_FAST);
          this.player.interacting = false;
        }
      }
    } else {
      this.player.interactProgress = Math.max(0, this.player.interactProgress - REPAIR_DECAY_RATE);
      this.player.interacting = false;
    }

    this.killer.update(dt, this.player, this.map);

    if (this.mode === GAME_MODE.SCORE) {
      this.scoreTimer -= dt;
      if (this.keys['KeyE']) {
        const ia = this.objectives.getNearbyInteractable(this.player.x, this.player.y, ['generator']);
        if (ia) this.score += 20 * dt;
      }
    }

    // Hook death check
    if (this.player.health === PLAYER_HEALTH.HOOKED) {
      if (this.player.hookTimer >= 300) {
        this.player.hookCount++;
        if (this.player.hookCount >= 3) {
          this.player.health = PLAYER_HEALTH.DEAD;
        } else {
          if (Math.random() < 0.12) {
            this.player.health = PLAYER_HEALTH.INJURED;
            this.player.hookTimer = 0;
            this.player.invincibleTimer = 60;
          } else {
            this.player.hookTimer = 0;
            this.killer.state = 'patrol';
          }
        }
      }
    }

    this._checkEndConditions();
  }

  _checkEndConditions() {
    const modeLabel = this.mode === GAME_MODE.ESCAPE ? '逃生模式' : '分数模式';
    const mapNames = { rooms: '房间走廊', open: '开阔场地', hybrid: '混合式' };
    const mapName = mapNames[this.mapType] || this.mapType;
    const timeSec = Math.floor(this.survivalTime);
    const timeStr = `${Math.floor(timeSec / 60)}分${timeSec % 60}秒`;

    if (this.mode === GAME_MODE.ESCAPE && this.objectives.checkEscape(this.player)) {
      this.state = STATE.RESULT;
      this.resultType = 'escape';
      this.resultTitle = '逃脱成功！';
      this.resultDetail = JSON.stringify({
        mode: modeLabel, map: mapName, time: timeStr,
        gens: this.gensRepaired, score: Math.floor(this.score),
        health: '幸存',
      });
      return;
    }

    if (this.player.health === PLAYER_HEALTH.DEAD || this.player.hookCount >= 3) {
      this.state = STATE.RESULT;
      this.resultType = 'dead';
      this.resultTitle = '被淘汰';
      const cause = this.player.hookCount >= 3 ? '挂上钩子三次' : '伤势过重';
      this.resultDetail = JSON.stringify({
        mode: modeLabel, map: mapName, time: timeStr,
        gens: this.gensRepaired, score: Math.floor(this.score),
        health: cause,
      });
      return;
    }

    if (this.mode === GAME_MODE.SCORE && this.scoreTimer <= 0) {
      this.state = STATE.RESULT;
      this.resultType = 'timeout';
      this.resultTitle = '时间到！';
      this.resultDetail = JSON.stringify({
        mode: modeLabel, map: mapName, time: timeStr,
        gens: this.gensRepaired, score: Math.floor(this.score),
        health: '存活',
      });
    }
  }

  handleKeyDown(code) {
    this.keys[code] = true;
  }

  handleKeyUp(code) {
    this.keys[code] = false;
  }

  _alertKillerToPlayer() {
    // Force killer to know the player's exact position and enter alert/chase
    const k = this.killer;
    k.alertPos = { x: this.player.x, y: this.player.y };
    k.lastPlayerSeen = { x: this.player.x, y: this.player.y };
    k.alertTimer = 300; // 5 seconds to investigate
    // Clear any search state so it goes straight to the player
    k.searchPoints = [];
    k.searchIndex = 0;
    if (k.state !== 'carry' && k.state !== 'break') {
      k.state = 'alert';
      k.speed = KILLER_SPEED;
    }
  }

  togglePause() {
    if (this.state === STATE.PLAYING) {
      this.state = STATE.PAUSED;
    } else if (this.state === STATE.PAUSED) {
      this.state = STATE.PLAYING;
    }
  }
}

// game.js
import { STATE, GAME_MODE, PLAYER_HEALTH, SCORE_MODE_TIME } from './constants.js';
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
    this.resultTitle = '';
    this.resultDetail = '';
    this.keys = {};
    this.pulseFrame = 0;
    this.gatesJustPowered = false;
    this.powerFlash = 0;
  }

  init(mapType, mode) {
    this.mapType = mapType;
    this.mode = mode;
    this.map = new GameMap(mapType);
    this.player = new Player(96, this.map.rows * 16);
    this.killer = new Killer((this.map.cols - 3) * 32, this.map.rows * 16);
    this.objectives = new ObjectivesManager(this.map);
    this.score = 0;
    this.scoreTimer = SCORE_MODE_TIME;
    this.gatesJustPowered = false;
    this.powerFlash = 0;
    this.state = STATE.PLAYING;
  }

  update(dt) {
    if (this.state !== STATE.PLAYING) return;
    this.pulseFrame++;
    if (this.powerFlash > 0) this.powerFlash--;

    this.player.update(dt, this.keys, this.map);

    if (this.player.interacting) {
      const interactable = this.objectives.getNearbyInteractable(this.player.x, this.player.y);
      if (interactable) {
        this.player.interactProgress++;
        const result = this.objectives.interact(interactable, this.player.interactProgress, this.killer);
        if (result) {
          if (result.done) {
            this.player.interactProgress = 0;
            this.player.interacting = false;
            if (result.event === 'generator_repaired') {
              if (this.mode === GAME_MODE.SCORE) this.score += 1000;
              if (this.objectives.areGatesPowered()) {
                this.gatesJustPowered = true;
                this.powerFlash = 120;
              }
            } else if (result.event === 'pallet_dropped') {
              if (this.mode === GAME_MODE.SCORE) this.score += 300;
            }
          } else if (result.spark) {
            if (this.killer.state === 'patrol') {
              this.killer.state = 'alert';
              this.killer.alertPos = { x: this.player.x, y: this.player.y };
              this.killer.alertTimer = 120;
            }
          }
        }
      } else {
        this.player.interactProgress = Math.max(0, this.player.interactProgress - 0.5);
      }
    } else {
      this.player.interactProgress = Math.max(0, this.player.interactProgress - 1);
    }

    this.killer.update(dt, this.player, this.map);

    if (this.mode === GAME_MODE.SCORE) {
      this.scoreTimer -= dt;
      if (this.player.interacting) {
        const ia = this.objectives.getNearbyInteractable(this.player.x, this.player.y);
        if (ia && ia.type === 'generator') this.score += 20 * dt;
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
    if (this.mode === GAME_MODE.ESCAPE && this.objectives.checkEscape(this.player)) {
      this.state = STATE.RESULT;
      this.resultTitle = '逃脱成功！';
      this.resultDetail = '你成功逃出了监管者的追捕';
      return;
    }

    if (this.player.health === PLAYER_HEALTH.DEAD || this.player.hookCount >= 3) {
      this.state = STATE.RESULT;
      this.resultTitle = '被淘汰';
      this.resultDetail = `得分: ${this.score}`;
      return;
    }

    if (this.mode === GAME_MODE.SCORE && this.scoreTimer <= 0) {
      this.state = STATE.RESULT;
      this.resultTitle = '时间到！';
      this.resultDetail = `最终得分: ${Math.floor(this.score)}`;
    }
  }

  handleKeyDown(code) {
    this.keys[code] = true;
  }

  handleKeyUp(code) {
    this.keys[code] = false;
  }

  togglePause() {
    if (this.state === STATE.PLAYING) {
      this.state = STATE.PAUSED;
    } else if (this.state === STATE.PAUSED) {
      this.state = STATE.PLAYING;
    }
  }
}

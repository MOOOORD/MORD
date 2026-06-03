// game.js
import { STATE, GAME_MODE, PLAYER_HEALTH, SCORE_MODE_TIME, KILLER_SPEED, KILLER_STATE, NETWORK_STATE_RATE, NETWORK_INPUT_RATE, PLAYER_ROLE, FOOTPRINT_DURATION } from './constants.js';
import { GameMap } from './map.js';
import { Player } from './player.js';
import { Killer } from './killer.js';
import { ObjectivesManager } from './objectives.js';

const HEALTH_MAP = { 0: 'healthy', 1: 'injured', 2: 'downed', 3: 'hooked', 4: 'dead' };
const HEALTH_REV = { healthy: 0, injured: 1, downed: 2, hooked: 3, dead: 4 };
const KSTATE_MAP = { 0: 'patrol', 1: 'alert', 2: 'chase', 3: 'carry', 4: 'break' };
const KSTATE_REV = { patrol: 0, alert: 1, chase: 2, carry: 3, break: 4 };
const APHASE_MAP = { 0: 'idle', 1: 'warning', 2: 'wipe' };
const APHASE_REV = { idle: 0, warning: 1, wipe: 2 };

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
    this.resultType = '';
    this.keys = {};
    this.pulseFrame = 0;
    this.gatesJustPowered = false;
    this.powerFlash = 0;
    this.footprints = [];
    // Multiplayer
    this.isMultiplayer = false;
    this.localRole = null;
    this.isHost = false;
    this.network = null;
    this.remoteKeys = {};
    this.lastStateSend = 0;
    this.lastInputSeq = -1;
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
    this.footprints = [];
    this._footprintTimer = 0;
    this.state = STATE.PLAYING;
  }

  initMultiplayer(mapType, mode, mapData, localRole, isHost, network) {
    this.init(mapType, mode, mapData);
    this.isMultiplayer = true;
    this.localRole = localRole;
    this.isHost = isHost;
    this.network = network;
    this.lastStateSend = 0;

    if (isHost) {
      this.network.on('player_input', (msg) => {
        this.remoteKeys = msg.keys || {};
      });
    } else {
      this.network.on('state_sync', (msg) => {
        this._receiveState(msg);
      });
      this.network.on('game_event', (msg) => {
        if (msg.event === 'paused') { this.state = STATE.PAUSED; }
        else if (msg.event === 'resumed') { this.state = STATE.PLAYING; }
        else if (msg.event === 'result') {
          this.state = STATE.RESULT;
          this.resultType = msg.resultType;
          this.resultTitle = msg.resultTitle;
          this.resultDetail = msg.resultDetail;
        }
      });
    }
  }

  _serializeState() {
    const p = this.player;
    const k = this.killer;
    return {
      p: [
        p.x, p.y, HEALTH_REV[p.health], p.stamina,
        p.hookCount, p.hookTimer, p.invincibleTimer, p.hitBoostTimer,
        p.facingDir.x, p.facingDir.y, p.interacting ? 1 : 0, p.interactProgress,
      ],
      k: [
        k.x, k.y, KSTATE_REV[k.state], k.stunTimer,
        APHASE_REV[k.attackPhase], k.attackTimer, k.attackHit ? 1 : 0, k.windowSlowTimer,
      ],
      g: this.map.generators.map(g => [g.x, g.y, g.repaired ? 1 : 0, g.phase || 0, g.repairProgress || 0]),
      d: this.map.exitGates.map(g => [g.x, g.y, g.open ? 1 : 0, g.powered ? 1 : 0]),
      l: this.map.pallets.map(p => [p.x, p.y, p.dropped ? 1 : 0, p.broken ? 1 : 0]),
      w: { ...this.objectives.windowCooldowns },
      fp: this.footprints.slice(-60).map(f => [f.x, f.y, f.time]),
      m: [this.mode === GAME_MODE.ESCAPE ? 0 : 1, this.score, this.scoreTimer,
        this.gensRepaired, this.powerFlash, this.survivalTime],
      seq: ++this.lastInputSeq,
    };
  }

  _receiveState(data) {
    const s = data;
    if (!s || !s.p || !s.k) return;

    const lerp = 0.35; // smooth interpolation factor

    // Player state (lerp position to avoid snapping)
    this.player.x += (s.p[0] - this.player.x) * lerp;
    this.player.y += (s.p[1] - this.player.y) * lerp;
    this.player.health = HEALTH_MAP[s.p[2]] || PLAYER_HEALTH.HEALTHY;
    this.player.stamina += (s.p[3] - this.player.stamina) * lerp;
    this.player.hookCount = s.p[4];
    this.player.hookTimer = s.p[5];
    this.player.invincibleTimer = s.p[6];
    this.player.hitBoostTimer = s.p[7];
    this.player.facingDir = { x: s.p[8], y: s.p[9] };
    this.player.interacting = !!s.p[10];
    this.player.interactProgress += (s.p[11] - this.player.interactProgress) * lerp;

    // Killer state (lerp position)
    this.killer.x += (s.k[0] - this.killer.x) * lerp;
    this.killer.y += (s.k[1] - this.killer.y) * lerp;
    this.killer.state = KSTATE_MAP[s.k[2]] || KILLER_STATE.PATROL;
    this.killer.stunTimer = s.k[3];
    this.killer.attackPhase = APHASE_MAP[s.k[4]] || 'idle';
    this.killer.attackTimer = s.k[5];
    this.killer.attackHit = !!s.k[6];
    this.killer.windowSlowTimer = s.k[7];

    // Generators
    for (let i = 0; i < s.g.length; i++) {
      const [gx, gy, repaired, phase, repairProgress] = s.g[i];
      if (i < this.map.generators.length) {
        const gen = this.map.generators[i];
        if (gen.x === gx && gen.y === gy) {
          gen.repaired = !!repaired;
          gen.phase = phase || 0;
          gen.repairProgress = repairProgress || 0;
        }
      }
    }

    // Gates
    for (let i = 0; i < s.d.length; i++) {
      const [dx, dy, open, powered] = s.d[i];
      if (i < this.map.exitGates.length) {
        const gate = this.map.exitGates[i];
        if (gate.x === dx && gate.y === dy) {
          gate.open = !!open;
          gate.powered = !!powered;
        }
      }
    }

    // Pallets
    for (let i = 0; i < s.l.length; i++) {
      const [lx, ly, dropped, broken] = s.l[i];
      if (i < this.map.pallets.length) {
        const pal = this.map.pallets[i];
        if (pal.x === lx && pal.y === ly) {
          pal.dropped = !!dropped;
          pal.broken = !!broken;
        }
      }
    }

    // Window cooldowns
    if (s.w) {
      this.objectives.windowCooldowns = {};
      Object.assign(this.objectives.windowCooldowns, s.w);
    }

    // Footprints
    if (s.fp) {
      this.footprints = s.fp.map(([x, y, t]) => ({ x, y, time: t }));
    }

    // Game state
    if (s.m) {
      this.mode = s.m[0] === 0 ? GAME_MODE.ESCAPE : GAME_MODE.SCORE;
      this.score = s.m[1];
      this.scoreTimer = s.m[2];
      this.gensRepaired = s.m[3];
      this.powerFlash = s.m[4];
      this.survivalTime = s.m[5];
    }
  }

  _sendState() {
    if (!this.network || !this.isHost) return;
    this.network.send('state_sync', this._serializeState());
  }

  _sendEvent(event, extra = {}) {
    if (!this.network || !this.isHost) return;
    this.network.send('game_event', { event, ...extra });
  }

  _sendInput() {
    if (!this.network || this.isHost) return;
    this.network.send('player_input', { keys: { ...this.keys } });
  }

  update(dt) {
    if (this.state !== STATE.PLAYING) return;

    // --- Client: send input every frame, no local prediction ---
    if (this.isMultiplayer && !this.isHost) {
      this._sendInput();
      if (this.pulseFrame === 0) {
        const msg = '[CLIENT] sending input, waiting for state_sync';
        console.log(msg);
        if (typeof window._debug === 'function') window._debug(msg);
      }
      this.pulseFrame++;
      return;
    }

    // --- Host / single-player: full simulation ---
    if (this.pulseFrame === 0) {
      const msg = '[HOST] running sim role=' + this.localRole;
      console.log(msg);
      if (typeof window._debug === 'function') window._debug(msg);
    }
    this.pulseFrame++;
    this.survivalTime += dt;
    if (this.powerFlash > 0) this.powerFlash--;
    this.objectives.update();

    // Determine which keys control which entity
    const playerKeys = (this.isMultiplayer && this.localRole === PLAYER_ROLE.KILLER)
      ? this.remoteKeys : this.keys;
    const killerKeys = (this.isMultiplayer && this.localRole === PLAYER_ROLE.SURVIVOR)
      ? this.remoteKeys : this.keys;

    this.player.update(dt, playerKeys, this.map);

    // E key — repair generators (survivor only)
    if (playerKeys['KeyE']) {
      const genTarget = this.objectives.getNearbyInteractable(this.player.x, this.player.y, ['generator']);
      if (genTarget) {
        genTarget.obj.repairProgress = (genTarget.obj.repairProgress || 0) + 1;
        this.player.interacting = true;
        const result = this.objectives.interact(genTarget, genTarget.obj.repairProgress, this.killer, this.player);
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
        this.player.interacting = false;
      }
    } else if (playerKeys['Space']) {
      // Space — vault windows, drop pallets, open gates
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
          this.player.interacting = false;
        }
      }
    } else {
      this.player.interacting = false;
    }

    // Killer update: AI or human-controlled
    if (this.isMultiplayer) {
      this.killer.updatePlayerControlled(dt, killerKeys, this.player, this.map);
    } else {
      this.killer.update(dt, this.player, this.map);
    }

    if (this.mode === GAME_MODE.SCORE) {
      this.scoreTimer -= dt;
      if (playerKeys['KeyE']) {
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

    // Footprint tracking — survivor leaves trail visible to killer
    if (this.player.health !== 'dead' && this.player.health !== 'hooked') {
      this._footprintTimer = (this._footprintTimer || 0) + 1;
      if (this._footprintTimer >= 5) {
        this._footprintTimer = 0;
        this.footprints.push({ x: this.player.x, y: this.player.y, time: FOOTPRINT_DURATION });
      }
    }
    // Expire old footprints
    this.footprints = this.footprints.filter(f => { f.time -= 1; return f.time > 0; });

    this._checkEndConditions();

    // Send state to client periodically
    if (this.isMultiplayer && this.isHost) {
      this.lastStateSend += dt * 1000;
      while (this.lastStateSend >= NETWORK_STATE_RATE) {
        this._sendState();
        this.lastStateSend -= NETWORK_STATE_RATE;
      }
    }
  }

  _checkEndConditions() {
    const modeLabel = this.mode === GAME_MODE.ESCAPE ? '逃生模式' : '分数模式';
    const mapNames = { rooms: '房间走廊', open: '开阔场地', hybrid: '混合式' };
    const mapName = mapNames[this.mapType] || this.mapType;
    const timeSec = Math.floor(this.survivalTime);
    const timeStr = `${Math.floor(timeSec / 60)}分${timeSec % 60}秒`;

    const setResult = (type, title, health) => {
      this.state = STATE.RESULT;
      this.resultType = type;
      this.resultTitle = title;
      this.resultDetail = JSON.stringify({
        mode: modeLabel, map: mapName, time: timeStr,
        gens: this.gensRepaired, score: Math.floor(this.score),
        health,
      });
      if (this.isMultiplayer && this.isHost) {
        this._sendEvent('result', { resultType: type, resultTitle: title, resultDetail: this.resultDetail });
      }
    };

    if (this.mode === GAME_MODE.ESCAPE && this.objectives.checkEscape(this.player)) {
      setResult('escape', '逃脱成功！', '幸存');
      return;
    }

    if (this.player.health === PLAYER_HEALTH.DEAD || this.player.hookCount >= 3) {
      const cause = this.player.hookCount >= 3 ? '挂上钩子三次' : '伤势过重';
      setResult('dead', '被淘汰', cause);
      return;
    }

    if (this.mode === GAME_MODE.SCORE && this.scoreTimer <= 0) {
      setResult('timeout', '时间到！', '存活');
    }
  }

  handleKeyDown(code) {
    if (this.keys[code] !== true) {
      const msg = '[KEY] ' + code;
      console.log(msg);
      if (typeof window._debug === 'function') window._debug(msg);
    }
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
      if (this.isMultiplayer && this.isHost) this._sendEvent('paused');
    } else if (this.state === STATE.PAUSED) {
      this.state = STATE.PLAYING;
      if (this.isMultiplayer && this.isHost) this._sendEvent('resumed');
    }
  }
}

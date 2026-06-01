// constants.js
export const TILE_SIZE = 32;
export const MAP_COLS = 30;
export const MAP_ROWS = 22;
export const CANVAS_WIDTH = 960;   // 30 * 32
export const CANVAS_HEIGHT = 704;  // 22 * 32

export const TILE = {
  FLOOR: 0,
  WALL: 1,
  OBSTACLE: 2,
  GENERATOR: 3,
  HOOK: 4,
  EXIT_GATE: 5,
  PALLET: 6,
};

export const PLAYER_SPEED = 2.5;       // px per frame
export const PLAYER_RUN_SPEED = 4.0;
export const PLAYER_STAMINA = 100;
export const PLAYER_STAMINA_DRAIN = 1.2;
export const PLAYER_STAMINA_REGEN = 0.6;
export const KILLER_SPEED = 2.8;       // slightly faster than normal walk
export const KILLER_CHASE_SPEED = 3.2;
export const PLAYER_INJURED_SPEED = 2.0;

export const REPAIR_TIME = 900;        // frames (15 seconds at 60fps), 3 phases of 5s each
export const REPAIR_PHASES = 3;
export const GATE_OPEN_TIME = 240;     // frames (4 seconds)
export const HOOK_STRUGGLE_TIME = 120; // frames
export const HOOK_ESCAPE_CHANCE = 0.12;
export const HOOK_MAX_COUNT = 3;
export const PALLET_STUN_TIME = 90;    // frames

export const KILLER_VISION_RANGE = 8;  // tiles
export const KILLER_HEARING_RANGE = 6; // tiles, for repair noise
export const KILLER_ALERT_DURATION = 180; // frames

export const PLAYER_VISION_RADIUS = 200; // pixels around player that are visible
export const SCORE_MODE_TIME = 300;    // seconds (5 minutes)

export const STATE = {
  MENU: 'menu',
  MAP_SELECT: 'map_select',
  MODE_SELECT: 'mode_select',
  PLAYING: 'playing',
  PAUSED: 'paused',
  RESULT: 'result',
};

export const GAME_MODE = {
  ESCAPE: 'escape',
  SCORE: 'score',
};

export const MAP_TYPE = {
  ROOMS: 'rooms',
  OPEN: 'open',
  HYBRID: 'hybrid',
};

export const KILLER_STATE = {
  PATROL: 'patrol',
  ALERT: 'alert',
  CHASE: 'chase',
  CARRY: 'carry',
  BREAK: 'break',
};

export const PLAYER_HEALTH = {
  HEALTHY: 'healthy',
  INJURED: 'injured',
  DOWNED: 'downed',
  HOOKED: 'hooked',
  DEAD: 'dead',
};

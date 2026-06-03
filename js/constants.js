// constants.js
export const TILE_SIZE = 32;
export const MAP_COLS = 30;
export const MAP_ROWS = 22;
export const CANVAS_WIDTH = 960;   // 30 * 32
export const CANVAS_HEIGHT = 704;  // 22 * 32
export const EDITOR_TILE_SIZE = 24;

export const TILE = {
  FLOOR: 0,
  WALL: 1,
  OBSTACLE: 2,
  GENERATOR: 3,
  HOOK: 4,
  EXIT_GATE: 5,
  PALLET: 6,
  WINDOW: 7,
};

export const TILE_LABELS = {
  [TILE.FLOOR]:      { name: '地板',   color: '#1a1a2e' },
  [TILE.WALL]:       { name: '墙壁',   color: '#16213e' },
  [TILE.OBSTACLE]:   { name: '障碍物', color: '#0f3460' },
  [TILE.GENERATOR]:  { name: '发电机', color: '#f0c040' },
  [TILE.HOOK]:       { name: '钩子',   color: '#a0522d' },
  [TILE.EXIT_GATE]:  { name: '大门',   color: '#4ecca3' },
  [TILE.PALLET]:     { name: '板子',   color: '#ff8c42' },
  [TILE.WINDOW]:     { name: '窗户',   color: '#5a8ab5' },
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
export const PALLET_STUN_TIME = 180;   // frames (3 seconds) — stun when pallet dropped on killer
export const KILLER_BREAK_TIME = 60;   // frames (1 second) — time to break a dropped pallet
export const PLAYER_HIT_BOOST_SPEED = 6.5;   // burst speed after being hit
export const PLAYER_HIT_BOOST_DURATION = 120; // frames of speed boost (2s)
export const KILLER_ATTACK_WARNING = 18;     // frames — visible warning before attack hits
export const KILLER_MISS_WIPE = 60;           // 1 second wipe on miss
export const KILLER_HIT_WIPE = 240;           // 4 seconds wipe on hit
export const REPAIR_DECAY_RATE = 0.1;         // slow decay when no key pressed
export const REPAIR_DECAY_FAST = 0.05;        // slow decay when wrong key pressed

export const KILLER_VISION_RANGE = 8;  // tiles
export const KILLER_HEARING_RANGE = 6; // tiles, for repair noise
export const KILLER_ALERT_DURATION = 180; // frames
export const KILLER_CHASE_RANGE = 14;  // tiles — lose chase beyond this distance

export const PLAYER_VISION_RADIUS = 200; // pixels around player that are visible
export const KILLER_VISION_RADIUS = 400; // multiplayer killer vision (2x survivor)
export const FOOTPRINT_DURATION = 300;  // frames (5 seconds at 60fps)
export const GEN_HIGHLIGHT_DURATION = 180; // frames (3 seconds) — gen glow after phase milestone
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
  CUSTOM: 'custom',
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

// Network sync
export const NETWORK_STATE_RATE = 50;    // ms between state syncs (20 Hz)
export const NETWORK_INPUT_RATE = 33;    // ms between input sends (~30 Hz)

export const PLAYER_ROLE = {
  SURVIVOR: 'survivor',
  KILLER: 'killer',
  SPECTATOR: 'spectator',
};

// Multiplayer game state (extends STATE for lobby)
export const LOBBY_STATE = {
  IDLE: 'idle',
  CREATING: 'creating',
  JOINING: 'joining',
  WAITING: 'waiting',
  READY: 'ready',
};

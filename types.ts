export type ScreenState = 'AUTH' | 'LOBBY' | 'GAME';

export interface PlayerProfile {
  id: string;
  name: string;
  isHost: boolean;
}

export interface Vec2 {
  x: number;
  y: number;
}

export interface Entity {
  id: string;
  pos: Vec2;
  velocity: Vec2;
  rotation: number; // in radians
  radius: number;
  type: 'PLAYER' | 'FRIEND' | 'SNAKE' | 'TREE' | 'ROCK' | 'STREAM';
  hp: number;
  maxHp: number;
  isAttacking: boolean;
  attackCooldown: number;
  walkCycle: number; // For animation 0-2PI
  color: string;
  // Leveling stats
  level?: number;
  xp?: number;
  maxXp?: number;
}

export interface GameState {
  player: Entity;
  friend?: Entity; // The second player
  enemies: Entity[]; // Snakes
  environment: Entity[]; // Trees, Rocks, Streams
  score: number;
  gameOver: boolean;
  camera: Vec2;
}
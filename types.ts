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
  type: 'PLAYER' | 'FRIEND' | 'ENEMY' | 'TREE';
  hp: number;
  maxHp: number;
  isAttacking: boolean;
  attackCooldown: number;
  walkCycle: number; // For animation 0-2PI
  color: string;
}

export interface GameState {
  player: Entity;
  friend?: Entity; // The second player
  enemies: Entity[];
  trees: Entity[];
  score: number;
  gameOver: boolean;
  camera: Vec2;
}
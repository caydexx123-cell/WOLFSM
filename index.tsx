import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { PawPrint, Shield, WifiOff, Play, Sword, Skull, Menu, Copy, CheckCircle2, Loader2, Users, Radio } from 'lucide-react';

// --- TYPES ---
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
  rotation: number;
  radius: number;
  type: 'PLAYER' | 'FRIEND' | 'ENEMY' | 'TREE';
  hp: number;
  maxHp: number;
  isAttacking: boolean;
  attackCooldown: number;
  walkCycle: number;
  color: string;
}

export interface GameState {
  player: Entity;
  friend?: Entity;
  enemies: Entity[];
  trees: Entity[];
  score: number;
  gameOver: boolean;
  camera: Vec2;
}

// Network Packets
type Packet = 
  | { type: 'PLAYER_UPDATE'; data: Entity }
  | { type: 'WORLD_UPDATE'; enemies: Entity[]; score: number }
  | { type: 'GAME_START'; seed: number };

// --- UTILS ---
const dist = (a: Vec2, b: Vec2) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
const lerp = (start: number, end: number, t: number) => start * (1 - t) + end * t;
// Simple seeded random for consistent tree generation across clients
const seededRandom = (seed: number) => {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
};

// --- COMPONENTS ---

// 1. Auth Screen
interface AuthScreenProps {
  profile: PlayerProfile;
  peerId: string | null;
  onCreate: () => void;
  onJoin: (id: string) => void;
  onOffline: () => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ profile, peerId, onCreate, onJoin, onOffline }) => {
  const [joinId, setJoinId] = useState('');

  return (
    <div className="relative z-10 flex flex-col items-center justify-center h-full p-6">
      <div className="max-w-md w-full bg-black/80 backdrop-blur-md border border-green-900/50 p-8 rounded-xl shadow-2xl shadow-green-900/20">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-green-400 to-emerald-800 uppercase italic transform -skew-x-12">
            Hotline Forest
          </h1>
          <p className="text-neutral-400 mt-2 text-sm tracking-widest">REAL-TIME MULTIPLAYER</p>
        </div>

        <div className="mb-6 bg-neutral-900/50 p-4 rounded border border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-neutral-800 rounded-full flex items-center justify-center">
              <PawPrint className="text-green-500 w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-neutral-500 uppercase">Your Online ID</p>
              {peerId ? (
                <p className="text-xl font-mono font-bold text-white tracking-wider animate-pulse">{peerId}</p>
              ) : (
                 <p className="text-sm font-mono text-yellow-500 animate-bounce">CONNECTING...</p>
              )}
            </div>
          </div>
          <div className={`h-2 w-2 rounded-full ${peerId ? 'bg-green-500' : 'bg-red-500'} animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.8)]`} />
        </div>

        <div className="space-y-4">
          <button 
            onClick={onOffline}
            className="w-full group relative overflow-hidden rounded bg-neutral-800 p-4 transition hover:bg-neutral-700 active:scale-95 border border-neutral-700"
          >
            <div className="flex items-center justify-between relative z-10">
              <span className="font-bold text-lg flex items-center gap-2">
                <WifiOff className="w-5 h-5 text-neutral-500 group-hover:text-white" />
                PLAY OFFLINE
              </span>
              <Play className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
            </div>
          </button>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-neutral-800"></div>
            <span className="flex-shrink-0 mx-4 text-neutral-600 text-xs uppercase">Online Multiplayer</span>
            <div className="flex-grow border-t border-neutral-800"></div>
          </div>

          <button 
            onClick={onCreate}
            disabled={!peerId}
            className="w-full bg-emerald-900/30 border border-emerald-500/30 hover:bg-emerald-800/50 disabled:opacity-50 p-4 rounded text-emerald-400 font-bold flex items-center justify-center gap-2 transition active:scale-95"
          >
            <Shield className="w-5 h-5" />
            CREATE LOBBY (HOST)
          </button>

          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="FRIEND'S ID"
              value={joinId}
              onChange={(e) => setJoinId(e.target.value.toUpperCase())}
              className="flex-1 bg-neutral-900 border border-neutral-700 rounded p-4 text-center font-mono placeholder:text-neutral-600 focus:outline-none focus:border-green-500 transition"
            />
            <button 
              onClick={() => joinId && onJoin(joinId)}
              disabled={!joinId || !peerId}
              className="bg-neutral-800 border border-neutral-700 hover:border-white hover:bg-neutral-700 text-white p-4 rounded disabled:opacity-50 disabled:cursor-not-allowed font-bold"
            >
              JOIN
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// 2. Lobby Screen
interface LobbyScreenProps {
  currentUser: PlayerProfile;
  peerId: string;
  conn: any; // PeerJS DataConnection
  isHost: boolean;
  onStart: () => void;
  onBack: () => void;
}

const LobbyScreen: React.FC<LobbyScreenProps> = ({ currentUser, peerId, conn, isHost, onStart, onBack }) => {
  const [copied, setCopied] = useState(false);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (conn) {
       // If connection is already open
       if (conn.open) setConnected(true);
       
       conn.on('open', () => {
         setConnected(true);
       });
       
       // If we are client, wait for start game message
       if (!isHost) {
         conn.on('data', (data: any) => {
           if (data.type === 'GAME_START') {
             onStart();
           }
         });
       }
    }
  }, [conn, isHost, onStart]);

  const copyId = () => {
    navigator.clipboard.writeText(peerId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleHostStart = () => {
    if (conn && conn.open) {
      // Send start signal to client
      const seed = Math.floor(Math.random() * 100000);
      conn.send({ type: 'GAME_START', seed });
      // We pass the seed via local storage or props context usually, but for now we'll inject it via a global hack or just prop
      // For simplicity, Host starts immediately after sending.
      // We need to pass seed to GameEngine.
      (window as any).GAME_SEED = seed;
      onStart();
    }
  };

  return (
    <div className="relative z-10 flex flex-col items-center justify-center h-full p-6 bg-black/90">
      <div className="max-w-2xl w-full bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-2xl">
        <div className="bg-neutral-950 p-6 border-b border-neutral-800 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Users className="text-green-500" />
              {isHost ? 'HOSTING LOBBY' : 'JOINING LOBBY'}
            </h2>
            <p className="text-neutral-500 text-sm">{connected ? 'Connection Established!' : 'Waiting for connection...'}</p>
          </div>
          <button onClick={onBack} className="text-red-500 hover:text-red-400 text-sm font-bold uppercase tracking-wider">
            Disconnect
          </button>
        </div>

        <div className="p-8">
          {isHost && (
            <div className="flex flex-col items-center mb-12">
              <span className="text-neutral-500 text-xs uppercase mb-2">Your Lobby ID (Give to Friend)</span>
              <button 
                onClick={copyId}
                className="group relative bg-neutral-800 hover:bg-neutral-700 border-2 border-dashed border-neutral-600 hover:border-green-500 transition-all rounded-lg px-12 py-6 flex flex-col items-center gap-2"
              >
                <span className="text-4xl font-mono font-black tracking-[0.2em] text-white">
                  {peerId}
                </span>
                <div className="flex items-center gap-1 text-xs text-green-500 font-bold opacity-0 group-hover:opacity-100 transition-opacity absolute -bottom-8">
                  {copied ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? "COPIED" : "CLICK TO COPY"}
                </div>
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-neutral-800/50 border border-green-500/50 p-4 rounded flex items-center gap-4">
               <div className="w-12 h-12 bg-neutral-700 rounded-full flex items-center justify-center relative">
                 <div className="text-2xl">🐺</div> 
               </div>
               <div>
                 <p className="font-bold text-white">You</p>
                 <p className="text-xs text-green-400 font-mono">READY</p>
               </div>
            </div>

            <div className={`border p-4 rounded flex items-center gap-4 transition-all duration-500 ${connected ? 'bg-neutral-800/50 border-orange-500/50' : 'bg-neutral-900 border-neutral-800 border-dashed'}`}>
              {connected ? (
                <>
                  <div className="w-12 h-12 bg-neutral-700 rounded-full flex items-center justify-center relative">
                     <div className="text-2xl">🦊</div>
                  </div>
                  <div>
                    <p className="font-bold text-white">Real Player</p>
                    <p className="text-xs text-orange-400 font-mono">CONNECTED</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-full border-2 border-neutral-700 border-t-neutral-500 animate-spin"></div>
                  <div>
                    <p className="font-bold text-neutral-500">Waiting...</p>
                    <p className="text-xs text-neutral-600 font-mono">SCANNING</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {isHost ? (
             <button
              onClick={handleHostStart}
              disabled={!connected}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-700 disabled:from-neutral-800 disabled:to-neutral-800 disabled:text-neutral-500 hover:from-green-500 hover:to-emerald-600 text-white font-black text-xl py-6 rounded-lg shadow-lg shadow-green-900/30 transition-all active:scale-[0.99] flex items-center justify-center gap-3 uppercase tracking-wider"
            >
              {connected ? <><Play className="fill-current" /> START GAME</> : <><Loader2 className="animate-spin" /> WAITING FOR PLAYER...</>}
            </button>
          ) : (
             <div className="text-center p-6 bg-neutral-800 rounded-lg animate-pulse">
                <p className="text-green-400 font-bold uppercase tracking-widest">Waiting for Host to start...</p>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

// 3. Game Engine
const CANVAS_WIDTH = 2500;
const CANVAS_HEIGHT = 2500;
const SPAWN_ZONE_CENTER = { x: 1250, y: 1250 };
const SPAWN_ZONE_RADIUS = 300;

interface GameEngineProps {
  isMultiplayer: boolean;
  isHost: boolean;
  conn: any; // PeerJS connection
  onExit: () => void;
}

const GameEngine: React.FC<GameEngineProps> = ({ isMultiplayer, isHost, conn, onExit }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();
  const [hudState, setHudState] = useState({ hp: 100, score: 0, gameOver: false });
  const keys = useRef<{ [key: string]: boolean }>({});
  const mouse = useRef<Vec2>({ x: 0, y: 0 });
  const joystickRef = useRef<{ active: boolean, dx: number, dy: number }>({ active: false, dx: 0, dy: 0 });
  
  const state = useRef<GameState>({
    player: {
      id: 'p1',
      pos: { x: SPAWN_ZONE_CENTER.x, y: SPAWN_ZONE_CENTER.y },
      velocity: { x: 0, y: 0 },
      rotation: 0,
      radius: 25,
      type: 'PLAYER',
      hp: 100,
      maxHp: 100,
      isAttacking: false,
      attackCooldown: 0,
      walkCycle: 0,
      color: '#64748b'
    },
    friend: undefined, // Will be the remote player
    enemies: [],
    trees: [],
    score: 0,
    gameOver: false,
    camera: { x: SPAWN_ZONE_CENTER.x, y: SPAWN_ZONE_CENTER.y }
  });

  // Handle incoming data
  useEffect(() => {
    if (isMultiplayer && conn) {
      // Set initial friend state
      state.current.friend = {
        id: 'p2',
        pos: { x: SPAWN_ZONE_CENTER.x + 60, y: SPAWN_ZONE_CENTER.y },
        velocity: { x: 0, y: 0 },
        rotation: 0,
        radius: 25,
        type: 'FRIEND',
        hp: 100,
        maxHp: 100,
        isAttacking: false,
        attackCooldown: 0,
        walkCycle: 0,
        color: '#d97706'
      };

      conn.on('data', (data: Packet) => {
        if (data.type === 'PLAYER_UPDATE' && state.current.friend) {
           // Update friend position instantly (naive approach, can add interpolation later)
           const f = state.current.friend;
           f.pos = data.data.pos;
           f.rotation = data.data.rotation;
           f.walkCycle = data.data.walkCycle;
           f.isAttacking = data.data.isAttacking;
           f.hp = data.data.hp;
        }
        if (data.type === 'WORLD_UPDATE' && !isHost) {
           // Client receives world state from Host
           state.current.enemies = data.enemies;
           state.current.score = data.score;
        }
        if (data.type === 'GAME_START') {
           // Just in case we missed it in lobby
           (window as any).GAME_SEED = data.seed;
           initWorld(data.seed);
        }
      });
    }
    
    // Initial World Gen
    const seed = (window as any).GAME_SEED || Math.random();
    initWorld(seed);
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMultiplayer, isHost, conn]);

  const initWorld = (seed: number) => {
    // Generate Trees Deterministically based on seed
    const newTrees: Entity[] = [];
    let currentSeed = seed;
    
    for (let i = 0; i < 200; i++) {
      currentSeed += 1;
      const r1 = seededRandom(currentSeed);
      currentSeed += 1;
      const r2 = seededRandom(currentSeed);
      
      const pos = { x: r1 * CANVAS_WIDTH, y: r2 * CANVAS_HEIGHT };
      if (dist(pos, SPAWN_ZONE_CENTER) > SPAWN_ZONE_RADIUS + 50) {
        newTrees.push({
          id: `tree-${i}`,
          pos,
          velocity: { x: 0, y: 0 },
          rotation: seededRandom(currentSeed + 5) * Math.PI * 2,
          radius: 40 + seededRandom(currentSeed + 6) * 50,
          type: 'TREE',
          hp: 100,
          maxHp: 100,
          isAttacking: false,
          attackCooldown: 0,
          walkCycle: 0,
          color: '#14532d'
        });
      }
    }
    state.current.trees = newTrees;
    
    if (!isMultiplayer || isHost) {
      spawnEnemies(5);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
      if (e.code === 'Space') handleAttack();
    };
    const handleKeyUp = (e: KeyboardEvent) => keys.current[e.code] = false;
    const handleMouseMove = (e: MouseEvent) => {
      mouse.current = { x: e.clientX, y: e.clientY };
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    requestRef.current = requestAnimationFrame(gameLoop);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const spawnEnemies = (count: number) => {
    for (let i = 0; i < count; i++) {
      let pos = { x: Math.random() * CANVAS_WIDTH, y: Math.random() * CANVAS_HEIGHT };
      while(dist(pos, state.current.player.pos) < 600 || dist(pos, SPAWN_ZONE_CENTER) < SPAWN_ZONE_RADIUS) {
        pos = { x: Math.random() * CANVAS_WIDTH, y: Math.random() * CANVAS_HEIGHT };
      }
      state.current.enemies.push({
        id: `enemy-${Date.now()}-${i}`,
        pos,
        velocity: { x: 0, y: 0 },
        rotation: 0,
        radius: 24,
        type: 'ENEMY',
        hp: 60,
        maxHp: 60,
        isAttacking: false,
        attackCooldown: 0,
        walkCycle: 0,
        color: '#171717'
      });
    }
  };

  const handleAttack = () => {
    if (state.current.gameOver) return;
    const p = state.current.player;
    if (p.attackCooldown <= 0) {
      p.isAttacking = true;
      p.attackCooldown = 25;
      const attackRange = 140;
      const attackAngle = 1.2;
      
      // Hit logic - only host calculates hits on enemies, but clients can push visually
      // For simplicity: Both simulate hits locally, but Host overwrites enemy HP next frame
      state.current.enemies.forEach(enemy => {
        const dx = enemy.pos.x - p.pos.x;
        const dy = enemy.pos.y - p.pos.y;
        const d = Math.sqrt(dx*dx + dy*dy);
        if (d < attackRange) {
          const angleToEnemy = Math.atan2(dy, dx);
          let angleDiff = angleToEnemy - p.rotation;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          if (Math.abs(angleDiff) < attackAngle) {
            // Apply damage instantly locally for responsiveness
            enemy.hp -= 35;
            enemy.pos.x += Math.cos(angleToEnemy) * 30;
            enemy.pos.y += Math.sin(angleToEnemy) * 30;
          }
        }
      });
    }
  };

  const gameLoop = () => {
    const s = state.current;
    if (s.gameOver) {
      setHudState(prev => ({ ...prev, gameOver: true }));
      return; 
    }
    updatePhysics(s);
    
    // --- NETWORKING SYNC ---
    if (isMultiplayer && conn && conn.open) {
      // 1. Send my player state
      conn.send({ 
        type: 'PLAYER_UPDATE', 
        data: {
          pos: s.player.pos,
          rotation: s.player.rotation,
          walkCycle: s.player.walkCycle,
          isAttacking: s.player.isAttacking,
          hp: s.player.hp
        }
      });

      // 2. If Host, send World State
      if (isHost) {
        conn.send({
          type: 'WORLD_UPDATE',
          enemies: s.enemies,
          score: s.score
        });
      }
    }

    render(s);
    if (Math.random() > 0.9) {
      setHudState({ hp: s.player.hp, score: s.score, gameOver: s.gameOver });
    }
    requestRef.current = requestAnimationFrame(gameLoop);
  };

  const updatePhysics = (s: GameState) => {
    const speed = 7;
    let dx = 0;
    let dy = 0;

    if (keys.current['KeyW'] || keys.current['ArrowUp']) dy = -1;
    if (keys.current['KeyS'] || keys.current['ArrowDown']) dy = 1;
    if (keys.current['KeyA'] || keys.current['ArrowLeft']) dx = -1;
    if (keys.current['KeyD'] || keys.current['ArrowRight']) dx = 1;

    if (joystickRef.current.active) {
      dx = joystickRef.current.dx;
      dy = joystickRef.current.dy;
    }

    if (dx !== 0 || dy !== 0) {
      const len = Math.sqrt(dx*dx + dy*dy);
      s.player.pos.x += (dx / len) * speed;
      s.player.pos.y += (dy / len) * speed;
      s.player.walkCycle += 0.3;
      if (joystickRef.current.active) {
        s.player.rotation = Math.atan2(dy, dx);
      }
    } else {
        s.player.walkCycle = 0;
    }

    if (!joystickRef.current.active && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const worldMouseX = s.camera.x + (mouse.current.x - rect.left - rect.width/2);
        const worldMouseY = s.camera.y + (mouse.current.y - rect.top - rect.height/2);
        s.player.rotation = Math.atan2(worldMouseY - s.player.pos.y, worldMouseX - s.player.pos.x);
    }

    if (s.player.attackCooldown > 0) {
        s.player.attackCooldown--;
        if (s.player.attackCooldown <= 0) s.player.isAttacking = false;
    }

    // --- ENEMY LOGIC (HOST ONLY) ---
    // If client, we trust the 'enemies' array from the host (updated in 'data' listener)
    // We only simulate enemy pushback/physics locally for smoothness if needed, but logic is Host
    if (!isMultiplayer || isHost) {
        s.enemies.forEach(enemy => {
            const distToPlayer = dist(enemy.pos, s.player.pos);
            // Check friend dist too
            let target = s.player.pos;
            let closestDist = distToPlayer;

            if (s.friend) {
                const distToFriend = dist(enemy.pos, s.friend.pos);
                if (distToFriend < closestDist) {
                    target = s.friend.pos;
                    closestDist = distToFriend;
                }
            }

            const distToSpawn = dist(enemy.pos, SPAWN_ZONE_CENTER);
            
            if (distToSpawn < SPAWN_ZONE_RADIUS + 50) {
                const angleAway = Math.atan2(enemy.pos.y - SPAWN_ZONE_CENTER.y, enemy.pos.x - SPAWN_ZONE_CENTER.x);
                enemy.pos.x += Math.cos(angleAway) * 2;
                enemy.pos.y += Math.sin(angleAway) * 2;
                enemy.rotation = angleAway;
                enemy.walkCycle += 0.2;
            } else if (closestDist < 700) {
                const edx = target.x - enemy.pos.x;
                const edy = target.y - enemy.pos.y;
                const angle = Math.atan2(edy, edx);
                enemy.rotation = angle;
                enemy.pos.x += Math.cos(angle) * 4;
                enemy.pos.y += Math.sin(angle) * 4;
                enemy.walkCycle += 0.25;

                // Attack Player 1
                if (distToPlayer < 45 && enemy.attackCooldown <= 0) {
                   s.player.hp -= 15;
                   enemy.attackCooldown = 60;
                   enemy.isAttacking = true;
                   setTimeout(() => { enemy.isAttacking = false; }, 300);
                }
            }
            if (enemy.attackCooldown > 0) enemy.attackCooldown--;
        });

        const aliveEnemies = s.enemies.filter(e => e.hp > 0);
        if (aliveEnemies.length < s.enemies.length) {
            s.score += (s.enemies.length - aliveEnemies.length) * 100;
            if (aliveEnemies.length < 4) spawnEnemies(3);
        }
        s.enemies = aliveEnemies;
    }

    // --- COLLISION ---
    const entities = [s.player, ...s.enemies];
    if (s.friend) entities.push(s.friend);
    entities.forEach(ent => {
        ent.pos.x = Math.max(0, Math.min(CANVAS_WIDTH, ent.pos.x));
        ent.pos.y = Math.max(0, Math.min(CANVAS_HEIGHT, ent.pos.y));
        s.trees.forEach(tree => {
            const d = dist(ent.pos, tree.pos);
            const minD = ent.radius + tree.radius * 0.6;
            if (d < minD) {
                const angle = Math.atan2(ent.pos.y - tree.pos.y, ent.pos.x - tree.pos.x);
                const push = minD - d;
                ent.pos.x += Math.cos(angle) * push;
                ent.pos.y += Math.sin(angle) * push;
            }
        });
    });

    s.camera.x = lerp(s.camera.x, s.player.pos.x, 0.1);
    s.camera.y = lerp(s.camera.y, s.player.pos.y, 0.1);
  };

  const render = (s: GameState) => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, cvs.width, cvs.height);

    ctx.save();
    ctx.translate(cvs.width / 2 - s.camera.x, cvs.height / 2 - s.camera.y);

    // Spawn Zone
    ctx.save();
    ctx.beginPath();
    ctx.arc(SPAWN_ZONE_CENTER.x, SPAWN_ZONE_CENTER.y, SPAWN_ZONE_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = '#1e293b';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#334155';
    ctx.stroke();
    ctx.restore();

    // Grid
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    const gridSize = 100;
    const startX = Math.floor((s.camera.x - cvs.width/2) / gridSize) * gridSize;
    const startY = Math.floor((s.camera.y - cvs.height/2) / gridSize) * gridSize;
    for (let x = startX; x < startX + cvs.width + gridSize; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, startY); ctx.lineTo(x, startY + cvs.height + gridSize); ctx.stroke();
    }
    for (let y = startY; y < startY + cvs.height + gridSize; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(startX, y); ctx.lineTo(startX + cvs.width + gridSize, y); ctx.stroke();
    }

    const renderList = [...s.trees, ...s.enemies, s.player, ...(s.friend ? [s.friend] : [])].sort((a, b) => a.pos.y - b.pos.y);
    renderList.forEach(ent => {
        if (ent.type === 'TREE') drawTree(ctx, ent);
        else drawRealisticEntity(ctx, ent);
    });
    ctx.restore();
  };

  const drawTree = (ctx: CanvasRenderingContext2D, t: Entity) => {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.arc(t.pos.x + 8, t.pos.y + 8, t.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a2e05';
    ctx.beginPath();
    ctx.arc(t.pos.x, t.pos.y, t.radius * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#14532d';
    ctx.beginPath();
    ctx.arc(t.pos.x, t.pos.y, t.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#166534';
    ctx.beginPath();
    ctx.arc(t.pos.x - t.radius*0.2, t.pos.y - t.radius*0.2, t.radius * 0.7, 0, Math.PI * 2);
    ctx.fill();
  };

  const drawRealisticEntity = (ctx: CanvasRenderingContext2D, e: Entity) => {
    const isPlayer = e.type === 'PLAYER';
    const isEnemy = e.type === 'ENEMY';
    const isFriend = e.type === 'FRIEND';

    ctx.save();
    ctx.translate(e.pos.x, e.pos.y);
    ctx.rotate(e.rotation);

    if (e.isAttacking) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, 70, -0.6, 0.6); 
        ctx.strokeStyle = isEnemy ? 'rgba(255, 0, 0, 0.5)' : 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 40;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, 75, -0.6, 0.6);
        ctx.strokeStyle = isEnemy ? '#ef4444' : '#fff';
        ctx.lineWidth = 5;
        ctx.stroke();
        ctx.restore();
    }

    const legOffset = 18;
    const legWidth = 10;
    const legLength = 16;
    const legMove1 = Math.sin(e.walkCycle) * 8;
    const legMove2 = Math.sin(e.walkCycle + Math.PI) * 8;

    ctx.fillStyle = isEnemy ? '#000' : (isFriend ? '#9a3412' : '#475569');
    const drawLeg = (x: number, y: number, offset: number) => {
        ctx.beginPath();
        ctx.ellipse(x + offset, y, legLength, legWidth, 0, 0, Math.PI * 2);
        ctx.fill();
    };
    drawLeg(15, -legOffset, legMove1);
    drawLeg(15, legOffset, legMove2);
    drawLeg(-20, -legOffset, legMove2);
    drawLeg(-20, legOffset, legMove1);

    const tailWag = Math.sin(e.walkCycle * 2) * 0.2;
    ctx.save();
    ctx.translate(-35, 0);
    ctx.rotate(tailWag);
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.ellipse(-10, 0, 25, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    if (isFriend) {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.ellipse(-25, 0, 10, 5, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();

    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 35, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.beginPath();
    ctx.ellipse(-5, 0, 25, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(25, 0); 
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 18, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = isEnemy ? '#171717' : (isFriend ? '#fff' : '#94a3b8');
    ctx.beginPath();
    ctx.ellipse(12, 0, 10, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(20, 0, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.moveTo(-5, -8); ctx.lineTo(5, -20); ctx.lineTo(8, -5); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-5, 8); ctx.lineTo(5, 20); ctx.lineTo(8, 5); ctx.fill();
    ctx.fillStyle = isEnemy ? '#ef4444' : '#000';
    ctx.beginPath();
    ctx.arc(5, -5, 2, 0, Math.PI * 2);
    ctx.arc(5, 5, 2, 0, Math.PI * 2);
    ctx.fill();
    if (isEnemy) {
        ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 10; ctx.fill(); ctx.shadowBlur = 0;
    }
    ctx.restore();

    if (e.hp < e.maxHp) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(e.pos.x - 25, e.pos.y - 50, 50, 6);
        ctx.fillStyle = isEnemy ? '#ef4444' : '#22c55e';
        ctx.fillRect(e.pos.x - 25, e.pos.y - 50, 50 * (e.hp / e.maxHp), 6);
    }
  };

  const [joystickPos, setJoystickPos] = useState({ x: 0, y: 0 });
  const joyBaseRef = useRef<HTMLDivElement>(null);

  const handleJoyTouchStart = (e: React.TouchEvent) => {
     joystickRef.current.active = true;
     handleJoyTouchMove(e);
  };
  
  const handleJoyTouchMove = (e: React.TouchEvent) => {
     if (!joyBaseRef.current) return;
     const touch = e.touches[0];
     const rect = joyBaseRef.current.getBoundingClientRect();
     const centerX = rect.left + rect.width / 2;
     const centerY = rect.top + rect.height / 2;
     
     let dx = touch.clientX - centerX;
     let dy = touch.clientY - centerY;
     
     const maxDist = 40;
     const dist = Math.sqrt(dx*dx + dy*dy);
     if (dist > maxDist) {
        dx = (dx / dist) * maxDist;
        dy = (dy / dist) * maxDist;
     }
     
     setJoystickPos({ x: dx, y: dy });
     joystickRef.current.dx = dx;
     joystickRef.current.dy = dy;
  };

  const handleJoyTouchEnd = () => {
    joystickRef.current.active = false;
    joystickRef.current.dx = 0;
    joystickRef.current.dy = 0;
    setJoystickPos({ x: 0, y: 0 });
  };

  return (
    <div className="relative w-full h-full bg-black overflow-hidden select-none">
        <canvas 
            ref={canvasRef} 
            width={window.innerWidth} 
            height={window.innerHeight}
            className="block cursor-crosshair"
        />
        
        <div className="absolute top-4 left-4 flex flex-col gap-2 pointer-events-none">
            <div className="flex items-center gap-2">
                <div className="bg-neutral-900 border border-neutral-700 p-1 w-64 h-8 rounded relative overflow-hidden">
                    <div 
                        className="h-full bg-gradient-to-r from-green-600 to-green-400 transition-all duration-300" 
                        style={{ width: `${hudState.hp}%` }} 
                    />
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow-md">
                        HP {Math.max(0, Math.floor(hudState.hp))}
                    </span>
                </div>
            </div>
            <div className="text-white font-mono text-xl font-bold drop-shadow-md bg-black/30 px-2 rounded inline-block">
                SCORE: {hudState.score}
            </div>
            {isMultiplayer && (
               <div className="flex items-center gap-2 bg-black/30 px-2 rounded w-fit">
                  <Radio className="w-4 h-4 text-green-500 animate-pulse" />
                  <span className="text-xs text-green-500 font-mono">LIVE LINK</span>
               </div>
            )}
        </div>

        <div className="absolute bottom-10 left-10 w-32 h-32 rounded-full border-2 border-white/20 bg-black/20 backdrop-blur-sm touch-none flex items-center justify-center z-50"
             ref={joyBaseRef}
             onTouchStart={handleJoyTouchStart}
             onTouchMove={handleJoyTouchMove}
             onTouchEnd={handleJoyTouchEnd}
        >
            <div 
                className="w-12 h-12 bg-white/50 rounded-full shadow-lg"
                style={{ transform: `translate(${joystickPos.x}px, ${joystickPos.y}px)` }}
            />
            <span className="absolute -top-8 text-white/50 text-xs font-bold tracking-widest pointer-events-none">MOVE</span>
        </div>

        <div className="absolute bottom-10 right-10 flex gap-4 z-50">
            <button 
                className="w-24 h-24 rounded-full bg-red-600/80 active:bg-red-500 border-4 border-red-900 shadow-xl flex items-center justify-center touch-none transform transition active:scale-95"
                onTouchStart={(e) => { e.preventDefault(); handleAttack(); }}
                onMouseDown={handleAttack}
            >
                <Sword className="text-white w-10 h-10" />
            </button>
             <span className="absolute -top-8 right-8 text-white/50 text-xs font-bold tracking-widest pointer-events-none">ATTACK</span>
        </div>

        <button 
            onClick={onExit}
            className="absolute top-4 right-4 bg-neutral-900/50 hover:bg-red-900/80 text-white p-2 rounded backdrop-blur border border-neutral-700 hover:border-red-500 transition z-50"
        >
            <Menu className="w-6 h-6" />
        </button>

        {hudState.gameOver && (
            <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
                <div className="bg-neutral-900 border border-red-900 p-8 rounded-xl text-center max-w-sm w-full shadow-2xl shadow-red-900/20 transform scale-110">
                    <Skull className="w-16 h-16 text-red-600 mx-auto mb-4 animate-bounce" />
                    <h2 className="text-4xl font-black text-white mb-2 tracking-tighter">YOU DIED</h2>
                    <p className="text-neutral-400 mb-6">The forest has claimed you.</p>
                    <p className="text-2xl font-mono text-green-500 mb-8">SCORE: {hudState.score}</p>
                    <button 
                        onClick={onExit}
                        className="w-full bg-white text-black font-black py-4 rounded hover:bg-neutral-200 transition uppercase tracking-widest"
                    >
                        Return to Lobby
                    </button>
                </div>
            </div>
        )}
    </div>
  );
};

// --- APP ---
function App() {
  const [screen, setScreen] = useState<ScreenState>('AUTH');
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [peerId, setPeerId] = useState<string | null>(null);
  const [isMultiplayer, setIsMultiplayer] = useState<boolean>(false);
  const [conn, setConn] = useState<any>(null); // PeerJS connection

  // PeerJS Instance
  const peerRef = useRef<any>(null);

  useEffect(() => {
    // 1. Create Profile
    let id = localStorage.getItem('fh_player_id');
    if (!id) {
       id = Math.random().toString(36).substring(2, 6).toUpperCase();
       localStorage.setItem('fh_player_id', id);
    }
    setProfile({ id: id!, name: `Wolf-${id}`, isHost: false });

    // 2. Initialize PeerJS
    const initPeer = async () => {
        // @ts-ignore
        if (!window.Peer) return; // Wait for script load
        // @ts-ignore
        const peer = new window.Peer(id, { debug: 1 }); // Use our ID as Peer ID
        peer.on('open', (id: string) => {
            console.log('My peer ID is: ' + id);
            setPeerId(id);
        });
        peer.on('connection', (c: any) => {
            console.log('Incoming connection');
            setConn(c);
            setIsMultiplayer(true);
            setProfile(p => p ? ({ ...p, isHost: true }) : null); // I am receiving, so I am likely host or P2P equal
            // Wait for user to click "Start" in lobby if host
        });
        peerRef.current = peer;
    };

    const interval = setInterval(() => {
       // @ts-ignore
       if(window.Peer && !peerRef.current) {
          initPeer();
          clearInterval(interval);
       }
    }, 500);

    return () => {
       if(peerRef.current) peerRef.current.destroy();
    };
  }, []);

  const handleCreateLobby = () => {
    if (!profile) return;
    setProfile({ ...profile, isHost: true });
    setIsMultiplayer(true);
    setScreen('LOBBY');
  };

  const handleJoinLobby = (hostId: string) => {
    if (!profile || !peerRef.current) return;
    const conn = peerRef.current.connect(hostId);
    setConn(conn);
    setProfile({ ...profile, isHost: false });
    setIsMultiplayer(true);
    setScreen('LOBBY');
  };

  const handlePlayOffline = () => {
    setIsMultiplayer(false);
    setScreen('GAME');
  };

  const handleStartGame = () => {
    setScreen('GAME');
  };

  const handleBack = () => {
    setScreen('AUTH');
    if (conn) {
       conn.close();
       setConn(null);
    }
    // Re-init peer logic if needed, but usually keep peer open
  };

  return (
    <div className="w-full h-screen bg-neutral-900 text-white font-sans relative overflow-hidden">
      <div className="absolute inset-0 opacity-10 pointer-events-none bg-[url('https://picsum.photos/1920/1080?grayscale&blur=2')] bg-cover bg-center" />
      <div className="scanlines absolute inset-0 z-50 pointer-events-none" />

      {screen === 'AUTH' && profile && (
        <AuthScreen 
          profile={profile}
          peerId={peerId} 
          onCreate={handleCreateLobby} 
          onJoin={handleJoinLobby} 
          onOffline={handlePlayOffline} 
        />
      )}

      {screen === 'LOBBY' && profile && peerId && (
        <LobbyScreen 
          currentUser={profile}
          peerId={peerId}
          conn={conn}
          isHost={profile.isHost}
          onStart={handleStartGame} 
          onBack={handleBack}
        />
      )}

      {screen === 'GAME' && profile && (
        <GameEngine 
          isMultiplayer={isMultiplayer} 
          isHost={profile.isHost}
          conn={conn}
          onExit={handleBack} 
        />
      )}
    </div>
  );
}

// --- MOUNT ---
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}
rootElement.innerHTML = '';
const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { PawPrint, Shield, WifiOff, Play, Sword, Skull, Menu, Copy, CheckCircle2, Loader2, Users } from 'lucide-react';

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

// --- UTILS ---
const dist = (a: Vec2, b: Vec2) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
const lerp = (start: number, end: number, t: number) => start * (1 - t) + end * t;

// --- COMPONENTS ---

// 1. Auth Screen
interface AuthScreenProps {
  profile: PlayerProfile;
  onCreate: () => void;
  onJoin: (id: string) => void;
  onOffline: () => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ profile, onCreate, onJoin, onOffline }) => {
  const [joinId, setJoinId] = useState('');

  return (
    <div className="relative z-10 flex flex-col items-center justify-center h-full p-6">
      <div className="max-w-md w-full bg-black/80 backdrop-blur-md border border-green-900/50 p-8 rounded-xl shadow-2xl shadow-green-900/20">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-green-400 to-emerald-800 uppercase italic transform -skew-x-12">
            Hotline Forest
          </h1>
          <p className="text-neutral-400 mt-2 text-sm tracking-widest">PRIMAL INSTINCT // V1.0</p>
        </div>

        <div className="mb-6 bg-neutral-900/50 p-4 rounded border border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-neutral-800 rounded-full flex items-center justify-center">
              <PawPrint className="text-green-500 w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-neutral-500 uppercase">Your Universal ID</p>
              <p className="text-xl font-mono font-bold text-white tracking-wider">{profile.id}</p>
            </div>
          </div>
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.8)]" />
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
            <span className="flex-shrink-0 mx-4 text-neutral-600 text-xs uppercase">Multiplayer</span>
            <div className="flex-grow border-t border-neutral-800"></div>
          </div>

          <button 
            onClick={onCreate}
            className="w-full bg-emerald-900/30 border border-emerald-500/30 hover:bg-emerald-800/50 p-4 rounded text-emerald-400 font-bold flex items-center justify-center gap-2 transition active:scale-95"
          >
            <Shield className="w-5 h-5" />
            CREATE LOBBY
          </button>

          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="ENTER FRIEND ID"
              value={joinId}
              onChange={(e) => setJoinId(e.target.value.toUpperCase())}
              className="flex-1 bg-neutral-900 border border-neutral-700 rounded p-4 text-center font-mono placeholder:text-neutral-600 focus:outline-none focus:border-green-500 transition"
            />
            <button 
              onClick={() => joinId && onJoin(joinId)}
              disabled={!joinId}
              className="bg-neutral-800 border border-neutral-700 hover:border-white hover:bg-neutral-700 text-white p-4 rounded disabled:opacity-50 disabled:cursor-not-allowed font-bold"
            >
              JOIN
            </button>
          </div>
        </div>
      </div>
      
      <p className="absolute bottom-6 text-neutral-600 text-xs text-center max-w-xs">
        Connect via Universal ID. Both players must be online.
      </p>
    </div>
  );
};

// 2. Lobby Screen
interface LobbyScreenProps {
  lobbyId: string;
  currentUser: PlayerProfile;
  onStart: () => void;
  onBack: () => void;
}

const LobbyScreen: React.FC<LobbyScreenProps> = ({ lobbyId, currentUser, onStart, onBack }) => {
  const [friendJoined, setFriendJoined] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!currentUser.isHost) {
      setFriendJoined(true);
      return;
    }
    const timer = setTimeout(() => {
      setFriendJoined(true);
    }, 3000 + Math.random() * 2000);
    return () => clearTimeout(timer);
  }, [currentUser.isHost]);

  const copyId = () => {
    navigator.clipboard.writeText(lobbyId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative z-10 flex flex-col items-center justify-center h-full p-6 bg-black/90">
      <div className="max-w-2xl w-full bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-2xl">
        <div className="bg-neutral-950 p-6 border-b border-neutral-800 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Users className="text-green-500" />
              LOBBY
            </h2>
            <p className="text-neutral-500 text-sm">Waiting for connection...</p>
          </div>
          <button onClick={onBack} className="text-red-500 hover:text-red-400 text-sm font-bold uppercase tracking-wider">
            Leave
          </button>
        </div>

        <div className="p-8">
          <div className="flex flex-col items-center mb-12">
            <span className="text-neutral-500 text-xs uppercase mb-2">Share this ID with your friend</span>
            <button 
              onClick={copyId}
              className="group relative bg-neutral-800 hover:bg-neutral-700 border-2 border-dashed border-neutral-600 hover:border-green-500 transition-all rounded-lg px-12 py-6 flex flex-col items-center gap-2"
            >
              <span className="text-4xl font-mono font-black tracking-[0.2em] text-white">
                {lobbyId}
              </span>
              <div className="flex items-center gap-1 text-xs text-green-500 font-bold opacity-0 group-hover:opacity-100 transition-opacity absolute -bottom-8">
                {copied ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied ? "COPIED TO CLIPBOARD" : "CLICK TO COPY"}
              </div>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-neutral-800/50 border border-green-500/50 p-4 rounded flex items-center gap-4">
              <div className="w-12 h-12 bg-neutral-700 rounded-full flex items-center justify-center relative">
                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.id}`} alt="avatar" className="w-10 h-10 rounded-full" />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-neutral-900 rounded-full"></div>
              </div>
              <div>
                <p className="font-bold text-white">{currentUser.name} (You)</p>
                <p className="text-xs text-green-400 font-mono">READY</p>
              </div>
            </div>

            <div className={`border p-4 rounded flex items-center gap-4 transition-all duration-500 ${friendJoined ? 'bg-neutral-800/50 border-orange-500/50' : 'bg-neutral-900 border-neutral-800 border-dashed'}`}>
              {friendJoined ? (
                <>
                  <div className="w-12 h-12 bg-neutral-700 rounded-full flex items-center justify-center relative">
                     <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${lobbyId}`} alt="avatar" className="w-10 h-10 rounded-full" />
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-neutral-900 rounded-full"></div>
                  </div>
                  <div className="animate-in fade-in slide-in-from-right-4">
                    <p className="font-bold text-white">Friend-Fox</p>
                    <p className="text-xs text-orange-400 font-mono">CONNECTED</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-full border-2 border-neutral-700 border-t-neutral-500 animate-spin"></div>
                  <div>
                    <p className="font-bold text-neutral-500">Waiting...</p>
                    <p className="text-xs text-neutral-600 font-mono">SCANNING NETWORK</p>
                  </div>
                </>
              )}
            </div>
          </div>

          <button
            onClick={onStart}
            disabled={!friendJoined}
            className="w-full bg-gradient-to-r from-green-600 to-emerald-700 disabled:from-neutral-800 disabled:to-neutral-800 disabled:text-neutral-500 hover:from-green-500 hover:to-emerald-600 text-white font-black text-xl py-6 rounded-lg shadow-lg shadow-green-900/30 transition-all active:scale-[0.99] flex items-center justify-center gap-3 uppercase tracking-wider"
          >
            {friendJoined ? (
              <>
                <Play className="fill-current" /> Enter The Forest
              </>
            ) : (
              <>
                <Loader2 className="animate-spin" /> Waiting for Player 2
              </>
            )}
          </button>
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
  onExit: () => void;
}

const GameEngine: React.FC<GameEngineProps> = ({ isMultiplayer, onExit }) => {
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
    friend: undefined,
    enemies: [],
    trees: [],
    score: 0,
    gameOver: false,
    camera: { x: SPAWN_ZONE_CENTER.x, y: SPAWN_ZONE_CENTER.y }
  });

  useEffect(() => {
    const newTrees: Entity[] = [];
    for (let i = 0; i < 200; i++) {
      const pos = { x: Math.random() * CANVAS_WIDTH, y: Math.random() * CANVAS_HEIGHT };
      if (dist(pos, SPAWN_ZONE_CENTER) > SPAWN_ZONE_RADIUS + 50) {
        newTrees.push({
          id: `tree-${i}`,
          pos,
          velocity: { x: 0, y: 0 },
          rotation: Math.random() * Math.PI * 2,
          radius: 40 + Math.random() * 50,
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
    spawnEnemies(5);

    if (isMultiplayer) {
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
    }

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
  }, [isMultiplayer]);

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

    if (s.friend) {
        const distToPlayer = dist(s.friend.pos, s.player.pos);
        if (distToPlayer > 180) {
           const fdx = s.player.pos.x - s.friend.pos.x;
           const fdy = s.player.pos.y - s.friend.pos.y;
           const angle = Math.atan2(fdy, fdx);
           s.friend.pos.x += Math.cos(angle) * (speed * 0.95);
           s.friend.pos.y += Math.sin(angle) * (speed * 0.95);
           s.friend.rotation = angle;
           s.friend.walkCycle += 0.3;
        } else {
           s.friend.walkCycle = 0;
        }
    }

    s.enemies.forEach(enemy => {
        const distToPlayer = dist(enemy.pos, s.player.pos);
        const distToSpawn = dist(enemy.pos, SPAWN_ZONE_CENTER);
        
        let target = s.player.pos;
        if (distToSpawn < SPAWN_ZONE_RADIUS + 50) {
             const angleAway = Math.atan2(enemy.pos.y - SPAWN_ZONE_CENTER.y, enemy.pos.x - SPAWN_ZONE_CENTER.x);
             enemy.pos.x += Math.cos(angleAway) * 2;
             enemy.pos.y += Math.sin(angleAway) * 2;
             enemy.rotation = angleAway;
             enemy.walkCycle += 0.2;
        } else if (distToPlayer < 700) {
            const edx = target.x - enemy.pos.x;
            const edy = target.y - enemy.pos.y;
            const angle = Math.atan2(edy, edx);
            enemy.rotation = angle;
            enemy.pos.x += Math.cos(angle) * 4;
            enemy.pos.y += Math.sin(angle) * 4;
            enemy.walkCycle += 0.25;

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

    ctx.save();
    ctx.beginPath();
    ctx.arc(SPAWN_ZONE_CENTER.x, SPAWN_ZONE_CENTER.y, SPAWN_ZONE_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = '#1e293b';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#334155';
    ctx.stroke();
    ctx.clip();
    ctx.strokeStyle = '#334155';
    ctx.globalAlpha = 0.3;
    for (let i = SPAWN_ZONE_CENTER.x - SPAWN_ZONE_RADIUS; i < SPAWN_ZONE_CENTER.x + SPAWN_ZONE_RADIUS; i+=50) {
        ctx.beginPath(); ctx.moveTo(i, SPAWN_ZONE_CENTER.y - SPAWN_ZONE_RADIUS); ctx.lineTo(i, SPAWN_ZONE_CENTER.y + SPAWN_ZONE_RADIUS); ctx.stroke();
    }
    ctx.restore();

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
  const [lobbyId, setLobbyId] = useState<string | null>(null);
  const [isMultiplayer, setIsMultiplayer] = useState<boolean>(false);

  useEffect(() => {
    try {
      const savedId = localStorage.getItem('fh_player_id');
      if (savedId) {
        setProfile({ id: savedId, name: `Wolf-${savedId.substring(0, 4)}`, isHost: false });
      } else {
        const newId = Math.random().toString(36).substring(2, 8).toUpperCase();
        localStorage.setItem('fh_player_id', newId);
        setProfile({ id: newId, name: `Wolf-${newId.substring(0, 4)}`, isHost: false });
      }
    } catch (e) {
      const newId = Math.random().toString(36).substring(2, 8).toUpperCase();
      setProfile({ id: newId, name: `Wolf-${newId.substring(0, 4)}`, isHost: false });
    }
  }, []);

  const handleCreateLobby = () => {
    if (!profile) return;
    const newLobbyId = Math.random().toString(36).substring(2, 6).toUpperCase();
    setLobbyId(newLobbyId);
    setProfile({ ...profile, isHost: true });
    setIsMultiplayer(true);
    setScreen('LOBBY');
  };

  const handleJoinLobby = (id: string) => {
    if (!profile) return;
    setLobbyId(id);
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
    setLobbyId(null);
  };

  return (
    <div className="w-full h-screen bg-neutral-900 text-white font-sans relative overflow-hidden">
      <div className="absolute inset-0 opacity-10 pointer-events-none bg-[url('https://picsum.photos/1920/1080?grayscale&blur=2')] bg-cover bg-center" />
      <div className="scanlines absolute inset-0 z-50 pointer-events-none" />

      {screen === 'AUTH' && profile && (
        <AuthScreen 
          profile={profile} 
          onCreate={handleCreateLobby} 
          onJoin={handleJoinLobby} 
          onOffline={handlePlayOffline} 
        />
      )}

      {screen === 'LOBBY' && profile && lobbyId && (
        <LobbyScreen 
          lobbyId={lobbyId} 
          currentUser={profile} 
          onStart={handleStartGame} 
          onBack={handleBack}
        />
      )}

      {screen === 'GAME' && profile && (
        <GameEngine 
          isMultiplayer={isMultiplayer} 
          onExit={() => setScreen('AUTH')} 
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

// Clear any existing content to remove the loader
rootElement.innerHTML = '';

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
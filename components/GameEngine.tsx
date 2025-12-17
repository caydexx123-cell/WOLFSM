import React, { useRef, useEffect, useState } from 'react';
import { Entity, GameState, Vec2 } from '../types.ts';
import { Sword, Skull, Menu, Radio } from 'lucide-react';

const FPS = 60;
const CANVAS_WIDTH = 2500;
const CANVAS_HEIGHT = 2500;

// Spawn Zone Configuration
const SPAWN_ZONE_CENTER = { x: 1250, y: 1250 };
const SPAWN_ZONE_RADIUS = 300;

interface GameEngineProps {
  isMultiplayer: boolean;
  isHost: boolean;
  conn: any;
  onExit: () => void;
}

// Utils
const dist = (a: Vec2, b: Vec2) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
const lerp = (start: number, end: number, t: number) => start * (1 - t) + end * t;
const seededRandom = (seed: number) => {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
};

export const GameEngine: React.FC<GameEngineProps> = ({ isMultiplayer, isHost, conn, onExit }) => {
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
    // 1. Setup Friend if Multiplayer (REAL connection)
    if (isMultiplayer && conn) {
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
        color: '#d97706' // Orange for friend
      };

      // Handle Data
      conn.on('data', (data: any) => {
        if (data.type === 'PLAYER_UPDATE' && state.current.friend) {
           const f = state.current.friend;
           f.pos = data.data.pos;
           f.rotation = data.data.rotation;
           f.walkCycle = data.data.walkCycle;
           f.isAttacking = data.data.isAttacking;
           f.hp = data.data.hp;
        }
        if (data.type === 'WORLD_UPDATE' && !isHost) {
           // Client receives world state
           state.current.enemies = data.enemies;
           state.current.score = data.score;
        }
      });
    }

    // 2. Generate World (Deterministic if seed present)
    const seed = (window as any).GAME_SEED || Math.random() * 10000;
    let currentSeed = seed;

    const newTrees: Entity[] = [];
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
          rotation: seededRandom(currentSeed) * Math.PI * 2,
          radius: 40 + seededRandom(currentSeed+1) * 50,
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

    // Only Host spawns enemies initially
    if (!isMultiplayer || isHost) {
        spawnEnemies(5);
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
  }, [isMultiplayer, isHost, conn]);

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
      
      // Local simulation for immediate feedback
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
    
    // --- NETWORK SEND ---
    if (isMultiplayer && conn && conn.open) {
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

    // Host Logic for Enemies
    if (!isMultiplayer || isHost) {
        s.enemies.forEach(enemy => {
            const distToPlayer = dist(enemy.pos, s.player.pos);
            let target = s.player.pos;
            let closestDist = distToPlayer;

            // Target Friend if closer
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

    // Collisions
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

    const renderList = [
        ...s.trees,
        ...s.enemies,
        s.player,
        ...(s.friend ? [s.friend] : [])
    ].sort((a, b) => a.pos.y - b.pos.y);

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
                  <span className="text-xs text-green-500 font-mono">LIVE</span>
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
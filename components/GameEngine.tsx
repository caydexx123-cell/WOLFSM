import React, { useRef, useEffect, useState } from 'react';
import { Entity, GameState, Vec2 } from '../types.ts';
import { Sword, Skull, Menu, Radio, Zap } from 'lucide-react';

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
  const [hudState, setHudState] = useState({ hp: 100, level: 1, xp: 0, maxXp: 100, gameOver: false });
  
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
      color: '#cbd5e1', // Realistic Grey Wolf
      level: 1,
      xp: 0,
      maxXp: 100 // 10 snakes * 10 xp
    },
    friend: undefined,
    enemies: [],
    environment: [],
    score: 0,
    gameOver: false,
    camera: { x: SPAWN_ZONE_CENTER.x, y: SPAWN_ZONE_CENTER.y }
  });

  useEffect(() => {
    // 1. Setup Friend
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
        color: '#cbd5e1', // Identical model color
        level: 1
      };

      conn.on('data', (data: any) => {
        if (data.type === 'PLAYER_UPDATE' && state.current.friend) {
           const f = state.current.friend;
           f.pos = data.data.pos;
           f.rotation = data.data.rotation;
           f.walkCycle = data.data.walkCycle;
           f.isAttacking = data.data.isAttacking;
           f.hp = data.data.hp;
           f.level = data.data.level; // Sync level for visuals
        }
        if (data.type === 'WORLD_UPDATE' && !isHost) {
           state.current.enemies = data.enemies;
        }
      });
    }

    // 2. Generate World
    const seed = (window as any).GAME_SEED || Math.random() * 10000;
    initWorld(seed);

    // Only Host spawns enemies
    if (!isMultiplayer || isHost) {
        spawnSnakes(5);
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

  const initWorld = (seed: number) => {
    const env: Entity[] = [];
    let currentSeed = seed;

    // Generate Stream (Healing River)
    // Create a winding path across the map
    for (let i = 0; i < 30; i++) {
        const x = (i / 30) * CANVAS_WIDTH;
        const y = (CANVAS_HEIGHT / 2) + Math.sin(i * 0.5 + currentSeed) * 400;
        env.push({
            id: `stream-${i}`,
            pos: {x, y},
            velocity: {x:0, y:0}, rotation: 0, radius: 60,
            type: 'STREAM', hp: 0, maxHp: 0, isAttacking: false, attackCooldown: 0, walkCycle: 0, color: '#3b82f6'
        });
    }

    // Trees and Rocks
    for (let i = 0; i < 250; i++) {
      currentSeed += 1;
      const r1 = seededRandom(currentSeed);
      currentSeed += 1;
      const r2 = seededRandom(currentSeed);
      
      const pos = { x: r1 * CANVAS_WIDTH, y: r2 * CANVAS_HEIGHT };
      
      if (dist(pos, SPAWN_ZONE_CENTER) > SPAWN_ZONE_RADIUS + 50) {
        // 80% Trees, 20% Rocks
        const isRock = seededRandom(currentSeed + 10) > 0.8;
        
        env.push({
          id: `env-${i}`,
          pos,
          velocity: { x: 0, y: 0 },
          rotation: seededRandom(currentSeed + 5) * Math.PI * 2,
          radius: isRock ? 25 + seededRandom(currentSeed)*20 : 40 + seededRandom(currentSeed+1) * 50,
          type: isRock ? 'ROCK' : 'TREE',
          hp: 100,
          maxHp: 100,
          isAttacking: false,
          attackCooldown: 0,
          walkCycle: 0,
          color: isRock ? '#57534e' : '#14532d'
        });
      }
    }
    state.current.environment = env;
  };

  const spawnSnakes = (count: number) => {
    for (let i = 0; i < count; i++) {
      let pos = { x: Math.random() * CANVAS_WIDTH, y: Math.random() * CANVAS_HEIGHT };
      while(dist(pos, state.current.player.pos) < 600 || dist(pos, SPAWN_ZONE_CENTER) < SPAWN_ZONE_RADIUS) {
        pos = { x: Math.random() * CANVAS_WIDTH, y: Math.random() * CANVAS_HEIGHT };
      }
      state.current.enemies.push({
        id: `snake-${Date.now()}-${i}`,
        pos,
        velocity: { x: 0, y: 0 },
        rotation: 0,
        radius: 20,
        type: 'SNAKE',
        hp: 60, // 5 hits at lvl 1 (12 dmg)
        maxHp: 60,
        isAttacking: false,
        attackCooldown: 0,
        walkCycle: 0,
        color: '#4d7c0f'
      });
    }
  };

  const handleAttack = () => {
    if (state.current.gameOver) return;
    const p = state.current.player;
    if (p.attackCooldown <= 0) {
      p.isAttacking = true;
      p.attackCooldown = 25;
      
      const attackRange = 150;
      const attackAngle = 1.5;
      
      // Calculate Damage: Lvl 1 = 12 (5 hits to kill 60hp), Lvl 2 = 60 (1 hit)
      const damage = (p.level || 1) >= 2 ? 60 : 12;

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
            enemy.hp -= damage;
            enemy.pos.x += Math.cos(angleToEnemy) * 40;
            enemy.pos.y += Math.sin(angleToEnemy) * 40;
            
            // Check kill locally for immediate XP feedback (Host ultimately decides world state though)
            if (enemy.hp <= 0 && enemy.hp + damage > 0) {
                // Enemy just died
                gainXp(10);
            }
          }
        }
      });
    }
  };

  const gainXp = (amount: number) => {
    const p = state.current.player;
    if ((p.level || 1) >= 2) return; // Cap at level 2

    p.xp = (p.xp || 0) + amount;
    if (p.xp >= (p.maxXp || 100)) {
        p.level = 2;
        p.xp = p.maxXp; // Cap visual
        // Heal on level up
        p.hp = p.maxHp;
    }
  };

  const gameLoop = () => {
    const s = state.current;
    if (s.gameOver) {
      setHudState(prev => ({ ...prev, gameOver: true }));
      return; 
    }

    updatePhysics(s);
    
    // Send Updates
    if (isMultiplayer && conn && conn.open) {
       conn.send({
         type: 'PLAYER_UPDATE',
         data: {
           pos: s.player.pos,
           rotation: s.player.rotation,
           walkCycle: s.player.walkCycle,
           isAttacking: s.player.isAttacking,
           hp: s.player.hp,
           level: s.player.level
         }
       });

       if (isHost) {
         conn.send({
           type: 'WORLD_UPDATE',
           enemies: s.enemies
         });
       }
    }

    render(s);

    if (Math.random() > 0.9) {
      setHudState({ 
          hp: s.player.hp, 
          level: s.player.level || 1, 
          xp: s.player.xp || 0, 
          maxXp: s.player.maxXp || 100, 
          gameOver: s.gameOver 
      });
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
      // Rotation follows movement
      s.player.rotation = Math.atan2(dy, dx);
    } else {
        s.player.walkCycle = 0;
    }

    // Cooldowns
    if (s.player.attackCooldown > 0) {
        s.player.attackCooldown--;
        if (s.player.attackCooldown <= 0) s.player.isAttacking = false;
    }

    // Healing from Streams
    let nearStream = false;
    s.environment.filter(e => e.type === 'STREAM').forEach(stream => {
        if (dist(s.player.pos, stream.pos) < stream.radius) {
            nearStream = true;
        }
    });
    
    // Heal 1 HP tick if near stream
    if (nearStream && s.player.hp < s.player.maxHp && Math.random() > 0.9) {
        s.player.hp = Math.min(s.player.maxHp, s.player.hp + 1);
    }

    // Enemy Logic (Host only)
    if (!isMultiplayer || isHost) {
        s.enemies.forEach(snake => {
            const distToPlayer = dist(snake.pos, s.player.pos);
            let target = s.player.pos;
            let closestDist = distToPlayer;

            if (s.friend) {
                const distToFriend = dist(snake.pos, s.friend.pos);
                if (distToFriend < closestDist) {
                    target = s.friend.pos;
                    closestDist = distToFriend;
                }
            }

            // Slither movement
            if (closestDist < 800) {
                const edx = target.x - snake.pos.x;
                const edy = target.y - snake.pos.y;
                const angle = Math.atan2(edy, edx);
                snake.rotation = angle;
                
                // Slower than wolves
                snake.pos.x += Math.cos(angle) * 3.5;
                snake.pos.y += Math.sin(angle) * 3.5;
                snake.walkCycle += 0.4; // Fast slither animation

                // Snake Bite
                if (closestDist < 35 && snake.attackCooldown <= 0) {
                   // Deal 10 damage
                   if (target === s.player.pos) s.player.hp -= 10;
                   // Note: Friend damage needs to be synced or handled by friend client, 
                   // but for simplicity host assumes hit. Friend hp will sync back from friend's client eventually.
                   
                   snake.attackCooldown = 60;
                   snake.isAttacking = true;
                   setTimeout(() => { snake.isAttacking = false; }, 300);
                }
            }
            if (snake.attackCooldown > 0) snake.attackCooldown--;
        });

        // Cleanup Dead Snakes
        const aliveEnemies = s.enemies.filter(e => e.hp > 0);
        if (aliveEnemies.length < s.enemies.length) {
            if (aliveEnemies.length < 5) spawnSnakes(3);
        }
        s.enemies = aliveEnemies;
    }

    // World Bounds & Environment Collision
    const dynamicEntities = [s.player, ...s.enemies];
    if (s.friend) dynamicEntities.push(s.friend);

    dynamicEntities.forEach(ent => {
        ent.pos.x = Math.max(0, Math.min(CANVAS_WIDTH, ent.pos.x));
        ent.pos.y = Math.max(0, Math.min(CANVAS_HEIGHT, ent.pos.y));

        s.environment.filter(e => e.type === 'ROCK').forEach(rock => {
             const d = dist(ent.pos, rock.pos);
             const minD = ent.radius + rock.radius;
             if (d < minD) {
                 const angle = Math.atan2(ent.pos.y - rock.pos.y, ent.pos.x - rock.pos.x);
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

    ctx.fillStyle = '#1c1917'; // Darker ground for contrast
    ctx.fillRect(0, 0, cvs.width, cvs.height);

    ctx.save();
    ctx.translate(cvs.width / 2 - s.camera.x, cvs.height / 2 - s.camera.y);

    // Draw Stream Layer First
    s.environment.filter(e => e.type === 'STREAM').forEach(stream => {
        ctx.beginPath();
        ctx.arc(stream.pos.x, stream.pos.y, stream.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#0ea5e9'; // Sky blue water
        ctx.fill();
        // Inner flow
        ctx.beginPath();
        ctx.arc(stream.pos.x, stream.pos.y, stream.radius * 0.8, 0, Math.PI * 2);
        ctx.fillStyle = '#38bdf8';
        ctx.fill();
    });

    const renderList = [
        ...s.environment.filter(e => e.type !== 'STREAM'),
        ...s.enemies,
        s.player,
        ...(s.friend ? [s.friend] : [])
    ].sort((a, b) => a.pos.y - b.pos.y);

    renderList.forEach(ent => {
        if (ent.type === 'TREE') drawTree(ctx, ent);
        else if (ent.type === 'ROCK') drawRock(ctx, ent);
        else if (ent.type === 'SNAKE') drawSnake(ctx, ent);
        else drawRealisticWolf(ctx, ent);
    });

    ctx.restore();
  };

  const drawRock = (ctx: CanvasRenderingContext2D, r: Entity) => {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.ellipse(r.pos.x + 10, r.pos.y + 10, r.radius, r.radius * 0.8, 0, 0, Math.PI*2);
      ctx.fill();

      ctx.fillStyle = '#57534e';
      ctx.beginPath();
      ctx.arc(r.pos.x, r.pos.y, r.radius, 0, Math.PI * 2);
      ctx.fill();
      
      // Detail
      ctx.fillStyle = '#78716c';
      ctx.beginPath();
      ctx.arc(r.pos.x - r.radius * 0.3, r.pos.y - r.radius * 0.3, r.radius * 0.4, 0, Math.PI * 2);
      ctx.fill();
  };

  const drawTree = (ctx: CanvasRenderingContext2D, t: Entity) => {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.arc(t.pos.x + 15, t.pos.y + 15, t.radius, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#14532d'; // Dark Green
    ctx.beginPath();
    ctx.arc(t.pos.x, t.pos.y, t.radius, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#166534'; // Light Green Highlight
    ctx.beginPath();
    ctx.arc(t.pos.x - t.radius*0.2, t.pos.y - t.radius*0.2, t.radius * 0.6, 0, Math.PI * 2);
    ctx.fill();
  };

  const drawSnake = (ctx: CanvasRenderingContext2D, s: Entity) => {
     ctx.save();
     ctx.translate(s.pos.x, s.pos.y);
     ctx.rotate(s.rotation);
     
     // Draw Snake Body (Sinusoidal)
     const segments = 10;
     const length = 40;
     
     // Shadow
     ctx.strokeStyle = 'rgba(0,0,0,0.3)';
     ctx.lineWidth = 14;
     ctx.lineCap = 'round';
     ctx.beginPath();
     for(let i=0; i<=segments; i++) {
         const x = -i * (length/segments);
         const y = Math.sin(s.walkCycle + i * 0.5) * 8;
         if (i===0) ctx.moveTo(x, y + 10);
         else ctx.lineTo(x, y + 10);
     }
     ctx.stroke();

     // Body
     ctx.strokeStyle = '#65a30d'; // Green
     ctx.lineWidth = 12;
     ctx.beginPath();
     for(let i=0; i<=segments; i++) {
         const x = -i * (length/segments);
         const y = Math.sin(s.walkCycle + i * 0.5) * 8;
         if (i===0) ctx.moveTo(x, y);
         else ctx.lineTo(x, y);
     }
     ctx.stroke();

     // Pattern
     ctx.strokeStyle = '#365314'; // Dark Green stripes
     ctx.lineWidth = 4;
     ctx.setLineDash([5, 5]);
     ctx.stroke();
     ctx.setLineDash([]);

     // Head
     ctx.fillStyle = '#4d7c0f';
     ctx.beginPath();
     ctx.ellipse(5, Math.sin(s.walkCycle)*8, 12, 9, 0, 0, Math.PI*2);
     ctx.fill();
     
     // Eyes
     ctx.fillStyle = '#ef4444';
     const headY = Math.sin(s.walkCycle)*8;
     ctx.beginPath(); ctx.arc(8, headY - 4, 2, 0, Math.PI*2); ctx.fill();
     ctx.beginPath(); ctx.arc(8, headY + 4, 2, 0, Math.PI*2); ctx.fill();

     // Tongue
     if (Math.sin(s.walkCycle * 2) > 0.5) {
         ctx.strokeStyle = '#ef4444';
         ctx.lineWidth = 2;
         ctx.beginPath();
         ctx.moveTo(15, headY);
         ctx.lineTo(25, headY);
         ctx.lineTo(30, headY - 3);
         ctx.moveTo(25, headY);
         ctx.lineTo(30, headY + 3);
         ctx.stroke();
     }

     // Health Bar
     if (s.hp < s.maxHp) {
        ctx.rotate(-s.rotation);
        ctx.fillStyle = 'red';
        ctx.fillRect(-15, -30, 30 * (s.hp/s.maxHp), 4);
     }

     ctx.restore();
  };

  const drawRealisticWolf = (ctx: CanvasRenderingContext2D, e: Entity) => {
    ctx.save();
    ctx.translate(e.pos.x, e.pos.y);
    ctx.rotate(e.rotation);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 5, 20, 10, 0, 0, Math.PI*2);
    ctx.fill();

    // Attack Slash
    if (e.isAttacking) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(30, 0, 40, -0.5, 0.5);
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#fff';
        ctx.stroke();
        ctx.restore();
    }

    // Colors
    const furColor = '#94a3b8'; // Blue-ish grey
    const darkFur = '#475569'; 
    const isLevel2 = (e.level || 1) >= 2;

    // Glowing aura for Lvl 2
    if (isLevel2) {
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 15;
    }

    // Body (2 ellipses for realistic shape)
    ctx.fillStyle = furColor;
    ctx.beginPath();
    ctx.ellipse(-10, 0, 20, 12, 0, 0, Math.PI*2); // Rear
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(5, 0, 18, 11, 0, 0, Math.PI*2); // Chest
    ctx.fill();

    // Head
    ctx.fillStyle = furColor;
    ctx.beginPath();
    ctx.moveTo(15, -8); // Ears
    ctx.lineTo(25, -5);
    ctx.lineTo(18, 0);
    ctx.lineTo(25, 5);
    ctx.lineTo(15, 8);
    // Snout
    ctx.quadraticCurveTo(35, 0, 15, -8);
    ctx.fill();

    // Ears detail
    ctx.fillStyle = darkFur;
    ctx.beginPath();
    ctx.moveTo(18, -6); ctx.lineTo(22, -5); ctx.lineTo(19, -3); ctx.fill();
    ctx.beginPath(); ctx.moveTo(18, 6); ctx.lineTo(22, 5); ctx.lineTo(19, 3); ctx.fill();

    // Nose
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(28, 0, 2, 0, Math.PI*2);
    ctx.fill();

    // Tail (Animated)
    const tailWag = Math.sin(e.walkCycle * 2) * 0.4;
    ctx.save();
    ctx.translate(-25, 0);
    ctx.rotate(tailWag);
    ctx.fillStyle = furColor;
    ctx.beginPath();
    ctx.moveTo(0, -3);
    ctx.quadraticCurveTo(-20, 0, 0, 3);
    ctx.fill();
    ctx.restore();

    // Legs (Animated)
    const legMove = Math.sin(e.walkCycle * 1.5) * 5;
    ctx.fillStyle = darkFur;
    // Front Left
    ctx.beginPath(); ctx.ellipse(10 + legMove, -12, 6, 3, 0, 0, Math.PI*2); ctx.fill();
    // Front Right
    ctx.beginPath(); ctx.ellipse(10 - legMove, 12, 6, 3, 0, 0, Math.PI*2); ctx.fill();
    // Back Left
    ctx.beginPath(); ctx.ellipse(-10 - legMove, -12, 6, 3, 0, 0, Math.PI*2); ctx.fill();
    // Back Right
    ctx.beginPath(); ctx.ellipse(-10 + legMove, 12, 6, 3, 0, 0, Math.PI*2); ctx.fill();

    // Level 2 Crown/Mark
    if (isLevel2) {
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(5, -5);
        ctx.lineTo(8, 0);
        ctx.lineTo(5, 5);
        ctx.fill();
    }

    ctx.shadowBlur = 0;

    // HP Bar
    if (e.hp < e.maxHp) {
        ctx.rotate(-e.rotation);
        ctx.fillStyle = 'red';
        ctx.fillRect(-20, -40, 40, 4);
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(-20, -40, 40 * (e.hp / e.maxHp), 4);
    }
    
    ctx.restore();
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
        
        {/* TOP HUD */}
        <div className="absolute top-0 left-0 right-0 p-4 flex flex-col items-center pointer-events-none z-50">
            {/* XP Bar */}
            <div className="w-full max-w-md bg-neutral-900/80 border border-neutral-700 h-6 rounded-full relative overflow-hidden mb-2">
                <div 
                    className="h-full bg-yellow-500 transition-all duration-300" 
                    style={{ width: `${(hudState.xp / hudState.maxXp) * 100}%` }} 
                />
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white drop-shadow-md tracking-widest">
                    LVL {hudState.level} {hudState.level >= 2 ? '(MAX)' : `XP ${hudState.xp}/${hudState.maxXp}`}
                </span>
            </div>

            <div className="flex justify-between w-full max-w-md">
                 <div className="bg-neutral-900 border border-neutral-700 p-1 w-32 h-8 rounded relative overflow-hidden">
                    <div 
                        className="h-full bg-red-600 transition-all duration-300" 
                        style={{ width: `${(hudState.hp / 100) * 100}%` }} 
                    />
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow-md">
                        HP {Math.floor(hudState.hp)}
                    </span>
                </div>
                {isMultiplayer && (
                   <div className="flex items-center gap-2 bg-black/30 px-2 rounded w-fit">
                      <Radio className="w-4 h-4 text-green-500 animate-pulse" />
                      <span className="text-xs text-green-500 font-mono">LIVE</span>
                   </div>
                )}
            </div>
        </div>

        {/* CONTROLS */}
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
        </div>

        <div className="absolute bottom-10 right-10 flex gap-4 z-50">
            <button 
                className="w-24 h-24 rounded-full bg-red-600/80 active:bg-red-500 border-4 border-red-900 shadow-xl flex items-center justify-center touch-none transform transition active:scale-95"
                onTouchStart={(e) => { e.preventDefault(); handleAttack(); }}
                onMouseDown={handleAttack}
            >
                <Sword className="text-white w-10 h-10" />
            </button>
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
                    <p className="text-neutral-400 mb-6">The snake venom was too strong.</p>
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
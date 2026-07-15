/* =====================================================================
   RETRO SNIPER  —  cazador oculto
   Juego de francotirador retro para navegador. Canvas 2D, sin dependencias.
   ===================================================================== */
(() => {
'use strict';

// ---------- Config base ----------
const W = 480, H = 270;         // resolución interna (pixel-art)
const GROUND = 196;             // línea de horizonte / suelo

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

// buffer de escena
const buf = document.createElement('canvas');
buf.width = W; buf.height = H;
const bx = buf.getContext('2d');
bx.imageSmoothingEnabled = false;

// ---------- Utilidades ----------
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = arr => arr[randi(0, arr.length - 1)];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
function shuffle(a){ for(let i=a.length-1;i>0;i--){const j=randi(0,i);[a[i],a[j]]=[a[j],a[i]];} return a; }

// ---------- Definición de niveles ----------
const LEVELS = [
  {
    biome:'DESIERTO', key:'desert', enemies:3, ammo:14, time:60, aggro:0.34,
    baseReveal:0.24, peekReveal:0.74, peekEvery:[2.4,4.2], decoys:2, distractors:5,
    sky:['#f6b25a','#e07b3a','#7a3b2e'], ground:['#c79a5c','#a9793f'], camo:'#6e5836'
  },
  {
    biome:'PLAYA', key:'beach', enemies:3, ammo:14, time:58, aggro:0.34,
    baseReveal:0.23, peekReveal:0.74, peekEvery:[2.4,4.2], decoys:2, distractors:5,
    sky:['#8fd3f4','#bfe8f9','#e9f6ff'], ground:['#e8d39a','#d3b878'], camo:'#b39a63'
  },
  {
    biome:'CIUDAD', key:'city', enemies:4, ammo:15, time:56, aggro:0.5,
    baseReveal:0.20, peekReveal:0.70, peekEvery:[2.6,4.6], decoys:3, distractors:5,
    sky:['#2b3b6b','#334a86','#8a6c9e'], ground:['#3a3f4a','#2a2d35'], camo:'#39414f'
  },
  {
    biome:'CASTILLOS', key:'castle', enemies:4, ammo:15, time:56, aggro:0.5,
    baseReveal:0.19, peekReveal:0.70, peekEvery:[2.6,4.6], decoys:3, distractors:5,
    sky:['#d99a5a','#9a5a6a','#3a2a4a'], ground:['#5f6b3a','#3f4a26'], camo:'#5a564c'
  },
  {
    biome:'BOSQUE', key:'forest', enemies:5, ammo:16, time:54, aggro:0.5,
    baseReveal:0.17, peekReveal:0.68, peekEvery:[2.8,5.0], decoys:3, distractors:6,
    sky:['#8fc7d4','#b6d9c2','#dce9c0'], ground:['#3f5a2e','#2c4322'], camo:'#31461f'
  },
  {
    biome:'CASA ABANDONADA', key:'abandoned', enemies:5, ammo:16, time:54, aggro:0.6,
    baseReveal:0.19, peekReveal:0.66, peekEvery:[2.8,5.0], decoys:3, distractors:5,
    sky:['#3a3330','#2a2422','#17120f'], ground:['#4a3826','#2a1f14'], camo:'#2c2318', interior:true
  },
  {
    biome:'FÁBRICA ABANDONADA', key:'factory', enemies:6, ammo:17, time:54, aggro:0.62,
    baseReveal:0.18, peekReveal:0.66, peekEvery:[2.8,5.0], decoys:3, distractors:5,
    sky:['#2e3338','#242a2e','#14181b'], ground:['#4a4e54','#292c30'], camo:'#3a3d38', interior:true
  },
  {
    biome:'BAJO EL MAR', key:'sea', enemies:5, ammo:16, time:54, aggro:0.6,
    baseReveal:0.18, peekReveal:0.68, peekEvery:[2.8,5.0], decoys:3, distractors:6,
    sky:['#1a90a0','#0e6d8a','#083f5c'], ground:['#b7a778','#8a7a50'], camo:'#2f5a5a'
  },
  {
    biome:'HIELO', key:'ice', enemies:6, ammo:17, time:52, aggro:0.66,
    baseReveal:0.16, peekReveal:0.66, peekEvery:[3.0,5.2], decoys:3, distractors:6,
    sky:['#cfe6f2','#dff0f7','#eef8fb'], ground:['#eef6fb','#cddbe6'], camo:'#aebecb'
  },
  {
    biome:'ESPACIO EXTERIOR', key:'space', enemies:7, ammo:18, time:50, aggro:0.75,
    baseReveal:0.15, peekReveal:0.64, peekEvery:[3.0,5.4], decoys:4, distractors:6,
    sky:['#05060f','#0a0a1e','#141033'], ground:['#4a3f5c','#2b2440'], camo:'#3a3550'
  }
];

// ---------- Estado global ----------
const game = {
  screen:'menu',       // menu | play | levelclear | win | fail
  levelIndex:0,
  L:null,
  t:0, dt:0,
  timeLeft:0,
  ammo:0, ammoMax:0,
  killed:0,
  enemies:[], decoys:[], distractors:[], props:[], bg:[],
  holes:[], puffs:[], corpses:[], tracers:[],
  hp:5, maxHP:5, crouched:false, threat:false,
  msg:'', msgTimer:0,
  hintT:0, coverHints:0,   // aviso guía: sólo las primeras veces de la partida
  aimX:W/2, aimY:H/2,   // en coords de mundo
  mouse:{x:0.5,y:0.5},  // normalizado 0..1 en pantalla
  zoom:false, zoomScale:2.3, viewZoom:1,
  shakeT:0, canShoot:true
};

// =====================================================================
//  AUDIO retro (WebAudio, beeps sintéticos)
// =====================================================================
let AC = null;
function audio(){ if(!AC){ try{ AC = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} } return AC; }
function beep(freq, dur, type='square', vol=0.18, slideTo=null){
  const ac = audio(); if(!ac) return;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.value = freq;
  if(slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ac.currentTime+dur);
  g.gain.value = vol;
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime+dur);
  o.connect(g); g.connect(ac.destination);
  o.start(); o.stop(ac.currentTime+dur);
}
function noise(dur, vol=0.25){
  const ac = audio(); if(!ac) return;
  const n = ac.sampleRate*dur, b = ac.createBuffer(1,n,ac.sampleRate), d = b.getChannelData(0);
  for(let i=0;i<n;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/n,2);
  const s = ac.createBufferSource(); s.buffer=b;
  const g = ac.createGain(); g.gain.value=vol;
  s.connect(g); g.connect(ac.destination); s.start();
}
const snd = {
  shot(){ noise(0.18,0.35); beep(180,0.12,'sawtooth',0.2,60); },
  hit(){ beep(880,0.08,'square',0.2); beep(1320,0.12,'square',0.18); },
  decoy(){ beep(120,0.25,'sawtooth',0.22,70); },
  animal(){ beep(300,0.18,'triangle',0.18,140); },
  miss(){ noise(0.08,0.15); },
  peek(){ beep(1600,0.03,'sine',0.05); },
  tick(){ beep(1400,0.03,'square',0.06); },
  win(){ [523,659,784,1046].forEach((f,i)=>setTimeout(()=>beep(f,0.16,'square',0.2),i*120)); },
  lose(){ [392,330,262,196].forEach((f,i)=>setTimeout(()=>beep(f,0.22,'sawtooth',0.2),i*160)); },
  empty(){ beep(90,0.06,'square',0.15); },
  aim(){ beep(500,0.12,'square',0.08,760); beep(760,0.12,'square',0.07); }, // aviso de puntería
  enemyfire(){ noise(0.14,0.3); beep(140,0.14,'sawtooth',0.18,50); },
  dodge(){ noise(0.06,0.12); beep(1200,0.05,'sine',0.06,1800); },   // bala esquivada
  hurt(){ beep(200,0.2,'sawtooth',0.22,90); noise(0.1,0.15); },
  run(){ beep(240,0.07,'square',0.05,300); beep(200,0.07,'square',0.05,260); }, // pasos al reubicarse
  clank(){ noise(0.06,0.2); beep(520,0.06,'square',0.14,240); }, // bala contra la cobertura
  // grito de muerte de un enemigo (gruñido descendente)
  death(){ beep(420,0.16,'sawtooth',0.2,150); setTimeout(()=>beep(300,0.24,'sawtooth',0.18,90),70); noise(0.18,0.12); },
  // chillido de un animal/inocente al morir
  deathAnimal(){ beep(700,0.1,'square',0.16,1100); setTimeout(()=>beep(900,0.18,'triangle',0.15,220),50); }
};

// =====================================================================
//  DOM refs
// =====================================================================
const D = {
  scope:document.getElementById('scope'),
  hud:document.getElementById('hud'),
  overlay:document.getElementById('overlay'),
  level:document.getElementById('hud-level'),
  biome:document.getElementById('hud-biome'),
  time:document.getElementById('hud-time'),
  ammo:document.getElementById('hud-ammo'),
  health:document.getElementById('hud-health'),
  threat:document.getElementById('threat'),
  hint:document.getElementById('hint'),
  cover:document.getElementById('cover'),
  crouchBtn:document.getElementById('crouchBtn'),
  alive:document.getElementById('hud-alive'),
  killed:document.getElementById('hud-killed'),
  msg:document.getElementById('hud-msg'),
  stage:document.getElementById('stage'),
  flash:document.getElementById('fx-flash')
};

// =====================================================================
//  GENERACIÓN DE ESCENARIO
// =====================================================================
function buildLevel(idx){
  const L = LEVELS[idx];
  game.L = L; game.levelIndex = idx;
  game.timeLeft = L.time;
  game.ammoMax = L.ammo; game.ammo = L.ammo;
  game.killed = 0;
  game.enemies = []; game.decoys = []; game.distractors = [];
  game.props = []; game.bg = []; game.holes = []; game.puffs = []; game.corpses = []; game.tracers = [];
  game.zoom = false; game.viewZoom = 1;
  game.hp = game.maxHP; game.crouched = false; game.threat = false;
  game.msg=''; game.msgTimer=0; game._noAmmoT=0;
  hideHint();

  // capas de fondo lejano
  buildBackground(L);

  // props / coberturas (hotspots donde esconder gente)
  const needed = L.enemies + L.decoys;            // escondites requeridos
  const hotspots = [];
  const nProps = Math.max(10, needed + randi(3,6));
  for(let i=0;i<nProps;i++){
    const x = 24 + (i/nProps)*(W-48) + rand(-14,14);
    const p = makeProp(L, x);
    game.props.push(p);
    if(p.hides) hotspots.push(p);
  }
  // garantizar suficientes escondites (fuerza props ocultadoras si faltan)
  let guard = 0;
  while(hotspots.length < needed && guard++ < 40){
    const x = 24 + Math.random()*(W-48);
    const p = makeProp(L, x); p.hides = true;
    game.props.push(p); hotspots.push(p);
  }
  // ordenar props por x para que el solapamiento de profundidad sea coherente
  game.props.sort((a,b)=>a.x-b.x);
  shuffle(hotspots);

  // colocar enemigos
  let hi = 0;
  for(let i=0;i<L.enemies && hi<hotspots.length;i++){
    game.enemies.push(makeEnemy(L, hotspots[hi++]));
  }
  // colocar señuelos
  for(let i=0;i<L.decoys && hi<hotspots.length;i++){
    game.decoys.push(makeDecoy(L, hotspots[hi++]));
  }

  // fauna / distractores móviles
  for(let i=0;i<L.distractors;i++) game.distractors.push(makeDistractor(L));

  updateHUD();
}

function buildBackground(L){
  // dunas / skyline / colinas según bioma
  if(L.key==='desert'){
    for(let i=0;i<4;i++) game.bg.push({type:'dune', y:GROUND-rand(6,26)-i*4, x:rand(-40,W), w:rand(120,240), c:i});
  } else if(L.key==='city'){
    let x=-10;
    while(x<W+20){ const w=rand(24,54), h=rand(40,120); game.bg.push({type:'sky-build',x,w,h}); x+=w+rand(2,8); }
    game.bg.push({type:'moon', x:rand(60,W-60), y:rand(30,70), r:rand(9,14)});
  } else if(L.key==='forest'){
    for(let i=0;i<3;i++) game.bg.push({type:'hill', y:GROUND-rand(2,20)-i*3, c:i});
  } else if(L.key==='beach'){
    game.bg.push({type:'sun2', x:rand(60,W-60), y:rand(34,60), r:rand(12,18)});
    for(let i=0;i<4;i++) game.bg.push({type:'cloud', x:rand(0,W), y:rand(24,80), w:rand(30,60)});
    game.bg.push({type:'waterline', y:GROUND-rand(2,8)});
  } else if(L.key==='sea'){
    for(let i=0;i<5;i++) game.bg.push({type:'beam', x:rand(-20,W), w:rand(20,50)});
    for(let i=0;i<3;i++) game.bg.push({type:'farfish', x:rand(0,W), y:rand(40,120)});
    for(let i=0;i<3;i++) game.bg.push({type:'hill', y:GROUND-rand(2,16)-i*3, c:i+3});
  } else if(L.key==='ice'){
    for(let i=0;i<3;i++) game.bg.push({type:'mountain', x:rand(-30,W), w:rand(80,160), h:rand(40,90)});
    game.bg.push({type:'sun2', x:rand(50,W-50), y:rand(28,48), r:rand(10,14), pale:true});
    game.bg.push({type:'aurora', y:rand(20,50)});
  } else if(L.key==='space'){
    for(let i=0;i<70;i++) game.bg.push({type:'star', x:rand(0,W), y:rand(0,GROUND), s:rand(1,2), tw:Math.random()*6.3});
    game.bg.push({type:'planet', x:rand(50,W-50), y:rand(34,70), r:rand(16,28)});
    game.bg.push({type:'nebula', x:rand(0,W), y:rand(30,90)});
    for(let i=0;i<3;i++) game.bg.push({type:'crater-h', x:rand(0,W), w:rand(30,70)});
  } else if(L.key==='castle'){
    game.bg.push({type:'moon', x:rand(50,W-50), y:rand(28,54), r:rand(9,13)});
    for(let i=0;i<3;i++) game.bg.push({type:'hill', y:GROUND-rand(4,20)-i*3, c:i});
    // siluetas de torres lejanas
    for(let i=0;i<4;i++) game.bg.push({type:'far-tower', x:rand(0,W), w:rand(14,24), h:rand(30,60)});
  } else if(L.key==='abandoned'){
    // interior: ventanas con luz de luna en la pared del fondo
    for(let i=0;i<2;i++) game.bg.push({type:'window-moon', x:rand(40,W-60), y:rand(30,60), w:rand(24,34), h:rand(34,48)});
    game.bg.push({type:'wall-crack', x:rand(0,W)});
    game.bg.push({type:'picture', x:rand(60,W-60), y:rand(40,70)});
    for(let i=0;i<3;i++) game.bg.push({type:'cobweb', x:i%2?W-4:4, y:2, s:rand(16,26)});
  } else if(L.key==='factory'){
    // nave industrial: ventanales altos con luz mortecina y vigas del techo
    for(let i=0;i<3;i++) game.bg.push({type:'factory-window', x:26+i*((W-52)/3)+rand(-8,8), y:rand(20,34), w:rand(40,60), h:rand(30,44)});
    game.bg.push({type:'girder', y:14}); game.bg.push({type:'girder', y:26});
    for(let i=0;i<3;i++) game.bg.push({type:'chain', x:rand(40,W-40), len:rand(20,46)});
    game.bg.push({type:'gauge', x:rand(50,W-50), y:rand(50,80)});
    game.bg.push({type:'hazard', y:GROUND-4});
  }
}

function makeProp(L, x){
  const p = { x, hides:true };
  if(L.key==='desert'){
    p.type = pick(['cactus','cactus','rock','bush']);
    p.h = p.type==='cactus'? rand(26,46) : p.type==='rock'? rand(10,20) : rand(12,20);
    p.w = p.type==='cactus'? rand(7,11) : rand(16,30);
    if(p.type==='rock') p.hides = Math.random()<0.4;
  } else if(L.key==='city'){
    p.type = pick(['building','building','car','crate','lamp']);
    if(p.type==='building'){ p.h=rand(34,74); p.w=rand(30,54); }
    else if(p.type==='car'){ p.h=14; p.w=rand(26,36); }
    else if(p.type==='crate'){ p.h=rand(10,16); p.w=rand(10,16); }
    else { p.h=rand(24,34); p.w=4; p.hides=false; }
  } else if(L.key==='forest'){
    p.type = pick(['tree','tree','bush','bush','log']);
    if(p.type==='tree'){ p.h=rand(46,86); p.w=rand(18,30); }
    else if(p.type==='bush'){ p.h=rand(14,24); p.w=rand(22,40); }
    else { p.h=10; p.w=rand(24,40); }
  } else if(L.key==='beach'){
    p.type = pick(['palm','palm','umbrella','rock','sandcastle','chair']);
    if(p.type==='palm'){ p.h=rand(46,74); p.w=rand(16,26); }
    else if(p.type==='umbrella'){ p.h=rand(30,42); p.w=rand(26,40); }
    else if(p.type==='rock'){ p.h=rand(10,18); p.w=rand(16,26); p.hides=Math.random()<0.4; }
    else if(p.type==='sandcastle'){ p.h=rand(12,20); p.w=rand(16,26); }
    else { p.h=rand(10,14); p.w=rand(16,22); p.hides=false; } // chair
  } else if(L.key==='sea'){
    p.type = pick(['coral','coral','seaweed','seaweed','rock','shell']);
    if(p.type==='coral'){ p.h=rand(22,42); p.w=rand(14,24); }
    else if(p.type==='seaweed'){ p.h=rand(30,60); p.w=rand(8,16); }
    else if(p.type==='rock'){ p.h=rand(12,22); p.w=rand(18,30); p.hides=Math.random()<0.5; }
    else { p.h=rand(8,12); p.w=rand(10,16); p.hides=false; } // shell
  } else if(L.key==='ice'){
    p.type = pick(['iceblock','iceblock','icespike','snowtree','snowtree','igloo']);
    if(p.type==='iceblock'){ p.h=rand(14,26); p.w=rand(18,32); }
    else if(p.type==='icespike'){ p.h=rand(26,50); p.w=rand(10,18); }
    else if(p.type==='snowtree'){ p.h=rand(40,72); p.w=rand(18,28); }
    else { p.h=rand(20,30); p.w=rand(30,46); } // igloo
  } else if(L.key==='space'){
    p.type = pick(['crystal','crystal','moonrock','moonrock','alienplant','debris']);
    if(p.type==='crystal'){ p.h=rand(24,46); p.w=rand(12,22); }
    else if(p.type==='moonrock'){ p.h=rand(12,24); p.w=rand(20,34); p.hides=Math.random()<0.6; }
    else if(p.type==='alienplant'){ p.h=rand(22,40); p.w=rand(16,26); }
    else { p.h=rand(14,24); p.w=rand(22,36); p.hides=Math.random()<0.5; } // debris
  } else if(L.key==='castle'){
    p.type = pick(['tower','wall','wall','barrel','banner','well']);
    if(p.type==='tower'){ p.h=rand(50,80); p.w=rand(24,36); }
    else if(p.type==='wall'){ p.h=rand(24,40); p.w=rand(34,54); }
    else if(p.type==='barrel'){ p.h=rand(12,18); p.w=rand(12,16); p.hides=Math.random()<0.6; }
    else if(p.type==='well'){ p.h=rand(14,20); p.w=rand(20,28); }
    else { p.h=rand(30,46); p.w=4; p.hides=false; } // banner
  } else if(L.key==='abandoned'){
    p.type = pick(['shelf','sofa','crate','fireplace','doorway','column','window']);
    if(p.type==='shelf'){ p.h=rand(30,46); p.w=rand(18,28); }
    else if(p.type==='sofa'){ p.h=rand(14,20); p.w=rand(30,44); }
    else if(p.type==='crate'){ p.h=rand(12,18); p.w=rand(12,18); }
    else if(p.type==='fireplace'){ p.h=rand(26,40); p.w=rand(30,44); }
    else if(p.type==='doorway'){ p.h=rand(40,56); p.w=rand(20,30); }
    else if(p.type==='column'){ p.h=rand(50,70); p.w=rand(10,16); }
    else { p.h=rand(24,34); p.w=rand(22,32); p.hides=false; } // window (tapiado)
  } else if(L.key==='factory'){
    p.type = pick(['machine','tank','crate','barrel','pillar','conveyor','panel']);
    if(p.type==='machine'){ p.h=rand(30,46); p.w=rand(28,42); }
    else if(p.type==='tank'){ p.h=rand(36,54); p.w=rand(20,30); }
    else if(p.type==='crate'){ p.h=rand(12,20); p.w=rand(14,22); }
    else if(p.type==='barrel'){ p.h=rand(16,24); p.w=rand(12,16); p.hides=Math.random()<0.7; }
    else if(p.type==='pillar'){ p.h=rand(52,72); p.w=rand(10,16); }
    else if(p.type==='conveyor'){ p.h=rand(12,18); p.w=rand(34,50); }
    else { p.h=rand(22,32); p.w=rand(16,24); } // panel (cuadro de control)
  } else {
    p.type='rock'; p.h=rand(10,20); p.w=rand(16,30);
  }
  // colores/patrones estables por prop (evita parpadeo entre frames)
  if(p.type==='car') p.tint=pick(['#7a2a2a','#2a4a7a','#2a6a3a','#6a6a2a']);
  else if(p.type==='coral') p.tint=pick(['#e0765a','#e0a35a','#c95a9a','#5ac9a0']);
  else if(p.type==='crystal') p.tint=pick(['#8affd6','#8ab4ff','#d68aff','#ffd68a']);
  else if(p.type==='umbrella') p.tint=pick(['#d94a4a','#4a7ad9','#d9c04a']);
  else if(p.type==='banner') p.tint=pick(['#a33','#36c','#3a3','#c93','#639']);
  else if(p.type==='sofa') p.tint=pick(['#5a3a4a','#3a4a5a','#4a4a3a','#5a4030']);
  else if(p.type==='barrel' && L.key==='factory') p.tint=pick(['#7a5a2a','#5a6a3a','#6a3a2a','#3a5a6a','#6a6a3a']);
  else if(p.type==='machine' || p.type==='tank' || p.type==='panel') p.tint=pick(['#565b62','#4a5258','#5a5248']);
  else if(p.type==='building'){ p.lit=[]; for(let i=0;i<260;i++) p.lit.push(Math.random()<0.3); }
  p.seed = Math.random()*1000;
  return p;
}

// ---------- Entidades humanas ----------
// Coberturas "blandas": ramas/telas que no detienen una bala. El resto son
// coberturas SÓLIDAS: mientras el enemigo esté agachado detrás, es INTOCABLE.
const SOFT_COVER = new Set(['bush','seaweed','chair','banner','alienplant','shell','lamp','icespike']);

// Un enemigo sólo puede ser alcanzado cuando se expone: al asomarse,
// al apuntarte o mientras corre. Detrás de cobertura sólida y agachado, no.
function enemyExposed(e){
  return !e.hardCover || e.peeking || e.aiming || e.running;
}

function makeEnemy(L, prop){
  const height = randi(18,22);
  const side = Math.random()<0.5 ? -1 : 1;
  const x = clamp(prop.x + side*(prop.w*0.28), 14, W-14);
  return {
    kind:'enemy', alive:true, x, baseX:x, y:GROUND, h:height, w:height*0.42,
    prop, side,
    hardCover: !SOFT_COVER.has(prop.type),   // ¿su escondite detiene balas?
    reveal:L.baseReveal, base:L.baseReveal,
    peekT: rand(0.8,3.0), peeking:false, peekDur:0, peekLife:0,
    sway: Math.random()*6.28, swaySpd: rand(0.6,1.2),
    lean:0, dieT:0,
    // se agachan/esconden por completo detrás de la cobertura
    ducking:false, duckT: rand(1.5,4),
    // ataque: disparan más seguido y hay más tiradores
    canAttack: Math.random() < Math.min(0.9,(L.aggro||0)+0.12),
    attackT: rand(2.5,6), aiming:false, aimTime:0, aimDur:0,
    // reubicación: tras cierto tiempo corren y cambian de escondite
    relocT: rand(18,30), running:false, runFrom:0, runTo:0, runProg:0, runDur:0,
    destProp:null, destSide:1
  };
}
function makeDecoy(L, prop){
  const height = randi(17,21);
  const side = Math.random()<0.5 ? -1 : 1;
  const x = clamp(prop.x + side*(prop.w*0.30), 14, W-14);
  return {
    kind:'decoy', alive:true, revealed:false, x, y:GROUND, h:height, w:height*0.42,
    prop, side,
    reveal:L.baseReveal*rand(0.8,1.15), // parecido a un enemigo, pero NO se mueve
    sway: Math.random()*6.28, shatterT:0
  };
}

// ---------- Distractores (fauna / paseantes) ----------
// fly:true => se mueve por el aire/agua a cierta altura. yTop => rango de altura.
const DCONF = {
  bird:{fly:1, sp:[22,40], w:8, h:6},
  pigeon:{fly:1, sp:[20,36], w:8, h:6},
  butterfly:{fly:1, sp:[10,20], w:5, h:5, yTop:[40,120]},
  tumbleweed:{sp:[26,42], w:12, h:12, y:GROUND-6},
  lizard:{sp:[16,30], w:8, h:4},
  deer:{sp:[14,22], w:20, h:16},
  cat:{sp:[16,30], w:8, h:6},
  squirrel:{sp:[16,30], w:6, h:5},
  pedestrian:{sp:[16,30], w:7, h:18},
  fish:{fly:1, sp:[18,34], w:9, h:6, yTop:[45,140]},
  jellyfish:{fly:1, sp:[8,16], w:8, h:12, yTop:[35,130]},
  turtle:{fly:1, sp:[10,18], w:15, h:9, yTop:[50,140]},
  seagull:{fly:1, sp:[24,40], w:9, h:6},
  crab:{sp:[10,20], w:9, h:5},
  beachball:{sp:[20,34], w:8, h:8},
  beachgoer:{sp:[14,26], w:7, h:18},
  penguin:{sp:[10,20], w:7, h:11},
  seal:{sp:[10,20], w:16, h:7},
  snowbird:{fly:1, sp:[22,38], w:8, h:6},
  ufo:{fly:1, sp:[20,40], w:16, h:7, yTop:[25,95]},
  asteroid:{fly:1, sp:[14,30], w:10, h:10, yTop:[20,110]},
  alien:{sp:[12,24], w:8, h:12},
  shootingstar:{fly:1, sp:[90,140], w:12, h:3, yTop:[15,60]},
  crow:{fly:1, sp:[24,40], w:9, h:6},
  raven:{fly:1, sp:[20,34], w:11, h:7, yTop:[35,110]},
  knight:{sp:[12,22], w:8, h:18},
  rat:{sp:[18,32], w:8, h:4},
  bat:{fly:1, sp:[26,46], w:8, h:6, yTop:[28,110]},
  moth:{fly:1, sp:[10,20], w:5, h:5, yTop:[40,120]},
  spider:{sp:[8,16], w:7, h:5}
};
const DIST_BY_BIOME = {
  desert:['bird','bird','tumbleweed','lizard'],
  beach:['seagull','seagull','crab','beachball','beachgoer'],
  city:['pedestrian','pedestrian','pigeon','cat'],
  forest:['deer','bird','bird','squirrel','butterfly'],
  sea:['fish','fish','jellyfish','turtle','fish'],
  ice:['penguin','penguin','seal','snowbird','seal'],
  space:['ufo','ufo','asteroid','alien','shootingstar'],
  castle:['crow','crow','raven','knight','crow'],
  abandoned:['rat','rat','bat','moth','spider'],
  factory:['rat','rat','pigeon','bat','moth']
};
function makeDistractor(L){
  const dir = Math.random()<0.5?1:-1;
  const startX = dir>0 ? -24 : W+24;
  const type = pick(DIST_BY_BIOME[L.key] || DIST_BY_BIOME.desert);
  const cf = DCONF[type];
  const d = { alive:true, dir, x:startX, hitT:0, type, phase:Math.random()*6.28 };
  d.fly = !!cf.fly;
  d.spd = rand(cf.sp[0], cf.sp[1]) * dir;
  d.w = cf.w; d.h = cf.h;
  if(d.fly){ const yt = cf.yTop || [40,120]; d.y = rand(yt[0], yt[1]); }
  else d.y = cf.y != null ? cf.y : GROUND;
  if(type==='pedestrian'||type==='beachgoer') d.tint=pick(['#c94','#49c','#c49','#4c9','#999','#e84','#5a5']);
  else if(type==='butterfly') d.tint=pick(['#ff8','#f8a','#af8','#8ff']);
  else if(type==='beachball') d.tint=pick(['#e84','#4ae','#ee4']);
  else if(type==='ufo') d.tint=pick(['#6effc9','#8ab4ff','#d68aff']);
  return d;
}

// =====================================================================
//  BUCLE PRINCIPAL
// =====================================================================
let last = performance.now();
function loop(now){
  game.dt = Math.min(0.05, (now-last)/1000); last = now;
  game.t += game.dt;
  if(game.screen==='play') update(game.dt);
  render();
  requestAnimationFrame(loop);
}

function update(dt){
  // tiempo
  const prev = Math.ceil(game.timeLeft);
  game.timeLeft -= dt;
  const nowSec = Math.ceil(game.timeLeft);
  if(nowSec!==prev && nowSec<=10 && nowSec>=0) snd.tick();
  if(game.timeLeft<=0){ game.timeLeft=0; return endLevel(false,'TIEMPO AGOTADO'); }

  // enemigos: respiración + asomarse (pista) + ataque ocasional
  for(const e of game.enemies){
    if(!e.alive){ e.dieT+=dt; continue; }
    e.sway += dt*e.swaySpd;

    // --- corriendo hacia un nuevo escondite (muy expuesto = vulnerable) ---
    if(e.running){
      e.runProg += dt/e.runDur;
      const t = clamp(e.runProg,0,1);
      e.baseX = lerp(e.runFrom, e.runTo, t);
      e.reveal = lerp(e.reveal, 0.85, dt*7);   // se ve claramente mientras corre
      e.lean = (e.runTo>e.runFrom?1:-1) * 1.2;
      e.x = e.baseX + Math.sin(e.runProg*Math.PI*10)*0.7; // bamboleo de carrera
      if(t>=1){
        e.running=false; e.prop=e.destProp||e.prop; e.side=e.destSide;
        e.hardCover = !SOFT_COVER.has(e.prop.type);   // el nuevo escondite manda
        e.baseX=e.runTo; e.lean=0;
        e.peekT = rand(game.L.peekEvery[0], game.L.peekEvery[1]);
        e.relocT = rand(18,30); e.attackT = rand(2.5,6);
        e.ducking=false; e.duckT = rand(1.5,4);
      }
      continue;
    }

    // temporizador de reubicación: tras ~30 s cambian de sitio
    e.relocT -= dt;
    if(e.relocT<=0 && !e.aiming){ startRun(e); continue; }

    if(e.aiming){
      // al apuntar se EXPONE (más visible): oportunidad de dispararle primero
      e.aimTime += dt;
      e.reveal = lerp(e.reveal, 0.9, dt*6);
      e.lean = e.leanDir * 1.6;
      if(e.aimTime>=e.aimDur){
        enemyFire(e);
        e.aiming=false; e.peeking=false; e.lean=0;
        // tras disparar, a veces corre a cambiar de posición (al azar)
        if(e.alive && Math.random()<0.45){ startRun(e); }
        else {
          e.peekT = rand(game.L.peekEvery[0], game.L.peekEvery[1]);
          e.attackT = rand(3,7); // vuelve a disparar pronto
          e.ducking=true; e.duckT = rand(1.0,2.2); // se agacha tras disparar
        }
      }
    } else if(!e.peeking){
      e.peekT -= dt;
      if(e.canAttack){
        e.attackT -= dt;
        if(e.attackT<=0){ startAim(e); }
      }
      // detrás de cobertura sólida: se agacha y se esconde del todo a ratos
      if(e.hardCover){
        e.duckT -= dt;
        if(e.duckT<=0){ e.ducking=!e.ducking; e.duckT = e.ducking? rand(1.0,2.4) : rand(2.0,4.5); }
      }
      if(!e.aiming && e.peekT<=0){
        e.peeking=true; e.ducking=false; e.peekLife=0; e.peekDur=rand(0.7,1.3);
        e.leanDir = Math.random()<0.5?-1:1;
        snd.peek();
      }
      const idleTarget = (e.hardCover && e.ducking) ? 0.03 : e.base;
      e.reveal = lerp(e.reveal, idleTarget, dt*4);
    } else {
      e.peekLife += dt;
      const p = e.peekLife/e.peekDur;
      const env = Math.sin(clamp(p,0,1)*Math.PI); // sube y baja
      e.reveal = e.base + (game.L.peekReveal-e.base)*env;
      e.lean = e.leanDir * env * 2.4;
      if(e.peekLife>=e.peekDur){
        e.peeking=false;
        e.peekT = rand(game.L.peekEvery[0], game.L.peekEvery[1]);
        e.lean=0;
      }
    }
    if(!e.running) e.x = e.baseX + Math.sin(e.sway)*0.6 + e.lean;
  }

  // aviso de amenaza (algún enemigo apuntándote)
  const threat = game.enemies.some(e=>e.alive && e.aiming);
  if(threat!==game.threat){ game.threat=threat; D.threat.classList.toggle('hidden', !threat); }

  // tracers (balas enemigas, sólo visual)
  for(const tr of game.tracers) tr.life-=dt;
  game.tracers = game.tracers.filter(tr=>tr.life>0);

  // señuelos: leve balanceo, sin picos de movimiento
  for(const d of game.decoys){
    if(!d.alive){ d.shatterT+=dt; continue; }
    d.sway += dt*0.4;
  }

  // distractores móviles
  for(const d of game.distractors){
    if(!d.alive){
      // muerte: cae y se desvanece, luego reaparece otro
      d.deadT += dt;
      d.vy = (d.vy||0) + 120*dt;
      d.y += d.vy*dt;
      d.rot = (d.rot||0) + dt*7*(d.dir||1);
      if(d.deadT>1.4) Object.assign(d, makeDistractor(game.L));
      continue;
    }
    d.x += d.spd*dt;
    d.phase += dt*8;
    if(d.hitT>0) d.hitT-=dt;
    if(d.fly) d.y += Math.sin(d.phase*0.4)*0.3;
    // reaparecer al salir de pantalla
    if(d.spd>0 && d.x>W+30 || d.spd<0 && d.x<-30){
      Object.assign(d, makeDistractor(game.L));
    }
  }

  // partículas
  for(const p of game.puffs){ p.life-=dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=60*dt; }
  game.puffs = game.puffs.filter(p=>p.life>0);

  // mensaje temporal
  if(game.msgTimer>0){ game.msgTimer-=dt; if(game.msgTimer<=0){ game.msg=''; updateHUD(); } }

  // aviso guía temporal
  if(game.hintT>0){ game.hintT-=dt; if(game.hintT<=0) hideHint(); }

  // shake
  if(game.shakeT>0) game.shakeT-=dt;

  // zoom suave
  const target = game.zoom ? game.zoomScale : 1;
  game.viewZoom = lerp(game.viewZoom, target, dt*12);

  // fin por munición
  if(game.ammo<=0 && aliveEnemies()>0){
    // deja ver el último disparo antes de terminar
    if(!game._noAmmoT) game._noAmmoT = 1.1;
    game._noAmmoT -= dt;
    if(game._noAmmoT<=0){ game._noAmmoT=0; endLevel(false,'SIN MUNICIÓN'); }
  }
}

function aliveEnemies(){ return game.enemies.filter(e=>e.alive).length; }

// =====================================================================
//  RENDER
// =====================================================================
function render(){
  const L = game.L;
  if(L) drawScene(L);
  else drawIdle();

  // blit del buffer al canvas visible con zoom
  const z = game.viewZoom;
  const srcW = W/z, srcH = H/z;
  let srcX = clamp(game.aimX - srcW/2, 0, W-srcW);
  let srcY = clamp(game.aimY - srcH/2, 0, H-srcH);
  if(z<=1.001){ srcX=0; srcY=0; }
  ctx.clearRect(0,0,W,H);
  ctx.save();
  if(game.shakeT>0){ const s=game.shakeT*24; ctx.translate(rand(-s,s),rand(-s,s)); }
  ctx.drawImage(buf, srcX,srcY,srcW,srcH, 0,0,W,H);
  ctx.restore();

  // posicionar mira (reticle) en coords de pantalla
  positionScope(srcX,srcY,srcW,srcH);
}

function drawIdle(){
  bx.fillStyle='#04120a'; bx.fillRect(0,0,W,H);
}

function drawScene(L){
  // cielo
  const g = bx.createLinearGradient(0,0,0,GROUND);
  g.addColorStop(0,L.sky[0]); g.addColorStop(0.6,L.sky[1]); g.addColorStop(1,L.sky[2]);
  bx.fillStyle=g; bx.fillRect(0,0,W,GROUND);

  // fondo lejano
  drawBackground(L);

  // suelo
  const gg = bx.createLinearGradient(0,GROUND,0,H);
  gg.addColorStop(0,L.ground[0]); gg.addColorStop(1,L.ground[1]);
  bx.fillStyle=gg; bx.fillRect(0,GROUND,W,H-GROUND);
  drawGroundTexture(L);

  // distractores que van por detrás de props (vuelan alto o lejos)
  for(const d of game.distractors) if(d.fly) drawDistractor(L,d);

  // props detrás
  for(const p of game.props) drawPropBack(L,p);

  // enemigos + señuelos (camuflados), luego follaje frontal
  for(const d of game.decoys) drawDecoy(L,d);
  for(const e of game.enemies) drawEnemy(L,e);
  for(const c of game.corpses) drawCorpse(L,c);
  for(const p of game.props) drawPropFront(L,p);

  // distractores a ras de suelo (por delante)
  for(const d of game.distractors) if(!d.fly) drawDistractor(L,d);

  // trazadores de balas enemigas (hacia el observador)
  for(const tr of game.tracers){
    const a = clamp(tr.life/tr.max,0,1);
    bx.save(); bx.globalAlpha=a;
    bx.strokeStyle='#ffdf6a'; bx.lineWidth=1+ (1-a)*2;
    bx.beginPath(); bx.moveTo(tr.x, tr.y); bx.lineTo(W/2 + (tr.x-W/2)*(1-a)*0.4, H-2); bx.stroke();
    bx.fillStyle='#fff'; bx.globalAlpha=a*0.8; bx.beginPath(); bx.arc(tr.x,tr.y,1.5,0,6.3); bx.fill();
    bx.restore();
  }

  // impactos y partículas
  for(const h of game.holes){ bx.fillStyle='rgba(0,0,0,.5)'; bx.fillRect(h.x-1,h.y-1,2,2); }
  for(const p of game.puffs){
    bx.globalAlpha = clamp(p.life/p.max,0,1);
    bx.fillStyle=p.c; bx.fillRect(p.x|0,p.y|0,p.s,p.s);
    bx.globalAlpha=1;
  }

  // viñeta de escena
  const v = bx.createRadialGradient(W/2,H/2,80,W/2,H/2,300);
  v.addColorStop(0,'rgba(0,0,0,0)'); v.addColorStop(1,'rgba(0,0,0,.35)');
  bx.fillStyle=v; bx.fillRect(0,0,W,H);
}

function drawBackground(L){
  const hillCol = L.key==='sea' ? ['#0c6a7a','#0a5566','#084552'] : ['#7fae86','#6b9d74','#5a8a63'];
  for(const b of game.bg){
    if(b.type==='dune'){
      bx.fillStyle = ['#e9a860','#d9954f','#c9853f','#b97636'][b.c%4];
      bx.beginPath(); bx.moveTo(b.x,GROUND);
      bx.quadraticCurveTo(b.x+b.w/2, b.y, b.x+b.w, GROUND);
      bx.fill();
    } else if(b.type==='hill'){
      bx.fillStyle=hillCol[b.c%3];
      bx.beginPath(); bx.moveTo(-20,GROUND);
      for(let x=-20;x<=W+20;x+=20) bx.lineTo(x, b.y+Math.sin(x*0.03+b.c)*5);
      bx.lineTo(W+20,GROUND); bx.fill();
    } else if(b.type==='sky-build'){
      bx.fillStyle='#1c2338'; bx.fillRect(b.x,GROUND-b.h,b.w,b.h);
      bx.fillStyle='rgba(255,214,120,.5)';
      for(let yy=GROUND-b.h+4; yy<GROUND-4; yy+=6)
        for(let xx=b.x+3; xx<b.x+b.w-3; xx+=6)
          if(Math.random()<0.35) bx.fillRect(xx,yy,2,3);
    } else if(b.type==='moon'){
      bx.fillStyle='#f4f0d0'; bx.beginPath(); bx.arc(b.x,b.y,b.r,0,6.3); bx.fill();
    } else if(b.type==='sun2'){
      bx.fillStyle = b.pale ? '#f2f7ff' : '#fff2c0';
      bx.beginPath(); bx.arc(b.x,b.y,b.r,0,6.3); bx.fill();
      bx.globalAlpha=.22; bx.beginPath(); bx.arc(b.x,b.y,b.r*1.6,0,6.3); bx.fill(); bx.globalAlpha=1;
    } else if(b.type==='cloud'){
      bx.fillStyle='rgba(255,255,255,.85)';
      blob(b.x,b.y,b.w/2,b.w/5); blob(b.x-b.w*0.3,b.y+2,b.w/4,b.w/6); blob(b.x+b.w*0.3,b.y+2,b.w/4,b.w/6);
    } else if(b.type==='waterline'){
      bx.fillStyle='rgba(60,150,190,.55)'; bx.fillRect(0,b.y,W,GROUND-b.y);
      bx.fillStyle='rgba(255,255,255,.4)';
      for(let x=0;x<W;x+=8) bx.fillRect(x,b.y+((x*7)%4),3,1);
    } else if(b.type==='beam'){
      bx.globalAlpha=.10; bx.fillStyle='#bfefff';
      bx.beginPath(); bx.moveTo(b.x,0); bx.lineTo(b.x+b.w,0); bx.lineTo(b.x+b.w*2,GROUND); bx.lineTo(b.x+b.w,GROUND); bx.closePath(); bx.fill();
      bx.globalAlpha=1;
    } else if(b.type==='farfish'){
      bx.fillStyle='rgba(255,255,255,.18)';
      bx.beginPath(); bx.ellipse(b.x,b.y,4,2,0,0,6.3); bx.fill();
    } else if(b.type==='mountain'){
      bx.fillStyle='#9fb6c8';
      bx.beginPath(); bx.moveTo(b.x,GROUND); bx.lineTo(b.x+b.w/2,GROUND-b.h); bx.lineTo(b.x+b.w,GROUND); bx.fill();
      bx.fillStyle='#eef6fb';
      bx.beginPath(); bx.moveTo(b.x+b.w/2,GROUND-b.h); bx.lineTo(b.x+b.w*0.36,GROUND-b.h*0.6); bx.lineTo(b.x+b.w*0.5,GROUND-b.h*0.66); bx.lineTo(b.x+b.w*0.62,GROUND-b.h*0.58); bx.fill();
    } else if(b.type==='aurora'){
      for(let i=0;i<3;i++){ bx.globalAlpha=.10; bx.fillStyle=['#6effc9','#7ab8ff','#c98bff'][i];
        bx.beginPath(); bx.moveTo(0,b.y+i*6);
        for(let x=0;x<=W;x+=16) bx.lineTo(x,b.y+i*6+Math.sin(x*0.05+i)*7);
        bx.lineTo(W,b.y+i*6+16); bx.lineTo(0,b.y+i*6+16); bx.fill(); }
      bx.globalAlpha=1;
    } else if(b.type==='star'){
      const tw = 0.5+0.5*Math.abs(Math.sin(game.t*2+b.tw));
      bx.globalAlpha=tw; bx.fillStyle='#ffffff'; bx.fillRect(b.x,b.y,b.s,b.s); bx.globalAlpha=1;
    } else if(b.type==='planet'){
      bx.fillStyle='#c97a4a'; bx.beginPath(); bx.arc(b.x,b.y,b.r,0,6.3); bx.fill();
      bx.fillStyle='rgba(0,0,0,.2)'; bx.beginPath(); bx.arc(b.x+b.r*0.3,b.y,b.r*0.85,0,6.3); bx.fill();
      bx.strokeStyle='rgba(255,220,180,.5)'; bx.lineWidth=2;
      bx.beginPath(); bx.ellipse(b.x,b.y,b.r*1.7,b.r*0.5,0.4,0,6.3); bx.stroke();
    } else if(b.type==='nebula'){
      bx.globalAlpha=.15;
      bx.fillStyle='#7a3aa0'; blob(b.x,b.y,60,26);
      bx.fillStyle='#3a5aa0'; blob(b.x+30,b.y+8,40,18);
      bx.globalAlpha=1;
    } else if(b.type==='crater-h'){
      bx.fillStyle='rgba(0,0,0,.2)';
      bx.beginPath(); bx.ellipse(b.x,GROUND+3,b.w/2,3,0,0,6.3); bx.fill();
    } else if(b.type==='far-tower'){
      bx.fillStyle='#3a2f3a'; bx.fillRect(b.x,GROUND-b.h,b.w,b.h);
      for(let mx=b.x; mx<b.x+b.w; mx+=4) bx.fillRect(mx,GROUND-b.h-3,2,3); // almenas
      bx.fillStyle='#5a3a2a'; bx.beginPath(); bx.moveTo(b.x-1,GROUND-b.h); bx.lineTo(b.x+b.w/2,GROUND-b.h-8); bx.lineTo(b.x+b.w+1,GROUND-b.h); bx.fill();
    } else if(b.type==='window-moon'){
      bx.fillStyle='#0a0806'; bx.fillRect(b.x,b.y,b.w,b.h);           // hueco
      bx.fillStyle='#5a6a8a'; bx.fillRect(b.x+2,b.y+2,b.w-4,b.h-4);   // cielo nocturno
      bx.fillStyle='#c9d4e8'; bx.beginPath(); bx.arc(b.x+b.w*0.7,b.y+b.h*0.35,4,0,6.3); bx.fill(); // luna
      bx.fillStyle='#1a1512'; // barrotes/tablas
      bx.fillRect(b.x+b.w/2-1,b.y,2,b.h);
      bx.save(); bx.globalAlpha=.5; bx.fillStyle='#6a7a9a';
      bx.beginPath(); bx.moveTo(b.x,b.y+b.h); bx.lineTo(b.x+b.w,b.y+b.h); bx.lineTo(b.x+b.w+20,GROUND); bx.lineTo(b.x-20,GROUND); bx.fill(); // haz de luz
      bx.restore();
    } else if(b.type==='wall-crack'){
      bx.strokeStyle='rgba(0,0,0,.4)'; bx.lineWidth=1;
      bx.beginPath(); bx.moveTo(b.x,10);
      for(let y=10;y<GROUND;y+=14) bx.lineTo(b.x+rand(-8,8),y);
      bx.stroke();
    } else if(b.type==='picture'){
      bx.fillStyle='#3a2a1a'; bx.fillRect(b.x-8,b.y-10,16,20);
      bx.fillStyle='#5a4a3a'; bx.fillRect(b.x-6,b.y-8,12,16);
      bx.save(); bx.translate(b.x,b.y); bx.rotate(0.12); bx.fillStyle='#2a1f16'; bx.fillRect(-6,-8,12,16); bx.restore(); // torcido
    } else if(b.type==='cobweb'){
      bx.strokeStyle='rgba(220,220,230,.18)'; bx.lineWidth=1;
      const cx=b.x, cy=b.y, dir=b.x<W/2?1:-1;
      for(let a=0;a<4;a++){ bx.beginPath(); bx.moveTo(cx,cy); bx.lineTo(cx+dir*b.s*Math.cos(a*0.4), cy+b.s*Math.sin(a*0.4)); bx.stroke(); }
      for(let r=6;r<b.s;r+=6){ bx.beginPath(); bx.moveTo(cx+dir*r,cy); bx.quadraticCurveTo(cx+dir*r*0.7,cy+r*0.7,cx,cy+r); bx.stroke(); }
    } else if(b.type==='factory-window'){
      bx.fillStyle='#1a1d20'; bx.fillRect(b.x,b.y,b.w,b.h);                 // marco
      bx.fillStyle='#5b6570'; bx.fillRect(b.x+2,b.y+2,b.w-4,b.h-4);         // vidrio sucio
      bx.fillStyle='rgba(120,140,160,.35)';                                // reflejo diagonal
      bx.beginPath(); bx.moveTo(b.x+2,b.y+b.h-4); bx.lineTo(b.x+b.w*0.5,b.y+2); bx.lineTo(b.x+b.w*0.7,b.y+2); bx.lineTo(b.x+2,b.y+b.h-4); bx.fill();
      bx.strokeStyle='#14171a'; bx.lineWidth=1;                            // barrotes
      for(let gx=b.x+b.w/4; gx<b.x+b.w-2; gx+=b.w/4){ bx.beginPath(); bx.moveTo(gx,b.y+2); bx.lineTo(gx,b.y+b.h-2); bx.stroke(); }
      bx.beginPath(); bx.moveTo(b.x+2,b.y+b.h/2); bx.lineTo(b.x+b.w-2,b.y+b.h/2); bx.stroke();
      bx.fillStyle='#0a0c0e';                                              // cristales rotos
      bx.fillRect(b.x+b.w*0.55,b.y+b.h*0.2,3,4); bx.fillRect(b.x+b.w*0.2,b.y+b.h*0.6,4,3);
    } else if(b.type==='girder'){
      bx.fillStyle='#20242a'; bx.fillRect(0,b.y,W,4);                      // viga horizontal
      bx.fillStyle='rgba(0,0,0,.4)'; bx.fillRect(0,b.y+3,W,1);
      bx.fillStyle='#2a2f36'; for(let x=10;x<W;x+=40) bx.fillRect(x,b.y-4,3,4); // remaches verticales
    } else if(b.type==='chain'){
      bx.strokeStyle='#3a3f45'; bx.lineWidth=1;
      const sw=Math.sin(game.t*0.8+b.x)*1.5;
      for(let y=14;y<14+b.len;y+=3){ bx.beginPath(); bx.arc(b.x+sw*(y-14)/b.len,y,1.4,0,6.3); bx.stroke(); }
      if(Math.random()<1){ bx.fillStyle='#2a2d31'; bx.fillRect(b.x-2+sw,14+b.len,4,3); } // gancho
    } else if(b.type==='gauge'){
      bx.fillStyle='#2a2d31'; bx.beginPath(); bx.arc(b.x,b.y,5,0,6.3); bx.fill();
      bx.strokeStyle='#6a7078'; bx.lineWidth=1; bx.beginPath(); bx.arc(b.x,b.y,5,0,6.3); bx.stroke();
      bx.strokeStyle='#d9534a'; bx.beginPath(); bx.moveTo(b.x,b.y); bx.lineTo(b.x+3,b.y-2); bx.stroke(); // aguja
    } else if(b.type==='hazard'){
      for(let x=0;x<W;x+=10){ bx.fillStyle=((x/10)|0)%2?'#c9a227':'#1a1a1a'; bx.fillRect(x,b.y,10,3); }
      bx.globalAlpha=.25; bx.fillStyle='#000'; bx.fillRect(0,b.y,W,3); bx.globalAlpha=1;
    }
  }
  if(L.key==='desert'){ // sol
    bx.fillStyle='#ffe08a'; bx.beginPath(); bx.arc(W*0.7,54,20,0,6.3); bx.fill();
    bx.globalAlpha=.25; bx.beginPath(); bx.arc(W*0.7,54,30,0,6.3); bx.fill(); bx.globalAlpha=1;
  }
}

function drawGroundTexture(L){
  bx.save();
  if(L.key==='desert' || L.key==='beach'){
    bx.fillStyle = L.key==='beach' ? 'rgba(200,170,110,.4)' : 'rgba(140,100,50,.35)';
    for(let i=0;i<60;i++) bx.fillRect((i*97%W), GROUND+((i*53)%(H-GROUND)), 2,1);
    if(L.key==='beach'){ // espuma en la orilla
      bx.fillStyle='rgba(255,255,255,.5)';
      for(let x=0;x<W;x+=6) bx.fillRect(x, GROUND+2+((x*5)%3), 4,1);
    }
  } else if(L.key==='city'){
    bx.strokeStyle='rgba(255,255,255,.15)'; bx.lineWidth=1;
    for(let x=0;x<W;x+=30){ bx.beginPath(); bx.moveTo(x,GROUND+4); bx.lineTo(x-20,H); bx.stroke(); }
    bx.fillStyle='rgba(255,220,120,.4)';
    for(let x=10;x<W;x+=40) bx.fillRect(x,GROUND+18,10,2);
  } else if(L.key==='sea'){
    bx.fillStyle='rgba(90,70,40,.4)';
    for(let i=0;i<50;i++) bx.fillRect((i*83%W), GROUND+((i*47)%(H-GROUND)), 2,1);
    bx.fillStyle='rgba(255,120,60,.5)'; // estrellitas de mar
    for(let x=20;x<W;x+=70) bx.fillRect(x,GROUND+16,3,3);
  } else if(L.key==='ice'){
    bx.strokeStyle='rgba(150,180,210,.5)'; bx.lineWidth=1;
    for(let i=0;i<6;i++){ const x=rand(0,W); bx.beginPath(); bx.moveTo(x,GROUND+4); bx.lineTo(x+rand(-14,14),H); bx.stroke(); }
    bx.fillStyle='rgba(255,255,255,.8)';
    for(let i=0;i<40;i++) bx.fillRect((i*71%W), GROUND+((i*41)%(H-GROUND)), 1,1);
  } else if(L.key==='space'){
    bx.fillStyle='rgba(0,0,0,.3)';
    for(let i=0;i<6;i++){ const x=(i*79%W), y=GROUND+6+((i*29)%(H-GROUND-6)); bx.beginPath(); bx.ellipse(x,y,rand(4,9),rand(2,4),0,0,6.3); bx.fill(); }
    bx.fillStyle='rgba(180,150,210,.4)';
    for(let i=0;i<40;i++) bx.fillRect((i*67%W), GROUND+((i*43)%(H-GROUND)), 1,1);
  } else if(L.key==='castle'){
    // adoquines de piedra
    bx.strokeStyle='rgba(0,0,0,.22)'; bx.lineWidth=1;
    for(let y=GROUND+6;y<H;y+=8){ bx.beginPath(); bx.moveTo(0,y); bx.lineTo(W,y); bx.stroke();
      const off=((y/8)|0)%2?4:0;
      for(let x=off;x<W;x+=16){ bx.beginPath(); bx.moveTo(x,y); bx.lineTo(x,y+8); bx.stroke(); } }
  } else if(L.key==='abandoned'){
    // tablones de madera del piso
    bx.strokeStyle='rgba(0,0,0,.4)'; bx.lineWidth=1;
    for(let x=0;x<W;x+=22){ bx.beginPath(); bx.moveTo(x,GROUND); bx.lineTo(x-14,H); bx.stroke(); }
    for(let y=GROUND+10;y<H;y+=12){ bx.globalAlpha=.5; bx.beginPath(); bx.moveTo(0,y); bx.lineTo(W,y+4); bx.stroke(); bx.globalAlpha=1; }
    bx.fillStyle='rgba(80,60,40,.3)';
    for(let i=0;i<30;i++) bx.fillRect((i*53%W), GROUND+((i*31)%(H-GROUND)), 2,1);
  } else if(L.key==='factory'){
    // losas de hormigón con juntas y manchas de aceite
    bx.strokeStyle='rgba(0,0,0,.3)'; bx.lineWidth=1;
    for(let x=0;x<=W;x+=40){ bx.beginPath(); bx.moveTo(x,GROUND); bx.lineTo(x,H); bx.stroke(); }
    for(let y=GROUND+12;y<H;y+=14){ bx.beginPath(); bx.moveTo(0,y); bx.lineTo(W,y); bx.stroke(); }
    bx.fillStyle='rgba(0,0,0,.28)'; // charcos de aceite
    for(let i=0;i<4;i++){ const x=(i*97%W), y=GROUND+8+((i*37)%(H-GROUND-8)); bx.beginPath(); bx.ellipse(x,y,rand(6,12),rand(2,4),0,0,6.3); bx.fill(); }
    bx.fillStyle='rgba(150,120,60,.25)'; // óxido
    for(let i=0;i<24;i++) bx.fillRect((i*61%W), GROUND+((i*29)%(H-GROUND)), 2,1);
  } else {
    bx.fillStyle='rgba(20,40,15,.5)';
    for(let i=0;i<80;i++){ const x=(i*61%W), y=GROUND+((i*37)%(H-GROUND)); bx.fillRect(x,y,1,rand(2,4)); }
  }
  bx.restore();
}

// ---------- Props ----------
function drawPropBack(L,p){
  bx.save();
  if(p.type==='cactus'){
    bx.fillStyle='#4f7a3a'; bx.fillRect(p.x-p.w/2,GROUND-p.h,p.w,p.h);
    bx.fillRect(p.x-p.w/2-4,GROUND-p.h*0.6,4,p.h*0.35);
    bx.fillRect(p.x+p.w/2,GROUND-p.h*0.72,4,p.h*0.4);
    bx.fillRect(p.x-p.w/2-4,GROUND-p.h*0.6,3,-6);
    bx.fillRect(p.x+p.w/2+1,GROUND-p.h*0.72,3,-6);
    bx.fillStyle='rgba(0,0,0,.15)'; bx.fillRect(p.x+p.w/2-2,GROUND-p.h,2,p.h);
  } else if(p.type==='rock'){
    bx.fillStyle='#8a7a63'; bx.beginPath();
    bx.ellipse(p.x,GROUND-p.h/2,p.w/2,p.h/2,0,0,6.3); bx.fill();
    bx.fillStyle='rgba(0,0,0,.2)'; bx.beginPath(); bx.ellipse(p.x+2,GROUND-p.h/2+2,p.w/2.6,p.h/2.6,0,0,6.3); bx.fill();
  } else if(p.type==='bush' && L.key==='desert'){
    bx.fillStyle='#5c6b32'; blob(p.x,GROUND-p.h/2,p.w/2,p.h/2);
  } else if(p.type==='building'){
    bx.fillStyle='#4a4f5c'; bx.fillRect(p.x-p.w/2,GROUND-p.h,p.w,p.h);
    bx.fillStyle='#3a3f4a'; bx.fillRect(p.x-p.w/2,GROUND-p.h,p.w,3);
    // ventanas (patrón estable)
    let wi=0;
    for(let yy=GROUND-p.h+5; yy<GROUND-4; yy+=8)
      for(let xx=p.x-p.w/2+3; xx<p.x+p.w/2-3; xx+=8){
        bx.fillStyle = (p.lit&&p.lit[wi++])? '#ffd67a':'#22262f';
        bx.fillRect(xx,yy,4,5);
      }
  } else if(p.type==='car'){
    bx.fillStyle=p.tint||'#7a2a2a';
    bx.fillRect(p.x-p.w/2,GROUND-8,p.w,8);
    bx.fillRect(p.x-p.w/3,GROUND-14,p.w*0.66,7);
    bx.fillStyle='#111'; bx.beginPath(); bx.arc(p.x-p.w/3,GROUND,3,0,6.3); bx.arc(p.x+p.w/3,GROUND,3,0,6.3); bx.fill();
    bx.fillStyle='#bcd'; bx.fillRect(p.x-p.w/3+1,GROUND-13,p.w*0.6,4);
  } else if(p.type==='crate'){
    bx.fillStyle='#7a5a32'; bx.fillRect(p.x-p.w/2,GROUND-p.h,p.w,p.h);
    bx.strokeStyle='#5a4020'; bx.strokeRect(p.x-p.w/2+.5,GROUND-p.h+.5,p.w-1,p.h-1);
  } else if(p.type==='lamp'){
    bx.fillStyle='#2a2d35'; bx.fillRect(p.x-1,GROUND-p.h,3,p.h);
    bx.fillStyle='#ffe08a'; bx.beginPath(); bx.arc(p.x,GROUND-p.h,3,0,6.3); bx.fill();
    bx.globalAlpha=.2; bx.beginPath(); bx.arc(p.x,GROUND-p.h,8,0,6.3); bx.fill(); bx.globalAlpha=1;
  } else if(p.type==='tree'){
    bx.fillStyle='#4a3420'; bx.fillRect(p.x-p.w*0.14,GROUND-p.h*0.6,p.w*0.28,p.h*0.6);
    bx.fillStyle='#2f4a1e'; blob(p.x,GROUND-p.h*0.66,p.w*0.6,p.h*0.4);
    bx.fillStyle='#3a5a26'; blob(p.x-p.w*0.2,GROUND-p.h*0.72,p.w*0.4,p.h*0.3);
    bx.fillStyle='#274018'; blob(p.x+p.w*0.2,GROUND-p.h*0.6,p.w*0.4,p.h*0.3);
  } else if(p.type==='bush'){
    bx.fillStyle='#2f4a1e'; blob(p.x,GROUND-p.h/2,p.w/2,p.h/2);
    bx.fillStyle='#39591f'; blob(p.x-p.w*0.2,GROUND-p.h*0.55,p.w*0.3,p.h*0.4);
  } else if(p.type==='log'){
    bx.fillStyle='#4a3420'; bx.fillRect(p.x-p.w/2,GROUND-p.h,p.w,p.h);
    bx.fillStyle='#5c4228'; bx.beginPath(); bx.arc(p.x-p.w/2,GROUND-p.h/2,p.h/2,0,6.3); bx.fill();
  }
  // ---- PLAYA ----
  else if(p.type==='palm'){
    bx.fillStyle='#7a5a34'; bx.fillRect(p.x-2,GROUND-p.h,4,p.h);
    bx.fillStyle='#3f7a3a';
    for(let a=0;a<6;a++){ const ang=-Math.PI/2+(a-2.5)*0.55;
      bx.beginPath(); bx.moveTo(p.x,GROUND-p.h);
      bx.quadraticCurveTo(p.x+Math.cos(ang)*p.w, GROUND-p.h+Math.sin(ang)*10, p.x+Math.cos(ang)*p.w*1.5, GROUND-p.h+Math.sin(ang)*p.w*0.7+6);
      bx.lineWidth=3; bx.strokeStyle='#3f7a3a'; bx.stroke(); }
    bx.fillStyle='#5a3a1a'; bx.beginPath(); bx.arc(p.x,GROUND-p.h,3,0,6.3); bx.fill();
  } else if(p.type==='umbrella'){
    bx.fillStyle='#8a7a5a'; bx.fillRect(p.x-1,GROUND-p.h,2,p.h);
    const c1=p.tint||'#d94a4a';
    bx.fillStyle=c1; bx.beginPath(); bx.arc(p.x,GROUND-p.h,p.w/2,Math.PI,0); bx.fill();
    bx.fillStyle='rgba(255,255,255,.8)';
    bx.beginPath(); bx.arc(p.x,GROUND-p.h,p.w/2,Math.PI,Math.PI*1.25); bx.lineTo(p.x,GROUND-p.h); bx.fill();
    bx.beginPath(); bx.arc(p.x,GROUND-p.h,p.w/2,Math.PI*1.5,Math.PI*1.75); bx.lineTo(p.x,GROUND-p.h); bx.fill();
  } else if(p.type==='sandcastle'){
    bx.fillStyle='#d9be82'; bx.fillRect(p.x-p.w/2,GROUND-p.h,p.w,p.h);
    bx.fillRect(p.x-p.w/2,GROUND-p.h-4,4,4); bx.fillRect(p.x+p.w/2-4,GROUND-p.h-4,4,4);
    bx.fillRect(p.x-2,GROUND-p.h-6,4,6);
    bx.fillStyle='#e94a4a'; bx.fillRect(p.x,GROUND-p.h-6,4,3);
  } else if(p.type==='chair'){
    bx.strokeStyle='#c94a4a'; bx.lineWidth=2;
    bx.beginPath(); bx.moveTo(p.x-p.w/2,GROUND); bx.lineTo(p.x-p.w/6,GROUND-p.h); bx.lineTo(p.x+p.w/2,GROUND-p.h*0.4); bx.stroke();
    bx.fillStyle='rgba(201,74,74,.4)';
    bx.beginPath(); bx.moveTo(p.x-p.w/6,GROUND-p.h); bx.lineTo(p.x+p.w/2,GROUND-p.h*0.4); bx.lineTo(p.x+p.w/2,GROUND-p.h*0.4+3); bx.lineTo(p.x-p.w/6,GROUND-p.h+3); bx.fill();
  }
  // ---- BAJO EL MAR ----
  else if(p.type==='coral'){
    const c=p.tint||'#e0765a';
    bx.fillStyle=c; bx.fillRect(p.x-2,GROUND-p.h*0.5,4,p.h*0.5);
    bx.fillRect(p.x-p.w*0.4,GROUND-p.h*0.7,3,p.h*0.5);
    bx.fillRect(p.x+p.w*0.3,GROUND-p.h*0.8,3,p.h*0.6);
    bx.beginPath(); bx.arc(p.x-p.w*0.4,GROUND-p.h*0.7,3,0,6.3); bx.arc(p.x+p.w*0.3+1,GROUND-p.h*0.8,3,0,6.3); bx.arc(p.x,GROUND-p.h*0.5,3,0,6.3); bx.fill();
  } else if(p.type==='seaweed'){
    bx.strokeStyle='#2f7a4a'; bx.lineWidth=3;
    const wob=Math.sin(game.t*1.5+p.seed)*4;
    for(let k=-1;k<=1;k++){
      bx.beginPath(); bx.moveTo(p.x+k*4,GROUND);
      bx.quadraticCurveTo(p.x+k*4+wob, GROUND-p.h*0.5, p.x+k*4+wob*1.5, GROUND-p.h);
      bx.stroke();
    }
  } else if(p.type==='shell'){
    bx.fillStyle='#e8c0c8'; bx.beginPath(); bx.arc(p.x,GROUND,p.w/2,Math.PI,0); bx.fill();
    bx.strokeStyle='#c98a9a'; bx.lineWidth=1;
    for(let k=-2;k<=2;k++){ bx.beginPath(); bx.moveTo(p.x,GROUND); bx.lineTo(p.x+k*3,GROUND-p.w/2); bx.stroke(); }
  }
  // ---- HIELO ----
  else if(p.type==='iceblock'){
    bx.fillStyle='rgba(180,215,235,.9)'; bx.fillRect(p.x-p.w/2,GROUND-p.h,p.w,p.h);
    bx.fillStyle='rgba(255,255,255,.6)'; bx.fillRect(p.x-p.w/2,GROUND-p.h,p.w,3);
    bx.strokeStyle='rgba(255,255,255,.7)'; bx.strokeRect(p.x-p.w/2+.5,GROUND-p.h+.5,p.w-1,p.h-1);
  } else if(p.type==='icespike'){
    bx.fillStyle='rgba(190,225,240,.9)';
    bx.beginPath(); bx.moveTo(p.x-p.w/2,GROUND); bx.lineTo(p.x,GROUND-p.h); bx.lineTo(p.x+p.w/2,GROUND); bx.fill();
    bx.fillStyle='rgba(255,255,255,.5)';
    bx.beginPath(); bx.moveTo(p.x,GROUND-p.h); bx.lineTo(p.x-p.w*0.2,GROUND); bx.lineTo(p.x,GROUND); bx.fill();
  } else if(p.type==='snowtree'){
    bx.fillStyle='#5a4020'; bx.fillRect(p.x-2,GROUND-p.h*0.25,4,p.h*0.25);
    bx.fillStyle='#2f5a3a';
    for(let k=0;k<3;k++){ const yy=GROUND-p.h*0.25-k*p.h*0.24, ww=p.w*(1-k*0.22);
      bx.beginPath(); bx.moveTo(p.x-ww/2,yy); bx.lineTo(p.x,yy-p.h*0.3); bx.lineTo(p.x+ww/2,yy); bx.fill(); }
    bx.fillStyle='rgba(255,255,255,.85)'; // nieve encima
    for(let k=0;k<3;k++){ const yy=GROUND-p.h*0.25-k*p.h*0.24, ww=p.w*(1-k*0.22);
      bx.beginPath(); bx.moveTo(p.x-ww/2,yy); bx.lineTo(p.x,yy-p.h*0.3); bx.lineTo(p.x-ww*0.15,yy-p.h*0.14); bx.fill(); }
  } else if(p.type==='igloo'){
    bx.fillStyle='#e6f0f7'; bx.beginPath(); bx.arc(p.x,GROUND,p.w/2,Math.PI,0); bx.fill();
    bx.strokeStyle='rgba(150,180,210,.6)'; bx.lineWidth=1;
    for(let k=-2;k<=2;k++){ bx.beginPath(); bx.arc(p.x,GROUND,p.w/2-4-k*0,Math.PI,0); bx.stroke(); }
    bx.fillStyle='#9fbfd0'; bx.beginPath(); bx.arc(p.x-p.w*0.1,GROUND,p.w*0.16,Math.PI,0); bx.fill();
  }
  // ---- ESPACIO ----
  else if(p.type==='crystal'){
    const c=p.tint||'#8ab4ff';
    bx.fillStyle=c;
    bx.beginPath(); bx.moveTo(p.x,GROUND-p.h); bx.lineTo(p.x-p.w/2,GROUND-p.h*0.4); bx.lineTo(p.x-p.w*0.2,GROUND); bx.lineTo(p.x+p.w*0.2,GROUND); bx.lineTo(p.x+p.w/2,GROUND-p.h*0.4); bx.fill();
    bx.globalAlpha=.3; bx.fillStyle='#fff'; bx.beginPath(); bx.moveTo(p.x,GROUND-p.h); bx.lineTo(p.x-p.w/2,GROUND-p.h*0.4); bx.lineTo(p.x,GROUND); bx.fill(); bx.globalAlpha=1;
  } else if(p.type==='moonrock'){
    bx.fillStyle='#6a6076'; bx.beginPath(); bx.ellipse(p.x,GROUND-p.h/2,p.w/2,p.h/2,0,0,6.3); bx.fill();
    bx.fillStyle='rgba(0,0,0,.3)'; bx.beginPath(); bx.arc(p.x-p.w*0.15,GROUND-p.h*0.5,2,0,6.3); bx.arc(p.x+p.w*0.2,GROUND-p.h*0.6,1.5,0,6.3); bx.fill();
  } else if(p.type==='alienplant'){
    bx.fillStyle='#7a3a9a'; bx.fillRect(p.x-2,GROUND-p.h*0.6,4,p.h*0.6);
    bx.fillStyle='#b45ad0'; bx.beginPath(); bx.arc(p.x,GROUND-p.h*0.65,p.w*0.4,0,6.3); bx.fill();
    bx.fillStyle='#e08aff'; bx.beginPath(); bx.arc(p.x,GROUND-p.h*0.65,2,0,6.3); bx.fill();
    bx.fillStyle='#7a3a9a'; bx.fillRect(p.x-p.w*0.3,GROUND-p.h*0.4,3,p.h*0.4); bx.fillRect(p.x+p.w*0.3,GROUND-p.h*0.45,3,p.h*0.45);
  } else if(p.type==='debris'){
    bx.fillStyle='#8a8f9a'; bx.fillRect(p.x-p.w/2,GROUND-p.h,p.w,p.h);
    bx.fillStyle='#5a5f6a'; bx.fillRect(p.x-p.w/2,GROUND-p.h,p.w,3);
    bx.fillStyle='#2a2d35'; bx.fillRect(p.x-p.w*0.2,GROUND-p.h*0.6,p.w*0.4,p.h*0.4);
    bx.strokeStyle='#3a3d45'; bx.strokeRect(p.x-p.w/2+.5,GROUND-p.h+.5,p.w-1,p.h-1);
  }
  // ---- CASTILLOS ----
  else if(p.type==='tower'){
    bx.fillStyle='#6a6058'; bx.fillRect(p.x-p.w/2,GROUND-p.h,p.w,p.h);
    bx.fillStyle='#565049'; // sillería
    for(let yy=GROUND-p.h+4; yy<GROUND; yy+=8) for(let xx=p.x-p.w/2; xx<p.x+p.w/2; xx+=10) bx.strokeRect(xx+.5,yy+.5,10,8);
    bx.fillStyle='#5a544c'; for(let mx=p.x-p.w/2; mx<p.x+p.w/2-2; mx+=8) bx.fillRect(mx,GROUND-p.h-5,5,5); // almenas
    bx.fillStyle='#1a1510'; bx.fillRect(p.x-2,GROUND-p.h*0.6,4,7); // saetera
    bx.fillStyle='#2a1a10'; bx.fillRect(p.x-p.w*0.2,GROUND-10,p.w*0.4,10); // puerta
  } else if(p.type==='wall'){
    bx.fillStyle='#6a6058'; bx.fillRect(p.x-p.w/2,GROUND-p.h,p.w,p.h);
    bx.strokeStyle='rgba(0,0,0,.25)'; bx.lineWidth=1;
    for(let yy=GROUND-p.h+5; yy<GROUND; yy+=7) bx.strokeRect(p.x-p.w/2+.5,yy+.5,p.w-1,7);
    bx.fillStyle='#5a544c'; for(let mx=p.x-p.w/2; mx<p.x+p.w/2-2; mx+=10) bx.fillRect(mx,GROUND-p.h-5,6,5); // almenas
  } else if(p.type==='barrel'){
    bx.fillStyle=p.tint||'#6a4a28'; bx.fillRect(p.x-p.w/2,GROUND-p.h,p.w,p.h);
    bx.strokeStyle='#3a2a16'; bx.lineWidth=1;
    bx.strokeRect(p.x-p.w/2+.5,GROUND-p.h+.5,p.w-1,p.h-1);
    bx.beginPath(); bx.moveTo(p.x-p.w/2,GROUND-p.h*0.66); bx.lineTo(p.x+p.w/2,GROUND-p.h*0.66);
    bx.moveTo(p.x-p.w/2,GROUND-p.h*0.33); bx.lineTo(p.x+p.w/2,GROUND-p.h*0.33); bx.stroke();
  } else if(p.type==='well'){
    bx.fillStyle='#5a544c'; bx.fillRect(p.x-p.w/2,GROUND-p.h,p.w,p.h);
    bx.fillStyle='#1a1510'; bx.fillRect(p.x-p.w*0.35,GROUND-p.h,p.w*0.7,p.h*0.5);
    bx.strokeStyle='#3a2a1a'; bx.lineWidth=2; // tejadillo
    bx.beginPath(); bx.moveTo(p.x-p.w/2-2,GROUND-p.h-2); bx.lineTo(p.x,GROUND-p.h-12); bx.lineTo(p.x+p.w/2+2,GROUND-p.h-2); bx.stroke();
    bx.fillStyle='#3a2a1a'; bx.fillRect(p.x-1,GROUND-p.h-12,2,12);
  } else if(p.type==='banner'){
    bx.fillStyle='#3a2a1a'; bx.fillRect(p.x-1,GROUND-p.h,2,p.h);
    bx.fillStyle=p.tint||'#a33';
    const wob=Math.sin(game.t*2+p.seed)*2;
    bx.beginPath(); bx.moveTo(p.x+1,GROUND-p.h); bx.lineTo(p.x+12+wob,GROUND-p.h+4); bx.lineTo(p.x+1,GROUND-p.h+14); bx.fill();
  }
  // ---- CASA ABANDONADA ----
  else if(p.type==='shelf'){
    bx.fillStyle='#3a2a1a'; bx.fillRect(p.x-p.w/2,GROUND-p.h,p.w,p.h);
    bx.fillStyle='#2a1e12';
    for(let yy=GROUND-p.h+6; yy<GROUND-2; yy+=9){ bx.fillRect(p.x-p.w/2+1,yy,p.w-2,2);
      for(let xx=p.x-p.w/2+2; xx<p.x+p.w/2-3; xx+=5) if(Math.random()<0.6){ bx.fillStyle=pick(['#5a3a2a','#3a4a5a','#5a5030']); bx.fillRect(xx,yy-6,3,6); bx.fillStyle='#2a1e12'; } }
  } else if(p.type==='sofa'){
    bx.fillStyle=p.tint||'#5a3a4a'; bx.fillRect(p.x-p.w/2,GROUND-p.h,p.w,p.h);
    bx.fillRect(p.x-p.w/2,GROUND-p.h-4,4,p.h*0.6); bx.fillRect(p.x+p.w/2-4,GROUND-p.h-4,4,p.h*0.6);
    bx.fillStyle='rgba(0,0,0,.3)'; bx.fillRect(p.x-p.w*0.1,GROUND-p.h+2,4,3); // roto
    bx.fillStyle='rgba(255,255,255,.06)'; bx.fillRect(p.x-p.w/2,GROUND-p.h,p.w,2);
  } else if(p.type==='fireplace'){
    bx.fillStyle='#4a3a30'; bx.fillRect(p.x-p.w/2,GROUND-p.h,p.w,p.h);
    bx.fillStyle='#3a2c22'; for(let yy=GROUND-p.h; yy<GROUND; yy+=5) for(let xx=p.x-p.w/2+((yy/5|0)%2?4:0); xx<p.x+p.w/2; xx+=8) bx.strokeRect(xx+.5,yy+.5,8,5);
    bx.fillStyle='#0a0806'; bx.fillRect(p.x-p.w*0.3,GROUND-p.h*0.7,p.w*0.6,p.h*0.7); // hueco
    bx.fillStyle='#7a3a1a'; bx.globalAlpha=.5+.3*Math.sin(game.t*6+p.seed); // brasas tenues
    bx.fillRect(p.x-p.w*0.2,GROUND-6,p.w*0.4,4); bx.globalAlpha=1;
  } else if(p.type==='doorway'){
    bx.fillStyle='#2a2018'; bx.fillRect(p.x-p.w/2,GROUND-p.h,p.w,p.h); // marco
    bx.fillStyle='#050403'; bx.fillRect(p.x-p.w/2+3,GROUND-p.h+3,p.w-6,p.h-3); // oscuridad
    bx.fillStyle='#3a2c1e'; bx.fillRect(p.x-p.w/2,GROUND-p.h,p.w,3);
  } else if(p.type==='column'){
    bx.fillStyle='#5a5048'; bx.fillRect(p.x-p.w/2,GROUND-p.h,p.w,p.h);
    bx.fillStyle='rgba(0,0,0,.25)'; bx.fillRect(p.x+p.w/2-2,GROUND-p.h,2,p.h);
    bx.fillStyle='rgba(255,255,255,.08)'; bx.fillRect(p.x-p.w/2,GROUND-p.h,2,p.h);
    bx.fillStyle='#4a4038'; bx.fillRect(p.x-p.w/2-2,GROUND-p.h,p.w+4,4); bx.fillRect(p.x-p.w/2-2,GROUND-6,p.w+4,6);
  } else if(p.type==='window'){
    bx.fillStyle='#2a2018'; bx.fillRect(p.x-p.w/2,GROUND-p.h,p.w,p.h);
    bx.fillStyle='#0a1420'; bx.fillRect(p.x-p.w/2+3,GROUND-p.h+3,p.w-6,p.h-6);
    bx.strokeStyle='#4a3826'; bx.lineWidth=2; // tablas cruzadas
    bx.beginPath(); bx.moveTo(p.x-p.w/2+2,GROUND-p.h+4); bx.lineTo(p.x+p.w/2-2,GROUND-6);
    bx.moveTo(p.x+p.w/2-2,GROUND-p.h+4); bx.lineTo(p.x-p.w/2+2,GROUND-6); bx.stroke();
  }
  // ---- FÁBRICA ABANDONADA ----
  else if(p.type==='machine'){
    bx.fillStyle=p.tint||'#565b62'; bx.fillRect(p.x-p.w/2,GROUND-p.h,p.w,p.h);
    bx.fillStyle='rgba(255,255,255,.06)'; bx.fillRect(p.x-p.w/2,GROUND-p.h,p.w,2);
    bx.fillStyle='rgba(0,0,0,.3)'; bx.fillRect(p.x+p.w/2-3,GROUND-p.h,3,p.h);
    bx.strokeStyle='#2a2d31'; bx.lineWidth=1; // rejilla de ventilación
    for(let yy=GROUND-p.h+6; yy<GROUND-6; yy+=4){ bx.beginPath(); bx.moveTo(p.x-p.w/2+4,yy); bx.lineTo(p.x-2,yy); bx.stroke(); }
    bx.fillStyle='#8a9098'; bx.beginPath(); bx.arc(p.x+p.w*0.25,GROUND-p.h*0.6,3,0,6.3); bx.fill(); // dial
    bx.strokeStyle='#d9534a'; bx.beginPath(); bx.moveTo(p.x+p.w*0.25,GROUND-p.h*0.6); bx.lineTo(p.x+p.w*0.25+2,GROUND-p.h*0.6-2); bx.stroke();
    bx.fillStyle='#3a3f45'; bx.fillRect(p.x-p.w*0.2,GROUND-p.h-6,4,6); // tubo superior
    bx.fillStyle=(Math.sin(game.t*3+p.seed)>0)?'#3cff6e':'#173a24'; bx.fillRect(p.x+p.w*0.32,GROUND-p.h+4,2,2); // piloto
  } else if(p.type==='tank'){
    bx.fillStyle=p.tint||'#4a5258'; bx.fillRect(p.x-p.w/2,GROUND-p.h,p.w,p.h);
    bx.beginPath(); bx.ellipse(p.x,GROUND-p.h,p.w/2,4,0,Math.PI,0); bx.fill(); // domo
    bx.fillStyle='rgba(255,255,255,.10)'; bx.fillRect(p.x-p.w/2,GROUND-p.h,3,p.h);
    bx.fillStyle='rgba(0,0,0,.28)'; bx.fillRect(p.x+p.w/2-3,GROUND-p.h,3,p.h);
    bx.strokeStyle='rgba(0,0,0,.3)'; bx.lineWidth=1;
    for(let yy=GROUND-p.h+8; yy<GROUND; yy+=10){ bx.beginPath(); bx.moveTo(p.x-p.w/2,yy); bx.lineTo(p.x+p.w/2,yy); bx.stroke(); }
    bx.fillStyle='#3a3f45'; bx.fillRect(p.x+p.w/2,GROUND-p.h*0.5,5,3); // tubería
    bx.fillStyle='#c9a227'; bx.beginPath(); bx.moveTo(p.x,GROUND-p.h*0.58); bx.lineTo(p.x-4,GROUND-p.h*0.42); bx.lineTo(p.x+4,GROUND-p.h*0.42); bx.fill(); // ⚠
    bx.fillStyle='#000'; bx.fillRect(p.x-0.5,GROUND-p.h*0.52,1,2);
  } else if(p.type==='pillar'){
    bx.fillStyle='#4a4e54'; bx.fillRect(p.x-p.w/2,GROUND-p.h,p.w,p.h);
    bx.fillStyle='#3a3d42'; bx.fillRect(p.x-p.w/2,GROUND-p.h,3,p.h); bx.fillRect(p.x+p.w/2-3,GROUND-p.h,3,p.h); // viga en I
    bx.fillStyle='rgba(255,255,255,.06)'; bx.fillRect(p.x-p.w*0.15,GROUND-p.h,2,p.h);
    bx.fillStyle='#2a2d31'; for(let yy=GROUND-p.h+6; yy<GROUND; yy+=12){ bx.fillRect(p.x-p.w*0.35,yy,2,2); bx.fillRect(p.x+p.w*0.25,yy,2,2); }
    bx.fillStyle='rgba(150,90,40,.35)'; bx.fillRect(p.x-p.w/2,GROUND-8,p.w,8); // óxido base
  } else if(p.type==='conveyor'){
    bx.fillStyle='#3a3f45'; bx.fillRect(p.x-p.w/2,GROUND-p.h,p.w,4); // cinta
    bx.fillStyle='#2a2d31'; bx.fillRect(p.x-p.w/2,GROUND-p.h+4,p.w,3);
    bx.fillStyle='#565b62'; bx.beginPath(); bx.arc(p.x-p.w/2+3,GROUND-p.h+2,3,0,6.3); bx.arc(p.x+p.w/2-3,GROUND-p.h+2,3,0,6.3); bx.fill(); // rodillos
    bx.fillStyle='#3a3f45'; bx.fillRect(p.x-p.w/2+4,GROUND-p.h+6,3,p.h-6); bx.fillRect(p.x+p.w/2-7,GROUND-p.h+6,3,p.h-6); // patas
    bx.fillStyle='#6a5a3a'; bx.fillRect(p.x-p.w*0.2,GROUND-p.h-6,8,6); // caja encima
  } else if(p.type==='panel'){
    bx.fillStyle=p.tint||'#5a5248'; bx.fillRect(p.x-p.w/2,GROUND-p.h,p.w,p.h);
    bx.fillStyle='#2a2d31'; bx.fillRect(p.x-p.w/2,GROUND-p.h,p.w,3);
    bx.fillStyle='#0a2a1a'; bx.fillRect(p.x-p.w*0.35,GROUND-p.h+5,p.w*0.7,p.h*0.35); // pantalla
    bx.fillStyle='rgba(60,255,110,.5)';
    for(let k=0;k<4;k++){ const yy=GROUND-p.h+7+k*3; bx.fillRect(p.x-p.w*0.3, yy, p.w*0.5*(0.4+0.5*Math.abs(Math.sin(p.seed+k))), 1); }
    const cols=['#d9534a','#c9a227','#3cff6e'];
    for(let i=0;i<3;i++){ bx.fillStyle=cols[i]; bx.beginPath(); bx.arc(p.x-p.w*0.25+i*p.w*0.25,GROUND-p.h*0.28,2,0,6.3); bx.fill(); }
  }
  bx.restore();
}

// follaje frontal que tapa parcialmente al enemigo (camuflaje)
const ROCK_FRONT = { desert:'#4f6b2e', beach:'#b39a63', sea:'#5a7a5a', space:'#5a5066', forest:'#26401a' };
function drawPropFront(L,p){
  if(!p.hides) return;
  bx.save();
  bx.globalAlpha=0.96;
  if(p.type==='cactus'){
    bx.fillStyle='#5c8a44'; bx.fillRect(p.x-2,GROUND-p.h,4,p.h*0.5);
  } else if(p.type==='bush'){
    bx.fillStyle = L.key==='desert' ? '#4f6b2e' : '#26401a';
    blob(p.x, GROUND-p.h*0.4, p.w*0.55, p.h*0.5);
  } else if(p.type==='rock' || p.type==='moonrock'){
    bx.fillStyle = ROCK_FRONT[L.key] || '#4f6b2e';
    blob(p.x, GROUND-p.h*0.35, p.w*0.5, p.h*0.45);
  } else if(p.type==='tree'){
    bx.fillStyle='#243c16';
    blob(p.x-p.w*0.1, GROUND-p.h*0.5, p.w*0.5, p.h*0.32);
    blob(p.x+p.w*0.25, GROUND-p.h*0.3, p.w*0.3, p.h*0.25);
  } else if(p.type==='building'){
    bx.fillStyle='#3a3f4a'; bx.fillRect(p.x-p.w/2-1,GROUND-4,p.w+2,4); // saliente base
  } else if(p.type==='car'){
    bx.fillStyle='rgba(0,0,0,.25)'; bx.fillRect(p.x-p.w/2,GROUND-2,p.w,2);
  }
  // playa
  else if(p.type==='palm'){
    bx.fillStyle='#6a4a28'; bx.fillRect(p.x-2,GROUND-p.h*0.4,4,p.h*0.4);
  } else if(p.type==='umbrella' || p.type==='sandcastle'){
    bx.fillStyle = p.type==='umbrella' ? 'rgba(120,110,90,.5)' : '#c9ac6f';
    bx.fillRect(p.x-p.w*0.35, GROUND-p.h*0.3, p.w*0.7, p.h*0.3);
  }
  // mar
  else if(p.type==='coral'){
    bx.fillStyle='#c95a6a'; bx.fillRect(p.x-p.w*0.4,GROUND-p.h*0.35,3,p.h*0.35);
    bx.fillRect(p.x+p.w*0.3,GROUND-p.h*0.4,3,p.h*0.4);
  } else if(p.type==='seaweed'){
    bx.strokeStyle='#256a3a'; bx.lineWidth=3;
    const wob=Math.sin(game.t*1.5+p.seed+1)*4;
    bx.beginPath(); bx.moveTo(p.x+3,GROUND); bx.quadraticCurveTo(p.x+3+wob,GROUND-p.h*0.5,p.x+3+wob,GROUND-p.h*0.75); bx.stroke();
  }
  // hielo
  else if(p.type==='iceblock' || p.type==='icespike'){
    bx.fillStyle='rgba(200,225,240,.75)'; bx.fillRect(p.x-p.w*0.2, GROUND-p.h*0.5, p.w*0.4, p.h*0.5);
  } else if(p.type==='snowtree'){
    bx.fillStyle='#2a4a30';
    bx.beginPath(); bx.moveTo(p.x-p.w*0.4,GROUND-p.h*0.2); bx.lineTo(p.x,GROUND-p.h*0.5); bx.lineTo(p.x+p.w*0.4,GROUND-p.h*0.2); bx.fill();
  } else if(p.type==='igloo'){
    bx.fillStyle='#d0dce7'; bx.beginPath(); bx.arc(p.x,GROUND,p.w*0.42,Math.PI,0); bx.fill();
  }
  // espacio
  else if(p.type==='crystal'){
    bx.fillStyle='rgba(150,220,255,.6)';
    bx.beginPath(); bx.moveTo(p.x,GROUND-p.h*0.7); bx.lineTo(p.x-p.w*0.25,GROUND); bx.lineTo(p.x+p.w*0.25,GROUND); bx.fill();
  } else if(p.type==='alienplant'){
    bx.fillStyle='#8a3aaa'; bx.fillRect(p.x-p.w*0.3,GROUND-p.h*0.3,3,p.h*0.3); bx.fillRect(p.x+p.w*0.3,GROUND-p.h*0.32,3,p.h*0.32);
  } else if(p.type==='debris'){
    bx.fillStyle='#6a6f7a'; bx.fillRect(p.x-p.w/2-1,GROUND-3,p.w+2,3);
  }
  // castillos
  else if(p.type==='tower' || p.type==='wall'){
    bx.fillStyle='#5a544c'; bx.fillRect(p.x-p.w/2-1,GROUND-4,p.w+2,4); // base saliente
  } else if(p.type==='barrel'){
    bx.fillStyle=p.tint||'#5a3e20'; bx.fillRect(p.x-p.w*0.2,GROUND-p.h*0.4,p.w*0.4,p.h*0.4);
  } else if(p.type==='well'){
    bx.fillStyle='#4a443c'; bx.fillRect(p.x-p.w/2-1,GROUND-p.h*0.4,p.w+2,p.h*0.4);
  }
  // casa abandonada
  else if(p.type==='sofa' || p.type==='fireplace'){
    bx.fillStyle = p.type==='sofa' ? (p.tint||'#5a3a4a') : '#3a2c22';
    bx.fillRect(p.x-p.w*0.4,GROUND-p.h*0.35,p.w*0.8,p.h*0.35);
  } else if(p.type==='shelf'){
    bx.fillStyle='#2a1e12'; bx.fillRect(p.x-p.w/2,GROUND-p.h*0.3,p.w,p.h*0.3);
  } else if(p.type==='doorway'){
    bx.fillStyle='#050403'; bx.fillRect(p.x-p.w/2+3,GROUND-p.h*0.4,p.w-6,p.h*0.4); // sombra que oculta
  } else if(p.type==='column'){
    bx.fillStyle='#4a4038'; bx.fillRect(p.x-p.w/2,GROUND-6,p.w,6);
  }
  // fábrica
  else if(p.type==='machine' || p.type==='panel'){
    bx.fillStyle='#2a2d31'; bx.fillRect(p.x-p.w/2-1,GROUND-5,p.w+2,5);
  } else if(p.type==='tank'){
    bx.fillStyle='#3a3f45'; bx.fillRect(p.x-p.w*0.4,GROUND-p.h*0.35,p.w*0.8,3); // tubería que cruza
    bx.fillStyle='#2a2d31'; bx.fillRect(p.x-p.w/2-1,GROUND-4,p.w+2,4);
  } else if(p.type==='pillar'){
    bx.fillStyle='#3a3d42'; bx.fillRect(p.x-p.w/2-2,GROUND-6,p.w+4,6); // placa base
  } else if(p.type==='conveyor'){
    bx.fillStyle='#2a2d31'; bx.fillRect(p.x-p.w/2,GROUND-p.h*0.5,p.w,2); // riel delantero
  }
  bx.restore();
}

function blob(cx,cy,rx,ry){
  bx.beginPath(); bx.ellipse(cx,cy,Math.abs(rx),Math.abs(ry),0,0,6.3); bx.fill();
}

// ---------- Figura humana (soldado) ----------
function humanShape(x, baseY, h, reveal, camo, opts={}){
  const w = h*0.42;
  const headR = h*0.16;
  const top = baseY - h;
  // color: mezcla camuflaje -> silueta visible
  const rr = clamp(reveal,0,1);
  bx.save();
  bx.globalAlpha = clamp(0.30 + rr*0.68, 0, 1);
  const col = mix(camo, opts.dead?'#7a1414':'#20160f', rr);
  bx.fillStyle = col;
  // piernas
  bx.fillRect(x-w*0.28, top+h*0.55, w*0.22, h*0.45);
  bx.fillRect(x+w*0.06, top+h*0.55, w*0.22, h*0.45);
  // torso
  bx.fillRect(x-w*0.30, top+h*0.30, w*0.60, h*0.32);
  // cabeza
  bx.beginPath(); bx.arc(x, top+headR, headR, 0, 6.3); bx.fill();
  // casco / detalle visible cuando reveal alto
  if(rr>0.4){
    bx.globalAlpha = clamp((rr-0.4)*1.6,0,1);
    bx.fillStyle = opts.dead? '#a33' : mix(camo,'#3a2a18',1);
    bx.fillRect(x-headR, top+headR*0.4, headR*2, headR*0.7); // banda del casco
    // rifle asomando
    if(!opts.dead){
      bx.strokeStyle='#15100a'; bx.lineWidth=1.2;
      bx.beginPath();
      bx.moveTo(x+w*0.1, top+h*0.36);
      if(opts.aiming){
        // te apunta: cañón hacia el observador (abajo-frente)
        bx.lineTo(x + (opts.lean||0)*1.5 + w*1.1, top+h*0.55);
      } else {
        bx.lineTo(x + (opts.lean||0)*1.5 + w*0.9, top+h*0.24);
      }
      bx.stroke();
    }
  }
  bx.restore();
  return { x, top, w, h, headR };
}

function mix(c1,c2,t){
  const a=hex(c1), b=hex(c2);
  return `rgb(${lerp(a[0],b[0],t)|0},${lerp(a[1],b[1],t)|0},${lerp(a[2],b[2],t)|0})`;
}
function hex(c){
  if(c[0]==='#'){ const n=parseInt(c.slice(1),16); return [(n>>16)&255,(n>>8)&255,n&255]; }
  const m=c.match(/\d+/g); return m?m.map(Number):[0,0,0];
}

function drawEnemy(L,e){
  if(!e.alive){ return; } // el cadáver se dibuja aparte
  // agachado detrás de la cobertura: silueta más baja
  const hh = e.ducking ? e.h*0.55 : e.h;
  const box = humanShape(e.x, e.y, hh, e.reveal, L.camo, {lean:e.lean, aiming:e.aiming});
  e._box = box;
  // destello sutil cuando se asoma mucho (pista extra de movimiento)
  if(e.peeking && e.reveal>0.55){
    bx.globalAlpha=clamp((e.reveal-0.55)*0.6,0,.3);
    bx.fillStyle='#fff'; bx.fillRect(box.x-1, box.top+box.headR, 2, 2);
    bx.globalAlpha=1;
  }
  // marcador de puntería: destello rojo del cañón apuntándote
  if(e.aiming){
    const pulse = 0.5+0.5*Math.sin(game.t*22);
    bx.save();
    bx.globalAlpha = 0.5+0.5*pulse;
    bx.fillStyle='#ff2b2b';
    bx.beginPath(); bx.arc(box.x, box.top+box.headR*1.2, 2+pulse, 0, 6.3); bx.fill();
    bx.globalAlpha = 0.25*pulse; bx.beginPath(); bx.arc(box.x, box.top+box.headR*1.2, 6+pulse*3, 0, 6.3); bx.fill();
    bx.restore();
  }
}

function drawDecoy(L,d){
  if(!d.alive){
    // señuelo destruido: cae y muestra que era falso
    const box = humanShape(d.x, d.y, d.h, 0.9, '#8a7a3a', {dead:false});
    bx.save(); bx.globalAlpha=clamp(1-d.shatterT,0,1);
    bx.strokeStyle='#c9b24a'; bx.lineWidth=1;
    bx.strokeRect(box.x-box.w*0.4, box.top, box.w*0.8, d.h); // marco de madera
    bx.restore();
    return;
  }
  const sway = Math.sin(d.sway)*0.4;
  d._box = humanShape(d.x+sway, d.y, d.h, d.reveal, L.camo, {});
}

function drawCorpse(L,c){
  bx.save();
  const t = clamp(c.t,0,1);
  bx.translate(c.x, c.y);
  bx.rotate(t*1.3*c.dir);
  bx.translate(-c.x, -c.y);
  humanShape(c.x, c.y, c.h, 1, L.camo, {dead:true});
  bx.restore();
  // sangre pixel
  bx.fillStyle='rgba(150,20,20,.6)';
  bx.fillRect(c.x-2, c.y-1, 5, 1);
}

// ---------- Distractores ----------
function drawDistractor(L,d){
  bx.save();
  if(!d.alive){
    bx.translate(d.x,d.y); bx.rotate(d.rot||0); bx.translate(-d.x,-d.y);
    bx.globalAlpha = clamp(1.35-(d.deadT||0),0,1);
  } else if(d.hitT>0){ bx.globalAlpha = 0.4+0.6*Math.abs(Math.sin(d.hitT*40)); }
  const flap = Math.sin(d.phase)*3;
  if(d.type==='bird' || d.type==='pigeon'){
    bx.fillStyle = d.type==='pigeon'?'#c9cdd6':'#2a2a2a';
    bx.beginPath();
    bx.moveTo(d.x-4, d.y+flap); bx.lineTo(d.x, d.y-1); bx.lineTo(d.x+4, d.y+flap);
    bx.lineTo(d.x, d.y+1); bx.closePath(); bx.fill();
  } else if(d.type==='butterfly'){
    bx.fillStyle=d.tint||'#ff8';
    const s=1+Math.abs(Math.sin(d.phase))*1.5;
    bx.fillRect(d.x-2,d.y-1,2,s); bx.fillRect(d.x,d.y-1,2,s);
  } else if(d.type==='tumbleweed'){
    bx.strokeStyle='#8a7038'; bx.lineWidth=1;
    bx.save(); bx.translate(d.x,d.y-4); bx.rotate(d.x*0.2);
    for(let i=0;i<6;i++){ bx.beginPath(); bx.moveTo(0,0); bx.lineTo(Math.cos(i)*5,Math.sin(i*1.5)*5); bx.stroke(); }
    bx.restore();
    bx.strokeStyle='rgba(138,112,56,.6)'; bx.beginPath(); bx.arc(d.x,d.y-4,5,0,6.3); bx.stroke();
  } else if(d.type==='lizard'){
    bx.fillStyle='#7a6a3a'; bx.fillRect(d.x-4,d.y-2,8,2);
    bx.fillRect(d.x+3*d.dir,d.y-2,3,1);
  } else if(d.type==='cat'){
    bx.fillStyle='#2a2a2a';
    bx.fillRect(d.x-4,d.y-4,8,4); bx.fillRect(d.x+3*d.dir,d.y-6,2,3);
    bx.fillRect(d.x-5*d.dir,d.y-6,2,2);
  } else if(d.type==='squirrel'){
    bx.fillStyle='#8a5a2a'; bx.fillRect(d.x-3,d.y-3,5,3);
    bx.beginPath(); bx.arc(d.x-4*d.dir,d.y-4,3,0,6.3); bx.fill();
  } else if(d.type==='deer'){
    bx.fillStyle='#8a6a42'; bx.fillRect(d.x-8,d.y-10,14,7);
    bx.fillRect(d.x-8,d.y-8,2,8); bx.fillRect(d.x+4,d.y-8,2,8);
    bx.fillRect(d.x+6*d.dir,d.y-14,3,6); // cuello/cabeza
    bx.strokeStyle='#5a4020'; bx.beginPath(); bx.moveTo(d.x+7*d.dir,d.y-14); bx.lineTo(d.x+9*d.dir,d.y-18); bx.stroke();
  } else if(d.type==='pedestrian' || d.type==='beachgoer'){
    const walk=Math.sin(d.phase)*2;
    bx.fillStyle=d.tint||'#c94';
    bx.fillRect(d.x-2,d.y-14,4,8);
    bx.beginPath(); bx.arc(d.x,d.y-16,2.5,0,6.3); bx.fill();
    bx.fillStyle= d.type==='beachgoer' ? '#e8c090' : '#222';
    bx.fillRect(d.x-2,d.y-6,2,6+walk*0.2); bx.fillRect(d.x,d.y-6,2,6-walk*0.2);
  }
  // ---- MAR ----
  else if(d.type==='fish'){
    bx.fillStyle=d.dir>0?'#e0a24a':'#4ab0e0';
    bx.beginPath(); bx.ellipse(d.x,d.y,4,2.5,0,0,6.3); bx.fill();
    bx.beginPath(); bx.moveTo(d.x-4*d.dir,d.y); bx.lineTo(d.x-7*d.dir,d.y-2); bx.lineTo(d.x-7*d.dir,d.y+2); bx.fill();
  } else if(d.type==='jellyfish'){
    bx.globalAlpha*=0.8; bx.fillStyle='#d98ad0';
    bx.beginPath(); bx.arc(d.x,d.y,4,Math.PI,0); bx.fill();
    bx.strokeStyle='#d98ad0'; bx.lineWidth=1;
    for(let k=-2;k<=2;k++){ bx.beginPath(); bx.moveTo(d.x+k*1.5,d.y); bx.lineTo(d.x+k*1.5+Math.sin(d.phase+k)*1.5,d.y+5+Math.abs(k)); bx.stroke(); }
  } else if(d.type==='turtle'){
    bx.fillStyle='#3f7a5a'; bx.beginPath(); bx.ellipse(d.x,d.y,6,4,0,0,6.3); bx.fill();
    bx.fillStyle='#2a5a3a'; bx.beginPath(); bx.arc(d.x,d.y,4,Math.PI,0); bx.fill();
    bx.fillStyle='#5a9a6a'; bx.fillRect(d.x+5*d.dir,d.y-1,3,2);
    const fl=Math.sin(d.phase)*1.5; bx.fillRect(d.x-2,d.y+3+fl,2,2); bx.fillRect(d.x+2,d.y+3-fl,2,2);
  }
  // ---- PLAYA ----
  else if(d.type==='seagull'){
    bx.strokeStyle='#eee'; bx.lineWidth=1.5;
    bx.beginPath(); bx.moveTo(d.x-4,d.y+flap*0.6); bx.quadraticCurveTo(d.x,d.y-1,d.x,d.y-1); bx.quadraticCurveTo(d.x,d.y-1,d.x+4,d.y+flap*0.6); bx.stroke();
  } else if(d.type==='crab'){
    bx.fillStyle='#e05a3a'; bx.beginPath(); bx.ellipse(d.x,d.y-2,4,3,0,0,6.3); bx.fill();
    bx.fillRect(d.x-5,d.y-4,2,2); bx.fillRect(d.x+3,d.y-4,2,2);
    bx.strokeStyle='#e05a3a'; for(let k=-1;k<=1;k+=2){ bx.beginPath(); bx.moveTo(d.x+k*3,d.y-1); bx.lineTo(d.x+k*5,d.y+1); bx.stroke(); }
  } else if(d.type==='beachball'){
    const roll=d.x*0.3;
    bx.save(); bx.translate(d.x,d.y-4); bx.rotate(roll);
    bx.fillStyle='#fff'; bx.beginPath(); bx.arc(0,0,4,0,6.3); bx.fill();
    bx.fillStyle=d.tint||'#e84'; bx.beginPath(); bx.arc(0,0,4,-0.6,0.6); bx.lineTo(0,0); bx.fill();
    bx.beginPath(); bx.arc(0,0,4,Math.PI-0.6,Math.PI+0.6); bx.lineTo(0,0); bx.fill();
    bx.restore();
  }
  // ---- HIELO ----
  else if(d.type==='penguin'){
    const walk=Math.sin(d.phase)*1.5;
    bx.fillStyle='#1a1a22'; bx.beginPath(); bx.ellipse(d.x,d.y-6,3.5,5,0,0,6.3); bx.fill();
    bx.fillStyle='#f0f0f5'; bx.beginPath(); bx.ellipse(d.x,d.y-5,2,4,0,0,6.3); bx.fill();
    bx.fillStyle='#e0a030'; bx.fillRect(d.x+2*d.dir,d.y-8,2,1);
    bx.fillStyle='#e0a030'; bx.fillRect(d.x-1,d.y-1,1,1+walk*0.2); bx.fillRect(d.x+1,d.y-1,1,1-walk*0.2);
  } else if(d.type==='seal'){
    bx.fillStyle='#8a97a5'; bx.beginPath(); bx.ellipse(d.x,d.y-3,7,3.5,0,0,6.3); bx.fill();
    bx.beginPath(); bx.arc(d.x+6*d.dir,d.y-4,2.5,0,6.3); bx.fill();
    bx.fillStyle='#000'; bx.fillRect(d.x+6*d.dir,d.y-5,1,1);
    bx.fillStyle='#8a97a5'; bx.fillRect(d.x-7*d.dir,d.y-2,3,2);
  } else if(d.type==='snowbird'){
    bx.fillStyle='#5a7a9a';
    bx.beginPath(); bx.moveTo(d.x-4,d.y+flap); bx.lineTo(d.x,d.y-1); bx.lineTo(d.x+4,d.y+flap); bx.lineTo(d.x,d.y+1); bx.closePath(); bx.fill();
  }
  // ---- ESPACIO ----
  else if(d.type==='ufo'){
    bx.fillStyle='#9aa0b0'; bx.beginPath(); bx.ellipse(d.x,d.y,8,2.5,0,0,6.3); bx.fill();
    bx.fillStyle=d.tint||'#6effc9'; bx.beginPath(); bx.arc(d.x,d.y-1,3,Math.PI,0); bx.fill();
    const bl=0.4+0.4*Math.abs(Math.sin(d.phase));
    bx.globalAlpha*=bl; bx.fillStyle='#ffe08a';
    for(let k=-1;k<=1;k++) bx.fillRect(d.x+k*4-0.5,d.y+2,1,1);
    bx.globalAlpha=bx.globalAlpha/bl;
  } else if(d.type==='asteroid'){
    bx.save(); bx.translate(d.x,d.y); bx.rotate(d.x*0.05);
    bx.fillStyle='#7a6f6a'; bx.beginPath(); bx.ellipse(0,0,5,4,0,0,6.3); bx.fill();
    bx.fillStyle='rgba(0,0,0,.3)'; bx.beginPath(); bx.arc(-1,-1,1.5,0,6.3); bx.arc(2,1,1,0,6.3); bx.fill();
    bx.restore();
  } else if(d.type==='alien'){
    const walk=Math.sin(d.phase)*1.5;
    bx.fillStyle='#5ad07a'; bx.beginPath(); bx.ellipse(d.x,d.y-14,3,4,0,0,6.3); bx.fill();
    bx.fillStyle='#5ad07a'; bx.fillRect(d.x-2,d.y-11,4,6);
    bx.fillStyle='#111'; bx.beginPath(); bx.ellipse(d.x-1,d.y-15,1,1.5,0,0,6.3); bx.ellipse(d.x+1,d.y-15,1,1.5,0,0,6.3); bx.fill();
    bx.fillStyle='#3a9a5a'; bx.fillRect(d.x-2,d.y-5,2,5+walk*0.2); bx.fillRect(d.x,d.y-5,2,5-walk*0.2);
  } else if(d.type==='shootingstar'){
    bx.strokeStyle='rgba(255,255,255,.7)'; bx.lineWidth=2;
    bx.beginPath(); bx.moveTo(d.x,d.y); bx.lineTo(d.x-10*d.dir,d.y-3); bx.stroke();
    bx.fillStyle='#fff'; bx.fillRect(d.x-1,d.y-1,2,2);
  }
  // ---- CASTILLOS ----
  else if(d.type==='crow' || d.type==='raven'){
    bx.fillStyle = d.type==='raven'?'#101014':'#1a1a1a';
    const sz = d.type==='raven'?1.3:1;
    bx.beginPath();
    bx.moveTo(d.x-4*sz, d.y+flap); bx.lineTo(d.x, d.y-1); bx.lineTo(d.x+4*sz, d.y+flap);
    bx.lineTo(d.x, d.y+1.5); bx.closePath(); bx.fill();
    bx.fillRect(d.x+3*d.dir*sz, d.y-1, 2, 1); // pico
  } else if(d.type==='knight'){
    const walk=Math.sin(d.phase)*2;
    bx.fillStyle='#9aa0aa'; bx.fillRect(d.x-2,d.y-15,4,9);      // armadura torso
    bx.fillStyle='#b0b6c0'; bx.beginPath(); bx.arc(d.x,d.y-17,2.5,0,6.3); bx.fill(); // yelmo
    bx.fillStyle='#333'; bx.fillRect(d.x-2,d.y-17,4,1);        // visera
    bx.strokeStyle='#c9c9d0'; bx.lineWidth=1; bx.beginPath(); bx.moveTo(d.x+3*d.dir,d.y-14); bx.lineTo(d.x+3*d.dir,d.y-4); bx.stroke(); // lanza
    bx.fillStyle='#5a5a66'; bx.fillRect(d.x-2,d.y-6,2,6+walk*0.2); bx.fillRect(d.x,d.y-6,2,6-walk*0.2);
  }
  // ---- CASA ABANDONADA ----
  else if(d.type==='rat'){
    bx.fillStyle='#4a4038'; bx.beginPath(); bx.ellipse(d.x,d.y-2,4,2,0,0,6.3); bx.fill();
    bx.beginPath(); bx.arc(d.x+3*d.dir,d.y-2,1.5,0,6.3); bx.fill();
    bx.strokeStyle='#4a4038'; bx.lineWidth=1; bx.beginPath(); bx.moveTo(d.x-4*d.dir,d.y-2); bx.lineTo(d.x-8*d.dir,d.y-3); bx.stroke(); // cola
  } else if(d.type==='bat'){
    bx.fillStyle='#1a1420';
    const w1=Math.sin(d.phase)*3;
    bx.beginPath(); bx.moveTo(d.x-5,d.y+w1); bx.lineTo(d.x-1,d.y-1); bx.lineTo(d.x-2,d.y+2); bx.closePath(); bx.fill();
    bx.beginPath(); bx.moveTo(d.x+5,d.y+w1); bx.lineTo(d.x+1,d.y-1); bx.lineTo(d.x+2,d.y+2); bx.closePath(); bx.fill();
    bx.fillRect(d.x-1,d.y-1,2,3);
  } else if(d.type==='moth'){
    bx.fillStyle='#9a9080';
    const s=1+Math.abs(Math.sin(d.phase))*1.5;
    bx.fillRect(d.x-2,d.y-1,2,s); bx.fillRect(d.x,d.y-1,2,s);
  } else if(d.type==='spider'){
    bx.fillStyle='#1a1512'; bx.beginPath(); bx.arc(d.x,d.y-2,2.5,0,6.3); bx.fill();
    bx.strokeStyle='#1a1512'; bx.lineWidth=1;
    for(let k=-1;k<=1;k++){ bx.beginPath(); bx.moveTo(d.x,d.y-2); bx.lineTo(d.x-4,d.y-4+k*2); bx.moveTo(d.x,d.y-2); bx.lineTo(d.x+4,d.y-4+k*2); bx.stroke(); }
  }
  if(!d.alive){ bx.fillStyle='rgba(150,20,20,.7)'; bx.fillRect(d.x-2,d.y-3,5,2); }
  bx.restore();
}

// =====================================================================
//  ATAQUE ENEMIGO
// =====================================================================
function startRun(e){
  // elige otro escondite distinto al actual y corre hacia él
  const spots = game.props.filter(p=>p.hides && p!==e.prop);
  if(!spots.length){ e.relocT = rand(20,30); return; }
  const dest = pick(spots);
  const side = Math.random()<0.5?-1:1;
  const tx = clamp(dest.x + side*(dest.w*0.28), 14, W-14);
  e.running=true; e.aiming=false; e.peeking=false; e.ducking=false;
  e.runFrom=e.baseX; e.runTo=tx; e.runProg=0;
  e.runDur=clamp(Math.abs(tx-e.baseX)/70, 0.5, 2.4); // ~70 px/s
  e.destProp=dest; e.destSide=side;
  snd.run();
}
function startAim(e){
  e.aiming=true; e.ducking=false; e.aimTime=0; e.aimDur=rand(1.1,1.6);
  e.leanDir = Math.random()<0.5?-1:1;
  snd.aim();
}
function enemyFire(e){
  if(!e.alive || game.screen!=='play') return;
  snd.enemyfire();
  game.tracers.push({x:e.x, y:e.y-e.h*0.7, life:0.18, max:0.18});
  addPuff(e.x, e.y-e.h*0.7, '#ffcf6a', 2, 0.15);
  if(game.crouched){
    snd.dodge();
    flashMsg('¡ESQUIVADO! a cubierto', 1.0);
  } else {
    game.hp = Math.max(0, game.hp-1);
    snd.hurt(); flash('dmg'); game.shakeT = 0.24;
    updateHUD();
    if(game.hp<=0) return endLevel(false,'HERIDO DE MUERTE');
    flashMsg('¡IMPACTO! −1 vida', 1.2);
  }
}

// =====================================================================
//  DISPARO DEL JUGADOR
// =====================================================================
function shoot(){
  if(game.screen!=='play') return;
  if(game.crouched){ snd.empty(); flashMsg('AGACHADO: no puedes disparar', 1.0); return; }
  if(!game.canShoot) return;
  if(game.ammo<=0){ snd.empty(); flashMsg('¡SIN BALAS!',1); return; }

  game.ammo--;
  game.canShoot=false; setTimeout(()=>game.canShoot=true, 260);
  snd.shot();
  flash('fire');
  game.shakeT = 0.16;

  const ax = game.aimX, ay = game.aimY;
  addPuff(ax,ay,'#fff',3,0.12);

  // 1) enemigos (prioridad). Sólo cuentan si están EXPUESTOS: detrás de una
  //    cobertura sólida y agachados, la bala se queda en el objeto.
  let target=null, tkind=null, blockedE=null;
  for(const e of game.enemies){
    if(e.alive && e._box && inBox(ax,ay,e._box, 3)){
      if(enemyExposed(e)){ target=e; tkind='enemy'; break; }
      blockedE = e;   // le diste a su cobertura
    }
  }
  if(!target) for(const d of game.decoys){
    if(d.alive && d._box && inBox(ax,ay,d._box, 3)){ target=d; tkind='decoy'; break; }
  }
  if(!target) for(const d of game.distractors){
    if(d.alive && hitDistractor(ax,ay,d)){ target=d; tkind='animal'; break; }
  }

  if(tkind==='enemy'){
    target.alive=false;
    game.killed++;
    game.corpses.push({x:target.x, y:target.y, h:target.h, t:0, dir:Math.random()<0.5?-1:1});
    game.corpses[game.corpses.length-1].t=0;
    snd.hit(); snd.death(); flash('hit');
    for(let i=0;i<8;i++) addPuff(target.x, ay, '#b31414', 2, 0.5);
    flashMsg('OBJETIVO ELIMINADO', 1.2);
    // animar caída
    animateCorpse(game.corpses[game.corpses.length-1]);
    updateHUD();
    if(aliveEnemies()===0) return endLevel(true,'ZONA DESPEJADA');
  } else if(tkind==='decoy'){
    target.alive=false;
    snd.decoy();
    for(let i=0;i<6;i++) addPuff(target.x, ay, '#c9b24a', 2, 0.4);
    flashMsg('¡ERA UN SEÑUELO! −1 bala', 1.4);
    updateHUD();
  } else if(tkind==='animal'){
    // matas a un inocente: muere a la vista, pierdes bala Y vida
    const person = (target.type==='pedestrian' || target.type==='beachgoer' || target.type==='alien');
    target.alive=false; target.deadT=0; target.vy=-20; target.rot=0;
    snd.animal(); (person?snd.death:snd.deathAnimal)(); snd.hurt();
    for(let i=0;i<8;i++) addPuff(target.x, target.y-target.h*0.4, '#b31414', 2, 0.5);
    game.hp = Math.max(0, game.hp-1);
    flash('dmg'); game.shakeT = 0.2;
    updateHUD();
    if(game.hp<=0) return endLevel(false, person?'MATASTE A UN INOCENTE':'MATASTE A UN ANIMAL');
    flashMsg((person?'¡INOCENTE ABATIDO!':'¡ANIMAL ABATIDO!')+' −1 bala −1 vida', 1.7);
  } else if(blockedE){
    // la bala choca contra la cobertura: hay que esperar a que se exponga
    snd.clank();
    game.holes.push({x:ax|0,y:ay|0});
    for(let i=0;i<4;i++) addPuff(ax, ay, '#ffd67a', 2, 0.25); // chispas
    flashMsg('¡A CUBIERTO! espera a que salga', 1.5);
    // las primeras veces, explica la mecánica
    game.coverHints++;
    if(game.coverHints<=3){
      showHint('🛡 <b>El enemigo está protegido</b>, debes esperar a que salga para dispararle.', 3.0);
    }
    // a veces el impacto lo espanta y sale corriendo (queda al descubierto)
    if(Math.random()<0.5) startRun(blockedE);
    updateHUD();
  } else {
    // fallo
    snd.miss();
    game.holes.push({x:ax|0,y:ay|0});
    addPuff(ax, ay, '#000', 2, 0.3);
    flashMsg('FALLO −1 bala', 1.0);
    updateHUD();
  }
}

function animateCorpse(c){
  const start=performance.now();
  function step(now){ c.t=Math.min(1,(now-start)/500); if(c.t<1) requestAnimationFrame(step); }
  requestAnimationFrame(step);
}

function inBox(px,py,box,pad=0){
  return px >= box.x-box.w*0.5-pad && px <= box.x+box.w*0.5+pad &&
         py >= box.top-pad && py <= box.top+box.h+pad;
}
function hitDistractor(px,py,d){
  return Math.abs(px-d.x) < d.w*0.7 && Math.abs(py-(d.y-d.h*0.4)) < d.h*0.7;
}

function addPuff(x,y,c,s,life){
  game.puffs.push({x,y,vx:rand(-20,20),vy:rand(-40,-5),c,s,life,max:life});
}

// =====================================================================
//  FIN DE NIVEL / FLUJO
// =====================================================================
function endLevel(success, reason){
  if(game.screen!=='play') return;
  game.screen = success? 'levelclear':'fail';
  game._noAmmoT=0;
  if(success){
    if(game.levelIndex >= LEVELS.length-1){ game.screen='win'; snd.win(); showWin(); }
    else { snd.win(); showLevelClear(reason); }
  } else {
    snd.lose(); flash('dmg'); showFail(reason);
  }
  setCrouch(false);
  D.hud.classList.add('hidden');
  D.scope.classList.add('hidden');
  D.crouchBtn.classList.add('hidden');
  D.threat.classList.add('hidden');
  hideHint();
  document.body.style.cursor='auto';
}

function startLevel(idx){
  if(idx===0) game.coverHints=0;   // partida nueva: vuelve a explicarse
  buildLevel(idx);
  game.screen='play';
  setCrouch(false);
  D.overlay.classList.add('hidden');
  D.hud.classList.remove('hidden');
  D.scope.classList.remove('hidden');
  D.crouchBtn.classList.remove('hidden');
  D.threat.classList.add('hidden');
  document.body.style.cursor='none';
  flashMsg('MISIÓN: elimina '+game.enemies.length+' objetivos', 2.2);
}

// =====================================================================
//  HUD / OVERLAYS
// =====================================================================
function updateHUD(){
  const L=game.L; if(!L) return;
  D.level.textContent = game.levelIndex+1;
  D.biome.textContent = L.biome;
  let ammo=''; for(let i=0;i<game.ammoMax;i++) ammo += i<game.ammo ? '●' : '<span class="spent">●</span>';
  D.ammo.innerHTML = ammo;
  let hp=''; for(let i=0;i<game.maxHP;i++) hp += i<game.hp ? '♥' : '<span class="lost">♥</span>';
  D.health.innerHTML = hp;
  D.alive.textContent = aliveEnemies();
  D.killed.textContent = game.killed;
  D.msg.textContent = game.msg;
}
function tickHUDTime(){ D.time.textContent = Math.max(0,Math.ceil(game.timeLeft)); }

function flashMsg(m,t){ game.msg=m; game.msgTimer=t; D.msg.textContent=m; }
// aviso guía grande y centrado (se oculta solo)
function showHint(html,t){ D.hint.innerHTML=html; D.hint.classList.remove('hidden'); game.hintT=t; }
function hideHint(){ game.hintT=0; D.hint.classList.add('hidden'); }
function flash(cls){ D.flash.classList.remove('fire','hit','dmg'); void D.flash.offsetWidth; D.flash.classList.add(cls); }

function overlayPanel(html){
  D.overlay.innerHTML = '<div class="panel">'+html+'</div>';
  D.overlay.classList.remove('hidden');
}

function showLevelClear(reason){
  const spent = game.ammoMax-game.ammo;
  overlayPanel(`
    <h1 class="title">ZONA DESPEJADA</h1>
    <p class="tagline">NIVEL ${game.levelIndex+1} · ${game.L.biome} COMPLETADO</p>
    <div class="result-stats">
      Objetivos eliminados: <b class="good">${game.killed}/${game.enemies.length}</b><br>
      Balas usadas: <b>${spent}/${game.ammoMax}</b><br>
      Tiempo restante: <b>${Math.ceil(game.timeLeft)}s</b>
    </div>
    <button class="btn" id="nextBtn">SIGUIENTE NIVEL ▸</button>
  `);
  document.getElementById('nextBtn').onclick = ()=> startLevel(game.levelIndex+1);
}

function showWin(){
  overlayPanel(`
    <h1 class="title glitch" data-text="MISIÓN CUMPLIDA">MISIÓN CUMPLIDA</h1>
    <p class="tagline">TODAS LAS ZONAS DESPEJADAS, FRANCOTIRADOR</p>
    <div class="result-stats">
      Has superado los ${LEVELS.length} escenarios.<br>
      <b class="good">Eres una leyenda del silencio.</b>
    </div>
    <button class="btn amber" id="againBtn">JUGAR DE NUEVO</button>
  `);
  document.getElementById('againBtn').onclick = ()=> startLevel(0);
}

function showFail(reason){
  overlayPanel(`
    <h1 class="title" style="color:var(--red);text-shadow:0 0 10px rgba(255,59,59,.8),3px 3px 0 #7a1414">MISIÓN FALLIDA</h1>
    <p class="tagline" style="color:var(--red)">${reason}</p>
    <div class="result-stats">
      Objetivos restantes: <b class="bad">${aliveEnemies()}</b><br>
      Eliminados: <b>${game.killed}/${game.enemies.length}</b>
    </div>
    <button class="btn red" id="retryBtn">REINTENTAR NIVEL</button>
    <button class="btn" id="menuBtn" style="margin-left:10px">DESDE EL INICIO</button>
  `);
  document.getElementById('retryBtn').onclick = ()=> startLevel(game.levelIndex);
  document.getElementById('menuBtn').onclick = ()=> startLevel(0);
}

// =====================================================================
//  MIRA / INPUT
// =====================================================================
function positionScope(srcX,srcY,srcW,srcH){
  const rect = canvas.getBoundingClientRect();
  // pos del punto de mundo aimX/aimY en pantalla
  const nx = (game.aimX - srcX)/srcW;
  const ny = (game.aimY - srcY)/srcH;
  const sx = rect.left + nx*rect.width;
  const sy = rect.top + ny*rect.height;
  D.scope.style.left = sx+'px';
  D.scope.style.top = sy+'px';
  const ring = D.scope.querySelector('.scope-ring');
  ring.style.transform = `translate(-50%,-50%) scale(${game.zoom?1.8:1})`;
}

function onMove(e){
  const rect = canvas.getBoundingClientRect();
  const nx = clamp((e.clientX-rect.left)/rect.width, 0, 1);
  const ny = clamp((e.clientY-rect.top)/rect.height, 0, 1);
  game.mouse.x=nx; game.mouse.y=ny;
  game.aimX = nx*W; game.aimY = ny*H;
}

function setCrouch(on){
  if(game.crouched===on) return;
  game.crouched = on;
  D.cover.classList.toggle('up', on);
  D.crouchBtn.classList.toggle('on', on);
  if(on) game.zoom=false; // agachado no apunta con zoom
}

function bindInput(){
  D.stage.addEventListener('mousemove', onMove);
  D.stage.addEventListener('mousedown', e=>{
    if(game.screen!=='play') return;
    if(e.button===0){ e.preventDefault(); shoot(); }
    else if(e.button===2){ e.preventDefault(); if(!game.crouched) game.zoom=true; }
  });
  window.addEventListener('mouseup', e=>{ if(e.button===2) game.zoom=false; });
  D.stage.addEventListener('contextmenu', e=>e.preventDefault());
  window.addEventListener('keydown', e=>{
    if(e.code==='Space'){ e.preventDefault(); if(!game.crouched) game.zoom=true; }   // zoom
    if((e.code==='ShiftLeft'||e.code==='ShiftRight') && !e.repeat){ e.preventDefault(); setCrouch(!game.crouched); } // agacharse (alterna)
    if(e.code==='Enter' && game.screen==='menu'){ startLevel(0); }
  });
  window.addEventListener('keyup', e=>{
    if(e.code==='Space') game.zoom=false;
  });

  // botón cubrirse (ratón + táctil): un toque alterna agachado/de pie
  const toggle = e=>{ e.preventDefault(); e.stopPropagation(); setCrouch(!game.crouched); };
  const swallow = e=>{ e.preventDefault(); e.stopPropagation(); };  // evita que el toque dispare
  D.crouchBtn.addEventListener('mousedown', toggle);
  D.crouchBtn.addEventListener('touchstart', toggle, {passive:false});
  D.crouchBtn.addEventListener('touchend', swallow, {passive:false});

  // touch (móvil): tocar = apuntar+disparar; dos dedos = zoom
  let crouchTouchOnBtn=false;
  D.stage.addEventListener('touchmove', e=>{
    const t=e.touches[0]; onMove({clientX:t.clientX,clientY:t.clientY});
    if(!game.crouched) game.zoom = e.touches.length>1;
    e.preventDefault();
  }, {passive:false});
  D.stage.addEventListener('touchstart', e=>{
    const t=e.touches[0]; onMove({clientX:t.clientX,clientY:t.clientY});
    if(e.touches.length>1 && !game.crouched){ game.zoom=true; }
    e.preventDefault();
  }, {passive:false});
  D.stage.addEventListener('touchend', e=>{
    if(game.screen==='play' && e.touches.length===0){ shoot(); game.zoom=false; }
    e.preventDefault();
  }, {passive:false});
}

// tick del reloj HUD (separado, 1/frame durante play)
setInterval(()=>{ if(game.screen==='play') tickHUDTime(); }, 100);

// =====================================================================
//  ARRANQUE
// =====================================================================
function boot(){
  bindInput();
  const startBtn = document.getElementById('startBtn');
  startBtn.onclick = ()=>{ audio(); startLevel(0); };
  requestAnimationFrame(loop);
}
boot();

// Hook de depuración (útil para pruebas automatizadas y consola)
if(typeof window!=='undefined'){
  window.__sniper = { buildLevel, drawScene, update, shoot, enemyExposed, LEVELS, get game(){ return game; } };
}

})();

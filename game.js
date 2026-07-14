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
    biome:'DESIERTO', key:'desert', enemies:3, ammo:6, time:60,
    baseReveal:0.24, peekReveal:0.74, peekEvery:[2.4,4.2], decoys:2, distractors:5,
    sky:['#f6b25a','#e07b3a','#7a3b2e'], ground:['#c79a5c','#a9793f'], camo:'#6e5836'
  },
  {
    biome:'CIUDAD', key:'city', enemies:4, ammo:6, time:56,
    baseReveal:0.20, peekReveal:0.70, peekEvery:[2.6,4.6], decoys:3, distractors:5,
    sky:['#2b3b6b','#334a86','#8a6c9e'], ground:['#3a3f4a','#2a2d35'], camo:'#39414f'
  },
  {
    biome:'BOSQUE', key:'forest', enemies:5, ammo:7, time:54,
    baseReveal:0.17, peekReveal:0.68, peekEvery:[2.8,5.0], decoys:3, distractors:6,
    sky:['#8fc7d4','#b6d9c2','#dce9c0'], ground:['#3f5a2e','#2c4322'], camo:'#31461f'
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
  holes:[], puffs:[], corpses:[],
  msg:'', msgTimer:0,
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
  empty(){ beep(90,0.06,'square',0.15); }
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
  game.props = []; game.bg = []; game.holes = []; game.puffs = []; game.corpses = [];
  game.zoom = false; game.viewZoom = 1;
  game.msg=''; game.msgTimer=0; game._noAmmoT=0;

  // capas de fondo lejano
  buildBackground(L);

  // props / coberturas (hotspots donde esconder gente)
  const hotspots = [];
  const nProps = 10 + randi(0,4);
  for(let i=0;i<nProps;i++){
    const x = 24 + (i/nProps)*(W-48) + rand(-14,14);
    const p = makeProp(L, x);
    game.props.push(p);
    if(p.hides) hotspots.push(p);
  }
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
  } else {
    for(let i=0;i<3;i++) game.bg.push({type:'hill', y:GROUND-rand(2,20)-i*3, c:i});
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
  } else {
    p.type = pick(['tree','tree','bush','bush','log']);
    if(p.type==='tree'){ p.h=rand(46,86); p.w=rand(18,30); }
    else if(p.type==='bush'){ p.h=rand(14,24); p.w=rand(22,40); }
    else { p.h=10; p.w=rand(24,40); }
  }
  p.seed = Math.random()*1000;
  return p;
}

// ---------- Entidades humanas ----------
function makeEnemy(L, prop){
  const height = randi(18,22);
  const side = Math.random()<0.5 ? -1 : 1;
  const x = clamp(prop.x + side*(prop.w*0.28), 14, W-14);
  return {
    kind:'enemy', alive:true, x, baseX:x, y:GROUND, h:height, w:height*0.42,
    prop, side,
    reveal:L.baseReveal, base:L.baseReveal,
    peekT: rand(0.8,3.0), peeking:false, peekDur:0, peekLife:0,
    sway: Math.random()*6.28, swaySpd: rand(0.6,1.2),
    lean:0, dieT:0
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
function makeDistractor(L){
  const dir = Math.random()<0.5?1:-1;
  const startX = dir>0 ? -20 : W+20;
  let d = { alive:true, dir, x:startX, hitT:0 };
  if(L.key==='desert'){
    d.type = pick(['bird','bird','tumbleweed','lizard']);
  } else if(L.key==='city'){
    d.type = pick(['pedestrian','pedestrian','pigeon','cat']);
  } else {
    d.type = pick(['deer','bird','bird','squirrel','butterfly']);
  }
  // altura de vuelo / suelo
  if(['bird','pigeon','butterfly'].includes(d.type)){ d.y = rand(40,120); d.spd=rand(22,40)*dir; d.fly=true; }
  else if(d.type==='tumbleweed'){ d.y=GROUND-6; d.spd=rand(26,42)*dir; }
  else if(d.type==='deer'){ d.y=GROUND; d.spd=rand(14,22)*dir; }
  else { d.y=GROUND; d.spd=rand(16,30)*dir; }
  d.x = startX;
  d.phase = Math.random()*6.28;
  d.w = d.type==='deer'?20:d.type==='pedestrian'?7:d.type==='tumbleweed'?12:8;
  d.h = d.type==='deer'?16:d.type==='pedestrian'?18:d.type==='tumbleweed'?12:6;
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

  // enemigos: respiración + eventos de asomarse (movimiento = pista)
  for(const e of game.enemies){
    if(!e.alive){ e.dieT+=dt; continue; }
    e.sway += dt*e.swaySpd;
    if(!e.peeking){
      e.peekT -= dt;
      if(e.peekT<=0){
        e.peeking=true; e.peekLife=0; e.peekDur=rand(0.7,1.3);
        e.leanDir = Math.random()<0.5?-1:1;
        snd.peek();
      }
      e.reveal = lerp(e.reveal, e.base, dt*4);
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
    e.x = e.baseX + Math.sin(e.sway)*0.6 + e.lean;
  }

  // señuelos: leve balanceo, sin picos de movimiento
  for(const d of game.decoys){
    if(!d.alive){ d.shatterT+=dt; continue; }
    d.sway += dt*0.4;
  }

  // distractores móviles
  for(const d of game.distractors){
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
  for(const b of game.bg){
    if(b.type==='dune'){
      bx.fillStyle = ['#e9a860','#d9954f','#c9853f','#b97636'][b.c%4];
      bx.beginPath(); bx.moveTo(b.x,GROUND);
      bx.quadraticCurveTo(b.x+b.w/2, b.y, b.x+b.w, GROUND);
      bx.fill();
    } else if(b.type==='hill'){
      bx.fillStyle=['#7fae86','#6b9d74','#5a8a63'][b.c%3];
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
    }
  }
  if(L.key==='desert'){ // sol
    bx.fillStyle='#ffe08a'; bx.beginPath(); bx.arc(W*0.7,54,20,0,6.3); bx.fill();
    bx.globalAlpha=.25; bx.beginPath(); bx.arc(W*0.7,54,30,0,6.3); bx.fill(); bx.globalAlpha=1;
  }
}

function drawGroundTexture(L){
  bx.save();
  if(L.key==='desert'){
    bx.fillStyle='rgba(140,100,50,.35)';
    for(let i=0;i<60;i++) bx.fillRect((i*97%W), GROUND+((i*53)%(H-GROUND)), 2,1);
  } else if(L.key==='city'){
    bx.strokeStyle='rgba(255,255,255,.15)'; bx.lineWidth=1;
    for(let x=0;x<W;x+=30){ bx.beginPath(); bx.moveTo(x,GROUND+4); bx.lineTo(x-20,H); bx.stroke(); }
    bx.fillStyle='rgba(255,220,120,.4)';
    for(let x=10;x<W;x+=40) bx.fillRect(x,GROUND+18,10,2);
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
    // ventanas
    for(let yy=GROUND-p.h+5; yy<GROUND-4; yy+=8)
      for(let xx=p.x-p.w/2+3; xx<p.x+p.w/2-3; xx+=8){
        bx.fillStyle = Math.random()<0.3? '#ffd67a':'#22262f';
        bx.fillRect(xx,yy,4,5);
      }
  } else if(p.type==='car'){
    bx.fillStyle=pick(['#7a2a2a','#2a4a7a','#2a6a3a','#6a6a2a']);
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
  bx.restore();
}

// follaje frontal que tapa parcialmente al enemigo (camuflaje)
function drawPropFront(L,p){
  if(!p.hides) return;
  bx.save();
  bx.globalAlpha=0.96;
  if(p.type==='cactus'){
    bx.fillStyle='#5c8a44'; bx.fillRect(p.x-2,GROUND-p.h,4,p.h*0.5);
  } else if(p.type==='bush' || (p.type==='rock')){
    bx.fillStyle = L.key==='desert' ? '#4f6b2e' : '#26401a';
    blob(p.x, GROUND-p.h*0.4, p.w*0.55, p.h*0.5);
  } else if(p.type==='tree'){
    bx.fillStyle='#243c16';
    blob(p.x-p.w*0.1, GROUND-p.h*0.5, p.w*0.5, p.h*0.32);
    blob(p.x+p.w*0.25, GROUND-p.h*0.3, p.w*0.3, p.h*0.25);
  } else if(p.type==='building'){
    bx.fillStyle='#3a3f4a'; bx.fillRect(p.x-p.w/2-1,GROUND-4,p.w+2,4); // saliente base
  } else if(p.type==='car'){
    bx.fillStyle='rgba(0,0,0,.25)'; bx.fillRect(p.x-p.w/2,GROUND-2,p.w,2);
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
      bx.lineTo(x + (opts.lean||0)*1.5 + w*0.9, top+h*0.24);
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
  const box = humanShape(e.x, e.y, e.h, e.reveal, L.camo, {lean:e.lean});
  e._box = box;
  // destello sutil cuando se asoma mucho (pista extra de movimiento)
  if(e.peeking && e.reveal>0.55){
    bx.globalAlpha=clamp((e.reveal-0.55)*0.6,0,.3);
    bx.fillStyle='#fff'; bx.fillRect(box.x-1, box.top+box.headR, 2, 2);
    bx.globalAlpha=1;
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
  if(d.hitT>0){ bx.globalAlpha = 0.4+0.6*Math.abs(Math.sin(d.hitT*40)); }
  const flap = Math.sin(d.phase)*3;
  if(d.type==='bird' || d.type==='pigeon'){
    bx.fillStyle = d.type==='pigeon'?'#c9cdd6':'#2a2a2a';
    bx.beginPath();
    bx.moveTo(d.x-4, d.y+flap); bx.lineTo(d.x, d.y-1); bx.lineTo(d.x+4, d.y+flap);
    bx.lineTo(d.x, d.y+1); bx.closePath(); bx.fill();
  } else if(d.type==='butterfly'){
    bx.fillStyle=pick(['#ff8', '#f8a', '#af8']);
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
  } else if(d.type==='pedestrian'){
    const walk=Math.sin(d.phase)*2;
    bx.fillStyle=pick(['#c94','#49c','#c49','#4c9','#999']);
    // reusar figura simple visible
    bx.fillRect(d.x-2,d.y-14,4,8);
    bx.beginPath(); bx.arc(d.x,d.y-16,2.5,0,6.3); bx.fill();
    bx.fillStyle='#222';
    bx.fillRect(d.x-2,d.y-6+0,2,6+walk*0.2); bx.fillRect(d.x,d.y-6,2,6-walk*0.2);
  }
  bx.restore();
}

// =====================================================================
//  DISPARO
// =====================================================================
function shoot(){
  if(game.screen!=='play') return;
  if(!game.canShoot) return;
  if(game.ammo<=0){ snd.empty(); flashMsg('¡SIN BALAS!',1); return; }

  game.ammo--;
  game.canShoot=false; setTimeout(()=>game.canShoot=true, 260);
  snd.shot();
  flash('fire');
  game.shakeT = 0.16;

  const ax = game.aimX, ay = game.aimY;
  addPuff(ax,ay,'#fff',3,0.12);

  // 1) enemigos (prioridad)
  let target=null, tkind=null;
  for(const e of game.enemies){
    if(e.alive && e._box && inBox(ax,ay,e._box, 3)){ target=e; tkind='enemy'; break; }
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
    snd.hit(); flash('hit');
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
    target.hitT=0.35; snd.animal();
    for(let i=0;i<5;i++) addPuff(target.x, target.y, '#ddd', 2, 0.4);
    flashMsg('¡FAUNA! No dispares. −1 bala', 1.4);
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
  D.hud.classList.add('hidden');
  D.scope.classList.add('hidden');
  document.body.style.cursor='auto';
}

function startLevel(idx){
  buildLevel(idx);
  game.screen='play';
  D.overlay.classList.add('hidden');
  D.hud.classList.remove('hidden');
  D.scope.classList.remove('hidden');
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
  D.alive.textContent = aliveEnemies();
  D.killed.textContent = game.killed;
  D.msg.textContent = game.msg;
}
function tickHUDTime(){ D.time.textContent = Math.max(0,Math.ceil(game.timeLeft)); }

function flashMsg(m,t){ game.msg=m; game.msgTimer=t; D.msg.textContent=m; }
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

function bindInput(){
  D.stage.addEventListener('mousemove', onMove);
  D.stage.addEventListener('mousedown', e=>{
    if(game.screen!=='play') return;
    if(e.button===0){ e.preventDefault(); shoot(); }
    else if(e.button===2){ e.preventDefault(); game.zoom=true; }
  });
  window.addEventListener('mouseup', e=>{ if(e.button===2) game.zoom=false; });
  D.stage.addEventListener('contextmenu', e=>e.preventDefault());
  window.addEventListener('keydown', e=>{
    if(e.code==='Space'){ e.preventDefault(); game.zoom=true; }
    if(e.code==='Enter' && game.screen==='menu'){ startLevel(0); }
  });
  window.addEventListener('keyup', e=>{ if(e.code==='Space') game.zoom=false; });

  // touch (móvil): tocar = apuntar+disparar; dos dedos = zoom
  D.stage.addEventListener('touchmove', e=>{
    const t=e.touches[0]; onMove({clientX:t.clientX,clientY:t.clientY});
    game.zoom = e.touches.length>1;
    e.preventDefault();
  }, {passive:false});
  D.stage.addEventListener('touchstart', e=>{
    const t=e.touches[0]; onMove({clientX:t.clientX,clientY:t.clientY});
    if(e.touches.length>1){ game.zoom=true; }
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

})();

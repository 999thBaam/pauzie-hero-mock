import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// ---------- helpers ----------
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (p, a, b) => clamp((p - a) / (b - a));          // 0..1 progress inside [a,b]
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const lerp = (a, b, t) => a + (b - a) * t;
const $ = id => document.getElementById(id);

const params = new URLSearchParams(location.search);
const FROZEN = params.has('p') ? parseFloat(params.get('p')) : null;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- stars ----------
{
  const s = $('stars');
  for (let i = 0; i < 70; i++) {
    const e = document.createElement('i');
    e.style.left = Math.random() * 100 + '%';
    e.style.top = Math.random() * 62 + '%';
    e.style.animationDelay = -Math.random() * 3 + 's';
    if (Math.random() < .2) e.style.width = e.style.height = '3px';
    s.appendChild(e);
  }
}

// ---------- crowds (Open Peeps, CC0) ----------
// ar = viewBox w/h. px/py = where the phone sits (% of the peep box).
const AR = { si1: 346/510, si2: 346/521, si9: 324/467, si10: 324/484, si11: 335/495, si12: 336/504, si14: 462/603, si18: 346/501,
             st4: 304/681, st5: 304/680, st6: 304/677, st10: 255/688, st16: 309/652, st22: 321/691, st23: 321/699, st24: 321/692, st25: 246/713, st26: 246/677, st27: 246/713 };

// Same slots in both acts: the people stay, the phones go.
const SLOTS = [
  // back row
  { x: 12, b: 27, h: 15, back: 1 },
  { x: 37, b: 28, h: 14, back: 1 },
  { x: 63, b: 28, h: 14, back: 1 },
  { x: 88, b: 27, h: 15, back: 1 },
  // front row
  { x: 14, b: 3,  h: 25 },
  { x: 50, b: 1,  h: 27 },
  { x: 86, b: 3,  h: 25 },
];
const NIGHT = [
  { k: 'st5',  px: 50, py: 30, pr: '-8deg' },
  { k: 'si1',  px: 46, py: 47, pr: '-20deg', seat: 1 },
  { k: 'si11', px: 40, py: 50, pr: '10deg',  seat: 1 },
  { k: 'st6',  px: 44, py: 31, pr: '-8deg', flip: -1 },
  { k: 'si9',  px: 50, py: 47, pr: '-6deg',  seat: 1 },
  { k: 'st4',  px: 42, py: 31, pr: '-10deg' },
  { k: 'si18', px: 54, py: 46, pr: '12deg',  seat: 1, flip: -1 },
];
const DAWN = [
  { k: 'st23', bob: 1 },
  { k: 'si14' , seat: 1.15 },
  { k: 'st24', bob: 1, flip: -1 },
  { k: 'st10' },
  { k: 'st22', bob: 1 },
  { k: 'st16' },
  { k: 'st25', bob: 1, flip: -1 },
];

function buildCrowd(el, cast, night) {
  cast.forEach((c, i) => {
    const s = SLOTS[i];
    const d = document.createElement('div');
    d.className = 'peep' + (s.back ? ' back' : '') + (c.bob ? ' bob' : '');
    const h = s.h * (c.seat ? (c.seat === 1 ? .72 : c.seat * .72) : 1);
    d.style.cssText = `--x:${s.x};--b:${s.b};--h:${h};--ar:${AR[c.k]};--flip:${c.flip || 1};z-index:${s.back ? 1 : 3}`;
    d.innerHTML = `<img src="assets/peeps/${c.k}.svg" alt="" draggable="false">`;
    if (night) {
      d.innerHTML += `<span class="face-glow" style="--px:${c.px};--py:${c.py}"></span><span class="phone" style="--px:${c.px};--py:${c.py};--pr:${c.pr};animation-delay:${-i * .37}s"></span>`;
    }
    if (c.bob) d.querySelector('img').style.animationDelay = -i * .3 + 's';
    el.appendChild(d);
  });
}
buildCrowd($('crowd-night'), NIGHT, true);
buildCrowd($('crowd-dawn'), DAWN, false);
const phones = [...document.querySelectorAll('.night .phone, .night .face-glow')];

// ---------- notification badges ----------
const APPS = [
  { ico: '♥', bg: 'linear-gradient(45deg,#f9a03f,#e1306c,#833ab4)', t: 'new likes' },
  { ico: '▶', bg: '#ff0033', t: 'Shorts for you' },
  { ico: '✉', bg: '#25d366', t: 'messages' },
  { ico: '●', bg: '#111', t: 'new posts' },
  { ico: '★', bg: '#ffb800', t: 'streak at risk' },
  { ico: '♪', bg: '#000', t: 'trending sound' },
];
const badgesEl = $('badges');
let badgeTimer = 0, badgesOn = true;
function spawnBadge() {
  if (!badgesOn || badgesEl.childElementCount > 9) return;
  const b = document.createElement('div');
  const reel = Math.random() < .28;
  // keep clear of the device (centre) and captions (top)
  const side = Math.random() < .5;
  const x = side ? 3 + Math.random() * 26 : 62 + Math.random() * 26;
  const y = 24 + Math.random() * 34;
  b.style.left = x + '%'; b.style.top = y + '%';
  if (reel) b.className = 'badge reel';
  else {
    const a = APPS[(Math.random() * APPS.length) | 0];
    const n = [3, 7, 12, 24, 47, 99, '99+'][(Math.random() * 7) | 0];
    b.className = 'badge';
    b.innerHTML = `<span class="ico" style="background:${a.bg}">${a.ico}</span><span class="n">${n}</span>`;
  }
  badgesEl.appendChild(b);
  setTimeout(() => { b.classList.add('out'); setTimeout(() => b.remove(), 400); }, 2600 + Math.random() * 1800);
}
function burstBadges() { [...badgesEl.children].forEach((b, i) => setTimeout(() => b.classList.add('out'), i * 40)); }

// ---------- three.js device ----------
const canvas = $('device');
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 1, 2000);
camera.position.set(0, 0, 420);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;

const hemi = new THREE.HemisphereLight(0x8fa6ff, 0x101225, .6);
const key = new THREE.DirectionalLight(0x9db4ff, 1.2); key.position.set(-120, 160, 220);
const rim = new THREE.DirectionalLight(0x6fa0ff, 2.4); rim.position.set(180, -40, -120);
const glow = new THREE.PointLight(0x7aa8ff, 0, 400, 1.6); glow.position.set(0, -60, 80);
scene.add(hemi, key, rim, glow);

const pivot = new THREE.Group();   // the part we animate
const holder = new THREE.Group();  // turns the GLB so its top face (+Y) looks at the camera (+Z)
holder.rotation.x = Math.PI / 2;
pivot.add(holder); scene.add(pivot);

const NIGHT_C = { hemi: new THREE.Color(0x8fa6ff), key: new THREE.Color(0x9db4ff), rim: new THREE.Color(0x6fa0ff) };
const DAWN_C  = { hemi: new THREE.Color(0xfff2e0), key: new THREE.Color(0xffe2bd), rim: new THREE.Color(0xffd29a) };

const draco = new DRACOLoader().setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
new GLTFLoader().setDRACOLoader(draco).load('assets/pact.glb', g => {
  const m = g.scene;
  const box = new THREE.Box3().setFromObject(m);
  m.position.sub(box.getCenter(new THREE.Vector3()));
  m.traverse(o => {
    if (!o.isMesh) return;
    o.material.envMapIntensity = .9;
    if (/foil/.test(o.name) || /foil/.test(o.material.name)) {      // foil sits on the stamp top: avoid z-fighting
      o.material.polygonOffset = true; o.material.polygonOffsetFactor = -2; o.material.polygonOffsetUnits = -2;
    }
  });
  holder.add(m);
  ready = true;
});
let ready = false;

function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  // device ~46% of the width on phones, ~40% of the height on wide screens
  const tf = Math.tan(THREE.MathUtils.degToRad(15)) * 2;
  camera.position.z = Math.max(64 / (.46 * tf * camera.aspect), 64 / (.40 * tf));
}
addEventListener('resize', resize); resize();

// world-space y for a screen fraction (0 top .. 1 bottom), at z = 0
function screenY(f) {
  const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
  return (0.5 - f) * 2 * halfH;
}

// ---------- scroll ----------
const hero = $('hero');
let target = 0, prog = 0;
function readScroll() {
  if (FROZEN !== null) { target = FROZEN; return; }
  const r = hero.getBoundingClientRect();
  target = clamp(-r.top / (r.height - innerHeight));
}
addEventListener('scroll', readScroll, { passive: true }); readScroll();

// ---------- frame ----------
const cap1 = $('cap1'), cap2 = $('cap2'), cap3 = $('cap3'), hint = $('hint'), dawn = $('dawn');
const rings = [...$('ripple').children];
const meta = document.querySelector('meta[name=theme-color]');
const clock = new THREE.Clock();
let burst = false;

function frame() {
  const t = clock.getElapsedTime();
  prog = FROZEN !== null ? target : lerp(prog, target, .12);
  const p = prog;

  // phases
  const a1 = seg(p, 0, .22);          // night, idle
  const turn = ease(seg(p, .22, .5)); // device spins to face you, badges burst
  const tap = seg(p, .5, .6);         // press + ripple
  const wipe = ease(seg(p, .56, .74));// dawn reveal
  const settle = ease(seg(p, .74, .95));

  // badges
  badgesOn = p < .22;
  if (p >= .26 && !burst) { burst = true; burstBadges(); }
  if (p < .2) burst = false;
  if (badgesOn && t - badgeTimer > (reduce ? 1.6 : .55)) { badgeTimer = t; spawnBadge(); }

  // phones dim one by one during the turn
  phones.forEach((ph, i) => {
    const k = seg(p, .24 + (i >> 1) * .025, .3 + (i >> 1) * .025);
    ph.style.opacity = 1 - k;
  });

  // captions
  cap1.style.opacity = 1 - seg(p, .12, .22);
  cap1.style.transform = `translateY(${-seg(p, .12, .22) * 20}px)`;
  const c2 = seg(p, .3, .4) * (1 - seg(p, .56, .62));
  cap2.style.opacity = c2;
  cap2.style.transform = `translateY(${(1 - seg(p, .3, .4)) * 16}px)`;
  cap3.style.opacity = seg(p, .72, .86);
  cap3.style.transform = `translateY(${(1 - seg(p, .72, .86)) * 22}px)`;
  cap3.style.pointerEvents = p > .8 ? 'auto' : 'none';
  hint.style.opacity = 1 - seg(p, .02, .08);

  // dawn wipe from the device
  dawn.style.clipPath = `circle(${wipe * 150}% at 50% 40%)`;
  meta.content = wipe > .5 ? '#f6ead9' : '#0b1020';
  document.querySelectorAll('.dawn .peep').forEach((el, i) => {
    const k = ease(seg(p, .62 + i * .015, .8 + i * .015));
    el.style.opacity = (el.classList.contains('back') ? .75 : 1) * k;
    el.style.translate = `0 ${(1 - k) * 20}px`;
  });

  // ripple rings
  rings.forEach((r, i) => {
    const k = seg(p, .52 + i * .03, .7 + i * .03);
    r.style.transform = `translate(-50%,-50%) scale(${k})`;
    r.style.opacity = k > 0 && k < 1 ? (1 - k) * .9 : 0;
  });

  // device
  if (ready) {
    const idle = reduce ? 0 : t;
    // act 1: diagonal, slow drift
    let rx = -0.85 + Math.sin(idle * .6) * .06;
    let ry = 0.55 + Math.sin(idle * .4) * .18;
    let rz = 0.55;
    // turn: one full spin, ending face-on with a slight tilt
    ry = lerp(ry, Math.PI * 2 + .12, turn);
    rx = lerp(rx, -0.18, turn);
    rz = lerp(rz, -0.06, turn);
    // after dawn: small idle float, slightly tipped
    rx = lerp(rx, -0.42 + Math.sin(idle * .8) * .04, settle);
    ry = lerp(ry, Math.PI * 2 + .35 + Math.sin(idle * .5) * .12, settle);
    pivot.rotation.set(rx, ry, rz);

    // tap: press in, then bounce back
    const press = Math.sin(clamp(tap) * Math.PI);
    const s = 1 - press * .12 - settle * (camera.aspect > 1 ? .48 : .3);
    pivot.scale.setScalar(s);
    // position: 40% down the screen, then lift towards the headline area
    const yf = lerp(.42, .40, turn);
    const yfDawn = camera.aspect > 1 ? .49 : .445;
    pivot.position.y = screenY(lerp(yf, yfDawn, settle)) + Math.sin(idle * 1.1) * 1.2;
    pivot.position.z = -press * 20;

    // light: cold night -> warm dawn
    const L = wipe;
    hemi.color.copy(NIGHT_C.hemi).lerp(DAWN_C.hemi, L);
    key.color.copy(NIGHT_C.key).lerp(DAWN_C.key, L);
    rim.color.copy(NIGHT_C.rim).lerp(DAWN_C.rim, L);
    hemi.intensity = lerp(.6, 1.6, L);
    key.intensity = lerp(1.2, 2.4, L);
    rim.intensity = lerp(2.4, .8, L);
    glow.intensity = lerp(0, 0, L) + press * 2600;
    renderer.toneMappingExposure = lerp(.95, 1.1, L);
  }
  // keep ripple + dawn centre on the device
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// keep cap3 out of the device area on short screens
if (FROZEN !== null) document.documentElement.classList.add('frozen');

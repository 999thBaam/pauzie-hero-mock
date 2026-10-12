import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLYPH } from './icons.js';

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
    d.innerHTML = `<img src="assets/peeps/${c.k}${night ? '' : '-pine'}.svg" alt="" draggable="false">`;
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
// wave order by x position (left to right)
const ORDER = SLOTS.map((s, i) => [s.x, i]).sort((u, v) => u[0] - v[0]).reduce((o, [, i], r) => (o[i] = r, o), []);

// ---------- notifications (Android heads-up style, dark theme) ----------
// Real apps, real-sounding copy. Logos: Simple Icons (CC0); trademarks belong to their owners.
const APP = {
  instagram: { name: 'Instagram', bg: 'radial-gradient(circle at 30% 107%, #fdf497 0%, #fd5949 45%, #d6249f 60%, #285AEB 90%)', fg: '#fff' },
  whatsapp:  { name: 'WhatsApp',  bg: '#25D366', fg: '#fff' },
  youtube:   { name: 'YouTube',   bg: '#fff', fg: '#FF0000' },
  snapchat:  { name: 'Snapchat',  bg: '#FFFC00', fg: '#fff', stroke: '#000' },
  zomato:    { name: 'Zomato',    bg: '#E23744', fg: '#fff' },
  swiggy:    { name: 'Swiggy',    bg: '#FC8019', fg: '#fff' },
};
const NOTES = [
  ['instagram', 'rahul.verma_', 'liked your reel ❤️'],
  ['whatsapp',  'Family 🏠', 'Mummy: Khana kha liya? Kab tak phone chalaoge'],
  ['instagram', 'priya.s and 23 others', 'liked your post'],
  ['youtube',   'Shorts for you', 'Ye dekh ke hassi nahi rukegi 😂 · 1.2M views'],
  ['whatsapp',  'College Gang', 'Rohit: bhai ye reel dekh 😂😂 (14 messages)'],
  ['snapchat',  'Riya', '🔥 Your Snapstreak is about to end!'],
  ['instagram', '_aanya.k_', 'started a live video. Watch now'],
  ['zomato',    'Midnight cravings? 🍕', 'Flat 50% off. Order in 2 taps'],
  ['whatsapp',  'Office Team', 'Boss: Are you up? Quick call kal subah'],
  ['youtube',   'Recommended', 'Top 10 moments you missed this week'],
  ['swiggy',    'Instamart 🛒', 'Chips & cold drink in 10 minutes'],
  ['instagram', 'karan.dev', 'sent you a reel'],
];
const icon = (k, cls = 'ai') => {
  const a = APP[k];
  return `<span class="${cls}" style="background:${a.bg}"><svg viewBox="0 0 24 24"><path d="${GLYPH[k]}" fill="${a.fg}"${a.stroke ? ` stroke="${a.stroke}" stroke-width="1.2"` : ''}/></svg></span>`;
};
// fixed landing spots so cards never pile on the device or each other: [left%, top%, tilt]
const SPOTS_TALL = [['L', 22, -2], ['R', 27, 2], ['L', 55, 1.5], ['R', 59, -1.5], ['R', 41, -1], ['L', 37, 1]];
const SPOTS_WIDE = [['L', 26, -2], ['R', 22, 2], ['L', 44, 1.5], ['R', 42, -1.5], ['L', 62, -1], ['R', 61, 1], [' 4', 34, 0], [' 72', 52, 0]];
const badgesEl = $('badges');
let badgeTimer = 0, badgesOn = true, noteI = 0;
const taken = new Set();
function spawnBadge() {
  if (!badgesOn) return;
  const spots = innerWidth > innerHeight ? SPOTS_WIDE : SPOTS_TALL;
  const cap = Math.round(lerp(2, spots.length, seg(prog, 0, .2)));
  const free = spots.map((_, i) => i).filter(i => i < cap && !taken.has(i));
  if (!free.length) return;
  const si = free[(Math.random() * free.length) | 0];
  const [x, y, r] = spots[si];
  const [k, title, body] = NOTES[noteI++ % NOTES.length];
  const b = document.createElement('div');
  b.className = 'note';
  if (x === 'L') b.style.left = '3%'; else if (x === 'R') b.style.right = '3%'; else b.style.left = x.trim() + '%';
  b.style.top = y + '%'; b.style.setProperty('--r', r + 'deg');
  b.innerHTML = `<div class="nh">${icon(k, 'ai sm')}<span class="app">${APP[k].name}</span><span class="dot">·</span><span class="when">now</span></div>
    <div class="nb"><div class="tx"><b>${title}</b><span>${body}</span></div></div>`;
  taken.add(si);
  badgesEl.appendChild(b);
  setTimeout(() => { b.classList.add('out'); setTimeout(() => { b.remove(); taken.delete(si); }, 400); }, 2800 + Math.random() * 1600);
}
function burstBadges() { [...badgesEl.children].forEach((b, i) => setTimeout(() => b.classList.add('suck'), i * 60)); }

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
    o.material.envMapIntensity = .55;
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
const bar = $('bar'), cap1 = $('cap1'), cap2 = $('cap2'), cap3 = $('cap3'), hint = $('hint'), dawn = $('dawn');
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
  if (p < .2) { burst = false; } else if (burst) taken.clear();
  if (badgesOn && t - badgeTimer > (reduce ? 1.6 : .7)) { badgeTimer = t; spawnBadge(); }

  // phones dim one by one during the turn
  phones.forEach((ph, i) => {
    const k = seg(p, .52 + ORDER[i >> 1] * .008, .55 + ORDER[i >> 1] * .008);
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
  const day = wipe > .35;
  bar.style.setProperty('--bar-fg', day ? '#3F4021' : '#e9ecff');
  bar.style.setProperty('--bar-btn-bg', day ? '#3F4021' : '#F2F0EA');
  bar.style.setProperty('--bar-btn-fg', day ? '#F2F0EA' : '#0b1020');
  document.querySelectorAll('.dawn .peep').forEach((el, i) => {
    const k = ease(seg(p, .68 + i * .012, .82 + i * .012));
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
    const wide = camera.aspect > 1;
    const idle = reduce ? 0 : t;
    // act 1: diagonal, slow drift
    let rx = -0.85 + Math.sin(idle * .6) * .06;
    let ry = 0.55 + Math.sin(idle * .4) * .18;
    let rz = 0.55;
    // turn: one full spin, ending face-on with a slight tilt
    ry = lerp(ry, Math.PI * 2 + .42, turn);
    rx = lerp(rx, -0.36, turn);
    rz = lerp(rz, -0.06, turn);
    // after dawn: small idle float, slightly tipped
    rx = lerp(rx, -0.45 + Math.sin(idle * .8) * .04, settle);
    ry = lerp(ry, Math.PI * 2 + .45 + Math.sin(idle * .5) * .1, settle);
    pivot.rotation.set(rx, ry, rz);

    // tap: press in, then bounce back
    const press = Math.sin(clamp(tap) * Math.PI);
    const s = (wide ? .7 : 1) - press * .12 - settle * (wide ? .15 : .3);
    pivot.scale.setScalar(s);
    // position: 40% down the screen, then lift towards the headline area
    const yf = wide ? lerp(.42, .42, turn) : lerp(.43, .41, turn);
    const yfDawn = wide ? .53 : .445;
    pivot.position.y = screenY(lerp(yf, yfDawn, settle)) + Math.sin(idle * 1.1) * 1.2;
    pivot.position.z = -press * 20;
    pivot.position.x = tap > 0 && tap < 1 ? Math.sin(t * 90) * press * 1.6 : 0;

    // light: cold night -> warm dawn
    const L = wipe;
    hemi.color.copy(NIGHT_C.hemi).lerp(DAWN_C.hemi, L);
    key.color.copy(NIGHT_C.key).lerp(DAWN_C.key, L);
    rim.color.copy(NIGHT_C.rim).lerp(DAWN_C.rim, L);
    hemi.intensity = lerp(.45, 1.0, L);
    key.intensity = lerp(.9, 1.6, L);
    rim.intensity = lerp(2.4, .8, L);
    glow.intensity = lerp(0, 0, L) + press * 2600;
    renderer.toneMappingExposure = lerp(.82, .9, L);
  }
  // keep ripple + dawn centre on the device
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// keep cap3 out of the device area on short screens
if (FROZEN !== null) document.documentElement.classList.add('frozen');

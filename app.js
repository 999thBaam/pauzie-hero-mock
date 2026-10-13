import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// ---------- helpers ----------
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (p, a, b) => clamp((p - a) / (b - a));
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => c1.map((v, i) => Math.round(lerp(v, c2[i], t)));
const rgb = c => `rgb(${c.join(',')})`;
const $ = id => document.getElementById(id);

const params = new URLSearchParams(location.search);
const FROZEN = params.has('p') ? parseFloat(params.get('p')) : null;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- strips ----------
// Each card = one scene, "night" (hooked) on top of "day" (free). Day versions are edits of the night picture.
const ROWS = [
  { scenes: ['dinner', 'metro', 'kid', 'wedding', 'office'], dir: -1, speed: 1 },
  { scenes: ['student', 'walk', 'cafe', 'bed'],              dir:  1, speed: .8 },
  { scenes: ['office', 'wedding', 'bed', 'dinner', 'metro'], dir: -1, speed: 1.15 },
];
const stripsEl = $('strips');
const rows = ROWS.map(r => {
  const row = document.createElement('div'); row.className = 'row';
  const track = document.createElement('div'); track.className = 'track';
  row.appendChild(track); stripsEl.appendChild(row);
  return { ...r, row, track, offset: Math.random() * 400, cards: [], unit: 0 };
});
function buildTracks() {
  rows.forEach(r => {
    r.track.innerHTML = ''; r.cards = [];
    const h = r.row.clientHeight, cw = h * 1.5, gap = parseFloat(getComputedStyle(stripsEl).gap) || 10;
    r.unit = r.scenes.length * (cw + gap);                     // width of one copy of the list
    const copies = Math.ceil((innerWidth + r.unit) / r.unit) + 1;
    for (let c = 0; c < copies; c++) r.scenes.forEach(s => {
      const d = document.createElement('div'); d.className = 'card';
      d.innerHTML = `<img class="night" src="assets/scenes/${s}-night.webp" alt="" draggable="false"><img class="day" src="assets/scenes/${s}-day.webp" alt="" loading="lazy" draggable="false">`;
      r.track.appendChild(d); r.cards.push(d);
    });
    r.cw = cw; r.gap = gap;
  });
}

// ---------- three.js device ----------
const canvas = $('device');
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 1, 3000);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;

const hemi = new THREE.HemisphereLight(0x8fa6ff, 0x101225, .45);
const key = new THREE.DirectionalLight(0x9db4ff, .9); key.position.set(-120, 160, 220);
const rim = new THREE.DirectionalLight(0x6fa0ff, 2.4); rim.position.set(180, -40, -120);
const glow = new THREE.PointLight(0xffe2b0, 0, 400, 1.6); glow.position.set(0, -40, 90);
scene.add(hemi, key, rim, glow);
const NIGHT_C = { hemi: new THREE.Color(0x8fa6ff), key: new THREE.Color(0x9db4ff), rim: new THREE.Color(0x6fa0ff) };
const DAWN_C  = { hemi: new THREE.Color(0xfff2e0), key: new THREE.Color(0xffe2bd), rim: new THREE.Color(0xffd29a) };

const pivot = new THREE.Group();
const holder = new THREE.Group(); holder.rotation.x = Math.PI / 2;   // GLB top face (+Y) -> camera (+Z)
pivot.add(holder); scene.add(pivot);
let ready = false;
const draco = new DRACOLoader().setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
new GLTFLoader().setDRACOLoader(draco).load('assets/pact.glb', g => {
  const m = g.scene;
  m.position.sub(new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3()));
  m.traverse(o => {
    if (!o.isMesh) return;
    o.material.envMapIntensity = .55;
    if (/foil/.test(o.name) || /foil/.test(o.material.name)) { o.material.polygonOffset = true; o.material.polygonOffsetFactor = -2; o.material.polygonOffsetUnits = -2; }
  });
  holder.add(m); ready = true;
});

// ---------- layout ----------
const stage = $('stage');
let W = 0, H = 0, devY = 0, wide = false;
function layout() {
  W = stage.clientWidth; H = stage.clientHeight; wide = W > H;
  buildTracks();
  const mid = rows[1].row.getBoundingClientRect(), st = stage.getBoundingClientRect();
  devY = mid.top - st.top + mid.height / 2;                    // device sits on the middle strip
  stage.style.setProperty('--dev-y', devY + 'px');
  renderer.setSize(W, H, false);
  camera.aspect = W / H; camera.updateProjectionMatrix();
  const tf = Math.tan(THREE.MathUtils.degToRad(15)) * 2;
  const frac = wide ? .3 : .42;                                 // device ≈ 42% of phone width, 30% of desktop height
  camera.position.z = wide ? 64 / (frac * tf) : 64 / (frac * tf * camera.aspect);
}
addEventListener('resize', layout);

function worldY(px) { return (0.5 - px / H) * 2 * Math.tan(THREE.MathUtils.degToRad(15)) * camera.position.z; }

// ---------- scroll ----------
const hero = $('hero');
let target = 0, prog = 0;
function readScroll() {
  if (FROZEN !== null) { target = FROZEN; return; }
  const r = hero.getBoundingClientRect();
  target = clamp(-r.top / (r.height - innerHeight));
}
addEventListener('scroll', readScroll, { passive: true });

// ---------- frame ----------
const cap1 = $('cap1'), cap2 = $('cap2'), cap3 = $('cap3'), bar = $('bar'), halo = $('halo');
const rings = [...$('ripple').children];
const meta = document.querySelector('meta[name=theme-color]');
const NIGHT_BG = [11, 16, 32], DAY_BG = [242, 240, 234];
const clock = new THREE.Clock();
let last = 0;

function frame() {
  const t = clock.getElapsedTime(), dt = Math.min(.05, t - last); last = t;
  prog = FROZEN !== null ? target : lerp(prog, target, .12);
  const p = prog;

  const turn = ease(seg(p, .2, .5));     // device spins round
  const tap = seg(p, .5, .6);            // press
  const day = ease(seg(p, .6, .7));     // background + light
  const settle = ease(seg(p, .74, .95));

  // strip speed: busy -> slows during the turn -> stops at the tap -> calm drift after
  const busy = 1 - ease(seg(p, .2, .52));
  const calm = ease(seg(p, .7, .9)) * .22;
  const pxps = (wide ? 70 : 46) * (busy + calm) * (reduce ? 0 : 1);
  rows.forEach((r, ri) => {
    r.offset = (r.offset + pxps * r.speed * dt) % r.unit;
    const x = r.dir < 0 ? -r.offset : r.offset - r.unit;
    r.track.style.transform = `translate3d(${x}px,0,0)`;
    // night -> day flip spreads outward from the device, like the ripple
    r.cards.forEach((c, i) => {
      const cx = x + i * (r.cw + r.gap) + r.cw / 2;
      const d = Math.min(1, Math.abs(cx - W / 2) / (W * .75) + Math.abs(ri - 1) * .12);
      c.style.setProperty('--day', ease(seg(p, .55 + d * .14, .6 + d * .14)));
    });
  });

  // ripple
  rings.forEach((r, i) => {
    const k = seg(p, .53 + i * .035, .72 + i * .035);
    r.style.transform = `translate(-50%,-50%) scale(${k})`;
    r.style.opacity = k > 0 && k < 1 ? (1 - k) * .9 : 0;
  });

  // background, halo, bar
  stage.style.setProperty('--bg', rgb(mix(NIGHT_BG, DAY_BG, day)));
  halo.style.setProperty('--halo', `rgba(${mix([8, 11, 24], [255, 236, 205], day)},${lerp(.92, .55, day)})`);
  halo.style.setProperty('--halo-mid', `rgba(${mix([8, 11, 24], [255, 236, 205], day)},${lerp(.55, .25, day)})`);
  const isDay = day > .5;
  bar.classList.toggle('day', isDay);
  meta.content = isDay ? '#f2f0ea' : '#0b1020';
  bar.style.setProperty('--bar-fg', isDay ? '#3F4021' : '#e9ecff');
  bar.style.setProperty('--bar-btn-bg', isDay ? '#3F4021' : '#F2F0EA');
  bar.style.setProperty('--bar-btn-fg', isDay ? '#F2F0EA' : '#0b1020');

  // captions
  cap1.style.opacity = 1 - seg(p, .14, .22);
  cap2.style.opacity = seg(p, .3, .4) * (1 - seg(p, .56, .62));
  cap3.style.opacity = seg(p, .72, .86);
  cap3.style.transform = `translateY(${(1 - seg(p, .72, .86)) * 18}px)`;

  if (ready) {
    const idle = reduce ? 0 : t;
    let rx = -0.85 + Math.sin(idle * .6) * .06;
    let ry = 0.55 + Math.sin(idle * .4) * .18;
    let rz = 0.55;
    ry = lerp(ry, Math.PI * 2 + .42, turn);
    rx = lerp(rx, -0.36, turn);
    rz = lerp(rz, -0.06, turn);
    rx = lerp(rx, -0.45 + Math.sin(idle * .8) * .04, settle);
    ry = lerp(ry, Math.PI * 2 + .45 + Math.sin(idle * .5) * .1, settle);
    pivot.rotation.set(rx, ry, rz);
    const press = Math.sin(tap * Math.PI);
    pivot.scale.setScalar(1 - press * .12 - settle * .08);
    pivot.position.y = worldY(devY) + Math.sin(idle * 1.1) * 1.2;
    pivot.position.z = -press * 20;
    pivot.position.x = tap > 0 && tap < 1 ? Math.sin(t * 90) * press * 1.6 : 0;

    hemi.color.copy(NIGHT_C.hemi).lerp(DAWN_C.hemi, day);
    key.color.copy(NIGHT_C.key).lerp(DAWN_C.key, day);
    rim.color.copy(NIGHT_C.rim).lerp(DAWN_C.rim, day);
    hemi.intensity = lerp(.45, 1.0, day);
    key.intensity = lerp(.9, 1.6, day);
    rim.intensity = lerp(2.4, .8, day);
    glow.intensity = press * 2600;
    renderer.toneMappingExposure = lerp(.82, .9, day);
  }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

layout(); readScroll();
requestAnimationFrame(frame);

/* How-it-works story viewer. Instagram-story feel: bars fill and cards advance by themselves while the
   section is on screen; tap right/left, swipe, arrows or keys to move; press and hold to pause. */
(() => {
  const STEPS = [
    { img: 'p1', chip: 'Step 1 · Admit it',          h: 'You want to get things done.',               l: 'Reel number 47 disagrees.' },
    { img: 'p2', chip: 'Step 2 · Get Pauzie',        h: 'Bring home a bodyguard.',                    l: 'Small, cream, and very serious about its job.' },
    { img: 'p3', chip: 'Step 3 · Tap',               h: 'Need deep focus? Tap your phone on Pauzie.', l: 'Your distracting apps lock. Instantly.' },
    { img: 'p6', chip: 'Step 4 · Hide it',           h: 'Now hide Pauzie far away.',                  l: 'Top of the almirah. Another room. Another country. Harder to reach, harder to cheat.', low: true },
    { img: 'p4', chip: 'Step 5 · It stands guard',   h: 'Your knight in shining armour.',             l: 'Reels, pings, “just one more”? Not today.' },
    { img: 'p5', chip: 'Step 6 · Tap again',         h: 'Work done? Tap again. Your apps are back.',  l: 'Guilt-free. You earned it.' },
    { end: true },
  ];
  const DUR = 5200;
  const $ = id => document.getElementById(id);
  const sv = $('sv'); if (!sv) return;
  const track = $('svTrack'), bars = $('svBars'), prev = $('svPrev'), next = $('svNext'), hint = $('svHint');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const cards = STEPS.map((s, i) => {
    const c = document.createElement('div');
    c.className = 'sv-card' + (s.end ? ' sv-end' : '');
    c.setAttribute('role', 'group');
    c.setAttribute('aria-label', `${i + 1} of ${STEPS.length}`);
    c.innerHTML = s.end
      ? `<p class="sv-h">Your turn.</p><p class="sv-l">Tap to focus. Tap to come back.</p>
         <a class="sv-cta" href="#">Pre-order ₹1,999</a><button class="sv-again" type="button">Watch again</button>`
      : `<img src="assets/story/${s.img}.webp?v=4" alt="" loading="${i < 2 ? 'eager' : 'lazy'}" draggable="false">
         <div class="sv-text${s.low ? ' sv-low' : ''}"><span class="sv-chip">${s.chip}</span><p class="sv-h">${s.h}</p><p class="sv-l">${s.l}</p></div>`;
    track.appendChild(c);
    return c;
  });
  const fills = STEPS.map(() => { const i = document.createElement('i'); const b = document.createElement('b'); i.appendChild(b); bars.appendChild(i); return b; });
  cards[cards.length - 1].querySelector('.sv-again').addEventListener('click', e => { e.stopPropagation(); go(0); });

  let cur = 0, t0 = performance.now(), elapsed = 0, held = false, seen = false, touched = false;

  function place() {
    const cw = cards[0].offsetWidth, gap = 14;
    cards.forEach((c, i) => {
      const d = i - cur;
      c.classList.toggle('is-cur', d === 0);
      c.style.transform = `translateX(${d * (cw + gap)}px) scale(${d === 0 ? 1 : .88})`;
      c.style.opacity = [1, .75, .35][Math.abs(d)] ?? 0;
      c.style.zIndex = 10 - Math.abs(d);
      c.setAttribute('aria-hidden', String(d !== 0));
    });
    fills.forEach((f, i) => f.style.setProperty('--f', i < cur ? 1 : 0));
    prev.disabled = cur === 0; next.disabled = cur === cards.length - 1;
  }
  function go(i) {
    cur = Math.max(0, Math.min(cards.length - 1, i));
    elapsed = 0; t0 = performance.now();
    place();
  }
  function interact() { touched = true; hint.classList.add('is-gone'); }

  // autoplay while on screen
  new IntersectionObserver(([e]) => { seen = e.intersectionRatio > .5; t0 = performance.now(); }, { threshold: [0, .5, 1] }).observe(sv);
  function tick(now) {
    requestAnimationFrame(tick);
    const running = seen && !held && !document.hidden && !reduce && cur < cards.length - 1;
    if (running) elapsed += now - t0;
    t0 = now;
    fills[cur].style.setProperty('--f', cur === cards.length - 1 ? 1 : Math.min(1, elapsed / DUR));
    if (running && elapsed >= DUR) go(cur + 1);
  }
  requestAnimationFrame(tick);

  // tap / swipe / hold
  let x0 = 0, y0 = 0, down = 0, holdTimer;
  sv.addEventListener('pointerdown', e => {
    if (e.target.closest('a,button')) return;
    x0 = e.clientX; y0 = e.clientY; down = performance.now();
    holdTimer = setTimeout(() => { held = true; }, 220);
  });
  sv.addEventListener('pointerup', e => {
    if (!down) return;
    clearTimeout(holdTimer);
    const dx = e.clientX - x0, dy = e.clientY - y0, long = performance.now() - down > 220;
    down = 0; held = false;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { interact(); go(cur + (dx < 0 ? 1 : -1)); return; }
    if (long || Math.abs(dy) > 12) return;
    const card = e.target.closest('.sv-card');
    if (card && !card.classList.contains('is-cur')) { interact(); go(cards.indexOf(card)); return; }
    if (card) { interact(); const r = card.getBoundingClientRect(); go(cur + (e.clientX - r.left < r.width / 3 ? -1 : 1)); }
  });
  sv.addEventListener('pointercancel', () => { clearTimeout(holdTimer); down = 0; held = false; });
  sv.addEventListener('mouseenter', () => { if (matchMedia('(hover: hover)').matches) held = true; });
  sv.addEventListener('mouseleave', () => { held = false; });
  prev.addEventListener('click', () => { interact(); go(cur - 1); });
  next.addEventListener('click', () => { interact(); go(cur + 1); });
  sv.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') { interact(); go(cur + 1); }
    if (e.key === 'ArrowLeft') { interact(); go(cur - 1); }
  });
  addEventListener('resize', place);

  const q = new URLSearchParams(location.search).get('story');   // ?story=3 opens a card (screenshots)
  go(q ? +q : 0);
  requestAnimationFrame(() => requestAnimationFrame(() => sv.classList.add('is-ready')));
})();

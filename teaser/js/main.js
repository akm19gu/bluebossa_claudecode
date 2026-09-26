// Boot, frame rendering (shutter-accumulated), and a scrub preview.
'use strict';

const SUBFRAMES = 5;       // motion-blur samples per frame
const SUBFRAMES_FAST = 14; // during fast moves (see fastMotion in scenes.js)
const SHUTTER = 0.5;       // 180° shutter

const out = document.getElementById('out');
const scene = makeCanvas(W, H), sctx = scene.getContext('2d', { willReadFrequently: false });
const hud = makeCanvas(W, H), hctx = hud.getContext('2d');
let post;

function loadImage(src) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
}

async function boot() {
  const [tm, meta] = await Promise.all([
    fetch('assets/timing.json').then(r => r.json()),
    fetch('assets/glyphs.json').then(r => r.json()),
  ]);
  initTimeline(tm);
  A.meta = meta;
  const names = { unlit: 'logo_unlit', letters: 'letters', layerMid: 'layer_mid', layerKeys: 'layer_keys' };
  await Promise.all(Object.entries(names).map(async ([k, f]) => { A[k] = await loadImage(`assets/${f}.png`); }));
  const fonts = ['300 100px Inter', '400 20px Inter', '500 20px Inter', '600 100px Inter',
    '500 100px "Cormorant Garamond"', '500 20px "Noto Sans JP"'];
  await Promise.all(fonts.map(f => document.fonts.load(f, f.includes('Noto') ? '秋う' : 'Aa0♭')));
  await document.fonts.ready;

  // Lettering band of the painting as a mask for the specular sweep.
  const gs = Object.values(meta.glyphs);
  const bx = Math.min(...gs.map(g => g.x0)) - 10, by = Math.min(...gs.map(g => g.y0)) - 10;
  const bw = Math.max(...gs.map(g => g.x1)) + 10 - bx, bh = Math.max(...gs.map(g => g.y1)) + 10 - by;
  const lc = makeCanvas(bw, bh); lc.getContext('2d').drawImage(A.letters, bx, by, bw, bh, 0, 0, bw, bh);
  A.lettersGlyph = { cv: lc, w: bw, h: bh, bx, by };

  post = new Post(out);
  window.READY = true;
  return { float: post.float };
}

function renderFrame(f) {
  const t = f / FPS;
  const n = fastMotion(t) ? SUBFRAMES_FAST : SUBFRAMES;
  post.begin();
  for (let i = 0; i < n; i++) {
    const ts = clamp(t + ((i + 0.5) / n - 0.5) * SHUTTER / FPS, 0, DUR - 1e-4);
    drawScene(sctx, ts);
    post.add(scene, 1 / n);
  }
  drawHUD(hctx, t);
  post.finish(hud, postParams(t, f));
  post.gl.finish();
  return true;
}
window.renderFrame = renderFrame;

const bootP = boot().catch(e => { window.BOOT_ERROR = String(e && e.stack || e); throw e; });
window.bootP = bootP;

// Preview: ?t=seconds renders one frame; ?play plays in real time (approximate, no audio).
bootP.then(() => {
  const q = new URLSearchParams(location.search);
  if (q.has('render')) return;
  if (q.has('t')) { renderFrame(Math.round(parseFloat(q.get('t')) * FPS)); return; }
  const t0 = performance.now();
  const loop = () => { const t = ((performance.now() - t0) / 1000) % DUR; renderFrame(Math.floor(t * FPS)); requestAnimationFrame(loop); };
  loop();
});

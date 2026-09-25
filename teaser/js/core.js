// Shared timing, easing and drawing helpers. Everything is a pure function of
// time so any frame can be rendered in any order (parallel workers, scrubbing).
'use strict';

const W = 1920, H = 1080, FPS = 60, DUR = 15;

const TL = {}; // timeline, filled by initTimeline() from assets/timing.json

function initTimeline(tm) {
  TL.tm = tm;
  TL.beatLen = tm.beat;
  TL.g0 = tm.grid0;
  TL.beat = k => TL.g0 + k * TL.beatLen;
  TL.first = tm.firstHit;          // piano's first chord (pushed ahead of the grid)
  TL.drums = 2.636;                 // drums enter on bar 1 beat 3 (measured attack)
  TL.bar = n => TL.beat(4 * (n - 1)); // bar n downbeat (1-based)
  TL.B2 = TL.bar(2); TL.B3 = TL.bar(3); TL.B4 = TL.bar(4); TL.B5 = TL.bar(5); TL.B6 = TL.bar(6);
  TL.chords = [
    { t: TL.first, sym: 'Cm7', fn: 'i' },
    { t: TL.B2, sym: 'Fm7', fn: 'iv' },
    { t: TL.B3, sym: 'Dm7♭5', fn: 'ii' },
    { t: TL.B4, sym: 'G7', fn: 'V' },
    { t: TL.B5, sym: 'Cm7', fn: 'i' },
    { t: TL.B6, sym: 'E♭m7', fn: 'ii / D♭' },
  ];
}

function envAt(name, t) {
  const a = name === 'all' ? TL.tm.envAll : TL.tm.env[name];
  const f = t * FPS, i = Math.floor(f), fr = f - i;
  const g = k => a[Math.max(0, Math.min(a.length - 1, k))];
  return g(i) + (g(i + 1) - g(i)) * fr;
}

// Sum of decaying pulses from detected onsets in a band (0..~1).
function onsetPulse(band, t, decay = 0.12, minS = 0) {
  let v = 0;
  for (const o of TL.tm.onsets[band]) {
    if (o.t > t) break;
    if (o.s < minS) continue;
    v += o.s * Math.exp(-(t - o.t) / decay);
  }
  return Math.min(1.2, v);
}

// ---------- math ----------
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const inv = (a, b, x) => clamp((x - a) / (b - a));
const E = {
  lin: x => x,
  inCubic: x => x * x * x,
  outCubic: x => 1 - Math.pow(1 - x, 3),
  inOutCubic: x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2,
  outQuart: x => 1 - Math.pow(1 - x, 4),
  inQuart: x => x * x * x * x,
  outQuint: x => 1 - Math.pow(1 - x, 5),
  outExpo: x => x >= 1 ? 1 : 1 - Math.pow(2, -10 * x),
  inExpo: x => x <= 0 ? 0 : Math.pow(2, 10 * x - 10),
  inOutExpo: x => x <= 0 ? 0 : x >= 1 ? 1 : x < .5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2,
  inOutSine: x => -(Math.cos(Math.PI * x) - 1) / 2,
  outBack: x => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
  outElastic: x => x <= 0 ? 0 : x >= 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - .75) * (2 * Math.PI) / 3) + 1,
};
const seg = (t, a, b, ease = E.lin) => ease(inv(a, b, t));
const pulse = (t, t0, d) => t < t0 ? 0 : Math.exp(-(t - t0) / d);
const win = (t, a, b) => t >= a && t < b;

function rng(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let r = Math.imul(seed ^ seed >>> 15, 1 | seed);
    r = r + Math.imul(r ^ r >>> 7, 61 | r) ^ r;
    return ((r ^ r >>> 14) >>> 0) / 4294967296;
  };
}
// Smooth 1D value noise, deterministic.
function noise1(x, seed = 0) {
  const h = n => { const s = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453; return s - Math.floor(s); };
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(h(i), h(i + 1), u) * 2 - 1;
}

// ---------- palette ----------
const C = {
  ink: '#0a0706', ink2: '#120b08', rose: '#2b120c', mahog: '#5a2314',
  gold: '#f4d77a', goldHi: '#fff3c4', goldMid: '#d9a441', goldLo: '#8a5a1c',
  ivory: '#f2ece0', blue: '#8cc4d6', navy: '#0b1620', red: '#c8412e',
};
const rgba = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
};

// ---------- canvas helpers ----------
function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w); c.height = Math.ceil(h);
  return c;
}

// Music flat drawn as a path (none of the display faces carry U+266D).
function flatPath(ctx, x, y, h) {
  const w = h * 0.42, s = Math.max(1, h * 0.075);
  ctx.beginPath();
  ctx.rect(x, y - h, s, h);
  ctx.moveTo(x + s, y - h * 0.40);
  ctx.bezierCurveTo(x + w * 0.85, y - h * 0.62, x + w * 1.28, y - h * 0.40, x + w * 0.98, y - h * 0.22);
  ctx.bezierCurveTo(x + w * 0.8, y - h * 0.08, x + w * 0.4, y - h * 0.02, x + s, y);
  ctx.lineTo(x + s, y - h * 0.13);
  ctx.bezierCurveTo(x + w * 0.42, y - h * 0.17, x + w * 0.76, y - h * 0.28, x + w * 0.70, y - h * 0.37);
  ctx.bezierCurveTo(x + w * 0.62, y - h * 0.47, x + w * 0.3, y - h * 0.40, x + s, y - h * 0.29);
  ctx.closePath();
  ctx.fill();
}

// Text that may contain '♭'; font must already be set. Returns width.
function textFlat(ctx, str, x, y, size, { align = 'left', measure = false, flatScale = 0.78 } = {}) {
  const parts = str.split('♭');
  const fw = size * flatScale * 0.46;
  let total = 0;
  parts.forEach((p, i) => { total += ctx.measureText(p).width; if (i < parts.length - 1) total += fw; });
  if (measure) return total;
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  const prevAlign = ctx.textAlign; ctx.textAlign = 'left';
  parts.forEach((p, i) => {
    ctx.fillText(p, cx, y); cx += ctx.measureText(p).width;
    if (i < parts.length - 1) { flatPath(ctx, cx + fw * 0.12, y - size * 0.02, size * flatScale); cx += fw; }
  });
  ctx.textAlign = prevAlign;
  return total;
}

// Lead-sheet style chord symbol: root big, accidental raised, quality, extensions superscript.
function parseChord(sym) {
  const m = sym.match(/^([A-G])(♭?)(m?)(.*)$/);
  return { root: m[1], acc: m[2], q: m[3], ext: m[4] };
}
function chordWidth(ctx, sym, size, family = 'Cinzel', weight = 700) {
  return drawChord(ctx, sym, 0, 0, size, { family, weight, measure: true });
}
function drawChord(ctx, sym, x, y, size, { family = 'Cinzel', weight = 700, measure = false, align = 'left' } = {}) {
  const c = parseChord(sym);
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  const run = (draw) => {
    let cx = 0;
    ctx.font = `${weight} ${size}px ${family}`;
    if (draw) ctx.fillText(c.root, x + cx, y);
    cx += ctx.measureText(c.root).width + size * 0.02;
    if (c.acc) { if (draw) flatPath(ctx, x + cx, y - size * 0.34, size * 0.52); cx += size * 0.26; }
    if (c.q) {
      // Cinzel has no lowercase (its 'm' is a small cap that would read as "M7"), so
      // the minor sign is set in Cormorant.
      ctx.font = `600 ${size * 0.8}px "Cormorant Garamond"`;
      if (draw) ctx.fillText(c.q, x + cx, y);
      cx += ctx.measureText(c.q).width + size * 0.04;
    }
    if (c.ext) {
      const es = size * 0.46;
      ctx.font = `${weight - 100} ${es}px ${family}`;
      const ey = y - size * 0.40;
      const parts = c.ext.split('♭');
      parts.forEach((p, i) => {
        if (draw) ctx.fillText(p, x + cx, ey);
        cx += ctx.measureText(p).width;
        if (i < parts.length - 1) { if (draw) flatPath(ctx, x + cx + es * 0.06, ey, es * 0.82); cx += es * 0.44; }
      });
    }
    return cx;
  };
  const w = run(false);
  if (!measure) {
    if (align === 'center') x -= w / 2; else if (align === 'right') x -= w;
    run(true);
  }
  ctx.restore();
  return w;
}

// Gold leaf material rendered once into a bitmap: gradient body, brushed
// texture sampled from the logo's own lettering, engraved edge and rim light.
function goldGlyph(text, font, size, { pad = 40, letterTex = null, tracking = 0 } = {}) {
  const m = makeCanvas(10, 10).getContext('2d');
  m.font = font; m.letterSpacing = tracking + 'px';
  const tm = m.measureText(text);
  const w = Math.ceil(tm.actualBoundingBoxLeft + tm.actualBoundingBoxRight) + pad * 2;
  const h = Math.ceil(tm.actualBoundingBoxAscent + tm.actualBoundingBoxDescent) + pad * 2;
  const cv = makeCanvas(w, h), g = cv.getContext('2d');
  const ox = pad + tm.actualBoundingBoxLeft, oy = pad + tm.actualBoundingBoxAscent;
  g.font = font; g.letterSpacing = tracking + 'px'; g.textBaseline = 'alphabetic';
  const gr = g.createLinearGradient(0, pad, 0, h - pad);
  gr.addColorStop(0, '#fff6cf'); gr.addColorStop(0.28, '#f6d77c'); gr.addColorStop(0.55, '#d8a540');
  gr.addColorStop(0.78, '#f0c965'); gr.addColorStop(1, '#8a5a1c');
  g.fillStyle = gr; g.fillText(text, ox, oy);
  if (letterTex) {
    // brushed leaf from the painting, clipped to the glyph before blending
    const tx = makeCanvas(w, h), tg = tx.getContext('2d');
    tg.drawImage(letterTex.img, letterTex.sx, letterTex.sy, letterTex.sw, letterTex.sh, 0, 0, w, h);
    tg.globalCompositeOperation = 'destination-in'; tg.drawImage(cv, 0, 0);
    g.globalAlpha = 0.7; g.globalCompositeOperation = 'overlay'; g.drawImage(tx, 0, 0);
    g.globalAlpha = 1;
  }
  g.globalCompositeOperation = 'source-atop';
  // diagonal sheen bands
  const sh = g.createLinearGradient(0, 0, w, h);
  sh.addColorStop(0.0, 'rgba(255,255,255,0)'); sh.addColorStop(0.38, 'rgba(255,250,220,0.0)');
  sh.addColorStop(0.46, 'rgba(255,250,220,0.35)'); sh.addColorStop(0.52, 'rgba(255,250,220,0)');
  sh.addColorStop(1, 'rgba(0,0,0,0.25)');
  g.fillStyle = sh; g.fillRect(0, 0, w, h);
  // engraved inner edge
  g.lineWidth = Math.max(2, size * 0.008); g.strokeStyle = 'rgba(90,50,10,0.75)';
  g.strokeText(text, ox, oy);
  g.globalCompositeOperation = 'source-over';
  g.lineWidth = Math.max(1, size * 0.0025); g.strokeStyle = 'rgba(255,245,210,0.55)';
  g.strokeText(text, ox, oy);
  return { cv, w, h, ox, oy };
}

// Draw a bitmap-with-alpha as a mask filled by a moving highlight band (additive).
const _sweep = { cv: null };
function sweep(ctx, glyph, dx, dy, dw, dh, pos, width = 0.12, alpha = 1, angle = 0.35) {
  if (alpha <= 0.001) return;
  if (!_sweep.cv || _sweep.cv.width < glyph.w || _sweep.cv.height < glyph.h) _sweep.cv = makeCanvas(Math.max(glyph.w, 1400), Math.max(glyph.h, 1400));
  const g = _sweep.cv.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, glyph.w, glyph.h);
  g.drawImage(glyph.cv, 0, 0);
  g.globalCompositeOperation = 'source-in';
  const cx = lerp(-0.3, 1.3, pos) * glyph.w;
  const gr = g.createLinearGradient(cx - glyph.w * width, -glyph.h * angle, cx + glyph.w * width, glyph.h * angle);
  gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, `rgba(255,252,235,${alpha})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, glyph.w, glyph.h);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(_sweep.cv, 0, 0, glyph.w, glyph.h, dx, dy, dw, dh);
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

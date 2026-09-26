// White, typographic layout read top-left to bottom-right: the headline is the
// way in, the square "stage" (the album-cover shape of the logo) sits lower
// right, the statement text fills the lower left, and the event line closes the
// frame at the bottom right. The painting is the only colour in the film.
//
//   0.00  count-in  "Post251"          stage: frame draws, "4"
//   0.72  bar 1  Cm7   "Experimental digital jazz"   stage: the painted keys (acoustic); first chord on beat 2
//   3.33  bar 2  Fm7   "Rhythm and harmony"          stage: drunk feel vs. a straight grid, notes between the keys
//   5.94  bar 3  Dm7♭5 "Beyond convention"           stage: ii
//   8.54  bar 4  G7    "ii – V – I"                  stage: V, then an empty slot for the I
//  11.15  bar 5  Cm7   "Acoustic and digital"        stage: the I lands late, is struck out, the logo takes its place
//  12.46  (beat 3)     "Grooves"                     album, event
//  13.76  bar 6  E♭m7  hold
'use strict';

const A = {}; // images and logo metadata (filled by main.js)

const PAPER = '#F4F3EF', INK = '#151515';
const ink = a => `rgba(21,21,21,${a})`;
const SQ = { x: 1080, y: 180, s: 720 };   // stage drawing space
SQ.cx = SQ.x + SQ.s / 2; SQ.cy = SQ.y + SQ.s / 2;
const STAGE = { x: 1150, y: 258, s: 650 }; // where the stage sits on screen
const COL = { x: 120, w: 780 };

// Map the stage's drawing space onto its place on screen.
function stageSpace(ctx) {
  const k = STAGE.s / SQ.s;
  ctx.translate(STAGE.x - SQ.x * k, STAGE.y - SQ.y * k); ctx.scale(k, k);
}

// ---------------------------------------------------------------- utilities
function clipStage(ctx) { ctx.beginPath(); ctx.rect(SQ.x, SQ.y, SQ.s, SQ.s); ctx.clip(); }

function hair(ctx, x0, y0, x1, y1, a = 1, lw = 1) {
  ctx.strokeStyle = ink(a); ctx.lineWidth = lw;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
}

function label(ctx, s, x, y, { size = 13, a = 0.55, align = 'left', track = 0.3, weight = 500 } = {}) {
  ctx.font = `${weight} ${size}px Inter`; ctx.letterSpacing = track + 'px';
  ctx.fillStyle = ink(a); ctx.textAlign = align; ctx.fillText(s, x, y);
  ctx.letterSpacing = '0px'; ctx.textAlign = 'left';
}

// ------------------------------------------------------------ the painting
// cam = {x, y, z, rot} in logo2x pixels, drawn around the screen point (vx, vy);
// the three layers slide against each other for 2.5D parallax (par = 0: flat).
function logoLayers() {
  return [
    { img: A.unlit, sy: 0, sh: 1080, p: 0.93 },
    { img: A.layerMid, sy: A.meta.layers.mid.y0, p: 1.0 },
    { img: A.layerKeys, sy: A.meta.layers.keys.y0, p: 1.1 },
  ];
}
function layerXf(cam, p, par) {
  const k = 1 + (p - 1) * par, z = cam.z * (1 + (p - 1) * par * 0.5);
  return { z, cx: 1000 + (cam.x - 1000) * k, cy: 1000 + (cam.y - 1000) * k };
}
function drawLogo(ctx, cam, vx, vy, { ign = null, par = 1, glowBoost = 0 } = {}) {
  ctx.save();
  ctx.imageSmoothingQuality = 'high';
  const base = ctx.getTransform();
  logoLayers().forEach((L, i) => {
    const f = layerXf(cam, L.p, par);
    ctx.setTransform(base); ctx.translate(vx, vy);
    if (cam.rot) ctx.rotate(cam.rot);
    ctx.scale(f.z, f.z); ctx.translate(-f.cx, -f.cy);
    if (i > 0) { ctx.drawImage(L.img, 0, L.sy); return; }
    ctx.drawImage(L.img, 0, 0, 2000, L.sh, 0, 0, 2000, L.sh);
    if (!ign) return;
    for (const [g, lv] of Object.entries(ign)) {
      if (lv <= 0.001) continue;
      const b = A.meta.glyphs[g], pad = 14;
      const bx = b.x0 - pad, by = b.y0 - pad, bw = b.x1 - b.x0 + 2 * pad, bh = b.y1 - b.y0 + 2 * pad;
      ctx.globalAlpha = Math.min(1, lv);
      ctx.drawImage(A.letters, bx, by, bw, bh, bx, by, bw, bh);
      const over = Math.min(0.8, Math.max(0, lv - 1) + glowBoost);
      if (over > 0.001) {
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = over;
        ctx.drawImage(A.letters, bx, by, bw, bh, bx, by, bw, bh);
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.globalAlpha = 1;
    }
  });
  ctx.restore();
}
function logoToScreen(cam, vx, vy, px, py, par = 1) {
  const f = layerXf(cam, 0.93, par);
  let dx = (px - f.cx) * f.z, dy = (py - f.cy) * f.z;
  if (cam.rot) { const c = Math.cos(cam.rot), s = Math.sin(cam.rot); [dx, dy] = [dx * c - dy * s, dx * s + dy * c]; }
  return { x: vx + dx, y: vy + dy };
}
// Keep a camera inside the painting for a viewport of half-size (hw, hh).
function clampCam(cam, hw, hh, par) {
  const k = 1 - 0.07 * par, zb = cam.z * (1 - 0.07 * par * 0.5);
  const ex = (hw + Math.abs(cam.rot || 0) * hh) / zb + 4, ey = (hh + Math.abs(cam.rot || 0) * hw) / zb + 4;
  const bx = clamp(1000 + (cam.x - 1000) * k, ex, 2000 - ex), by = clamp(1000 + (cam.y - 1000) * k, ey, 2000 - ey);
  return { ...cam, x: 1000 + (bx - 1000) / k, y: 1000 + (by - 1000) / k };
}

// Piano keys falling through a box as a left-to-right glissando: complete on
// the downbeat th, then falling away so the next picture opens on the hit.
function keyWipe(ctx, t, th, box, n = 7) {
  const kw = box.w / n, st = 0.022;
  const keyY = i => {
    const c = E.outCubic(inv(th - 0.26 + i * st, th - 0.26 + i * st + 0.11, t));
    const u = E.outQuart(inv(th + i * st * 0.6, th + i * st * 0.6 + 0.2, t));
    return lerp(-box.h * 1.08, 0, c) + u * box.h * 1.12;
  };
  const ys = Array.from({ length: n }, (_, i) => keyY(i));
  if (ys.every(y => y <= -box.h || y >= box.h)) return;
  ctx.save();
  ctx.beginPath(); ctx.rect(box.x, box.y, box.w, box.h); ctx.clip();
  for (let i = 0; i < n; i++) {
    const y = box.y + ys[i], x = box.x + i * kw;
    const g = ctx.createLinearGradient(0, y, 0, y + box.h);
    g.addColorStop(0, '#dcd7cc'); g.addColorStop(0.75, '#f3efe6'); g.addColorStop(1, '#fbf9f4');
    ctx.fillStyle = g; roundRect(ctx, x + 1, y - 30, kw - 2, box.h + 30, 7); ctx.fill();
    ctx.strokeStyle = ink(0.35); ctx.lineWidth = 1; ctx.stroke();
  }
  for (let i = 0; i < n - 1; i++) {
    if (![0, 1, 3, 4, 5].includes(i % 7)) continue;
    const y = box.y + (ys[i] + ys[i + 1]) / 2;
    const bw = kw * 0.56, bx = box.x + (i + 1) * kw - bw / 2, bh = box.h * 0.6;
    const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    g.addColorStop(0, '#060606'); g.addColorStop(0.5, '#242325'); g.addColorStop(1, '#070707');
    ctx.fillStyle = g; roundRect(ctx, bx, y - 30, bw, bh + 30, 5); ctx.fill();
  }
  ctx.restore();
}

// --------------------------------------------------------------- headline
function headlines() {
  return [
    { t: 0.03, lines: ['Post251'] },
    { t: TL.B1, lines: ['Experimental', 'digital jazz'] },
    { t: TL.B2, lines: ['Rhythm and', 'harmony'] },
    { t: TL.B3, lines: ['Beyond', 'convention'] },
    { t: TL.B4, lines: ['ii – V – I'] },
    { t: TL.B5, lines: ['Acoustic and', 'digital'] },
    { t: TL.beat(18), lines: ['Grooves'], label: 'Upcoming album' },
  ];
}
function drawHeadline(ctx, t) {
  // The headline block is one slot, two lines plus descenders tall: the old
  // block rolls up out of it while the new one rolls in from a full slot below,
  // so they never meet and nothing below the baseline is cut.
  const HL = headlines();
  const size = 118, lh = 126, top = 322, slot = 2 * lh + Math.round(size * 0.34);
  let i = -1;
  HL.forEach((h, k) => { if (t >= h.t - 0.03) i = k; });
  if (i < 0) return;
  const cur = HL[i], prev = HL[i - 1];
  const p = seg(t, cur.t - 0.03, cur.t + 0.55, E.outExpo);
  ctx.save();
  ctx.beginPath(); ctx.rect(COL.x - 10, top - size * 0.96, STAGE.x - COL.x - 40, slot); ctx.clip();
  ctx.font = `600 ${size}px Inter`; ctx.letterSpacing = '-4.5px'; ctx.fillStyle = INK; ctx.textBaseline = 'alphabetic';
  const block = (lines, dy) => lines.forEach((line, li) => ctx.fillText(line, COL.x - 5, top + li * lh + dy));
  if (prev && p < 1) block(prev.lines, -p * slot);
  block(cur.lines, (1 - p) * slot);
  ctx.restore();
  if (cur.label) {
    const e = seg(t, cur.t, cur.t + 0.4, E.outExpo);
    ctx.save(); ctx.globalAlpha = e;
    label(ctx, cur.label, COL.x, top - size - 12 + (1 - e) * 10, { size: 20, a: 0.6, weight: 500 });
    ctx.restore();
  }
}

// -------------------------------------------------------------- manifesto
// The whole text is laid out once so words never reflow. Each phrase fades in
// just after its downbeat (the eye takes the headline and the stage first) and
// greys out when the next one arrives. Words prefixed with * are semibold.
function phrases() {
  return [
    [0.06, '*Post251 is an experimental digital jazz unit'],
    [TL.B1, 'formed by drummer and composer *Nakam.'],
    [TL.B2, 'From the perspectives of *rhythm and *harmony,'],
    [TL.B3, 'we aim to move beyond broadly applied conventions in music,'],
    [TL.B4, 'including the *ii–V–I progression.'],
    [TL.B5, 'Crossing the boundary between *acoustic and *digital sound, we explore new possibilities for music.'],
    [TL.beat(18), 'In the upcoming album *‘Grooves’, we pursue *microtonal *harmony and *dilla *(drunk) *feel in a practical way in jazz ground.'],
  ];
}
let _para = null;
function layoutPara(ctx) {
  const size = 22, lh = 35, sp = 5.9;
  const words = [];
  phrases().forEach(([t0, text], pi) => {
    text.split(' ').forEach(w => {
      const bold = w.startsWith('*');
      words.push({ s: bold ? w.slice(1) : w, bold, pi, t: t0 + (pi ? 0.14 : 0) });
    });
  });
  let x = 0, line = 0;
  for (const w of words) {
    ctx.font = `${w.bold ? 600 : 400} ${size}px Inter`;
    w.w = ctx.measureText(w.s).width;
    if (x > 0 && x + w.w > COL.w) { x = 0; line++; }
    w.x = x; w.line = line; x += w.w + sp;
  }
  _para = { words, size, lh, top: 590 };
}
function drawPara(ctx, t) {
  if (!_para) layoutPara(ctx);
  const P = _para, starts = phrases().map(p => p[0]);
  ctx.save(); ctx.textBaseline = 'alphabetic'; ctx.letterSpacing = '0px';
  for (const w of P.words) {
    const e = seg(t, w.t, w.t + 0.45, E.outCubic);
    if (e <= 0) continue;
    const nextStart = starts[w.pi + 1];
    const past = nextStart === undefined ? 0 : seg(t, nextStart, nextStart + 0.35);
    const c = Math.round(lerp(21, 150, past));
    ctx.font = `${w.bold ? 600 : 400} ${P.size}px Inter`;
    ctx.fillStyle = `rgba(${c},${c - 3},${c - 8},${e})`;
    ctx.fillText(w.s, COL.x + w.x, P.top + w.line * P.lh + (1 - e) * 10);
  }
  ctx.restore();
}

// ---------------------------------------------------------- stage: frame
function drawFrame(ctx, t) {
  const p = seg(t, 0.02, 0.62, E.inOutCubic);
  let left = SQ.s * 4 * p;
  const pts = [[SQ.x, SQ.y], [SQ.x + SQ.s, SQ.y], [SQ.x + SQ.s, SQ.y + SQ.s], [SQ.x, SQ.y + SQ.s], [SQ.x, SQ.y]];
  ctx.save(); ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(...pts[0]);
  for (let i = 1; i < pts.length && left > 0; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i], f = Math.min(left, SQ.s) / SQ.s;
    ctx.lineTo(ax + (bx - ax) * f, ay + (by - ay) * f); left -= SQ.s;
  }
  ctx.stroke(); ctx.restore();
}

// S0 — count-in: two silent beats inside an empty stage
function st0(ctx, t) {
  ctx.save(); clipStage(ctx);
  const g = seg(t, 0.08, 0.6, E.outCubic);
  for (let i = 1; i < 4; i++) {
    hair(ctx, SQ.x + SQ.s * i / 4, SQ.y, SQ.x + SQ.s * i / 4, SQ.y + SQ.s * g, 0.07);
    hair(ctx, SQ.x, SQ.y + SQ.s * i / 4, SQ.x + SQ.s * g, SQ.y + SQ.s * i / 4, 0.07);
  }
  ctx.font = '300 220px Inter'; ctx.textAlign = 'center'; ctx.letterSpacing = '-8px';
  [['4', TL.beat(-1)]].forEach(([s, bt]) => {
    const e = seg(t, bt - 0.02, bt + 0.12, E.outCubic), o = 1 - seg(t, bt + 0.36, bt + 0.6, E.inCubic);
    if (e * o <= 0) return;
    const sc = lerp(1.15, 1, E.outExpo(inv(bt, bt + 0.5, t)));
    ctx.save(); ctx.translate(SQ.cx, SQ.cy + 78); ctx.scale(sc, sc);
    ctx.fillStyle = ink(e * o); ctx.fillText(s, 0, 0); ctx.restore();
  });
  ctx.letterSpacing = '0px'; ctx.textAlign = 'left';
  // the pickup's four beats along the bottom edge
  for (let i = 0; i < 4; i++) {
    const bt = TL.beat(i - 4), on = i === 3 && t >= bt ? pulse(t, bt, 0.3) : 0;
    const x = SQ.x + SQ.s * (i + 0.5) / 4;
    ctx.fillStyle = ink(0.25 + 0.75 * on);
    ctx.fillRect(x - 1, SQ.y + SQ.s - 36 - 12 * on, 2, 14 + 12 * on);
  }
  // anticipation: a hairline across the middle, about to open
  const k = seg(t, TL.B1 - 0.34, TL.B1, E.inCubic);
  if (k > 0) hair(ctx, SQ.cx - SQ.s / 2 * k, SQ.cy, SQ.cx + SQ.s / 2 * k, SQ.cy, 1, 1.5);
  ctx.restore();
}

// S1 — the painted keys, opening from the hairline
function st1(ctx, t) {
  const t0 = TL.B1, lt = t - t0;
  const whip = seg(t, TL.drums - 0.12, TL.drums + 0.2, E.inOutExpo);
  const impact = 1 - seg(t, t0, t0 + 0.7, E.outExpo);
  let cam = { x: 800 + lt * 24 + whip * 380, y: 1440 - lt * 10, z: 0.84 * (1 + 0.1 * impact) * (1 + lt * 0.02), rot: -0.05 + whip * 0.03 };
  cam = clampCam(cam, SQ.s / 2, SQ.s / 2, 1.3);
  const open = seg(t, t0, t0 + 0.45, E.outExpo);
  const hh = SQ.s / 2 * open;
  ctx.save();
  ctx.beginPath(); ctx.rect(SQ.x, SQ.cy - hh, SQ.s, 2 * hh); ctx.clip();
  drawLogo(ctx, cam, SQ.cx, SQ.cy, { par: 1.3 });
  ctx.restore();
  if (open < 1) {
    hair(ctx, SQ.x, SQ.cy - hh, SQ.x + SQ.s, SQ.cy - hh, 1 - open, 1.5);
    hair(ctx, SQ.x, SQ.cy + hh, SQ.x + SQ.s, SQ.cy + hh, 1 - open, 1.5);
  }
}

// S2 — what the band is after (an illustration, not something this recording
// does): a drunk / dilla feel pulled off a straight grid, and harmony that
// lands between the keys.
const DRUNK = [ // [16th step, offset ms, weight, label?]
  [0, -12, 1, true], [2, 36, 0.5], [4, 82, 0.9, true], [6, 24, 0.5], [7, -34, 0.45],
  [8, 6, 1], [10, 48, 0.5], [11, 90, 0.55], [12, 74, 0.9, true], [14, 30, 0.5],
];
const MICRO = [[0, 'C'], [5, 'E♭ −50¢'], [10, 'F'], [17, 'A♭ +50¢']]; // quarter tones above C, one per beat
const isBlackPc = pc => [1, 3, 6, 8, 10].includes(pc);

function st2(ctx, t) {
  const t0 = TL.B2, t1 = TL.B3, step = TL.beatLen / 4;
  const ent = seg(t, t0, t0 + 0.6, E.outExpo);
  const ex = seg(t, t1 - 0.36, t1 - 0.02, E.inQuart);
  const sc = (1 - ex) * lerp(0.92, 1, ent), la = 0.6 * ent * (1 - ex);
  const draw = seg(t, t0, t0 + 0.5, E.outCubic);
  ctx.save(); clipStage(ctx);
  label(ctx, 'Dilla (drunk) feel', SQ.x + 24, SQ.y + 44, { size: 18, a: 1.3 * la });
  label(ctx, 'Microtonal harmony', SQ.x + 24, SQ.cy + 44, { size: 18, a: 1.3 * la });
  hair(ctx, SQ.x + 24, SQ.cy, SQ.x + 24 + (SQ.s - 48) * draw, SQ.cy, 0.15 * (1 - ex));
  ctx.translate(SQ.cx, SQ.cy); ctx.scale(sc, sc); ctx.rotate(ex * 2.2); ctx.translate(-SQ.cx, -SQ.cy);
  const X0 = SQ.x + 70, X1 = SQ.x + SQ.s - 50, sw = (X1 - X0) / 16;

  // rhythm: the straight row on the grid, the drunk row pulled off it
  const yS = SQ.y + 128, yD = SQ.y + 262;
  for (let i = 0; i <= 16; i++) {
    const x = X0 + i * sw, q = i % 4 === 0;
    hair(ctx, x, yS - 24, x, lerp(yS - 24, yD + 24, draw), q ? 0.32 : 0.1);
    if (q && i < 16) label(ctx, String(i / 4 + 1), x + 5, yS - 32, { size: 13, a: 0.5 * draw, weight: 400 });
  }
  [['straight', yS], ['drunk', yD]].forEach(([s, y]) => { // row names, set vertically in the margin
    ctx.save(); ctx.translate(SQ.x + 44, y); ctx.rotate(-Math.PI / 2);
    label(ctx, s, 0, 0, { size: 13, a: 0.5 * draw, align: 'center', weight: 400 }); ctx.restore();
  });
  const ph = (t - t0) / (4 * TL.beatLen);
  if (ph >= 0 && ph <= 1) { const px = X0 + ph * (X1 - X0); hair(ctx, px, yS - 30, px, yD + 30, 0.85, 1.5); }
  for (const [st, ms, w, tag] of DRUNK) {
    const xs = X0 + st * sw, xd = xs + ms / 1000 / step * sw;
    const ts = t0 + st * step, td = ts + ms / 1000;
    const ps = E.outBack(clamp((t - ts) / 0.16)), pd = E.outBack(clamp((t - td) / 0.16));
    const r = 4 + 4 * w;
    if (ps > 0) {
      ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(xs, yS, Math.max(0.1, r * ps), 0, Math.PI * 2); ctx.stroke();
    }
    if (pd > 0) {
      hair(ctx, xs, yS + r, lerp(xs, xd, clamp(pd)), lerp(yS + r, yD - r, clamp(pd)), 0.45, 1);
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(xd, yD, Math.max(0.1, r * pd), 0, Math.PI * 2); ctx.fill();
      if (tag) label(ctx, `${ms > 0 ? '+' : '−'}${Math.abs(ms)} ms`, xd + 2, yD + 30, { size: 13, a: 0.6 * clamp(pd), align: 'center', weight: 400 });
    }
  }

  // harmony: twelve semitone keys with the quarter tones between them; the
  // marker steps through the chord on each beat and twice stops between keys
  const kx0 = X0, kw = (X1 - X0) / 12, ry = SQ.cy + 122, k0 = ry + 12, k1 = SQ.y + SQ.s - 72;
  const bi = clamp(Math.floor((t - t0) / TL.beatLen), 0, 3);
  const bt = t0 + bi * TL.beatLen;
  const from = bi > 0 ? MICRO[bi - 1][0] : MICRO[0][0], to = MICRO[bi][0];
  const qpos = lerp(from, to, E.outExpo(clamp((t - bt) / 0.14)));
  const onKey = Math.abs(qpos - Math.round(qpos)) < 0.02 && Math.round(qpos) % 2 === 0;
  for (let i = 0; i < 12; i++) {
    const x = kx0 + i * kw, black = isBlackPc(i);
    const lit = onKey && Math.round(qpos) / 2 === i;
    const between = !onKey && Math.abs(qpos - (2 * i + 1)) < 0.02 || !onKey && Math.abs(qpos - (2 * i - 1)) < 0.02;
    const h = (k1 - k0) * (black ? 0.62 : 1) * draw;
    if (black) { ctx.fillStyle = lit ? ink(0.5) : INK; ctx.fillRect(x + 3, k0, kw - 6, h); }
    else {
      if (lit) { ctx.fillStyle = ink(0.85); ctx.fillRect(x, k0, kw, h); }
      else if (between) { ctx.fillStyle = ink(0.08); ctx.fillRect(x, k0, kw, h); }
      ctx.strokeStyle = ink(0.5); ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, k0, kw - 1, h);
    }
  }
  for (let q = 0; q < 24; q++) { // the ruler: tall ticks on the keys, short ones between
    const xc = kx0 + (q / 2) * kw + kw / 2;
    hair(ctx, xc, ry - (q % 2 ? 6 : 12), xc, ry, (q % 2 ? 0.45 : 0.8) * draw, 1);
  }
  const mx = kx0 + (qpos / 2) * kw + kw / 2;
  if (!onKey) { ctx.save(); ctx.setLineDash([4, 4]); hair(ctx, mx, ry, mx, k1, 0.9, 1.5); ctx.restore(); }
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.moveTo(mx - 7, ry - 26); ctx.lineTo(mx + 7, ry - 26); ctx.lineTo(mx, ry - 15); ctx.closePath(); ctx.fill();
  ctx.font = '500 17px Inter'; ctx.fillStyle = ink(ent);
  textFlat(ctx, MICRO[bi][1], clamp(mx, SQ.x + 90, SQ.x + SQ.s - 90), ry - 36, 17, { align: 'center' });
  ctx.restore();
  if (ex > 0.85) { ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(SQ.cx, SQ.cy, 5, 0, Math.PI * 2); ctx.fill(); }
}

// Roman numerals, set large in the stage.
function numeral(ctx, s, x, y, size, a = 1) {
  ctx.font = `500 ${size}px "Cormorant Garamond"`; ctx.textAlign = 'center'; ctx.fillStyle = ink(a);
  ctx.fillText(s, x, y); ctx.textAlign = 'left';
}
function stageChord(ctx, chord, a) {
  if (a <= 0.001) return;
  ctx.save(); ctx.fillStyle = ink(a); drawChord(ctx, chord, SQ.x + 24, SQ.y + SQ.s - 28, 30, { family: 'Inter', weight: 600 }); ctx.restore();
}

// S3 — ii
function st3(ctx, t) {
  const t0 = TL.B3, hit = TL.beat(11);
  const e = seg(t, t0, t0 + 0.55, E.outExpo);
  const out = seg(t, TL.B4 - 0.01, TL.B4 + 0.42, E.outExpo);
  ctx.save(); clipStage(ctx);
  stageChord(ctx, 'Dm7♭5', e * (1 - out));
  const sl = seg(t, hit - 0.01, hit + 0.5), slices = 9, base = SQ.cy + 190;
  const x = SQ.cx - out * SQ.s;
  for (let i = 0; i < slices; i++) {
    const off = sl > 0 && sl < 1 ? (i % 2 ? 1 : -1) * (18 + 26 * Math.abs(Math.sin(i * 2.3))) * (1 - E.outElastic(sl)) : 0;
    const y0 = SQ.y + 60 + i * (SQ.s - 60) / slices;
    ctx.save(); ctx.beginPath(); ctx.rect(SQ.x, y0, SQ.s, (SQ.s - 60) / slices + 1); ctx.clip();
    numeral(ctx, 'ii', x + off, base + (1 - e) * 420, 600);
    ctx.restore();
  }
  ctx.restore();
}

// S4 — V, then an empty slot where the I should land
function st4(ctx, t) {
  const t0 = TL.B4, h1 = TL.beat(15), h2 = 10.699;
  const inn = seg(t, t0 - 0.01, t0 + 0.42, E.outExpo);
  const shrink = seg(t, TL.beat(15.2), TL.beat(15.9), E.inOutCubic);
  ctx.save(); clipStage(ctx);
  stageChord(ctx, 'G7', inn);
  const pp = 0.04 * ((t >= h1 ? pulse(t, h1, 0.14) : 0) + (t >= h2 ? pulse(t, h2, 0.14) : 0));
  const size = lerp(600, 330, shrink) * (1 + pp);
  const x = lerp(SQ.cx + (1 - inn) * SQ.s, SQ.x + 190, shrink), y = lerp(SQ.cy + 190, SQ.cy + 110, shrink);
  numeral(ctx, 'V', x, y, size);
  const slot = seg(t, TL.beat(15.6), TL.beat(15.95), E.outCubic);
  if (slot > 0) { // the slot for the resolution, blinking like a cursor
    const { x: bx, y: by, w: bw, h: bh } = SLOT;
    const on = Math.floor((t - TL.beat(15.6)) / (TL.beatLen / 2)) % 2 === 0;
    ctx.save(); ctx.setLineDash([10, 8]); ctx.strokeStyle = ink(slot * (on ? 1 : 0.3)); ctx.lineWidth = 1.5;
    ctx.strokeRect(bx, by + bh * (1 - slot), bw, bh * slot); ctx.restore();
  }
  ctx.restore();
}

// S5/S6 — the I lands late and off-axis (a drunk downbeat), gets struck out,
// and the painting takes the slot: POST ii–V–I.
const SLOT = { x: SQ.x + 400, y: SQ.cy - 150, w: 220, h: 300 };

function logoCam(t) {
  const t0 = TL.B5 + 0.3, t1 = TL.beat(18);
  const p = seg(t, t0, t1, E.inOutCubic);
  const z = Math.exp(lerp(Math.log(0.62), Math.log(SQ.s / 2000), p)) * (1 + 0.012 * Math.max(0, t - t1));
  const par = 1 - p;
  return { cam: clampCam({ x: lerp(1500, 1000, p), y: lerp(760, 1000, p), z, rot: 0 }, SQ.s / 2, SQ.s / 2, par), par };
}
function st5(ctx, t) {
  const late = TL.B5 + 0.07, strike = TL.B5 + 0.295, wipe0 = TL.B5 + 0.315, wipe1 = TL.B5 + 0.635;
  ctx.save(); clipStage(ctx);
  const fade = 1 - seg(t, wipe0, wipe1);
  if (fade > 0) {
    ctx.globalAlpha = fade;
    numeral(ctx, 'V', SQ.x + 190, SQ.cy + 110, 330);
    ctx.save(); ctx.setLineDash([10, 8]); ctx.strokeStyle = ink(0.8); ctx.lineWidth = 1.5;
    ctx.strokeRect(SLOT.x, SLOT.y, SLOT.w, SLOT.h); ctx.restore();
    // falls in and touches down exactly 70 ms after the downbeat, then settles
    const fall = inv(late - 0.1, late, t);
    const dy = t < late ? (1 - fall * fall) * 420 : -16 * Math.exp(-(t - late) / 0.06) * Math.abs(Math.sin((t - late) * 38));
    const wob = t >= late ? 0.05 * Math.sin((t - late) * 30) * pulse(t, late, 0.12) : 0;
    ctx.save(); ctx.translate(SQ.x + 510, SQ.cy + 110 - dy); ctx.rotate(lerp(-0.3, -0.12, fall) + wob);
    numeral(ctx, 'I', 0, 0, 330); ctx.restore();
    const s = seg(t, strike, strike + 0.08, E.outCubic);
    if (s > 0) { ctx.save(); ctx.fillStyle = INK; ctx.translate(SQ.x + 510, SQ.cy - 10); ctx.rotate(-0.35); ctx.fillRect(-150, -3, 300 * s, 6); ctx.restore(); }
    label(ctx, '+70 ms', SQ.x + 510, SQ.cy + 196, { size: 16, a: 0.6 * seg(t, late, late + 0.1), align: 'center', weight: 400 });
    ctx.globalAlpha = 1;
  }
  const w = seg(t, wipe0, wipe1, E.inOutCubic);
  if (w > 0) { // the struck-out slot opens into the painting
    const r = { x: lerp(SLOT.x, SQ.x, w), y: lerp(SLOT.y, SQ.y, w), w: lerp(SLOT.w, SQ.s, w), h: lerp(SLOT.h, SQ.s, w) };
    const { cam, par } = logoCam(t);
    const ignAt = { '1': 0.485, '5': 0.665, '2': 0.845, 'T': 1.045, 'S': 1.095, 'O': 1.145, 'P': 1.195 };
    const ign = {};
    for (const [g, dt] of Object.entries(ignAt)) { const ta = TL.B5 + dt; ign[g] = seg(t, ta, ta + 0.07) * (1 + 0.4 * (t >= ta ? pulse(t, ta, 0.2) : 0)); }
    ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
    drawLogo(ctx, cam, SQ.cx, SQ.cy, { ign, par, glowBoost: t >= TL.beat(18) ? 0.18 * pulse(t, TL.beat(18), 0.35) : 0 });
    const band = A.lettersGlyph;
    const a = logoToScreen(cam, SQ.cx, SQ.cy, band.bx, band.by, par), b = logoToScreen(cam, SQ.cx, SQ.cy, band.bx + band.w, band.by + band.h, par);
    sweep(ctx, band, a.x, a.y, b.x - a.x, b.y - a.y, seg(t, TL.beat(18) - 0.05, TL.beat(18) + 0.75, E.inOutSine), 0.09, 0.45, 0.2);
    sweep(ctx, band, a.x, a.y, b.x - a.x, b.y - a.y, seg(t, TL.B6 - 0.02, TL.B6 + 0.55, E.inOutSine), 0.1, 0.3, 0.2);
    ctx.restore();
    if (w < 1) { ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.strokeRect(r.x, r.y, r.w, r.h); }
  }
  ctx.restore();
}

// -------------------------------------------------------------- end card
function drawEvent(ctx, t) {
  const e = seg(t, TL.beat(18) + 0.3, TL.beat(18) + 0.9, E.outExpo);
  if (e <= 0) return;
  const x0 = STAGE.x, x1 = STAGE.x + STAGE.s, y = STAGE.y + STAGE.s + 58; // clear of the beat ruler below
  ctx.save(); ctx.globalAlpha = e;
  ctx.fillStyle = INK; ctx.fillRect(x0, y - 38, STAGE.s * e, 1.2);
  ctx.textBaseline = 'alphabetic'; ctx.letterSpacing = '0.2px';
  let x = x0;
  const put = (s, font, color, gap = 22) => { ctx.font = font; ctx.fillStyle = color; ctx.fillText(s, x, y); x += ctx.measureText(s).width + gap; };
  put('M3-2026', '600 20px Inter', INK, 3);
  put('秋', '500 20px "Noto Sans JP"', INK);
  put('2026.10.25 SUN', '500 18px Inter', ink(0.7));
  put('う', '500 18px "Noto Sans JP"', ink(0.7), 1);
  put('-01b', '500 18px Inter', ink(0.7));
  ctx.textAlign = 'right'; ctx.font = '600 18px Inter'; ctx.fillStyle = INK;
  ctx.fillText('post251.com', x1, y);
  ctx.restore();
}

// ------------------------------------------------------------- dispatcher
function drawScene(ctx, t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.letterSpacing = '0px'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.setLineDash([]);
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);

  ctx.save(); stageSpace(ctx);
  if (t < TL.B1) st0(ctx, t);
  else if (t < TL.B2) st1(ctx, t);
  else if (t < TL.B3) st2(ctx, t);
  else if (t < TL.B4 + 0.42) { if (t >= TL.B4 - 0.01) st4(ctx, t); st3(ctx, t); }
  else if (t < TL.B5) st4(ctx, t);
  else st5(ctx, t);
  if (t > TL.B2 - 0.3 && t < TL.B2 + 0.45) keyWipe(ctx, t, TL.B2, { x: SQ.x, y: SQ.y, w: SQ.s, h: SQ.s });
  drawFrame(ctx, t);
  ctx.restore();

  drawHeadline(ctx, t);
  drawPara(ctx, t);
  drawEvent(ctx, t);
}

// -------------------------------------------------------------------- HUD
function drawHUD(ctx, t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const vis = seg(t, 0.02, 0.3, E.outCubic);
  if (vis <= 0) return;
  ctx.globalAlpha = vis; ctx.textBaseline = 'alphabetic';
  ctx.font = '600 14px Inter'; ctx.letterSpacing = '3px'; ctx.fillStyle = INK;
  ctx.fillText('POST251', COL.x, 104);
  label(ctx, 'Teaser 01', COL.x + 96, 104, { size: 14, a: 0.5, weight: 400 });
  label(ctx, 'Blue Bossa', W - 120, 104, { size: 14, a: 0.5, weight: 400, align: 'right' });

  // beat ruler under the stage: a tick per beat, taller on each bar, lighting
  // up as the playhead passes
  const rx0 = STAGE.x, rx1 = STAGE.x + STAGE.s, ry = 1018, total = 24;
  const pos = (t - TL.g0) / TL.beatLen;
  for (let b = 0; b < total; b++) {
    const x = lerp(rx0, rx1, b / (total - 1));
    const hot = t >= TL.beat(b) ? pulse(t, TL.beat(b), 0.22) : 0;
    const h = b % 4 === 0 ? 14 : 7;
    ctx.fillStyle = ink(pos >= b ? 0.55 + 0.45 * hot : 0.18);
    ctx.fillRect(x - 0.75, ry - h / 2 - hot * 5, 1.5, h + hot * 10);
  }
  ctx.fillStyle = INK; ctx.fillRect(lerp(rx0, rx1, clamp(pos / (total - 1), 0, 1)) - 1, ry - 18, 2, 36);
  ctx.globalAlpha = 1; ctx.letterSpacing = '0px';
}

// ------------------------------------------------------------ post params
// Paper and ink: no bloom, lens or grade, just a trace of grain.
function postParams(t, frame) {
  return { th: 0.95, knee: 0.3, bloom: 0, ca: 0, vig: 0, grain: 0.02, expo: 1, warp: 0, sat: 1, tone: 0,
    lift: [0, 0, 0], gain: [1, 1, 1], tint: [1, 1, 1], seed: frame % 97 };
}

// Fast moves get more shutter samples so they blur as streaks.
function fastMotion(t) {
  const w = [[TL.drums - 0.15, TL.drums + 0.3], [TL.B2 - 0.3, TL.B2 + 0.5], [TL.B3 - 0.4, TL.B3 + 0.1],
    [TL.beat(11) - 0.02, TL.beat(11) + 0.5], [TL.B4 - 0.05, TL.B4 + 0.42], [TL.beat(15.2), TL.B5 + 0.72]];
  if (headlines().some(h => t > h.t - 0.05 && t < h.t + 0.3)) return true;
  return w.some(([a, b]) => t >= a && t < b);
}

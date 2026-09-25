// White, typographic layout: a manifesto column on the left, a square "stage"
// on the right (the album-cover shape of the logo). The painting is the only
// colour in the film.
//
//   0.00  count-in  "Post251"          stage: frame draws, "3" "4"
//   1.29  bar 1  Cm7   "Experimental digital jazz"   stage: the painted keys (acoustic)
//   3.98  bar 2  Fm7   "Rhythm × Harmony"            stage: onsets vs. grid, pitch circle
//   6.59  bar 3  Dm7♭5 "Beyond convention"           stage: ii
//   9.20  bar 4  G7    "ii – V – I"                  stage: V, then an empty slot for the I
//  11.80  bar 5  Cm7   "Acoustic × Digital"          stage: the I lands late, is struck out, the logo takes its place
//  13.11  (beat 3)     "Grooves"                     album, event
//  14.41  bar 6  E♭m7  hold
'use strict';

const A = {}; // images and logo metadata (filled by main.js)

const PAPER = '#F4F3EF', INK = '#151515';
const ink = a => `rgba(21,21,21,${a})`;
const SQ = { x: 1080, y: 180, s: 720 };
SQ.cx = SQ.x + SQ.s / 2; SQ.cy = SQ.y + SQ.s / 2;
const COL = { x: 120, w: 840 };

// ---------------------------------------------------------------- utilities
function clipStage(ctx) { ctx.beginPath(); ctx.rect(SQ.x, SQ.y, SQ.s, SQ.s); ctx.clip(); }

function hair(ctx, x0, y0, x1, y1, a = 1, lw = 1) {
  ctx.strokeStyle = ink(a); ctx.lineWidth = lw;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
}

function mono(ctx, s, x, y, { size = 13, a = 0.55, align = 'left', track = 3, weight = 400 } = {}) {
  ctx.font = `${weight} ${size}px "JetBrains Mono"`; ctx.letterSpacing = track + 'px';
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
  logoLayers().forEach((L, i) => {
    const f = layerXf(cam, L.p, par);
    ctx.setTransform(1, 0, 0, 1, vx, vy);
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
    { t: 0.12, lines: ['Post251'] },
    { t: TL.first, lines: ['Experimental', 'digital jazz'] },
    { t: TL.B2, lines: ['Rhythm ×', 'Harmony'] },
    { t: TL.B3, lines: ['Beyond', 'convention'] },
    { t: TL.B4, lines: ['ii – V – I'] },
    { t: TL.B5, lines: ['Acoustic ×', 'Digital'] },
    { t: TL.beat(18), lines: ['Grooves'], label: 'UPCOMING ALBUM' },
  ];
}
function drawHeadline(ctx, t) {
  const HL = headlines();
  const size = 104, lh = 114, top = 318;
  ctx.save();
  ctx.font = `600 ${size}px Inter`; ctx.letterSpacing = '-4px'; ctx.fillStyle = INK; ctx.textBaseline = 'alphabetic';
  HL.forEach((h, i) => {
    const next = HL[i + 1];
    if (t < h.t - 0.02 || (next && t > next.t + 0.3)) return;
    h.lines.forEach((line, li) => {
      const inn = seg(t, h.t + li * 0.05, h.t + 0.5 + li * 0.05, E.outExpo);
      const out = next ? seg(t, next.t - 0.16 + li * 0.03, next.t + 0.12 + li * 0.03, E.inCubic) : 0;
      const y = top + li * lh;
      const dy = (1 - inn) * lh * 0.95 - out * lh * 0.95;
      ctx.save();
      ctx.beginPath(); ctx.rect(COL.x - 10, y - size * 0.96, COL.w + 20, lh * 1.02); ctx.clip();
      ctx.fillText(line, COL.x - 5, y + dy);
      ctx.restore();
    });
    if (h.label) {
      const e = seg(t, h.t, h.t + 0.4, E.outExpo);
      ctx.save(); ctx.globalAlpha = e;
      mono(ctx, h.label, COL.x, top - size - 16 + (1 - e) * 10, { size: 14, a: 0.7, track: 5 });
      ctx.restore();
    }
  });
  ctx.restore();
}

// -------------------------------------------------------------- manifesto
// The whole text is laid out once so words never reflow; each phrase is typed
// word by word inside its window and greys out when the next one starts.
// Words prefixed with * are set in the semibold.
function phrases() {
  return [
    [0.16, 1.16, '*Post251 is an experimental digital jazz unit'],
    [TL.first, TL.first + 2.1, 'formed by drummer and composer *Nakam and composer *Shunya *Ishikawa *(Pami).'],
    [TL.B2, TL.B2 + 1.3, 'From the perspectives of *rhythm and *harmony,'],
    [TL.B3, TL.B3 + 1.7, 'we aim to move beyond broadly applied conventions in music,'],
    [TL.B4, TL.B4 + 1.3, 'including the *ii–V–I progression.'],
    [TL.B5, TL.B5 + 1.15, 'Crossing the boundary between *acoustic and *digital sound, we explore new possibilities for music.'],
    [TL.beat(18), TL.beat(18) + 1.15, 'In the upcoming album *‘Grooves’, we pursue *microtonal *harmony and *dilla *(drunk) *feel in a practical way in jazz ground.'],
  ];
}
let _para = null;
function layoutPara(ctx) {
  const size = 21, lh = 33, sp = 5.6;
  const words = [];
  phrases().forEach(([t0, t1, text], pi) => {
    const ws = text.split(' ');
    ws.forEach((w, j) => {
      const bold = w.startsWith('*');
      words.push({ s: bold ? w.slice(1) : w, bold, pi, t: t0 + (t1 - t0) * j / ws.length });
    });
  });
  let x = 0, line = 0;
  for (const w of words) {
    ctx.font = `${w.bold ? 600 : 400} ${size}px Inter`;
    w.w = ctx.measureText(w.s).width;
    if (x > 0 && x + w.w > COL.w) { x = 0; line++; }
    w.x = x; w.line = line; x += w.w + sp;
  }
  _para = { words, size, lh, top: 560 };
}
function drawPara(ctx, t) {
  if (!_para) layoutPara(ctx);
  const P = _para, starts = phrases().map(p => p[0]);
  ctx.save(); ctx.textBaseline = 'alphabetic'; ctx.letterSpacing = '0px';
  for (const w of P.words) {
    const e = seg(t, w.t, w.t + 0.16, E.outCubic);
    if (e <= 0) continue;
    const nextStart = starts[w.pi + 1];
    const past = nextStart === undefined ? 0 : seg(t, nextStart, nextStart + 0.35);
    const c = Math.round(lerp(21, 150, past));
    ctx.font = `${w.bold ? 600 : 400} ${P.size}px Inter`;
    ctx.fillStyle = `rgba(${c},${c - 3},${c - 8},${e})`;
    ctx.fillText(w.s, COL.x + w.x, P.top + w.line * P.lh + (1 - e) * 8);
  }
  ctx.restore();
}

// ----------------------------------------------------------------- credits
function drawCredits(ctx, t) {
  const y = SQ.y + SQ.s + 46;
  const cols = [[SQ.x, 'NAKAM', 'Drums, Composition', TL.first], [SQ.x + 360, 'SHUNYA ISHIKAWA (PAMI)', 'Composition', TL.first + 0.12]];
  ctx.save();
  cols.forEach(([x, name, role, ta], i) => {
    const e = seg(t, ta, ta + 0.45, E.outExpo);
    if (e <= 0) return;
    ctx.globalAlpha = e;
    ctx.font = '600 14px Inter'; ctx.letterSpacing = '2.5px'; ctx.fillStyle = INK;
    ctx.fillText(name, x + (1 - e) * 20, y);
    ctx.font = '400 14px Inter'; ctx.letterSpacing = '0.2px'; ctx.fillStyle = ink(0.55);
    ctx.fillText(role, x + (1 - e) * 20, y + 22);
    if (i === 0) { // the drummer's line draws as the drums come in
      const d = seg(t, TL.drums - 0.02, TL.drums + 0.35, E.outExpo);
      ctx.fillStyle = INK; ctx.fillRect(x, y + 34, 150 * d, 2);
    }
  });
  ctx.letterSpacing = '0px';
  ctx.restore();
}

// ---------------------------------------------------------- stage: frame
function drawFrame(ctx, t) {
  const p = seg(t, 0.08, 1.0, E.inOutCubic);
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
  const g = seg(t, 0.2, 0.9, E.outCubic);
  for (let i = 1; i < 4; i++) {
    hair(ctx, SQ.x + SQ.s * i / 4, SQ.y, SQ.x + SQ.s * i / 4, SQ.y + SQ.s * g, 0.07);
    hair(ctx, SQ.x, SQ.y + SQ.s * i / 4, SQ.x + SQ.s * g, SQ.y + SQ.s * i / 4, 0.07);
  }
  ctx.font = '300 220px Inter'; ctx.textAlign = 'center'; ctx.letterSpacing = '-8px';
  [['3', TL.beat(-2)], ['4', TL.beat(-1)]].forEach(([s, bt]) => {
    const e = seg(t, bt - 0.02, bt + 0.12, E.outCubic), o = 1 - seg(t, bt + 0.36, bt + 0.6, E.inCubic);
    if (e * o <= 0) return;
    const sc = lerp(1.15, 1, E.outExpo(inv(bt, bt + 0.5, t)));
    ctx.save(); ctx.translate(SQ.cx, SQ.cy + 78); ctx.scale(sc, sc);
    ctx.fillStyle = ink(e * o); ctx.fillText(s, 0, 0); ctx.restore();
  });
  ctx.letterSpacing = '0px'; ctx.textAlign = 'left';
  // the pickup's four beats along the bottom edge
  for (let i = 0; i < 4; i++) {
    const bt = TL.beat(i - 4), on = i >= 2 && t >= bt ? pulse(t, bt, 0.3) : 0;
    const x = SQ.x + SQ.s * (i + 0.5) / 4;
    ctx.fillStyle = ink(0.25 + 0.75 * on);
    ctx.fillRect(x - 1, SQ.y + SQ.s - 36 - 12 * on, 2, 14 + 12 * on);
  }
  // anticipation: a hairline across the middle, about to open
  const k = seg(t, 0.95, TL.first, E.inCubic);
  if (k > 0) hair(ctx, SQ.cx - SQ.s / 2 * k, SQ.cy, SQ.cx + SQ.s / 2 * k, SQ.cy, 1, 1.5);
  ctx.restore();
}

// S1 — the painted keys, opening from the hairline
function st1(ctx, t) {
  const t0 = TL.first, lt = t - t0;
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

// S2 — rhythm (bar 2's onsets against a straight 16th grid) and harmony (a
// pitch circle in quarter tones with the Fm7 shape)
function st2(ctx, t) {
  const t0 = TL.B2, t1 = TL.B3, bar = 4 * TL.beatLen;
  const grid0 = TL.bar(2) - 0.066; // the session's straight grid for bar 2
  const hit = TL.beat(6);
  const ent = seg(t, t0, t0 + 0.6, E.outExpo);
  const ex = seg(t, t1 - 0.36, t1 - 0.02, E.inQuart);
  const sc = (1 - ex) * lerp(0.92, 1, ent);
  ctx.save(); clipStage(ctx);
  mono(ctx, 'RHYTHM — ONSETS / GRID', SQ.x + 24, SQ.y + 40, { size: 12, a: 0.6 * ent * (1 - ex) });
  mono(ctx, 'HARMONY — Fm7', SQ.x + SQ.s - 24, SQ.y + 40, { size: 12, a: 0.6 * ent * (1 - ex), align: 'right' });
  ctx.translate(SQ.cx, SQ.cy + 12); ctx.scale(sc, sc); ctx.rotate(ex * 2.2);
  const R = 290, r = 168;
  const draw = seg(t, t0, t0 + 0.55, E.outCubic);
  // rhythm ring
  ctx.strokeStyle = ink(0.8); ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(0, 0, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * draw); ctx.stroke();
  for (let i = 0; i < 16; i++) {
    if (i / 16 > draw) break;
    const a = -Math.PI / 2 + i * Math.PI / 8, L = i % 4 === 0 ? 26 : 12;
    hair(ctx, Math.cos(a) * (R - L / 2), Math.sin(a) * (R - L / 2), Math.cos(a) * (R + L / 2), Math.sin(a) * (R + L / 2), i % 4 === 0 ? 0.85 : 0.35, 1.2);
  }
  const pa = -Math.PI / 2 + clamp((t - grid0) / bar, 0, 1) * Math.PI * 2;
  hair(ctx, 0, 0, Math.cos(pa) * (R + 24), Math.sin(pa) * (R + 24), 0.55 * (1 - ex), 1);
  const bandR = { low: R - 18, mid: R, hi: R + 18 };
  for (const band of ['low', 'mid', 'hi']) {
    for (const o of TL.tm.onsets[band]) {
      if (o.t < grid0 || o.t >= grid0 + bar || o.s < 0.18 || o.t > t) continue;
      const a = -Math.PI / 2 + (o.t - grid0) / bar * Math.PI * 2;
      const pop = E.outBack(clamp((t - o.t) / 0.18));
      ctx.fillStyle = INK;
      ctx.beginPath(); ctx.arc(Math.cos(a) * bandR[band], Math.sin(a) * bandR[band], Math.max(0, (2.5 + 6 * o.s) * pop), 0, Math.PI * 2); ctx.fill();
    }
  }
  // pitch circle: 24 quarter-tone ticks, 12 names, the chord's shape
  ctx.strokeStyle = ink(0.35); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(0, 0, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * draw); ctx.stroke();
  for (let i = 0; i < 24; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 12, L = i % 2 ? 6 : 12;
    hair(ctx, Math.cos(a) * r, Math.sin(a) * r, Math.cos(a) * (r - L), Math.sin(a) * (r - L), (i % 2 ? 0.3 : 0.7) * draw, 1);
  }
  ctx.font = '500 14px "JetBrains Mono"';
  const names = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
  const chord = [5, 8, 0, 3];
  names.forEach((n, i) => {
    const a = -Math.PI / 2 + i * Math.PI / 6;
    ctx.fillStyle = ink((chord.includes(i) ? 1 : 0.4) * draw);
    textFlat(ctx, n, Math.cos(a) * (r + 24), Math.sin(a) * (r + 24) + 5, 14, { align: 'center' });
  });
  const pd = seg(t, t0 + 0.25, t0 + 0.8, E.inOutCubic), pp = pulse(t, hit, 0.25) * (t >= hit ? 1 : 0);
  const pts = chord.map(i => { const a = -Math.PI / 2 + i * Math.PI / 6; return [Math.cos(a) * (r - 20), Math.sin(a) * (r - 20)]; });
  const seq = [...pts, pts[0]], upto = pd * (seq.length - 1);
  ctx.strokeStyle = INK; ctx.lineWidth = 1.6 + 2.5 * pp;
  ctx.beginPath(); ctx.moveTo(...seq[0]);
  for (let i = 1; i < seq.length; i++) {
    const f = clamp(upto - (i - 1));
    if (f <= 0) break;
    ctx.lineTo(lerp(seq[i - 1][0], seq[i][0], f), lerp(seq[i - 1][1], seq[i][1], f));
  }
  ctx.stroke();
  if (pd >= 1) {
    ctx.fillStyle = ink(0.06 + 0.1 * pp);
    ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p)); ctx.closePath(); ctx.fill();
  }
  pts.forEach(([x, y], i) => { if (pd * 4 > i) { ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x, y, 4.5 + 2 * pp, 0, Math.PI * 2); ctx.fill(); } });
  ctx.restore();
  if (ex > 0.85) { ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(SQ.cx, SQ.cy + 12, 5, 0, Math.PI * 2); ctx.fill(); }
}

// Roman numerals, set large in the stage.
function numeral(ctx, s, x, y, size, a = 1) {
  ctx.font = `500 ${size}px "Cormorant Garamond"`; ctx.textAlign = 'center'; ctx.fillStyle = ink(a);
  ctx.fillText(s, x, y); ctx.textAlign = 'left';
}
function stageLabels(ctx, top, chord, a) {
  if (a <= 0.001) return;
  mono(ctx, top, SQ.x + 24, SQ.y + 40, { size: 12, a: 0.6 * a });
  ctx.save(); ctx.fillStyle = ink(a); drawChord(ctx, chord, SQ.x + 24, SQ.y + SQ.s - 28, 30, { family: 'Inter', weight: 600 }); ctx.restore();
}

// S3 — ii
function st3(ctx, t) {
  const t0 = TL.B3, hit = TL.beat(10);
  const e = seg(t, t0, t0 + 0.55, E.outExpo);
  const out = seg(t, TL.B4 - 0.02, TL.B4 + 0.3, E.inOutExpo);
  ctx.save(); clipStage(ctx);
  stageLabels(ctx, 'ii — SUPERTONIC', 'Dm7♭5', e * (1 - out));
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
  const t0 = TL.B4, h1 = TL.beat(14), h2 = 10.699;
  const inn = seg(t, t0 - 0.02, t0 + 0.3, E.inOutExpo);
  const shrink = seg(t, TL.beat(15.2), TL.beat(15.9), E.inOutCubic);
  ctx.save(); clipStage(ctx);
  stageLabels(ctx, 'V — DOMINANT', 'G7', inn);
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
    mono(ctx, 'I ?', bx + 12, by + bh + 34, { size: 13, a: 0.6 * slot });
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
  const late = TL.B5 + 0.07, strike = 12.10, wipe0 = 12.12, wipe1 = 12.44;
  ctx.save(); clipStage(ctx);
  const fade = 1 - seg(t, wipe0, wipe1);
  if (fade > 0) {
    ctx.globalAlpha = fade;
    numeral(ctx, 'V', SQ.x + 190, SQ.cy + 110, 330);
    const land = E.outBack(inv(late - 0.12, late + 0.06, t));
    const wob = t >= late ? 0.05 * Math.sin((t - late) * 30) * pulse(t, late, 0.12) : 0;
    ctx.save(); ctx.translate(SQ.x + 510, SQ.cy + 110 - (1 - land) * 420); ctx.rotate(lerp(-0.25, -0.12, land) + wob);
    numeral(ctx, 'I', 0, 0, 330); ctx.restore();
    const s = seg(t, strike, strike + 0.08, E.outCubic);
    if (s > 0) { ctx.save(); ctx.fillStyle = INK; ctx.translate(SQ.x + 510, SQ.cy - 10); ctx.rotate(-0.35); ctx.fillRect(-150, -3, 300 * s, 6); ctx.restore(); }
    mono(ctx, 'DRUNK +70 MS', SQ.x + 412, SQ.cy + 190, { size: 12, a: 0.6 * seg(t, late, late + 0.1) });
    ctx.globalAlpha = 1;
  }
  const w = seg(t, wipe0, wipe1, E.inOutCubic);
  if (w > 0) { // the struck-out slot opens into the painting
    const r = { x: lerp(SLOT.x, SQ.x, w), y: lerp(SLOT.y, SQ.y, w), w: lerp(SLOT.w, SQ.s, w), h: lerp(SLOT.h, SQ.s, w) };
    const { cam, par } = logoCam(t);
    const ignAt = { '1': 12.29, '5': 12.47, '2': 12.65, 'T': 12.85, 'S': 12.9, 'O': 12.95, 'P': 13.0 };
    const ign = {};
    for (const [g, ta] of Object.entries(ignAt)) ign[g] = seg(t, ta, ta + 0.07) * (1 + 0.4 * (t >= ta ? pulse(t, ta, 0.2) : 0));
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
  const y = 918;
  ctx.save(); ctx.globalAlpha = e;
  ctx.fillStyle = INK; ctx.fillRect(COL.x, y - 44, COL.w * e, 1.2);
  ctx.textBaseline = 'alphabetic'; ctx.letterSpacing = '0.5px';
  let x = COL.x;
  const put = (s, font, color, gap = 26) => { ctx.font = font; ctx.fillStyle = color; ctx.fillText(s, x, y); x += ctx.measureText(s).width + gap; };
  put('M3-2026', '600 22px Inter', INK, 4);
  put('秋', '500 22px "Noto Sans JP"', INK);
  put('2026.10.25 SUN', '500 20px "JetBrains Mono"', ink(0.75));
  put('う', '500 20px "Noto Sans JP"', ink(0.75), 2);
  put('-01b', '500 20px "JetBrains Mono"', ink(0.75));
  ctx.textAlign = 'right'; ctx.font = '500 20px "JetBrains Mono"'; ctx.fillStyle = INK;
  ctx.fillText('post251.com', COL.x + COL.w, y);
  ctx.restore();
}

// ------------------------------------------------------------- dispatcher
function drawScene(ctx, t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.letterSpacing = '0px'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.setLineDash([]);
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);

  if (t < TL.first) st0(ctx, t);
  else if (t < TL.B2) st1(ctx, t);
  else if (t < TL.B3) st2(ctx, t);
  else if (t < TL.B4 + 0.3) { if (t >= TL.B4 - 0.02) st4(ctx, t); st3(ctx, t); }
  else if (t < TL.B5) st4(ctx, t);
  else st5(ctx, t);
  if (t > TL.B2 - 0.3 && t < TL.B2 + 0.45) keyWipe(ctx, t, TL.B2, { x: SQ.x, y: SQ.y, w: SQ.s, h: SQ.s });
  drawFrame(ctx, t);

  drawHeadline(ctx, t);
  drawPara(ctx, t);
  drawCredits(ctx, t);
  drawEvent(ctx, t);
}

// -------------------------------------------------------------------- HUD
function drawHUD(ctx, t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const vis = seg(t, 0.05, 0.5, E.outCubic);
  if (vis <= 0) return;
  ctx.globalAlpha = vis; ctx.textBaseline = 'alphabetic';
  ctx.font = '600 13px Inter'; ctx.letterSpacing = '3px'; ctx.fillStyle = INK;
  ctx.fillText('POST251', COL.x, 100);
  ctx.font = '400 13px Inter'; ctx.fillStyle = ink(0.5);
  ctx.fillText('TEASER 01', COL.x + 92, 100);
  mono(ctx, 'BLUE BOSSA  ·  92 BPM  ·  4/4  ·  C MINOR', W - 120, 100, { size: 12, a: 0.5, align: 'right', track: 2 });
  const f = Math.round(t * FPS);
  mono(ctx, `00:00:${String(Math.floor(f / FPS)).padStart(2, '0')}:${String(f % FPS).padStart(2, '0')}`, W - 120, 122, { size: 12, a: 0.38, align: 'right', track: 2 });

  // chord with a slot roll
  let ci = -1;
  TL.chords.forEach((c, i) => { if (t >= c.t - 0.02) ci = i; });
  const bx = COL.x, by = 1022;
  if (ci >= 0) {
    const c = TL.chords[ci], pr = TL.chords[ci - 1];
    const e = seg(t, c.t - 0.02, c.t + 0.28, E.outExpo);
    ctx.save(); ctx.beginPath(); ctx.rect(bx - 6, by - 36, 240, 48); ctx.clip();
    if (pr && e < 1) { ctx.fillStyle = ink(1 - e); drawChord(ctx, pr.sym, bx, by - e * 44, 26, { family: 'Inter', weight: 600 }); }
    ctx.fillStyle = ink(e);
    const cw = drawChord(ctx, c.sym, bx, by + (1 - e) * 44, 26, { family: 'Inter', weight: 600 });
    ctx.font = 'italic 500 26px "Cormorant Garamond"'; ctx.fillStyle = ink(0.6 * e);
    textFlat(ctx, c.fn, bx + cw + 16, by + (1 - e) * 44, 26);
    ctx.restore();
  }
  const bi = Math.floor((t - TL.g0) / TL.beatLen + 1e-6);
  mono(ctx, t < TL.first ? 'COUNT-IN' : `BAR ${String(Math.floor(bi / 4) + 1).padStart(2, '0')} · ${((bi % 4) + 4) % 4 + 1}`, bx + 250, by, { size: 12, a: 0.45 });

  // beat ruler under the stage
  const rx0 = SQ.x, rx1 = SQ.x + SQ.s, ry = 1016, total = 24;
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
    [TL.beat(10) - 0.02, TL.beat(10) + 0.5], [TL.B4 - 0.05, TL.B4 + 0.35], [TL.beat(15.2), TL.B5 + 0.72]];
  if (headlines().some(h => t > h.t - 0.2 && t < h.t + 0.25)) return true;
  return w.some(([a, b]) => t >= a && t < b);
}

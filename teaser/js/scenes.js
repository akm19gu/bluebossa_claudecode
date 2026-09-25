// The six shots, one per bar of the tune (plus the silent count-in), and the HUD.
//
//   0.00  count-in   two silent beats ("3", "4")
//   1.29  bar 1  Cm7    macro on the painted keys, "Blue Bossa"
//   3.98  bar 2  Fm7    circle of fifths, chord shape morph
//   6.59  bar 3  Dm7♭5  ii  -> "2"
//   9.20  bar 4  G7     V   -> "5", kinetic rows, tension, implode to a line
//  11.80  bar 5  Cm7    i   -> the line opens on the logo's own "1", pull back to POST251
//  14.41  bar 6  E♭m7   the next ii begins: to be continued
'use strict';

const A = {}; // images, glyph bitmaps, logo metadata (filled by main.js)

// ---------------------------------------------------------------- utilities
function bgRadial(ctx, cx, cy, r, c0, c1) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, c0); g.addColorStop(1, c1);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

function glow(ctx, x, y, r, color, a) {
  if (a <= 0.002) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, a)); g.addColorStop(0.35, rgba(color, a * 0.35)); g.addColorStop(1, rgba(color, 0));
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, 2 * r, 2 * r); ctx.restore();
}

function flash(ctx, a, color = '#fff4d8') {
  if (a <= 0.002) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = rgba(color, a);
  ctx.fillRect(0, 0, W, H); ctx.restore();
}

function ring(ctx, x, y, r, lw, color, a) {
  if (a <= 0.002 || r <= 0) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = rgba(color, a); ctx.lineWidth = lw;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
}

// Drifting gold dust. Stateless: position is a closed-form function of t.
function dust(ctx, t, { n = 90, seed = 7, color = C.gold, alpha = 0.6, speed = 18, size = [0.6, 2.6], box = [0, 0, W, H], sway = 30 } = {}) {
  const r = rng(seed);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const x0 = r() * box[2], y0 = r() * box[3], z = 0.3 + r() * 0.7, ph = r() * 6.28, sz = lerp(size[0], size[1], r() * r());
    const tw = 0.5 + 0.5 * Math.sin(t * (1.3 + r() * 2) + ph);
    let x = x0 + Math.sin(t * 0.4 + ph) * sway * z + t * speed * z * 0.4;
    let y = y0 - t * speed * z;
    x = box[0] + ((x % box[2]) + box[2]) % box[2];
    y = box[1] + ((y % box[3]) + box[3]) % box[3];
    ctx.fillStyle = rgba(color, alpha * z * (0.35 + 0.65 * tw));
    ctx.beginPath(); ctx.arc(x, y, sz * z * 1.4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function leak(ctx, x, y, r, color, a) {
  if (a <= 0.002) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, a)); g.addColorStop(0.5, rgba(color, a * 0.3)); g.addColorStop(1, rgba(color, 0));
  ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
}

// Draw a string letter by letter so each glyph can carry its own animation.
function perLetter(ctx, str, x, y, spacing, fn) {
  let cx = x;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    fn(i, ch, cx, y);
    cx += ctx.measureText(ch).width + spacing;
  }
  return cx - x - spacing;
}

// ------------------------------------------------------------ the painting
// cam = {x, y, z, rot} in logo2x pixels; layers separated for 2.5D parallax.
function drawLogo(ctx, cam, { ign = null, par = 1, sx = 0, sy = 0, glowBoost = 0 } = {}) {
  const ref = { x: 1000, y: 1000 };
  const layers = [
    { img: A.unlit, sy: 0, sh: 1080, p: 0.93 },
    { img: A.layerMid, sy: A.meta.layers.mid.y0, sh: 0, p: 1.0 },
    { img: A.layerKeys, sy: A.meta.layers.keys.y0, sh: 0, p: 1.1 },
  ];
  ctx.save();
  ctx.imageSmoothingQuality = 'high';
  const setT = (p) => {
    const k = 1 + (p - 1) * par;
    const z = cam.z * (1 + (p - 1) * par * 0.5);
    const cx = ref.x + (cam.x - ref.x) * k, cy = ref.y + (cam.y - ref.y) * k;
    ctx.setTransform(1, 0, 0, 1, W / 2 + sx, H / 2 + sy);
    if (cam.rot) ctx.rotate(cam.rot);
    ctx.scale(z, z); ctx.translate(-cx, -cy);
  };
  layers.forEach((L, i) => {
    setT(L.p);
    if (i === 0) {
      ctx.drawImage(L.img, 0, 0, 2000, L.sh, 0, 0, 2000, L.sh);
      if (ign) {
        for (const [g, lv] of Object.entries(ign)) {
          if (lv <= 0.001) continue;
          const b = A.meta.glyphs[g], pad = 14;
          const bx = b.x0 - pad, by = b.y0 - pad, bw = b.x1 - b.x0 + 2 * pad, bh = b.y1 - b.y0 + 2 * pad;
          ctx.globalAlpha = Math.min(1, lv);
          ctx.drawImage(A.letters, bx, by, bw, bh, bx, by, bw, bh);
          if (lv > 1 || glowBoost > 0) {
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = Math.min(1, (lv - 1) + glowBoost);
            ctx.drawImage(A.letters, bx, by, bw, bh, bx, by, bw, bh);
            ctx.globalCompositeOperation = 'source-over';
          }
          ctx.globalAlpha = 1;
        }
      }
    } else {
      ctx.drawImage(L.img, 0, L.sy);
    }
  });
  ctx.restore();
}

// Screen-space position of a logo2x point under the top-layer transform.
function logoToScreen(cam, px, py, p = 0.93, par = 1) {
  const k = 1 + (p - 1) * par, z = cam.z * (1 + (p - 1) * par * 0.5);
  const cx = 1000 + (cam.x - 1000) * k, cy = 1000 + (cam.y - 1000) * k;
  let dx = (px - cx) * z, dy = (py - cy) * z;
  if (cam.rot) { const c = Math.cos(cam.rot), s = Math.sin(cam.rot); [dx, dy] = [dx * c - dy * s, dx * s + dy * c]; }
  return { x: W / 2 + dx, y: H / 2 + dy, z };
}

// --------------------------------------------------------------- keyboard
const isBlack = m => [1, 3, 6, 8, 10].includes(((m % 12) + 12) % 12);
function drawKeyboard(ctx, x, y, w, h, lo, hi, lit, press, alpha = 1) {
  const whites = [];
  for (let m = lo; m <= hi; m++) if (!isBlack(m)) whites.push(m);
  const ww = w / whites.length;
  ctx.save(); ctx.globalAlpha = alpha;
  whites.forEach((m, i) => {
    const p = press(m), L = lit(m);
    const kx = x + i * ww + 1.5, ky = y + p * 7;
    const g = ctx.createLinearGradient(0, ky, 0, ky + h);
    if (L > 0) {
      g.addColorStop(0, rgba('#fff0c0', 0.95)); g.addColorStop(1, rgba(C.goldMid, 0.95));
    } else {
      g.addColorStop(0, 'rgba(236,229,214,0.92)'); g.addColorStop(1, 'rgba(200,190,172,0.92)');
    }
    ctx.fillStyle = g; roundRect(ctx, kx, ky, ww - 3, h, 5); ctx.fill();
    if (L > 0) glow(ctx, kx + ww / 2, ky + h * 0.75, ww * 1.4, C.gold, 0.35 * L + 0.4 * p);
  });
  let wi = 0;
  for (let m = lo; m <= hi; m++) {
    if (!isBlack(m)) { wi++; continue; }
    const p = press(m), L = lit(m);
    const bw = ww * 0.58, bh = h * 0.62, kx = x + wi * ww - bw / 2, ky = y - 2 + p * 6;
    const g = ctx.createLinearGradient(kx, 0, kx + bw, 0);
    if (L > 0) { g.addColorStop(0, '#7a4f12'); g.addColorStop(0.5, '#f1c95e'); g.addColorStop(1, '#6d440e'); }
    else { g.addColorStop(0, '#050505'); g.addColorStop(0.5, '#1d1c1e'); g.addColorStop(1, '#030303'); }
    ctx.fillStyle = g; roundRect(ctx, kx, ky, bw, bh, 4); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(kx + bw * 0.2, ky + bh - 10, bw * 0.6, 2);
    if (L > 0) glow(ctx, kx + bw / 2, ky + bh * 0.6, bw * 2.2, C.gold, 0.35 * L + 0.4 * p);
  }
  ctx.restore();
}

// Piano-key curtain used as the bar 1 -> bar 2 wipe. phase: 0..1 covering, 1..2 uncovering.
function keyWipe(ctx, phase) {
  if (phase <= 0 || phase >= 2) return;
  const n = 14, kw = W / n;
  ctx.save();
  for (let i = 0; i < n; i++) {
    const d = (i % 2 ? 0.06 : 0) + i * 0.018;
    let y;
    if (phase <= 1) y = lerp(-H - 80, 0, E.outCubic(clamp((phase - d) / (1 - 0.3))));
    else y = lerp(0, H + 80, E.inCubic(clamp((phase - 1 - d) / (1 - 0.3))));
    const x = i * kw;
    const g = ctx.createLinearGradient(x, 0, x + kw, 0);
    g.addColorStop(0, '#020202'); g.addColorStop(0.15, '#161517'); g.addColorStop(0.5, '#0b0b0c'); g.addColorStop(0.9, '#1c1b1d'); g.addColorStop(1, '#010101');
    ctx.fillStyle = g;
    roundRect(ctx, x - 0.5, y - 20, kw + 1, H + 20, 10); ctx.fill();
    ctx.fillStyle = 'rgba(255,236,190,0.22)'; ctx.fillRect(x + kw * 0.12, y + H - 26, kw * 0.76, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(x + kw * 0.5, y, 2, H - 30);
  }
  ctx.restore();
}

// ------------------------------------------------------------------- S0
function s0(ctx, t) {
  bgRadial(ctx, W / 2, H / 2, 1150, '#1b0f0b', '#050303');
  const grow = seg(t, 0.02, 0.9, E.outExpo);
  const k = seg(t, 1.0, TL.first, E.inCubic);
  const half = lerp(0, 760, grow) * (1 - k * 0.985);
  const y = H / 2;
  const g = ctx.createLinearGradient(W / 2 - half, 0, W / 2 + half, 0);
  const a = 0.85 + k * 0.15;
  g.addColorStop(0, rgba(C.gold, 0)); g.addColorStop(0.5, rgba(C.goldHi, a)); g.addColorStop(1, rgba(C.gold, 0));
  ctx.fillStyle = g;
  const lw = 1.6 + k * 3;
  ctx.fillRect(W / 2 - half, y - lw / 2, half * 2, lw);
  // tick marks for the four beats of the pickup bar (two already "passed")
  for (let i = 0; i < 4; i++) {
    const bt = TL.beat(i - 4);
    const x = W / 2 + (i - 1.5) * 120 * (1 - k);
    const on = i >= 2 ? pulse(t, bt, 0.35) : 0;
    const vis = seg(t, 0.15 + i * 0.05, 0.45 + i * 0.05) * (1 - k);
    ctx.fillStyle = rgba(C.ivory, (0.25 + 0.75 * on) * vis);
    ctx.fillRect(x - 1, y + 14, 2, 10 + 10 * on);
    if (i >= 2) glow(ctx, x, y, 60, C.gold, on * 0.6 * vis);
  }
  // count-in numerals on the two silent beats
  ctx.save();
  ctx.font = '400 64px Cinzel'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  [['3', TL.beat(-2)], ['4', TL.beat(-1)]].forEach(([s, bt]) => {
    const e = seg(t, bt - 0.02, bt + 0.1, E.outCubic), o = 1 - seg(t, bt + 0.32, bt + 0.6);
    if (e * o <= 0) return;
    const sc = lerp(1.2, 1, E.outExpo(inv(bt, bt + 0.4, t)));
    ctx.save(); ctx.translate(W / 2, y - 44); ctx.scale(sc, sc);
    ctx.fillStyle = rgba(C.ivory, 0.9 * e * o); ctx.fillText(s, 0, 0); ctx.restore();
  });
  ctx.restore();
  // inhale: dust pulled into the point just before the downbeat
  if (k > 0) {
    const r = rng(3);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 70; i++) {
      const ang = r() * Math.PI * 2, d0 = 200 + r() * 700, s = 1 + r() * 2;
      const d = d0 * Math.pow(1 - k, 1.6);
      ctx.fillStyle = rgba(C.gold, 0.7 * k * (1 - k * 0.3));
      ctx.fillRect(W / 2 + Math.cos(ang) * d - s / 2, y + Math.sin(ang) * d * 0.55 - s / 2, s, s);
    }
    ctx.restore();
  }
  glow(ctx, W / 2, y, 90 + 180 * k, C.gold, 0.25 + 0.75 * k);
  dust(ctx, t, { n: 50, seed: 11, alpha: 0.35 * grow, speed: 10 });
}

// ------------------------------------------------------------------- S1
function s1(ctx, t) {
  const t0 = TL.first, t1 = TL.B2;
  ctx.fillStyle = '#070404'; ctx.fillRect(0, 0, W, H);
  const lt = t - t0;
  const whip = seg(t, TL.drums - 0.12, TL.drums + 0.2, E.inOutExpo);
  const impact = 1 - seg(t, t0, t0 + 0.7, E.outExpo);
  const cam = {
    x: 790 + lt * 22 + whip * 380,
    y: 1400 - lt * 14 - whip * 30,
    z: 1.3 * (1 + 0.14 * impact) * (1 + lt * 0.025),
    rot: -0.10 + lt * 0.012 + whip * 0.035,
  };
  const shake = pulse(t, TL.drums, 0.12) * 8;
  drawLogo(ctx, cam, { par: 1.4, sx: noise1(t * 40, 1) * shake, sy: noise1(t * 40, 2) * shake });
  // light sweeping across the lacquer
  const sw = seg(t, t0 + 0.05, t0 + 1.6, E.inOutSine);
  leak(ctx, lerp(-200, W + 300, sw), 380, 520, '#9fd0da', 0.22);
  leak(ctx, W + 80, -60, 900, '#ff9a4a', 0.28 + 0.15 * pulse(t, TL.drums, 0.4));
  // legibility scrim
  const sg = ctx.createLinearGradient(0, 0, W * 0.75, 0);
  sg.addColorStop(0, 'rgba(8,4,3,0.82)'); sg.addColorStop(0.55, 'rgba(8,4,3,0.45)'); sg.addColorStop(1, 'rgba(8,4,3,0)');
  ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);

  // "Blue" — letter rise, staggered from the first chord
  ctx.save();
  ctx.font = 'italic 500 290px "Cormorant Garamond"'; ctx.textBaseline = 'alphabetic';
  const bx = 150, by = 560;
  perLetter(ctx, 'Blue', bx, by, 2, (i, ch, x, y) => {
    const e = seg(t, t0 + i * 0.05, t0 + 0.55 + i * 0.05, E.outExpo);
    if (e <= 0) return;
    ctx.save();
    ctx.beginPath(); ctx.rect(x - 60, 0, 400, by + 80); ctx.clip();
    ctx.fillStyle = rgba(C.ivory, e);
    ctx.fillText(ch, x + (1 - e) * 30, y + (1 - e) * 200);
    ctx.restore();
  });
  // "BOSSA" — tracking collapses on the drum entry
  const d = seg(t, TL.drums - 0.04, TL.drums + 0.55, E.outExpo);
  if (d > 0) {
    ctx.font = '700 104px Cinzel';
    const sp = lerp(90, 30, d);
    perLetter(ctx, 'BOSSA', bx + 20, by + 140, sp, (i, ch, x, y) => {
      const e = seg(t, TL.drums - 0.04 + i * 0.03, TL.drums + 0.4 + i * 0.03, E.outExpo);
      const gr = ctx.createLinearGradient(0, y - 90, 0, y);
      gr.addColorStop(0, C.goldHi); gr.addColorStop(0.6, C.gold); gr.addColorStop(1, C.goldMid);
      ctx.fillStyle = gr; ctx.globalAlpha = e;
      ctx.fillText(ch, x + (1 - e) * 120, y);
      ctx.globalAlpha = 1;
    });
    // hairline underline + composer credit
    const u = seg(t, TL.drums + 0.05, TL.drums + 0.8, E.outExpo);
    ctx.fillStyle = rgba(C.gold, 0.9); ctx.fillRect(bx + 22, by + 178, 690 * u, 2);
    ctx.font = '400 20px "JetBrains Mono"'; ctx.letterSpacing = '9px';
    ctx.fillStyle = rgba(C.ivory, 0.7 * seg(t, TL.drums + 0.3, TL.drums + 0.8));
    ctx.fillText('KENNY DORHAM', bx + 24, by + 222);
    ctx.letterSpacing = '0px';
  }
  ctx.restore();
  dust(ctx, t, { n: 70, seed: 5, alpha: 0.5, speed: 22 });
  flash(ctx, 0.55 * pulse(t, t0, 0.12));
  ring(ctx, W / 2, H / 2, 40 + 1400 * seg(t, t0, t0 + 0.6, E.outCubic), 6 * (1 - seg(t, t0, t0 + 0.6)), C.goldHi, 0.8 * (1 - seg(t, t0, t0 + 0.6)));
}

// ------------------------------------------------------------------- S2
const FIFTHS = ['C', 'G', 'D', 'A', 'E', 'B', 'G♭', 'D♭', 'A♭', 'E♭', 'B♭', 'F'];
function chordAngles(idx) { return idx.map(i => i * 30).sort((a, b) => a - b); }

function s2(ctx, t) {
  const t0 = TL.B2, t1 = TL.B3, hit = TL.beat(6);
  bgRadial(ctx, 1210, 560, 1300, '#10202c', '#040709');
  // faint giant numeral as texture
  ctx.save();
  ctx.font = 'italic 600 980px "Cormorant Garamond"'; ctx.fillStyle = rgba(C.blue, 0.06);
  ctx.fillText('iv', 90 - 60 * seg(t, t0, t1), 960);
  ctx.restore();
  dust(ctx, t, { n: 80, seed: 21, color: C.blue, alpha: 0.35, speed: 14 });

  const cx = 1230, cy = 560, R = 350;
  const ent = seg(t, t0, t0 + 0.7, E.outExpo);
  const ex = seg(t, t1 - 0.42, t1, E.inQuart);
  const punch = pulse(t, hit, 0.2);
  const sc = lerp(0.55, 1, ent) * (1 + 0.07 * punch) * (1 - ex);
  const rot = (lerp(-120, 30, ent) + 540 * ex) * Math.PI / 180; // F rotates to 12 o'clock
  const alpha = ent * (1 - ex * 0.6);
  if (sc > 0.01) {
    ctx.save(); ctx.translate(cx, cy); ctx.scale(sc, sc); ctx.rotate(rot);
    ctx.globalAlpha = alpha;
    // rings + ticks
    ctx.strokeStyle = rgba(C.gold, 0.55); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = rgba(C.gold, 0.22); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, R * 0.64, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, R * 1.12, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 72; i++) {
      const a = i * Math.PI * 2 / 72, major = i % 6 === 0;
      const r0 = R * 1.12, r1 = r0 + (major ? 22 : 9);
      ctx.strokeStyle = rgba(C.ivory, major ? 0.55 : 0.22);
      ctx.beginPath(); ctx.moveTo(Math.sin(a) * r0, -Math.cos(a) * r0); ctx.lineTo(Math.sin(a) * r1, -Math.cos(a) * r1); ctx.stroke();
    }
    // chord shape: Cm7 morphing into Fm7
    // iv is i moved one step round the circle, so every vertex turns by -30°
    const A0 = chordAngles([0, 1, 9, 10]), A1 = chordAngles([11, 0, 9, 8]).map(a => a > 300 ? a - 360 : a).sort((a, b) => a - b);
    const m = seg(t, t0 + 0.08, t0 + 0.6, E.inOutCubic);
    const pts = A0.map((a, i) => {
      const ang = lerp(a, A1[i], m) * Math.PI / 180;
      return [Math.sin(ang) * R, -Math.cos(ang) * R];
    });
    ctx.fillStyle = rgba(C.gold, 0.10 + 0.12 * punch);
    ctx.strokeStyle = rgba(C.goldHi, 0.95); ctx.lineWidth = 2.5;
    ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle = rgba(C.gold, 0.35); ctx.lineWidth = 1;
    pts.forEach(([x, y]) => { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(x, y); ctx.stroke(); });
    ctx.globalAlpha = 1;
    pts.forEach(([x, y]) => glow(ctx, x, y, 70 + 60 * punch, C.gold, (0.55 + 0.45 * punch) * alpha));
    ctx.globalAlpha = alpha;
    // key names, kept upright
    const lit = new Set(m > 0.5 ? ['F', 'A♭', 'C', 'E♭'] : ['C', 'E♭', 'G', 'B♭']);
    FIFTHS.forEach((n, i) => {
      const a = i * Math.PI / 6;
      const x = Math.sin(a) * R * 0.82, y = -Math.cos(a) * R * 0.82;
      const on = lit.has(n);
      ctx.save(); ctx.translate(x, y); ctx.rotate(-rot);
      ctx.font = `${on ? 700 : 400} ${on ? 40 : 30}px Cinzel`;
      ctx.fillStyle = on ? rgba(C.goldHi, 1) : rgba(C.ivory, 0.45);
      textFlat(ctx, n, 0, (on ? 14 : 10), on ? 40 : 30, { align: 'center' });
      ctx.restore();
      ctx.fillStyle = on ? rgba(C.goldHi, 1) : rgba(C.ivory, 0.4);
      ctx.beginPath(); ctx.arc(Math.sin(a) * R, -Math.cos(a) * R, on ? 7 : 3.5, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();
    ring(ctx, cx, cy, R * sc * (1 + 0.8 * seg(t, hit, hit + 0.6, E.outCubic)), 3, C.goldHi, 0.8 * punch);
  }
  // left column: the chord spelled out
  ctx.save();
  const lx = 170;
  ctx.font = '400 17px "JetBrains Mono"'; ctx.letterSpacing = '7px';
  ctx.fillStyle = rgba(C.blue, 0.8 * ent * (1 - ex));
  ctx.fillText('CIRCLE OF FIFTHS', lx, 300);
  ctx.letterSpacing = '0px';
  ctx.fillStyle = rgba(C.ivory, ent * (1 - ex));
  drawChord(ctx, 'Fm7', lx, 440, 150, { family: 'Cinzel', weight: 700 });
  const tones = [['F', 'ROOT'], ['A♭', '♭3'], ['C', '5'], ['E♭', '♭7']];
  tones.forEach(([n, f], i) => {
    const e = seg(t, t0 + 0.2 + i * 0.07, t0 + 0.7 + i * 0.07, E.outExpo) * (1 - ex);
    const on = pulse(t, hit + i * 0.04, 0.25);
    const y = 540 + i * 74;
    ctx.fillStyle = rgba(C.gold, e * (0.8 + 0.2 * on));
    ctx.font = '600 50px Cinzel';
    textFlat(ctx, n, lx + (1 - e) * -60, y + 40, 50);
    ctx.fillStyle = rgba(C.ivory, 0.55 * e);
    ctx.font = '400 20px "JetBrains Mono"';
    textFlat(ctx, f, lx + 120 + (1 - e) * -60, y + 34, 20);
    ctx.fillStyle = rgba(C.gold, 0.25 * e); ctx.fillRect(lx + 190, y + 26, 380 * e, 1);
  });
  ctx.restore();
  flash(ctx, 0.18 * pulse(t, hit, 0.1), '#dff3ff');
  if (ex > 0) glow(ctx, cx, cy, 200 + 500 * ex, C.goldHi, ex);
}

// ------------------------------------------------------------------- S3
function s3(ctx, t) {
  const t0 = TL.B3, t1 = TL.B4, hit = TL.beat(10);
  const lt = t - t0;
  ctx.fillStyle = '#0b0605'; ctx.fillRect(0, 0, W, H);
  glow(ctx, 600, 560, 900, '#7a2e14', 0.55);
  leak(ctx, 1700, 200, 800, '#ff8a3c', 0.12);
  dust(ctx, t, { n: 80, seed: 31, alpha: 0.4, speed: 16 });

  const G = A.g2;
  const ent = seg(t, t0, t0 + 0.55, E.outExpo);
  const drift = lt * 0.018;
  const sc = lerp(1.32, 1, ent) * (1 + drift);
  const gh = 860 * sc, gw = G.w / G.h * gh;
  const gx = 590 - gw / 2, gy = 500 - gh / 2 + (1 - ent) * 260;
  // echo outlines collapsing into the glyph
  for (let k = 3; k >= 1; k--) {
    const e = seg(t, t0 + k * 0.03, t0 + 0.5 + k * 0.05, E.outExpo);
    const s = 1 + k * 0.12 * (1 - e);
    ctx.save(); ctx.globalAlpha = 0.28 * (1 - e) * seg(t, t0, t0 + 0.05);
    ctx.drawImage(G.cv, 590 - gw * s / 2, 500 - gh * s / 2, gw * s, gh * s); ctx.restore();
  }
  // main glyph, sliced on the bar's half-note accent
  const sl = seg(t, hit - 0.01, hit + 0.55);
  const slices = 11;
  ctx.save(); ctx.globalAlpha = ent;
  for (let i = 0; i < slices; i++) {
    const off = sl > 0 && sl < 1 ? (i % 2 ? 1 : -1) * (40 + 60 * Math.abs(Math.sin(i * 2.3))) * (1 - E.outElastic(sl)) * 1.0 : 0;
    const syy = G.h * i / slices, shh = G.h / slices + 1;
    ctx.drawImage(G.cv, 0, syy, G.w, shh, gx + off, gy + gh * i / slices, gw, gh / slices + 1);
  }
  ctx.restore();
  sweep(ctx, G, gx, gy, gw, gh, seg(t, t0 + 0.1, t0 + 0.9, E.inOutSine), 0.10, 0.9);
  sweep(ctx, G, gx, gy, gw, gh, seg(t, hit, hit + 0.6, E.inOutSine), 0.14, 0.8);

  // right-hand block
  const rx = 1070;
  const ein = i => seg(t, t0 + 0.12 + i * 0.06, t0 + 0.7 + i * 0.06, E.outExpo);
  ctx.save();
  ctx.font = '400 17px "JetBrains Mono"'; ctx.letterSpacing = '7px';
  ctx.fillStyle = rgba(C.gold, 0.8 * ein(0));
  ctx.fillText('BAR 03 · SUPERTONIC', rx + (1 - ein(0)) * 80, 250);
  ctx.letterSpacing = '0px';
  ctx.font = 'italic 600 250px "Cormorant Garamond"';
  ctx.fillStyle = rgba(C.ivory, ein(1));
  ctx.fillText('ii', rx - 10 + (1 - ein(1)) * 140, 470);
  ctx.fillStyle = rgba(C.gold, ein(2));
  drawChord(ctx, 'Dm7♭5', rx + 190 + (1 - ein(2)) * 140, 470, 120);
  ctx.font = '400 19px "JetBrains Mono"'; ctx.letterSpacing = '8px';
  ctx.fillStyle = rgba(C.ivory, 0.6 * ein(3));
  ctx.fillText('HALF-DIMINISHED', rx + 195 + (1 - ein(3)) * 140, 522);
  ctx.letterSpacing = '0px';
  ctx.restore();

  // keyboard: chord tones lit, pressed on the actual note onsets
  const tones = [62, 65, 68, 72]; // D F A♭ C
  const ons = TL.tm.onsets.mid.concat(TL.tm.onsets.low).filter(o => o.t >= t0 - 0.05 && o.t < t1 && o.s > 0.3).sort((a, b) => a.t - b.t);
  const pressOf = m => {
    const idx = tones.indexOf(m); if (idx < 0) return 0;
    let v = 0; ons.forEach((o, k) => { if (k % 4 === idx && o.t <= t) v = Math.max(v, Math.exp(-(t - o.t) / 0.16)); });
    return v + (win(t, t0, t0 + 0.4) ? pulse(t, t0, 0.25) : 0);
  };
  const kbE = ein(4);
  const ky = 610 + (1 - kbE) * 60, kw = 700 / 10;
  drawKeyboard(ctx, rx, ky, 700, 250, 60, 76, m => tones.includes(m) ? 1 : 0, pressOf, kbE);
  ctx.save();
  ctx.font = '700 26px Cinzel'; ctx.fillStyle = rgba('#2a1606', 0.9 * kbE);
  [['D', 1, 0], ['F', 3, 0], ['C', 7, 0]].forEach(([n, wi]) => textFlat(ctx, n, rx + wi * kw + kw / 2, ky + 232 + pressOf(n === 'D' ? 62 : n === 'F' ? 65 : 72) * 7, 26, { align: 'center' }));
  ctx.font = '700 20px Cinzel';
  textFlat(ctx, 'A♭', rx + 5 * kw, ky + 140 + pressOf(68) * 6, 20, { align: 'center' });
  ctx.restore();
  flash(ctx, 0.6 * pulse(t, t0, 0.1));
  ring(ctx, 590, 560, 60 + 1200 * seg(t, t0, t0 + 0.7, E.outCubic), 5, C.goldHi, 0.7 * (1 - seg(t, t0, t0 + 0.7)));
}

// ------------------------------------------------------------------- S4
function s4(ctx, t) {
  const t0 = TL.B4, t1 = TL.B5;
  const lt = t - t0;
  const imp = seg(t, TL.beat(14.6), t1 - 0.02, E.inQuart); // collapse into one gold line
  const h1 = TL.beat(14), h2 = 10.699, h3 = 10.786;
  ctx.fillStyle = '#0b0404'; ctx.fillRect(0, 0, W, H);
  glow(ctx, W / 2, H / 2, 1000, '#8a1d10', 0.5 * (1 - imp));

  const shake = (pulse(t, h1, 0.1) + pulse(t, h2, 0.1)) * 14 * (1 - imp);
  const shx = noise1(t * 50, 3) * shake, shy = noise1(t * 50, 4) * shake;
  ctx.save();
  ctx.translate(W / 2 + shx, H / 2 + shy);
  ctx.rotate(-0.12 - lt * 0.02);
  const zoom = (1 + lt * 0.035) * (1 + 0.05 * pulse(t, h1, 0.2));
  ctx.scale(zoom, zoom * (1 - imp * 0.985));
  // kinetic rows
  const rows = 11, rh = 128;
  const speedUp = 1 + 2.5 * seg(t, t0, t1, E.inCubic);
  const inv1 = pulse(t, h1, 0.18);
  ctx.font = '400 124px Anton'; ctx.textBaseline = 'middle';
  const phrase = 'G7   ·   FIVE   ·   V7   ·   DOMINANT   ·   ';
  const pw = ctx.measureText(phrase).width;
  for (let i = 0; i < rows; i++) {
    const r = i - (rows - 1) / 2;
    const dir = i % 2 ? 1 : -1;
    const x = ((lt * 260 * speedUp * dir + i * 311) % pw + pw) % pw;
    const y = r * rh;
    const center = Math.abs(r) < 0.5;
    const rowIn = seg(t, t0 + Math.abs(r) * 0.03, t0 + 0.3 + Math.abs(r) * 0.03, E.outExpo);
    ctx.globalAlpha = rowIn;
    if (i % 2 === 0) {
      ctx.strokeStyle = rgba(center ? C.gold : C.ivory, center ? 0.55 : 0.17 + 0.5 * inv1);
      ctx.lineWidth = 1.5;
      for (let k = -2; k < 3; k++) ctx.strokeText(phrase, -x + k * pw, y);
    } else {
      ctx.fillStyle = rgba(inv1 > 0.05 ? C.gold : C.red, 0.13 + 0.55 * inv1);
      for (let k = -2; k < 3; k++) ctx.fillText(phrase, -x + k * pw, y);
    }
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // tension rings
  ctx.save(); ctx.translate(W / 2 + shx, H / 2 + shy);
  ctx.globalAlpha = (1 - imp) * seg(t, t0, t0 + 0.3);
  ctx.setLineDash([4, 14]); ctx.strokeStyle = rgba(C.goldHi, 0.6); ctx.lineWidth = 2;
  ctx.rotate(lt * 0.9); ctx.beginPath(); ctx.arc(0, 0, 470, 0, Math.PI * 2); ctx.stroke();
  ctx.rotate(-lt * 2.1); ctx.setLineDash([60, 20, 4, 20]); ctx.strokeStyle = rgba(C.red, 0.7);
  ctx.beginPath(); ctx.arc(0, 0, 510, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // the "5"
  const G = A.g5;
  const ent = seg(t, t0, t0 + 0.35, E.outExpo);
  const s = lerp(1.45, 1, ent) * (1 + lt * 0.03);
  const sx = s * (1 + imp * 5), sy = s * (1 - imp * 0.99);
  const gh = 860, gw = G.w / G.h * gh;
  // strobe echo on the dotted hits
  for (const [ht, dz] of [[h2, 0.16], [h3, 0.3]]) {
    const e = pulse(t, ht, 0.14);
    if (e < 0.01) continue;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.4 * e;
    const ss = 1 + dz * (1 - e);
    ctx.drawImage(G.cv, W / 2 - gw * sx * ss / 2 + shx, H / 2 - gh * sy * ss / 2 + shy, gw * sx * ss, gh * sy * ss);
    ctx.restore();
  }
  ctx.drawImage(G.cv, W / 2 - gw * sx / 2 + shx, H / 2 - gh * sy / 2 + shy, gw * sx, gh * sy);
  sweep(ctx, G, W / 2 - gw * sx / 2 + shx, H / 2 - gh * sy / 2 + shy, gw * sx, gh * sy, seg(t, h1 - 0.1, h1 + 0.45), 0.12, 0.9);

  // side captions
  ctx.save();
  ctx.globalAlpha = (1 - imp) * seg(t, t0 + 0.15, t0 + 0.5);
  ctx.font = '400 17px "JetBrains Mono"'; ctx.letterSpacing = '7px'; ctx.fillStyle = rgba(C.ivory, 0.75);
  ctx.fillText('BAR 04 · DOMINANT', 150, 190);
  ctx.textAlign = 'right'; ctx.fillText('TENSION → RESOLUTION', W - 150, 190);
  ctx.letterSpacing = '0px';
  ctx.restore();

  // the collapse: a single gold line across the frame
  if (imp > 0) {
    const lw = lerp(40, 2.5, imp);
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, rgba(C.gold, 0)); g.addColorStop(0.5, rgba(C.goldHi, imp)); g.addColorStop(1, rgba(C.gold, 0));
    ctx.fillStyle = g; ctx.fillRect(0, H / 2 - lw / 2, W, lw);
    glow(ctx, W / 2, H / 2, 600, C.gold, 0.6 * imp);
  }
  flash(ctx, 0.7 * pulse(t, t0, 0.09), '#ffe9e0');
  flash(ctx, 0.25 * pulse(t, h1, 0.08), '#ffd0a0');
}

// ------------------------------------------------------------------- S5/S6
function logoCam(t) {
  const t0 = TL.B5;
  const b1 = A.meta.glyphs['1'];
  const c1 = { x: (b1.x0 + b1.x1) / 2, y: (b1.y0 + b1.y1) / 2 };
  const cf = { x: 1000, y: 880 };
  const p = seg(t, t0, t0 + 1.55, E.inOutCubic);
  const pz = seg(t, t0, t0 + 1.55, t => 1 - Math.pow(1 - t, 2.2));
  const z = Math.exp(lerp(Math.log(3.1), Math.log(1.035), pz)) * (1 + 0.018 * Math.max(0, t - t0 - 1.55));
  const rot = lerp(0.06, 0, p);
  // keep the frame inside the painting (the back layer is the smallest one)
  const zb = z * (1 - 0.07 * 1.2 * 0.5), k = 1 - 0.07 * 1.2;
  const hw = (W / 2 + Math.abs(rot) * H / 2) / zb + 6, hh = (H / 2 + Math.abs(rot) * W / 2) / zb + 6;
  let x = lerp(c1.x, cf.x, p), y = lerp(c1.y, cf.y, p);
  const bx = 1000 + (x - 1000) * k;
  const bxC = clamp(bx, hw, 2000 - hw);
  x = 1000 + (bxC - 1000) / k;
  y = Math.max(y, 1000 + (hh - 1000) / k);
  return { x, y, z, rot };
}

function s5(ctx, t) {
  const t0 = TL.B5, t6 = TL.B6;
  ctx.fillStyle = '#060303'; ctx.fillRect(0, 0, W, H);
  const cam = logoCam(t);
  const ignAt = { '1': t0 - 0.01, '5': 12.268, '2': 12.462, 'T': 12.83, 'S': 12.88, 'O': 12.93, 'P': 12.98 };
  const ign = {};
  const dim = 1 - 0.22 * seg(t, t6 + 0.1, DUR, E.inOutSine); // lights come down with the fade-out
  for (const [g, ta] of Object.entries(ignAt)) ign[g] = seg(t, ta, ta + 0.07) * (dim + 0.45 * pulse(t, ta, 0.22));
  const sweepHit = TL.beat(18);
  drawLogo(ctx, cam, { ign, par: 1.2, glowBoost: 0.22 * pulse(t, sweepHit, 0.35) + 0.18 * pulse(t, t6, 0.3) });

  // specular pass over the whole lettering on the bar's accent
  const band = A.lettersGlyph;
  const tl = logoToScreen(cam, band.bx, band.by), br = logoToScreen(cam, band.bx + band.w, band.by + band.h);
  sweep(ctx, band, tl.x, tl.y, br.x - tl.x, br.y - tl.y, seg(t, sweepHit - 0.05, sweepHit + 0.75, E.inOutSine), 0.09, 0.5, 0.2);
  sweep(ctx, band, tl.x, tl.y, br.x - tl.x, br.y - tl.y, seg(t, t6 - 0.02, t6 + 0.55, E.inOutSine), 0.1, 0.35, 0.2);

  // warm leak rolling in with the resolution, cooling on the E♭m7
  leak(ctx, lerp(W + 200, W * 0.7, seg(t, t0, t0 + 2)), 120, 900, '#ff9d4d', 0.35 * (1 - seg(t, t6, t6 + 0.4)));
  leak(ctx, 200, 1000, 800, '#8cc4d6', 0.25 * seg(t, t6 - 0.05, t6 + 0.3));
  dust(ctx, t, { n: 110, seed: 51, alpha: 0.55, speed: 20 });

  // end-card billing
  const info = seg(t, sweepHit, sweepHit + 0.6, E.outExpo);
  if (info > 0) {
    const sg = ctx.createLinearGradient(0, 780, 0, H);
    sg.addColorStop(0, 'rgba(6,3,3,0)'); sg.addColorStop(0.38, 'rgba(6,3,3,0.86)'); sg.addColorStop(0.6, 'rgba(6,3,3,0.96)'); sg.addColorStop(1, 'rgba(6,3,3,0.98)');
    ctx.globalAlpha = info; ctx.fillStyle = sg; ctx.fillRect(0, 780, W, H - 780); ctx.globalAlpha = 1;
    const y = 985, rule = 900;
    const rw = 1560 * seg(t, sweepHit, sweepHit + 0.7, E.outExpo);
    const rg = ctx.createLinearGradient(W / 2 - rw / 2, 0, W / 2 + rw / 2, 0);
    rg.addColorStop(0, rgba(C.gold, 0)); rg.addColorStop(0.2, rgba(C.gold, 0.8)); rg.addColorStop(0.8, rgba(C.gold, 0.8)); rg.addColorStop(1, rgba(C.gold, 0));
    ctx.fillStyle = rg; ctx.fillRect(W / 2 - rw / 2, rule, rw, 1.5);
    const col = (i) => seg(t, sweepHit + 0.08 + i * 0.09, sweepHit + 0.6 + i * 0.09, E.outExpo);
    ctx.save();
    ctx.textBaseline = 'alphabetic';
    // left: teaser number
    ctx.globalAlpha = col(0);
    ctx.font = '400 18px "JetBrains Mono"'; ctx.letterSpacing = '8px'; ctx.fillStyle = rgba(C.ivory, 0.75);
    ctx.textAlign = 'left'; ctx.fillText('TEASER', 180, y - 30);
    ctx.font = '600 50px Cinzel'; ctx.letterSpacing = '6px'; ctx.fillStyle = C.gold;
    ctx.fillText('01', 180, y + 26);
    // centre: event
    ctx.globalAlpha = col(1);
    ctx.textAlign = 'center'; ctx.letterSpacing = '4px';
    ctx.font = '600 44px Cinzel'; ctx.fillStyle = C.goldHi;
    const ev = 'M3-2026', evw = ctx.measureText(ev).width;
    ctx.font = '500 44px "Noto Serif JP"';
    const aw = ctx.measureText('秋').width;
    const ex0 = W / 2 - (evw + aw + 10) / 2;
    ctx.textAlign = 'left';
    ctx.font = '600 44px Cinzel'; ctx.fillText(ev, ex0, y - 8);
    ctx.font = '500 44px "Noto Serif JP"'; ctx.fillText('秋', ex0 + evw + 10, y - 8);
    ctx.textAlign = 'center';
    ctx.font = '400 21px "JetBrains Mono"'; ctx.letterSpacing = '6px'; ctx.fillStyle = rgba(C.ivory, 0.85);
    ctx.fillText('2026.10.25 SUN', W / 2 - 70, y + 34);
    ctx.font = '500 21px "Noto Serif JP"'; ctx.letterSpacing = '4px';
    ctx.fillText('う-01b', W / 2 + 165, y + 34);
    // right: url
    ctx.globalAlpha = col(2);
    ctx.textAlign = 'right'; ctx.font = '400 20px "JetBrains Mono"'; ctx.letterSpacing = '6px'; ctx.fillStyle = rgba(C.ivory, 0.75);
    ctx.fillText('POST251.COM', W - 180, y + 26);
    // ii – V – i rolls over to "to be continued" as the next ii (E♭m7) arrives
    const tb = seg(t, t6 - 0.02, t6 + 0.32, E.outExpo);
    ctx.beginPath(); ctx.rect(W - 700, y - 62, 540, 50); ctx.clip();
    ctx.font = 'italic 500 32px "Cormorant Garamond"'; ctx.letterSpacing = '1px';
    ctx.fillStyle = rgba(C.gold, 0.95 * (1 - tb));
    ctx.fillText('ii – V – i', W - 180, y - 24 - tb * 44);
    ctx.fillStyle = rgba(C.ivory, 0.95 * tb);
    ctx.fillText('to be continued …', W - 180, y - 24 + (1 - tb) * 44);
    ctx.restore();
  }

  // the gold line from bar 4 splits open onto the painting
  const open = seg(t, t0, t0 + 0.5, E.outExpo);
  if (open < 1) {
    const hh = H / 2 * open;
    ctx.fillStyle = '#050202';
    ctx.fillRect(0, 0, W, H / 2 - hh); ctx.fillRect(0, H / 2 + hh, W, H / 2 - hh + 1);
    const a = 1 - open;
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, rgba(C.gold, 0)); g.addColorStop(0.5, rgba(C.goldHi, a)); g.addColorStop(1, rgba(C.gold, 0));
    ctx.fillStyle = g; ctx.fillRect(0, H / 2 - hh - 2, W, 3); ctx.fillRect(0, H / 2 + hh - 1, W, 3);
  }
  const p1 = logoToScreen(cam, (A.meta.glyphs['1'].x0 + A.meta.glyphs['1'].x1) / 2, 736);
  glow(ctx, p1.x, p1.y, 620, C.goldHi, 0.6 * pulse(t, t0, 0.3));
  ring(ctx, p1.x, p1.y, 80 + 1500 * seg(t, t0, t0 + 0.8, E.outCubic), 8 * (1 - seg(t, t0, t0 + 0.8)), C.goldHi, 0.8 * (1 - seg(t, t0, t0 + 0.8)));
  flash(ctx, 0.32 * pulse(t, t0, 0.1));
  flash(ctx, 0.1 * pulse(t, t6, 0.15), '#d8f0ff');
}

// ------------------------------------------------------------- dispatcher
function drawScene(ctx, t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.letterSpacing = '0px'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.setLineDash([]);
  const wipeIn = TL.B2 - 0.3, wipeOut = TL.B2 + 0.42;
  if (t < TL.first) s0(ctx, t);
  else if (t < TL.B2) s1(ctx, t);
  else if (t < TL.B3) s2(ctx, t);
  else if (t < TL.B4) s3(ctx, t);
  else if (t < TL.B5) s4(ctx, t);
  else s5(ctx, t);
  if (t > wipeIn && t < wipeOut) {
    const ph = t < TL.B2 ? inv(wipeIn, TL.B2, t) : 1 + inv(TL.B2, wipeOut, t);
    keyWipe(ctx, ph);
  }
}

// -------------------------------------------------------------------- HUD
function drawHUD(ctx, t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const vis = seg(t, 0.1, 0.6, E.outCubic) * (1 - seg(t, TL.B5 - 0.05, TL.B5 + 0.25));
  const corners = seg(t, 0.05, 0.5) * (1 - 0.6 * seg(t, TL.B5, TL.B5 + 0.4));
  ctx.textBaseline = 'alphabetic';
  // safe-area brackets
  ctx.strokeStyle = rgba(C.ivory, 0.35 * corners); ctx.lineWidth = 1.5;
  const m = 56, l = 34;
  [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]].forEach(([x, y, sx, sy]) => {
    ctx.beginPath(); ctx.moveTo(x, y + sy * l); ctx.lineTo(x, y); ctx.lineTo(x + sx * l, y); ctx.stroke();
  });
  if (vis <= 0.001) return;
  ctx.globalAlpha = vis;
  // top-left brand
  ctx.font = '600 21px Cinzel'; ctx.letterSpacing = '9px'; ctx.fillStyle = C.gold;
  ctx.fillText('POST251', 96, 108);
  ctx.font = '400 13px "JetBrains Mono"'; ctx.letterSpacing = '5px'; ctx.fillStyle = rgba(C.ivory, 0.55);
  ctx.fillText('TEASER 01', 97, 132);
  // top-right session info
  ctx.textAlign = 'right'; ctx.font = '400 14px "JetBrains Mono"'; ctx.letterSpacing = '4px'; ctx.fillStyle = rgba(C.ivory, 0.62);
  ctx.fillText('92 BPM  ·  4/4  ·  C MINOR', W - 96, 108);
  ctx.fillStyle = rgba(C.ivory, 0.4); ctx.font = '400 12px "JetBrains Mono"';
  ctx.fillText('BLUE BOSSA', W - 96, 132);
  ctx.textAlign = 'left';

  // bottom-left: chord symbol with a slot roll on each change
  let ci = -1;
  TL.chords.forEach((c, i) => { if (t >= c.t - 0.02) ci = i; });
  const bx = 96, by = 978;
  if (ci >= 0) {
    const c = TL.chords[ci], pr = TL.chords[ci - 1];
    const e = seg(t, c.t - 0.02, c.t + 0.3, E.outExpo);
    ctx.save(); ctx.beginPath(); ctx.rect(bx - 10, by - 82, 560, 104); ctx.clip();
    if (pr && e < 1) {
      ctx.fillStyle = rgba(C.gold, 1 - e);
      drawChord(ctx, pr.sym, bx, by - e * 100, 66);
    }
    ctx.fillStyle = rgba(C.gold, e);
    const cw = drawChord(ctx, c.sym, bx, by + (1 - e) * 100, 66);
    ctx.font = 'italic 500 40px "Cormorant Garamond"'; ctx.fillStyle = rgba(C.ivory, 0.8 * e);
    textFlat(ctx, c.fn, bx + cw + 22, by + (1 - e) * 100, 40);
    ctx.restore();
  }
  const beatIdx = Math.floor((t - TL.g0) / TL.beatLen + 1e-6);
  const barN = Math.floor(beatIdx / 4) + 1, bt = ((beatIdx % 4) + 4) % 4 + 1;
  ctx.font = '400 13px "JetBrains Mono"'; ctx.letterSpacing = '4px'; ctx.fillStyle = rgba(C.ivory, 0.5);
  ctx.fillText(t < TL.first ? 'COUNT-IN' : `BAR ${String(barN).padStart(2, '0')} · BEAT ${bt}`, bx + 2, by + 34);

  // ii–V–i tracker
  const tx = 700, ty = 960;
  [['2', TL.B3], ['5', TL.B4], ['1', TL.B5]].forEach(([n, ta], i) => {
    const on = seg(t, ta - 0.02, ta + 0.2, E.outExpo);
    const x = tx + i * 64;
    ctx.strokeStyle = rgba(C.gold, 0.5 + 0.5 * on); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, ty, 19, 0, Math.PI * 2); ctx.stroke();
    if (on > 0) { ctx.fillStyle = rgba(C.gold, 0.9 * on); ctx.beginPath(); ctx.arc(x, ty, 19 * on, 0, Math.PI * 2); ctx.fill(); }
    ctx.font = '700 17px Cinzel'; ctx.letterSpacing = '0px'; ctx.textAlign = 'center';
    ctx.fillStyle = on > 0.5 ? '#1a0c06' : rgba(C.gold, 0.8); ctx.fillText(n, x, ty + 6);
    ctx.textAlign = 'left';
    if (i < 2) { ctx.fillStyle = rgba(C.gold, 0.35); ctx.fillRect(x + 22, ty - 0.5, 20, 1); }
  });

  // bottom: bar/beat ruler with playhead
  const rx0 = 960, rx1 = W - 400, ry = 968;
  const total = 24, pos = clamp((t - TL.g0) / TL.beatLen, -2, total);
  for (let b = 0; b < total; b++) {
    const x = lerp(rx0, rx1, b / (total - 1));
    const past = pos >= b, hot = pulse(t, TL.beat(b), 0.25) * (t >= TL.beat(b) ? 1 : 0);
    const h = b % 4 === 0 ? 16 : 8;
    ctx.fillStyle = rgba(past ? C.gold : C.ivory, past ? 0.55 + 0.45 * hot : 0.22);
    ctx.fillRect(x - 1, ry - h / 2 - hot * 6, 2, h + hot * 12);
  }
  const px = lerp(rx0, rx1, clamp(pos / (total - 1), 0, 1));
  ctx.fillStyle = C.goldHi; ctx.fillRect(px - 1, ry - 22, 2, 44);
  ctx.fillStyle = rgba(C.gold, 0.3); ctx.fillRect(rx0, ry + 24, px - rx0, 1);

  // bottom-right: timecode + band meters
  ctx.textAlign = 'right';
  const f = Math.round(t * FPS), ss = Math.floor(f / FPS), ff = f % FPS;
  ctx.font = '400 15px "JetBrains Mono"'; ctx.letterSpacing = '3px'; ctx.fillStyle = rgba(C.ivory, 0.62);
  ctx.fillText(`00:00:${String(ss).padStart(2, '0')}:${String(ff).padStart(2, '0')}`, W - 96, by + 34);
  ['low', 'mid', 'hi'].forEach((b, i) => {
    const v = envAt(b, t);
    const x = W - 96 - 60 + i * 22, h = 6 + 52 * v;
    ctx.fillStyle = rgba(C.gold, 0.25 + 0.6 * v);
    ctx.fillRect(x, by + 4 - h, 12, h);
  });
  ctx.textAlign = 'left'; ctx.letterSpacing = '0px'; ctx.globalAlpha = 1;
}

// ------------------------------------------------------------ post params
function postParams(t, frame) {
  const P = { th: 0.86, knee: 0.45, bloom: 0.6, ca: 0.0012, vig: 0.5, grain: 0.05, expo: 1.0, warp: 0.02,
    lift: [0.0, 0.0, 0.0], gain: [1, 1, 1], tint: [1, 1, 1], seed: frame % 97 };
  const hits = [TL.first, TL.drums, TL.B2, TL.beat(6), TL.B3, TL.beat(10), TL.B4, TL.beat(14), 10.699, TL.B5, TL.beat(18), TL.B6];
  let hp = 0; hits.forEach(h => hp += pulse(t, h, 0.18));
  P.bloom += 0.5 * hp;
  P.ca += 0.006 * (pulse(t, TL.B3, 0.2) + pulse(t, TL.B4, 0.25) + pulse(t, TL.beat(10), 0.25) + pulse(t, 10.699, 0.15) + pulse(t, TL.B2, 0.2)) + 0.002 * hp;
  // grade per bar: warm / cool / warm / red / warm / cool
  const grades = [
    [0, { lift: [0.02, 0.008, 0.0], gain: [1.02, 0.99, 0.95] }],
    [TL.B2, { lift: [0.0, 0.012, 0.03], gain: [0.95, 1.0, 1.06] }],
    [TL.B3, { lift: [0.025, 0.01, 0.0], gain: [1.04, 0.99, 0.93] }],
    [TL.B4, { lift: [0.035, 0.0, 0.0], gain: [1.06, 0.95, 0.92] }],
    [TL.B5, { lift: [0.02, 0.01, 0.0], gain: [1.03, 1.0, 0.95] }],
    [TL.B6, { lift: [0.0, 0.015, 0.035], gain: [0.98, 1.0, 1.04] }],
  ];
  let g = grades[0][1], prev = g, gt = 0;
  grades.forEach(([ts, v], i) => { if (t >= ts) { prev = i ? grades[i - 1][1] : v; g = v; gt = ts; } });
  const k = seg(t, gt, gt + 0.25);
  P.lift = prev.lift.map((v, i) => lerp(v, g.lift[i], k));
  P.gain = prev.gain.map((v, i) => lerp(v, g.gain[i], k));
  P.sat = 1.05;
  if (t < TL.first) { P.bloom = 0.9; P.th = 0.45; }
  // end card: hold the leaf's colour instead of blooming it towards white
  const endK = seg(t, TL.beat(18) + 0.3, TL.beat(18) + 1.0);
  P.bloom = lerp(P.bloom, 0.38 + 0.3 * hp, endK); P.sat = lerp(P.sat, 1.14, endK);
  return P;
}

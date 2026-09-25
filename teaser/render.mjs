// Headless renderer: serves this folder, drives index.html frame by frame in
// Chromium (parallel pages), and encodes with ffmpeg.
//
//   node render.mjs stills 1.4,3.2,7.0 [outDir]
//   node render.mjs video <song.mp3> [out.mp4] [--workers 4] [--from 0 --to 900]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = require('/opt/node22/lib/node_modules/playwright'); }

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const FPS = 60, DUR = 15, FRAMES = FPS * DUR;
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.css': 'text/css' };

function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { rsp.writeHead(404); rsp.end(); return; }
      rsp.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(rsp);
    }).listen(0, '127.0.0.1', () => res(srv));
  });
}

async function openPage(browser, port) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('console', m => { if (m.type() === 'error') console.error('[page]', m.text()); });
  page.on('pageerror', e => console.error('[pageerror]', e.message));
  await page.goto(`http://127.0.0.1:${port}/index.html?render=1`);
  const info = await page.evaluate(async () => { try { return await window.bootP; } catch (e) { return { error: window.BOOT_ERROR || String(e) }; } });
  if (info && info.error) throw new Error(info.error);
  return { page, info };
}

async function shot(page, f) {
  await page.evaluate(f => window.renderFrame(f), f);
  return page.locator('#out').screenshot({ type: 'png' });
}

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const mode = args[0];

const srv = await serve();
const port = srv.address().port;
const browser = await playwright.chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-driver-bug-workarounds'],
});

try {
  if (mode === 'stills') {
    const times = args[1].split(',').map(Number);
    const outDir = args[2] || 'stills';
    fs.mkdirSync(outDir, { recursive: true });
    const { page, info } = await openPage(browser, port);
    console.log('float targets:', info.float);
    for (const t of times) {
      const f = Math.round(t * FPS);
      const t0 = Date.now();
      const buf = await shot(page, f);
      const name = path.join(outDir, `t${t.toFixed(2).padStart(5, '0')}.png`);
      fs.writeFileSync(name, buf);
      console.log(name, `${Date.now() - t0}ms`);
    }
  } else if (mode === 'video') {
    const song = args[1];
    const outFile = args[2] && !args[2].startsWith('--') ? args[2] : 'out/post251_teaser01.mp4';
    const workers = +opt('--workers', 4);
    const from = +opt('--from', 0), to = +opt('--to', FRAMES);
    const frameDir = path.join(path.dirname(outFile), 'frames');
    fs.mkdirSync(frameDir, { recursive: true });
    const todo = [];
    for (let f = from; f < to; f++) if (!fs.existsSync(path.join(frameDir, `f${String(f).padStart(4, '0')}.png`))) todo.push(f);
    console.log(`${todo.length} frames to render with ${workers} workers`);
    let done = 0; const tStart = Date.now();
    await Promise.all(Array.from({ length: workers }, async (_, w) => {
      const { page } = await openPage(browser, port);
      for (let k = w; k < todo.length; k += workers) {
        const f = todo[k];
        fs.writeFileSync(path.join(frameDir, `f${String(f).padStart(4, '0')}.png`), await shot(page, f));
        if (++done % 30 === 0) {
          const el = (Date.now() - tStart) / 1000;
          console.log(`${done}/${todo.length}  ${el.toFixed(0)}s  eta ${(el / done * (todo.length - done)).toFixed(0)}s`);
        }
      }
      await page.close();
    }));
    // Encode: first 15.000 s of the song (its two silent pickup beats included),
    // eased out after the E♭m7 hit so the cut lands soft.
    const enc = [
      '-y', '-framerate', String(FPS), '-i', path.join(frameDir, 'f%04d.png'),
      '-ss', '0', '-t', String(DUR), '-i', song,
      '-filter_complex', `[1:a]atrim=0:${DUR},afade=t=out:st=14.45:d=0.55:curve=qsin,asetpts=N/SR/TB[a]`,
      '-map', '0:v', '-map', '[a]',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-tune', 'grain', '-pix_fmt', 'yuv420p',
      '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
      '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-t', String(DUR),
      '-movflags', '+faststart', outFile,
    ];
    await new Promise((res, rej) => {
      const p = spawn(FFMPEG, enc, { stdio: ['ignore', 'inherit', 'inherit'] });
      p.on('exit', c => c === 0 ? res() : rej(new Error('ffmpeg exit ' + c)));
    });
    console.log('wrote', outFile);
  } else {
    console.log('usage: node render.mjs stills <t,t,..> [dir] | video <song.mp3> [out.mp4] [--workers N]');
  }
} finally {
  await browser.close();
  srv.close();
}

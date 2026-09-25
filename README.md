# POST251 — Teaser 01

「Blue Bossa」冒頭 15 秒（92 BPM / 4/4 / C minor）に合わせた、1920×1080・60fps のモーショングラフィックス・ティーザー。
白い紙面に黒の文字組み。色を持つのはロゴの絵だけにしてある。カットとアクセントは、音源を解析して得た拍とアタック位置に合わせている。

左の列には見出しとマニフェスト本文を置いた。本文は拍に合わせて一語ずつ組み上がり、最後のフレームで全文が読める。
右にはロゴと同じ正方形の「ステージ」があり、小節ごとに中身が替わる。

## 構成（音源のファイル時刻）

| 時刻 | 小節 | コード | 見出し | ステージ |
|---|---|---|---|---|
| 0.00 | カウントイン（4 拍目） | — | Post251 | 枠が描かれ、「4」 |
| 0.72 | 1 | Cm7 | Experimental digital jazz | 中央の線が開いて塗りの鍵盤が現れる（曲の最初の和音は 2 拍目の 1.29 秒）。ドラムが入る 2.64 秒で Nakam のクレジットに線が引かれる |
| 3.33 | 2 | Fm7 | Rhythm × Harmony | 鍵盤のグリッサンドでワイプ。バンドが目指すものの図解（この録音のデータではない）。上段はストレートの列と、そこから前後にずれるドランク（dilla）の列。下段は四分音つきの 12 鍵で、拍ごとに C → E♭−50¢ → F → A♭+50¢ と、鍵盤のあいだにも止まる |
| 5.94 | 3 | Dm7♭5 | Beyond convention | **ii** |
| 8.54 | 4 | G7 | ii – V – I | **V**。続いて、I が来るはずの空き枠 |
| 11.15 | 5 | Cm7 | Acoustic × Digital | **I** が 70ms 遅れて傾いて枠に着地（drunk）→ 打ち消し線 → 枠が広がってロゴの絵になり、1・5・2・POST の順に文字が灯る |
| 12.46 | 5（3 拍目） | — | Grooves | アルバム名と M3-2026秋 の情報 |
| 13.76 | 6 | E♭m7 | — | そのまま保持。音声は 14.45 秒からフェードアウトし、15.000 秒で終わる |

## 書き出し

必要なもの: Node 18+ と Playwright の Chromium、ffmpeg、Python 3（numpy / scipy / librosa / pillow）。

```sh
cd teaser
# 素材（リポジトリにはコミット済み。作り直すときだけ）
python3 tools/prepare_logo.py path/to/logo.webp          # ロゴを 2.5D 用のレイヤーと文字マスクに分解
python3 tools/analyze_audio.py path/to/blue_bossa-07.mp3 # 拍・アタック → assets/timing.json
bash tools/fetch_fonts.sh                                # フォント（OFL）を取り直す

# 静止画で確認
node render.mjs stills 1.4,6.8,12.3,14.9 stills
# 本番（PNG 連番 → H.264 + AAC）
node render.mjs video path/to/blue_bossa-07.mp3 out/post251_teaser01.mp4 --workers 5
```

`index.html` をローカルサーバーで開くと、音なしのループ再生になる。`?t=秒` を付けると、そのフレームだけを表示する。

音源ファイルと書き出した動画は、リポジトリに含めていない（`.gitignore`）。

## 中身

- `js/scenes.js` — レイアウト、各小節のステージ、見出し、本文、HUD。すべて時刻 t の純関数なので、どのフレームからでも並列に描ける
- `js/post.js` — WebGL2 の仕上げ。シャッター 180° のモーションブラー（リニア空間でサブフレームを合成し、速い動きでは 14 枚）とグレイン。ブルームとグレードも持っているが、この白いデザインでは切ってある
- `js/core.js` — タイムライン、イージング、コード表記（♭ はパスで描画）
- `assets/` — ロゴ由来のレイヤー（`tools/prepare_logo.py` で生成）、`timing.json`、フォント

フォントは Inter / Cormorant Garamond / JetBrains Mono / Noto Sans JP（いずれも SIL OFL 1.1、`assets/fonts/licenses/`）。

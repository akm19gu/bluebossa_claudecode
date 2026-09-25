# POST251 — Teaser 01

「Blue Bossa」冒頭 15 秒（92 BPM / 4/4 / C minor）に合わせた 1920×1080・60fps のモーショングラフィックス・ティーザー。
すべてのカットとアクセントは、音源を解析して得た拍・アタック位置に合わせてある。

## 構成（音源のファイル時刻）

| 時刻 | 小節 | コード | 映像 |
|---|---|---|---|
| 0.00 | カウントイン（無音 2 拍） | — | 金の一本線、「3」「4」のカウント |
| 1.29 | 1 | Cm7 | 塗りのピアノ鍵盤マクロ、*Blue* **BOSSA**（ドラム入りでトラッキングが締まる） |
| 3.98 | 2 | Fm7 | 鍵盤ワイプ → 五度圏。Cm7 の和音図形が一段回転して Fm7 に |
| 6.59 | 3 | Dm7♭5 | **ii → 「2」**。鍵盤は実際のノートのアタックで打鍵 |
| 9.20 | 4 | G7 | **V → 「5」**。キネティックな文字列、緊張、一本の金線へ収束 |
| 11.80 | 5 | Cm7 | **i → 「1」**。金線が開き、ロゴ本体の「1」が点灯 → 5 → 2 → POST と引いていく |
| 14.41 | 6 | E♭m7 | 次の ii（D♭ への ii–V）が来たところで「to be continued …」 |

音声は 14.45 秒からフェードアウトし、15.000 秒で終わる。

## 書き出し

必要なもの: Node 18+ と Playwright の Chromium、ffmpeg、Python 3（numpy / scipy / librosa / pillow）。

```sh
cd teaser
# 素材（リポジトリにはコミット済み。作り直すときだけ）
python3 tools/prepare_logo.py path/to/logo.webp       # ロゴを 2.5D 用のレイヤーと文字マスクに分解
python3 tools/analyze_audio.py path/to/blue_bossa-07.mp3 # 拍・アタック → assets/timing.json
bash tools/fetch_fonts.sh                               # フォント（OFL）を取り直す

# 静止画で確認
node render.mjs stills 1.4,6.8,12.6,14.9 stills
# 本番（PNG 連番 → H.264 + AAC）
node render.mjs video path/to/blue_bossa-07.mp3 out/post251_teaser01.mp4 --workers 4
```

`index.html` をローカルサーバーで開くと、ループ再生（音なし）や `?t=秒` で 1 フレームだけの表示ができる。

音源ファイルと書き出した動画はリポジトリに含めていない（`.gitignore`）。

## 中身

- `js/scenes.js` — 各ショット、HUD、ポスト処理のパラメータ。すべて時刻 t の純関数なので、どのフレームからでも並列に描ける
- `js/post.js` — WebGL2 の仕上げ：シャッター 180° のモーションブラー（5 サブフレームをリニア空間で合成）、ブルーム、色収差、グレード、グレイン
- `js/core.js` — タイムライン、イージング、コード表記（♭ はパスで描画）、金箔マテリアル
- `assets/` — ロゴ由来のレイヤー（`tools/prepare_logo.py` で生成）、`timing.json`、フォント

フォントは Cinzel / Cormorant Garamond / JetBrains Mono / Anton / Noto Serif JP（いずれも SIL OFL 1.1、`assets/fonts/licenses/`）。

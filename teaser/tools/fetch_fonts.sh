#!/usr/bin/env bash
# Re-fetch the (OFL-1.1) web fonts into assets/fonts from npm @fontsource packages.
# The Japanese face is reduced to the unicode-range subsets that cover JP_CHARS.
set -euo pipefail
cd "$(dirname "$0")/.."
JP_CHARS="${JP_CHARS:-秋第二展示場う日曜予告編一弾}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
(cd "$TMP" && npm init -y >/dev/null && npm install --silent @fontsource/cinzel @fontsource/cormorant-garamond @fontsource/jetbrains-mono @fontsource/anton @fontsource/noto-serif-jp)
FS="$TMP/node_modules/@fontsource"
D=assets/fonts
mkdir -p "$D/licenses"
cp "$FS"/cinzel/files/cinzel-latin-{400,600,700,900}-normal.woff2 "$D/"
cp "$FS"/cormorant-garamond/files/cormorant-garamond-latin-{400,500,600}-italic.woff2 "$D/"
cp "$FS"/cormorant-garamond/files/cormorant-garamond-latin-{500,600}-normal.woff2 "$D/"
cp "$FS"/jetbrains-mono/files/jetbrains-mono-latin-{300,400,600}-normal.woff2 "$D/"
cp "$FS"/anton/files/anton-latin-400-normal.woff2 "$D/"
for f in cinzel cormorant-garamond jetbrains-mono anton noto-serif-jp; do cp "$FS/$f/LICENSE" "$D/licenses/$f-OFL.txt"; done
FS="$FS" JP_CHARS="$JP_CHARS" python3 - <<'EOF'
import os, re, shutil
fs, chars = os.environ["FS"] + "/noto-serif-jp", set(os.environ["JP_CHARS"])
css = open(f"{fs}/500.css").read()
out = []
for b in re.findall(r"@font-face\s*{[^}]*}", css):
    url = re.search(r"url\(\./files/([^)]+\.woff2)\)", b).group(1)
    ur = re.search(r"unicode-range:\s*([^;]+);", b).group(1)
    rngs = []
    for part in ur.split(","):
        part = part.strip().replace("U+", "")
        a, c = part.split("-") if "-" in part else (part, part)
        rngs.append((int(a, 16), int(c, 16)))
    if any(any(a <= ord(ch) <= c for a, c in rngs) for ch in chars):
        shutil.copy(f"{fs}/files/{url}", f"assets/fonts/{url}")
        out.append(f"@font-face{{font-family:'Noto Serif JP';font-weight:500;src:url({url}) format('woff2');unicode-range:{ur};}}")
open("assets/fonts/noto-serif-jp.css", "w").write("\n".join(out) + "\n")
print(len(out), "JP subsets")
EOF

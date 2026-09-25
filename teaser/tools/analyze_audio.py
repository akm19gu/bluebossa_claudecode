"""Extract the timing data the teaser is keyed to.

Usage: python3 tools/analyze_audio.py <song.mp3> [out.json]

Writes per-frame band envelopes (60 fps) and onset lists for the first
15 seconds, plus the measured beat grid. The visuals read these so every
hit lands on the actual audio rather than on an idealised grid.
"""
import json
import sys

import librosa
import numpy as np
import scipy.signal as ss

FPS = 60
DUR = 15.0
BPM = 92.0

src = sys.argv[1]
dst = sys.argv[2] if len(sys.argv) > 2 else "assets/timing.json"

y, sr = librosa.load(src, sr=44100, mono=True, duration=DUR + 1.0)
T = 60.0 / BPM


def band(lo, hi):
    if lo == 0:
        sos = ss.butter(4, hi, btype="low", fs=sr, output="sos")
    elif hi is None:
        sos = ss.butter(4, lo, btype="high", fs=sr, output="sos")
    else:
        sos = ss.butter(4, [lo, hi], btype="band", fs=sr, output="sos")
    return ss.sosfiltfilt(sos, y)


def envelope(sig, attack=0.004, release=0.12):
    # RMS per video frame, then an attack/release follower so pulses feel physical.
    hop = sr // FPS
    n = int(DUR * FPS)
    rms = np.array([np.sqrt(np.mean(sig[i * hop:(i + 1) * hop] ** 2) + 1e-12) for i in range(n)])
    db = 20 * np.log10(rms)
    lo, hi = np.percentile(db[db > -80], [10, 99.5])
    x = np.clip((db - lo) / (hi - lo), 0, 1)
    out = np.zeros_like(x)
    a = np.exp(-1 / (attack * FPS))
    r = np.exp(-1 / (release * FPS))
    for i in range(1, n):
        c = a if x[i] > out[i - 1] else r
        out[i] = c * out[i - 1] + (1 - c) * x[i]
    return out


def onsets(sig, thresh):
    hop = 256
    o = librosa.onset.onset_strength(y=sig.astype(np.float32), sr=sr, hop_length=hop).astype(float)
    pk, _ = ss.find_peaks(o, height=thresh * o.max(), distance=int(0.09 * sr / hop))
    return [
        {"t": round(float(p * hop / sr), 4), "s": round(float(o[p] / o.max()), 3)}
        for p in pk
        if p * hop / sr < DUR
    ]


bands = {"low": band(0, 160), "mid": band(300, 2500), "hi": band(3000, None)}

# Attack of the first note (after ~1.3 s of silence at the head of the file).
first = float(np.argmax(np.abs(y) > 0.02) / sr)

# The groove sits a constant 66 ms behind the DAW grid (measured on the
# half-note accents). The file opens one beat before bar 1 (beat 4 of the
# count-in), so bar 1's downbeat is at T; the tune's first chord is on beat 2.
g0 = T + 0.066

data = {
    "fps": FPS,
    "duration": DUR,
    "bpm": BPM,
    "beat": T,
    "grid0": round(g0, 4),
    "firstHit": round(first, 4),
    "env": {k: [round(float(v), 3) for v in envelope(s)] for k, s in bands.items()},
    "envAll": [round(float(v), 3) for v in envelope(y, release=0.25)],
    "onsets": {k: onsets(s, 0.22) for k, s in bands.items()},
}
with open(dst, "w") as f:
    json.dump(data, f, separators=(",", ":"))
print("first hit", first, "grid0", g0, "->", dst)

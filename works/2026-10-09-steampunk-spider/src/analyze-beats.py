import json
import wave
from pathlib import Path

import numpy as np

root = Path(__file__).parent / "artifacts"
with wave.open(str(root / "music-analysis.wav")) as source:
    sample_rate = source.getframerate()
    audio = np.frombuffer(source.readframes(source.getnframes()), dtype=np.int16).astype(float) / 32768

hop = 220
window_size = 1024
frames = np.lib.stride_tricks.sliding_window_view(audio, window_size)[::hop]
spectrum = np.abs(np.fft.rfft(frames * np.hanning(window_size), axis=1))
frequencies = np.fft.rfftfreq(window_size, 1 / sample_rate)
# Bass-band onset energy identifies the kick pulses in this supplied music.
bass = spectrum[:, (frequencies >= 35) & (frequencies <= 210)].sum(axis=1)
envelope = np.maximum(0, np.diff(bass, prepend=bass[0]))
envelope = np.convolve(envelope, np.ones(3) / 3, mode="same")
frame_seconds = hop / sample_rate
candidates = np.arange(round(0.35 / frame_seconds), round(0.85 / frame_seconds))
scores = [np.dot(envelope[:-lag], envelope[lag:]) for lag in candidates]
lag = int(candidates[int(np.argmax(scores))])
period = lag * frame_seconds
phase_scores = [sum(envelope[index::lag]) for index in range(lag)]
phase = int(np.argmax(phase_scores))
beats = []
strengths = []
for expected in range(phase, len(envelope), lag):
    start = max(0, expected - 8)
    end = min(len(envelope), expected + 9)
    observed = start + int(np.argmax(envelope[start:end]))
    beats.append(round((observed * hop + window_size / 2) / sample_rate, 3))
    strengths.append(round(float(envelope[observed]), 3))
result = {"sourceStartSeconds": 103, "estimatedBpm": round(60 / period, 2), "periodSeconds": round(period, 4), "beats": beats, "strengths": strengths, "method": "Bass spectral onset autocorrelation, local peaks aligned within 80 ms; estimated beat grid"}
(root / "music-beats.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
print(json.dumps(result))

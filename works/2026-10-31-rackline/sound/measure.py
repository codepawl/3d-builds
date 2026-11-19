"""Prints band shares and the end of the lift cue for a soundtrack, so a mix can be compared with numbers.

Usage: uv run --no-project --python 3.12 --with numpy --with soundfile python measure.py <soundtrack.wav> <lift start> <lift end>
"""
import sys

import numpy
import soundfile

BANDS = {"under 250 Hz": (20, 250), "250 Hz to 2 kHz": (250, 2000), "2 to 6 kHz": (2000, 6000), "over 6 kHz": (6000, 20000)}
WINDOW_SECONDS = 0.25


def band_shares(mono, sample_rate):
    power = numpy.abs(numpy.fft.rfft(mono * numpy.hanning(len(mono)))) ** 2
    frequencies = numpy.fft.rfftfreq(len(mono), 1 / sample_rate)
    total = power.sum()
    return {name: round(float(power[(frequencies >= low) & (frequencies < high)].sum() / total * 100), 1) for name, (low, high) in BANDS.items()}


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    audio, sample_rate = soundfile.read(sys.argv[1])
    mono = audio.mean(axis=1)
    lift_start = float(sys.argv[2])
    lift_end = float(sys.argv[3])
    print("whole film", band_shares(mono, sample_rate))
    print("lift", band_shares(mono[int(lift_start * sample_rate):int(lift_end * sample_rate)], sample_rate))
    window = int(WINDOW_SECONDS * sample_rate)
    levels = []
    for start in numpy.arange(lift_end - 1.5, lift_end + 0.5, WINDOW_SECONDS):
        chunk = mono[int(start * sample_rate):int(start * sample_rate) + window]
        levels.append(round(float(20 * numpy.log10(numpy.sqrt((chunk ** 2).mean()) + 1e-9)), 1))
    print("level around the lift's end, dB every 0.25 s", levels)


if __name__ == "__main__":
    main()

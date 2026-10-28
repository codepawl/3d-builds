# Self-review, round 1 (2026-10-28)

Measured: `window.__setMetrics` (12 set models, yaws 20 to 36): min height 282 px, max width 281 px in 315 px cells (gaps >= 34 px). Mix: -16.0 LUFS, true peak -2.3 dBFS on the encode.
Looked at: 16 sheet frames x 2 (1 fps) and 9 full-size stills of the encoded video (0.8, 3.0, 4.6, 7.0, 10.8, 15.5, 18.8, 24.5, 29).

Found and fixed:
- Set panel line "median 109x smaller" ran past the panel (3.6 s on). Now "109x smaller" with a small "median".
- Set panel sat top-left with empty space under it; moved down to the vertical middle.
- "load both" button stayed as a ghost in the centre after the click; it now fades out within 0.8 s.
- Cursor parked over a set model (barrier wall) for the last seconds; it now parks in the empty lower left.
- Old overlaps (X-ray touched the dishwasher, boot lid touched the dishwasher): one camera per cell, models never share a cell.

Still weak: see the report (close-up right half shows blur where the optimized texture is soft; left fast-forward uses time, not bytes, for the bar).

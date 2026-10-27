#!/bin/bash
# Encodes out/reel-frames (supersampled jpgs) to out/popup-book-picture.mp4: 1920x1080, 30 fps, yuv420p limited range
# bt709, crf 18, no sound, at below-normal priority. Usage (Git Bash): bash tools/encode-reel.sh
root="$(cd "$(dirname "$0")/.." && pwd)"
powershell.exe -NoProfile -Command "\$p = Start-Process -FilePath ffmpeg -ArgumentList @('-y','-framerate','30','-i','$(cygpath -w "$root/out/reel-frames/f%05d.jpg")','-vf','scale=1920:1080:flags=lanczos:out_color_matrix=bt709:out_range=tv,format=yuv420p','-c:v','libx264','-crf','18','-preset','slow','-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709','-color_range','tv','-an','-movflags','+faststart','$(cygpath -w "$root/out/popup-book-picture.mp4")') -NoNewWindow -PassThru; \$p.PriorityClass = 'BelowNormal'; \$p.WaitForExit()"

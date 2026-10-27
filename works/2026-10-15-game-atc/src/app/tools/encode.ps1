# Encodes shots/frames into shots/film.mp4 (crf 18) and shots/film-web.mp4 (under 25 MB) at
# below-normal priority so the machine stays responsive. Run after node tools/film.mjs.
$shots = Join-Path (Split-Path $PSScriptRoot -Parent) 'shots'
$frames = Join-Path $shots 'frames\%04d.png'

function Invoke-Encode([string[]] $arguments) {
  $process = Start-Process -FilePath 'ffmpeg' -ArgumentList $arguments -NoNewWindow -PassThru
  $process.PriorityClass = 'BelowNormal'
  $process.WaitForExit()
}

Invoke-Encode @('-v', 'error', '-y', '-framerate', '30', '-i', "`"$frames`"", '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', "`"$(Join-Path $shots 'film.mp4')`"")
Invoke-Encode @('-v', 'error', '-y', '-framerate', '30', '-i', "`"$frames`"", '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-maxrate', '6M', '-bufsize', '12M', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', "`"$(Join-Path $shots 'film-web.mp4')`"")
Get-Item (Join-Path $shots 'film*.mp4') | ForEach-Object { '{0} {1:N1} MB' -f $_.Name, ($_.Length / 1MB) }

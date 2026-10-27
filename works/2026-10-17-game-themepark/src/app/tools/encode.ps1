# Encodes shots/frames into shots/film.mp4 and a web copy under 25 MB, at below-normal priority.
$root = Split-Path -Parent $PSScriptRoot
$shots = Join-Path $root 'shots'
function Invoke-LowPriority([string[]]$arguments) {
  $process = Start-Process -FilePath 'ffmpeg' -ArgumentList $arguments -NoNewWindow -PassThru
  $process.PriorityClass = 'BelowNormal'
  $process.WaitForExit()
}
Invoke-LowPriority @('-loglevel', 'error', '-y', '-framerate', '30', '-i', "`"$shots\frames\%04d.png`"", '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', "`"$shots\film.mp4`"")
Invoke-LowPriority @('-loglevel', 'error', '-y', '-i', "`"$shots\film.mp4`"", '-c:v', 'libx264', '-preset', 'slow', '-b:v', '5200k', '-maxrate', '6000k', '-bufsize', '12000k', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', "`"$shots\film-web.mp4`"")
Get-Item "$shots\film.mp4", "$shots\film-web.mp4" | ForEach-Object { '{0} {1:N1} MB' -f $_.Name, ($_.Length / 1MB) }

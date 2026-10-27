# Encodes shots/frames into shots/film.mp4 (H.264 yuv420p crf 18, faststart) and a web copy under 25 MB,
# both at below-normal priority so the machine stays responsive.
$ErrorActionPreference = 'Stop'
$app = Split-Path -Parent $PSScriptRoot
$frames = Join-Path $app 'shots\frames\%04d.png'
$film = Join-Path $app 'shots\film.mp4'
$web = Join-Path $app 'shots\film-web.mp4'

function Invoke-BelowNormal([string[]] $arguments) {
  $process = Start-Process -FilePath 'ffmpeg' -ArgumentList $arguments -NoNewWindow -PassThru
  $process.PriorityClass = 'BelowNormal'
  $process.WaitForExit()
  if ($process.ExitCode -ne 0) { throw "ffmpeg failed with exit code $($process.ExitCode)" }
}

Invoke-BelowNormal @('-y', '-loglevel', 'error', '-framerate', '30', '-i', "`"$frames`"", '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', "`"$film`"")
Invoke-BelowNormal @('-y', '-loglevel', 'error', '-i', "`"$film`"", '-c:v', 'libx264', '-preset', 'slow', '-crf', '22', '-maxrate', '8M', '-bufsize', '16M', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', "`"$web`"")
Get-Item $film, $web | Select-Object Name, @{ Name = 'MB'; Expression = { [math]::Round($_.Length / 1MB, 1) } }

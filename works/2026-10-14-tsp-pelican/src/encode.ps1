# Score loudness (two-pass loudnorm to -16 LUFS, true peak -1.5 dBTP), then mux with the frames.
# Every ffmpeg runs at below-normal priority.
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$raw = Join-Path $root "sound\score_raw.wav"
$mastered = Join-Path $root "sound\score.wav"
$film = Join-Path $root "tsp-pelican.mp4"
$web = Join-Path $root "tsp-pelican-web.mp4"

function Invoke-LowPriority([string[]] $arguments) {
  $errorFile = Join-Path $root "sound\ffmpeg-stderr.txt"
  $process = Start-Process -FilePath "ffmpeg" -ArgumentList $arguments -NoNewWindow -PassThru -RedirectStandardError $errorFile
  $process.PriorityClass = "BelowNormal"
  $process.WaitForExit()
  if ($process.ExitCode -ne 0) { Get-Content $errorFile -Tail 20; throw "ffmpeg failed" }
  return Get-Content $errorFile -Raw
}

$measure = Invoke-LowPriority @("-hide_banner", "-y", "-i", "`"$raw`"", "-af", "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-")
$json = [regex]::Match($measure, "\{[^{}]*""input_i""[^{}]*\}").Value | ConvertFrom-Json
$filter = "loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=$($json.input_i):measured_TP=$($json.input_tp):measured_LRA=$($json.input_lra):measured_thresh=$($json.input_thresh):offset=$($json.target_offset):linear=true"
Invoke-LowPriority @("-hide_banner", "-y", "-i", "`"$raw`"", "-af", $filter, "-ar", "48000", "-c:a", "pcm_s24le", "`"$mastered`"") | Out-Null

Invoke-LowPriority @("-hide_banner", "-y", "-framerate", "30", "-i", "`"$root\frames\%05d.png`"", "-i", "`"$mastered`"",
  "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k",
  "-movflags", "+faststart", "-shortest", "`"$film`"") | Out-Null
Invoke-LowPriority @("-hide_banner", "-y", "-i", "`"$film`"", "-c:v", "libx264", "-preset", "slow", "-b:v", "2800k",
  "-maxrate", "3200k", "-bufsize", "6400k", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", "`"$web`"") | Out-Null
Get-Item $film, $web | Select-Object Name, @{ Name = "MB"; Expression = { [math]::Round($_.Length / 1MB, 1) } }

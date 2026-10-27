# Encodes the recorded frames and the sound into the film (H.264 yuv420p crf 18, faststart, AAC 192k) and a web
# copy (two-pass, under 25 MB). Every ffmpeg run starts at below-normal priority.
#   tools/encode.ps1            shots/frames + shots/sound.wav -> shots/film.mp4, shots/film-web.mp4
#   tools/encode.ps1 -Vertical  shots/frames-vertical + shots/sound-vertical.wav -> shots/film-vertical.mp4, shots/film-vertical-web.mp4
#   tools/encode.ps1 -Name life [-Vertical]  the documentary: shots/frames-life[-vertical] + shots/sound-life[-vertical].wav
#                               -> shots/life-wide.mp4 or shots/life-vertical.mp4, and their -web copies
param([switch]$Vertical, [string]$Name = '')
$ErrorActionPreference = 'Stop'
$shots = Join-Path (Split-Path $PSScriptRoot -Parent) 'shots'
$orientation = if ($Vertical) { '-vertical' } else { '' }
$suffix = if ($Name) { "-$Name$orientation" } else { $orientation }
$frames = "frames$suffix/%04d.jpg"
$sound = "sound$suffix.wav"
$film = if ($Name) { "$Name$(if ($Vertical) { '-vertical' } else { '-wide' }).mp4" } else { "film$suffix.mp4" }
$web = $film -replace '\.mp4$', '-web.mp4'
# The documentary runs about 187 s: 680k video (capped at 760k) and 96k audio keep its web copy under 20 MB. It is
# encoded in one pass: two-pass rate control starved the grainy dark farm shots into grey blocks. A denoise and
# adaptive quantisation for dark scenes spend the bits on the picture instead of the film grain.
$webBitrate = if ($Name) { '680k' } else { '3500k' }
$webAudio = if ($Name) { '96k' } else { '192k' }
$webTuning = if ($Name) { @('-vf', 'hqdn3d=4:3:6:4.5', '-x264-params', 'aq-mode=3:aq-strength=0.9', '-maxrate', '760k', '-bufsize', '1520k') } else { @() }

function Invoke-BelowNormal([string[]]$arguments) {
    $process = Start-Process -FilePath 'ffmpeg' -ArgumentList $arguments -NoNewWindow -PassThru -WorkingDirectory $shots
    # Touch the handle now: Windows PowerShell reports a null ExitCode for a process whose handle was never read.
    $null = $process.Handle
    $process.PriorityClass = 'BelowNormal'
    $process.WaitForExit()
    if ($process.ExitCode -ne 0) { throw "ffmpeg failed with exit code $($process.ExitCode)" }
}

Invoke-BelowNormal @('-y', '-loglevel', 'error', '-framerate', '30', '-i', $frames, '-i', $sound,
    '-vf', 'scale=in_range=pc:out_range=tv,format=yuv420p', '-color_range', 'tv', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    '-c:a', 'aac', '-b:a', '192k', '-shortest', $film)

if ($Name) {
    Invoke-BelowNormal (@('-y', '-loglevel', 'error', '-i', $film) + $webTuning + @('-c:v', 'libx264', '-preset', 'slow', '-b:v', $webBitrate,
        '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-c:a', 'aac', '-b:a', $webAudio, $web))
} else {
Invoke-BelowNormal (@('-y', '-loglevel', 'error', '-i', $film) + $webTuning + @('-c:v', 'libx264', '-preset', 'slow', '-b:v', $webBitrate,
    '-pass', '1', '-passlogfile', "web2pass$suffix", '-an', '-f', 'mp4', 'NUL'))
Invoke-BelowNormal (@('-y', '-loglevel', 'error', '-i', $film) + $webTuning + @('-c:v', 'libx264', '-preset', 'slow', '-b:v', $webBitrate,
    '-pass', '2', '-passlogfile', "web2pass$suffix", '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-c:a', 'aac', '-b:a', $webAudio, $web))
}
Remove-Item (Join-Path $shots "web2pass$suffix*") -ErrorAction SilentlyContinue

Get-Item (Join-Path $shots $film), (Join-Path $shots $web) | ForEach-Object { '{0} {1:N1} MB' -f $_.Name, ($_.Length / 1MB) }

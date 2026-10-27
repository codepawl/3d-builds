# Final render of all 450 frames to render\frame_####.png. Resumable: finished frames are skipped.
#   .\render.ps1            start (or resume) in the background; prints the process id
#   .\render.ps1 -Stop      stop it (the worker and its Blender)
#   .\render.ps1 -Status    frames done and the log tail
param([switch]$Worker, [switch]$Stop, [switch]$Status, [int]$Chunk = 75)
$root = $PSScriptRoot
$blender = 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe'
$outDir = "$root\render"
$pidFile = "$outDir\render.pid"
New-Item -ItemType Directory -Force $outDir | Out-Null
if ($Status) {
    "frames done: " + (Get-ChildItem "$outDir\frame_*.png" -ErrorAction SilentlyContinue | Measure-Object).Count + " / 450"
    if (Test-Path $pidFile) { "worker pid: " + (Get-Content $pidFile) + "  running: " + [bool](Get-Process -Id (Get-Content $pidFile) -ErrorAction SilentlyContinue) }
    Get-Content "$outDir\render.log" -Tail 4 -ErrorAction SilentlyContinue
    return
}
if ($Stop) {
    if (Test-Path $pidFile) {
        $workerId = [int](Get-Content $pidFile)
        Get-CimInstance Win32_Process -Filter "ParentProcessId=$workerId" | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
        Stop-Process -Id $workerId -Force -ErrorAction SilentlyContinue
        "stopped worker $workerId"
    }
    return
}
if (-not $Worker) {
    if ((Test-Path $pidFile) -and (Get-Process -Id (Get-Content $pidFile) -ErrorAction SilentlyContinue)) { "already running, pid " + (Get-Content $pidFile); return }
    $launched = Start-Process -FilePath pwsh -ArgumentList @('-NoProfile', '-File', "$root\render.ps1", '-Worker', '-Chunk', $Chunk) -WindowStyle Hidden -PassThru
    $launched.PriorityClass = 'BelowNormal'
    $launched.Id | Set-Content $pidFile
    "started worker pid " + $launched.Id
    return
}
for ($first = 0; $first -lt 450; $first += $Chunk) {
    $last = [Math]::Min($first + $Chunk - 1, 449)
    $missing = $first..$last | Where-Object { -not (Test-Path ("$outDir\frame_{0:D4}.png" -f $_)) }
    if (-not $missing) { continue }
    $arguments = @('-b', "$root\blender\food_forest.blend", '-P', "$root\blender\render_frames.py", '--', $outDir, '1', "$first-$last")
    $process = Start-Process -FilePath $blender -ArgumentList $arguments -NoNewWindow -PassThru -RedirectStandardOutput "$outDir\render.log" -RedirectStandardError "$outDir\render.err"
    $process.PriorityClass = 'BelowNormal'
    $process.WaitForExit()
}
"done" | Add-Content "$outDir\render.log"

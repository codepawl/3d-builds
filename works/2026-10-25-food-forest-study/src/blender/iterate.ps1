# Rebuild the blend and events.json, render half-res stills, make the compare sheet.
param([int]$Samples = 48, [string]$Times = "0.5 1.5 2.6 3.6 4.8 5.8 7.5 9.5 11.5 13.0 14.5")
$root = Split-Path -Parent $PSScriptRoot
$blender = 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe'
$build = Start-Process -FilePath $blender -ArgumentList @('-b', '-P', "$root\blender\build_food_forest.py") -NoNewWindow -PassThru -RedirectStandardOutput "$root\out\build.log" -RedirectStandardError "$root\out\build.err"
$build.PriorityClass = 'BelowNormal'; $build.WaitForExit()
(Select-String -Path "$root\out\build.log" -Pattern 'BUILD OK|Traceback|Error' | ForEach-Object { $_.Line }) -join "; "
$arguments = @('-b', "$root\blender\food_forest.blend", '-P', "$root\blender\render_stills.py", '--', '0.5', "$Samples") + ($Times -split ' ')
$stills = Start-Process -FilePath $blender -ArgumentList $arguments -NoNewWindow -PassThru -RedirectStandardOutput "$root\out\stills.log" -RedirectStandardError "$root\out\stills.err"
$stills.PriorityClass = 'BelowNormal'; $stills.WaitForExit()
(Select-String -Path "$root\out\stills.log" -Pattern 'STILL' | ForEach-Object { $_.Line }) -join "; "
& uv run --no-project --with pillow python -I "$root\blender\compare_sheet.py"

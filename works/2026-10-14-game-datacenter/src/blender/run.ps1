# Runs the asset build headless at below-normal priority, after waiting for any other Blender on this machine to finish.
# Usage: pwsh blender/run.ps1 [hall cooling power units campus]
$blender = 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe'
$script = Join-Path $PSScriptRoot 'build_all.py'
while (Get-Process blender -ErrorAction SilentlyContinue) {
  Write-Host 'another blender.exe is running, waiting 15 s'
  Start-Sleep -Seconds 15
}
$arguments = @('--background', '--factory-startup', '--python', "`"$script`"")
if ($args.Count) { $arguments += @('--') + $args }
$process = Start-Process -FilePath $blender -ArgumentList $arguments -NoNewWindow -PassThru -RedirectStandardOutput (Join-Path $PSScriptRoot 'last-run.log') -RedirectStandardError (Join-Path $PSScriptRoot 'last-run.err')
$process.PriorityClass = 'BelowNormal'
$process.WaitForExit()
Get-Content (Join-Path $PSScriptRoot 'last-run.log') | Select-String -Pattern 'exported|Error|Traceback|line \d+|rror:' | Select-Object -Last 30
Get-Content (Join-Path $PSScriptRoot 'last-run.err') | Select-Object -Last 20
exit $process.ExitCode

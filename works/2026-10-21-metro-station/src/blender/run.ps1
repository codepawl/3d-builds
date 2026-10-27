param([Parameter(Mandatory = $true)][string]$Script, [string[]]$ScriptArgs = @())
# Runs one Blender script headless at below-normal priority, waiting while any other blender.exe is running.
# Full output goes to last-run.log; only EXPORTED / RENDERED / error lines are printed.
$blender = "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe"
while (Get-Process blender -ErrorAction SilentlyContinue) {
    Write-Host "another blender.exe is running, waiting 15 s"
    Start-Sleep -Seconds 15
}
$scriptPath = Join-Path $PSScriptRoot $Script
$logPath = Join-Path $PSScriptRoot "last-run.log"
$arguments = @("--background", "--factory-startup", "--python", $scriptPath)
if ($ScriptArgs.Count -gt 0) { $arguments += @("--") + $ScriptArgs }
$process = Start-Process -FilePath $blender -ArgumentList $arguments -NoNewWindow -PassThru -RedirectStandardOutput $logPath
$process.PriorityClass = "BelowNormal"
$process.WaitForExit()
Select-String -Path $logPath -Pattern "^EXPORTED|^RENDERED|Traceback|Error:|Error " | ForEach-Object { $_.Line }
exit $process.ExitCode

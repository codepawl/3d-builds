# Runs one Blender script headless at below-normal priority, after any other Blender run on
# this machine has finished. Usage: pwsh blender/run.ps1 <script.py> [extra args after --]
param([Parameter(Mandatory = $true)][string]$Script, [string[]]$ScriptArgs = @())

$blender = 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe'
while (Get-Process blender -ErrorAction SilentlyContinue) {
    Write-Output 'another blender.exe is running, waiting 20 s'
    Start-Sleep -Seconds 20
}
$log = Join-Path $env:TEMP ("blender-" + [IO.Path]::GetFileNameWithoutExtension($Script) + ".log")
$arguments = @('--background', '--factory-startup', '--python', $Script)
if ($ScriptArgs.Count) { $arguments += @('--') + $ScriptArgs }
$process = Start-Process -FilePath $blender -ArgumentList $arguments -NoNewWindow -PassThru -RedirectStandardOutput $log -RedirectStandardError "$log.err"
$process.PriorityClass = 'BelowNormal'
$process.WaitForExit()
Get-Content $log, "$log.err" | Select-String -Pattern 'exported|rendered|Error|Traceback|File "|line \d|EXCEPTION' | Select-Object -First 30
Write-Output "exit $($process.ExitCode)"

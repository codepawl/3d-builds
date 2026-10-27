param([string]$Script, [string]$Log, [string[]]$ScriptArgs)
# Runs Blender headless at below-normal priority, one at a time, output to a log file.
while (Get-Process blender -ErrorAction SilentlyContinue) { Start-Sleep -Seconds 5 }
$blender = "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe"
$argList = @("--background", "--factory-startup", "--python", $Script)
if ($ScriptArgs) { $argList += @("--") + $ScriptArgs }
$process = Start-Process -FilePath $blender -ArgumentList $argList -NoNewWindow -PassThru -RedirectStandardOutput $Log -RedirectStandardError "$Log.err"
$process.PriorityClass = 'BelowNormal'
$process.WaitForExit()
"exit $($process.ExitCode)"

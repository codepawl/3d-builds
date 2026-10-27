# Runs headless Blender 5.2 at below-normal priority: run_blender.ps1 <script.py> [script args...]
param([Parameter(Mandatory = $true)][string]$Script, [Parameter(ValueFromRemainingArguments = $true)][string[]]$Rest)
$blender = 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe'
$arguments = @('--background', '--factory-startup', '--python', $Script, '--') + $Rest
$process = Start-Process -FilePath $blender -ArgumentList $arguments -NoNewWindow -PassThru
$process.PriorityClass = 'BelowNormal'
$process.WaitForExit()
exit $process.ExitCode

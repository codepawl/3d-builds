param([string]$Script,[string]$Tag)
$R='<your folder>/viz-canal/blender'
$waited=0; while ((Get-Process blender -ErrorAction SilentlyContinue) -and $waited -lt 200) { Start-Sleep 5; $waited+=5 }
$p = Start-Process -FilePath 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' -ArgumentList @('--background','--factory-startup','--python',"$R/$Script") -NoNewWindow -PassThru -RedirectStandardOutput "$R/log_$Tag.txt" -RedirectStandardError "$R/log_${Tag}_err.txt"
$p.PriorityClass='BelowNormal'; $p.WaitForExit()
Get-Content "$R/log_$Tag.txt" | Select-String 'EXPORTED|Error|error|Traceback' | Select-Object -Last 10
Get-Content "$R/log_${Tag}_err.txt" | Select-Object -Last 25


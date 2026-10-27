param([string]$Files,[string]$Only="")
$R='<your folder>/viz-canal/blender'
$waited=0; while ((Get-Process blender -ErrorAction SilentlyContinue) -and $waited -lt 200) { Start-Sleep 5; $waited+=5 }
$env:PREVIEW_ONLY=$Only
$args2 = @('--background','--factory-startup','--python',"$R/preview.py",'--') + ($Files -split ',')
$p = Start-Process -FilePath 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' -ArgumentList $args2 -NoNewWindow -PassThru -RedirectStandardOutput "$R/log_preview.txt" -RedirectStandardError "$R/log_preview_err.txt"
$p.PriorityClass='BelowNormal'; $p.WaitForExit()
Get-Content "$R/log_preview.txt" | Select-String 'PREVIEWED|Error|Traceback' | Select-Object -Last 20
Get-Content "$R/log_preview_err.txt" | Select-Object -Last 25

# Runs a command at below-normal priority so its children inherit it. Usage: run_low.ps1 <exe> <args...>
param([string]$Exe, [Parameter(ValueFromRemainingArguments = $true)][string[]]$Rest)
$process = Start-Process -FilePath $Exe -ArgumentList $Rest -NoNewWindow -PassThru
$process.PriorityClass = 'BelowNormal'
$process.WaitForExit()
exit $process.ExitCode

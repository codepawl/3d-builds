# Trace the quads, then verify. Runs at below-normal priority.
$T = $PSScriptRoot
$Root = Resolve-Path "$T\..\.."
$M = "$Root\app\public\assets\map"; $Q = "$Root\blender\refs\quads"; $V = "$Root\blender\previews"
foreach ($step in @(@("$T\trace_map.py", $T, $Q, $M), @("$T\verify_map.py", $T, $Q, $M, "$V\map-verify.png", "$V\map-verify.json"))) {
  $p = Start-Process -FilePath 'uv' -ArgumentList (@('run','--project',$T,'python','-I') + $step) -NoNewWindow -PassThru -RedirectStandardOutput "$T\step.log" -RedirectStandardError "$T\step.err"
  $p.PriorityClass = 'BelowNormal'; $p.WaitForExit(); Get-Content "$T\step.log"; Get-Content "$T\step.err" -Tail 5
}

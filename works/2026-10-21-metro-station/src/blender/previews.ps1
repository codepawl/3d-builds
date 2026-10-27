# Renders iso + close shots for each root of each GLB, then tiles one contact sheet per GLB.
$blenderDir = $PSScriptRoot
$assets = Join-Path $blenderDir "..\app\public\assets"
$previews = Join-Path $blenderDir "previews"
$sets = [ordered]@{
    station    = @("Station_Module", "Psd_DoorUnit", "Psd_Panel", "Station_Floor", "Station_Wall", "Mezzanine_Module", "Escalator", "Stairs", "Gateline", "Service_Kiosk", "Bench", "Hanging_Sign", "Street_Entrance")
    structures = @("Viaduct_Span", "Viaduct_Pier", "Shed_Module", "Shed_End", "Workshop_Module", "Wash_Plant", "Control_Centre", "Substation")
    city       = @("Building_Low_A", "Building_Mid_B", "Building_Tower_B", "Tree_0", "Tree_2", "Street_Lamp", "Ground_grass", "Ground_cross")
    people     = @("Figure_Adult_Rig", "Figure_Backpack_Rig")
}
foreach ($name in $sets.Keys) {
    $images = @()
    foreach ($root in $sets[$name]) {
        & "$blenderDir\run.ps1" -Script preview.py -ScriptArgs @((Resolve-Path "$assets\$name.glb").Path, "$previews\$root", $root, "iso", "close") 2>&1 | Select-String -Pattern "^RENDERED|Traceback|IndexError" | ForEach-Object { $_.Line } | Where-Object { $_ -notmatch "^RENDERED" }
        $images += "$previews\$root-iso.png", "$previews\$root-close.png"
    }
    uv run --no-project --with pillow python "$blenderDir\sheet.py" "$previews\sheet-$name.png" 4 @images
}

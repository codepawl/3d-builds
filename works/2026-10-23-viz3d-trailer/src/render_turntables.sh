#!/bin/bash
# Renders every hero turntable, one Blender at a time, below-normal priority. Usage: render_turntables.sh [name ...]
T='<your folder>/trailer-visualize-3d'
D='<your folder>/demos'
OUT=<your folder>/trailer-visualize-3d/turn
# name | glb | object | frames | arc | start
MODELS=(
  "rocket|game-launchsite\app\public\assets\rocket.glb|ship_crew|66|110|20"
  "crane|game-port\app\public\assets\sts_cranes.glb|sts_a|66|110|25"
  "jet|game-airport\public\assets\aircraft.glb|jet_a|66|110|30"
  "ambulance|game-er\app\public\assets\vehicles.glb|amb_type3_a|66|120|20"
  "robot|game-datacenter\public\assets\units.glb|robot|66|120|20"
  "coaster|game-themepark\app\public\assets\coaster.glb|coaster_train_a|66|120|20"
  "racecar|game-pitlane\app\public\assets\cars.glb|car_halvard_07|66|120|25"
  "cart|game-fulfillment\app\public\assets\drive_units.glb|du_standard|66|120|25"
  "drone|game-fulfillment\app\public\assets\drone.glb|drone_hex|66|120|20"
  "orglet|game-agent-office\public\assets\orglet.glb|orglet|66|120|20"
  "hero|game-launchsite\app\public\assets\rocket.glb|ship_crew|171|45|40"
)
for entry in "${MODELS[@]}"; do
  IFS='|' read -r name glb object frames arc start <<< "$entry"
  if [ $# -gt 0 ] && [[ ! " $* " =~ " $name " ]]; then continue; fi
  mkdir -p "$OUT/$name"
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$T"'\tools\run_blender.ps1' "$T"'\tools\turntable.py' "$D"'\'"$glb" "$object" "$T"'\turn\'"$name" "$frames" "$arc" "$start" 2>&1 | grep -E "done|Error|error|Traceback" | head -5
done

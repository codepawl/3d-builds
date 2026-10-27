# Prompts

The messages are from An, translated from Vietnamese, with chat filler removed. Times are UTC. The briefs are copied as sent, with local paths removed.

## Prompt 1 (translated from Vietnamese, 2026-10-17 01:01 UTC)

Look for 3D models on Sketchfab or other model platforms, pull them in, adjust them and use them as reference. Do not make them low poly. I need them realistic, for example plants, rocks, houses, furniture, exteriors. The materials must be realistic too, so look online for references.

## Prompt 2: topic file, the plan for this app (`design/TOPIC-er.md`)

~~~~text
Your folder: <your folder> (create it). Port 5430.
Look: toy isometric (references/looks.md).
Subject: a hospital emergency department operations app (patient flow and capacity, not clinical decisions). Sites are three hospitals in a made-up health network (a city level 1 trauma centre, a suburban community hospital, a children's hospital). The world: the ambulance bay with ambulances arriving, a helipad with a medical helicopter, the walk-in entrance and waiting room, triage desks, resuscitation and trauma bays, cubicles with beds, imaging (CT and X-ray), a lab, the nurses' station, porters wheeling beds, staff in scrubs, and the admission path to wards. Keep it calm and clinical: no blood, no injuries shown, patients are covered figures on beds with a colour triage tag. Data: patients (made-up ID only, triage level 1 to 5, stage, waiting time, assigned bed, pending tests), beds (state: free, occupied, cleaning), staff on shift, ambulances (ETA, priority), imaging queue. KPIs: door-to-doctor time, patients waiting, beds free, left without being seen. The bottom timeline follows one patient's visit (arrival, triage, seen, tests, decision, admitted or discharged). Use made-up hospital names and no real patient data.
Reference images: An approved (2026-10-17) fetching about 20 to 40 reference images for modelling from Wikimedia Commons (check each licence) and public domain US government sites, kept in blender/refs/, never shown in the app or film.
~~~~

The original task message for this app was not kept, so its pass 1 and pass 2 briefs are not available. The work followed the pattern of the earlier apps in this series. See `works/2026-10-15-game-atc/design/PASS1-atc.md` and `PASS2-atc.md`, the briefs for the same series two days earlier. `src/blender/ASSETS.md` describes the reference-image step.

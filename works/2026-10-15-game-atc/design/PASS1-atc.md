Build the 3D asset pack for a real-time operations app that looks like a strategy game. The subject, its world and
its data are in design/TOPIC-atc.md; read it first. The look comes from the reference video
the reference video (not included) (frame sheet its frame sheet): a clean
isometric world in a light, cool palette with one strong brand colour, small vehicles and units, chunky readable
shapes. Make your own designs; no real brands, logos, liveries or existing characters.

Work only in <your folder>: Blender scripts in blender/, GLBs in app/public/assets/. Blender 5.2 is at
"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe"; run it headless (--background --factory-startup
--python) at below-normal priority, only when no other blender.exe is running (wait if one is).

Model every asset procedurally with proper bevels and rounded edges, panel lines and small real details (vents,
bolts, windows, wheels with hubs, lights, signage plates), clean topology with smooth shading and hardened edges,
UVs, PBR materials (small procedurally baked textures are fine), emissive where things glow. Several variants per
asset type so repetition does not show. Moving parts are separate named objects or bones with their pivot at the
origin (wheels, doors, fans, lifts, booms, bridges, character limbs); characters and animals get an armature with
named clips. Keep the total under about 40 MB, one GLB per asset family so repeats can be instanced.

Verify: blender/preview.py renders a contact sheet per GLB (a few angles, back-face culling on) to
blender/previews/; look at every sheet and fix wrong scale, bad normals, holes, floating parts. Write
blender/ASSETS.md listing every GLB, its nodes, pivots, clips, real-world scale and where it goes. Rules: no
top-level cd, no bare python, check nvidia-smi before GPU renders, no personal data. Write pass1_started_at.txt and
pass1_finished_at.txt (UTC). Budget about 80 tool calls. Report the asset list with sizes, what you looked at, gaps.

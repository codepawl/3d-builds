"""blender -b food_forest.blend -P render_stills.py -- <scale> <samples> <t1> <t2> ...  -> stills/still_<t>.png"""
import bpy, sys, os
args = sys.argv[sys.argv.index("--") + 1:]
scale, samples = float(args[0]), int(args[1])
times = [float(a) for a in args[2:]]
scene = bpy.context.scene
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ff_device
ff_device.enable_gpu()
scene.render.resolution_percentage = int(scale * 100)
scene.cycles.samples = samples
out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(bpy.data.filepath))), "stills") if False else "<your folder>/food-forest-study/stills"
os.makedirs(out, exist_ok=True)
import time
for t in times:
    frame = min(int(round(t * 30)), 449)
    scene.frame_set(frame)
    shot = [m for m in sorted(scene.timeline_markers, key=lambda m: m.frame) if m.frame <= frame][-1]
    scene.camera = shot.camera
    scene.render.filepath = f"{out}/still_{t:05.2f}.png"
    t0 = time.time()
    bpy.ops.render.render(write_still=True)
    print("STILL", t, shot.name, round(time.time() - t0, 1), "s", flush=True)

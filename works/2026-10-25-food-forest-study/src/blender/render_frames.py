"""blender -b food_forest.blend -P render_frames.py -- <outdir> <skip_existing 0|1> <frame or a-b> ...
Renders PNG frames at the blend's own (final) settings; skips frames that already exist."""
import bpy, sys, os, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ff_device
ff_device.enable_gpu()
args = sys.argv[sys.argv.index("--") + 1:]
out_dir, skip_existing = args[0], args[1] == "1"
frames = []
for token in args[2:]:
    if "-" in token:
        first, last = token.split("-")
        frames.extend(range(int(first), int(last) + 1))
    else:
        frames.append(int(token))
os.makedirs(out_dir, exist_ok=True)
scene = bpy.context.scene
scene.render.use_persistent_data = True
markers = sorted(scene.timeline_markers, key=lambda m: m.frame)
for frame in frames:
    target = f"{out_dir}/frame_{frame:04d}.png"
    if skip_existing and os.path.exists(target) and os.path.getsize(target) > 50000:
        continue
    scene.frame_set(frame)
    scene.camera = [m for m in markers if m.frame <= frame][-1].camera
    scene.render.filepath = target
    started = time.time()
    bpy.ops.render.render(write_still=True)
    print("FRAME", frame, round(time.time() - started, 1), "s", flush=True)

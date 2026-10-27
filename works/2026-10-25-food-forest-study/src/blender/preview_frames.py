"""blender -b food_forest.blend -P preview_frames.py -- <outdir> <skip_existing 0|1> <frame or a-b> ...
Fast motion preview: 40% size and 12 samples, otherwise the same as render_frames.py. Judge motion with it, not looks."""
import bpy
import os

scene = bpy.context.scene
scene.render.resolution_percentage = 40
scene.cycles.samples = 12
scene.cycles.adaptive_threshold = 0.1

exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "render_frames.py")).read())

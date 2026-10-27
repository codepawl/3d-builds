# Executed inside build_food_forest.py (uses scene, bpy). Bloom, film grain and a soft vignette (Blender 5.x socket API).
import numpy as np


def set_menu(socket, wanted):
    items = [item.identifier for item in socket.enum_items] if hasattr(socket, "enum_items") else []
    match = next((i for i in items if i.lower() == wanted.lower()), None)
    socket.default_value = match or wanted


try:
    comp = bpy.data.node_groups.new("FoodForestComp", "CompositorNodeTree")
    scene.compositing_node_group = comp
    comp.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
    cn, cl = comp.nodes, comp.links
    render_layers = cn.new("CompositorNodeRLayers")
    glare = cn.new("CompositorNodeGlare")
    set_menu(glare.inputs["Type"], "Bloom")
    glare.inputs["Strength"].default_value = 0.5
    glare.inputs["Threshold"].default_value = 0.9
    glare.inputs["Size"].default_value = 0.55
    cl.new(render_layers.outputs["Image"], glare.inputs["Image"])
    last = glare.outputs["Image"]

    def mix_node(blend, factor):
        node = cn.new("ShaderNodeMix")
        node.data_type = "RGBA"
        node.blend_type = blend
        node.inputs[0].default_value = factor
        return node

    size = 1024
    grain_pixels = np.random.default_rng(3).normal(0.5, 0.3, (size, size)).clip(0, 1).astype(np.float32)
    rgba = np.repeat(grain_pixels[:, :, None], 4, axis=2)
    rgba[:, :, 3] = 1.0
    grain_image = bpy.data.images.new("film_grain", size, size)
    grain_image.pixels.foreach_set(rgba.reshape(-1))
    grain_image.pack()
    grain_image.colorspace_settings.name = "Non-Color"
    grain_node = cn.new("CompositorNodeImage")
    grain_node.image = grain_image
    translate = cn.new("CompositorNodeTranslate")
    set_menu(translate.inputs["Extension X"], "Repeat")
    set_menu(translate.inputs["Extension Y"], "Repeat")
    for axis, expression in (("X", "(frame*137)%1000"), ("Y", "(frame*251)%1000")):
        driver = translate.inputs[axis].driver_add("default_value").driver
        driver.type = "SCRIPTED"
        driver.expression = expression
    cl.new(grain_node.outputs["Image"], translate.inputs["Image"])
    scale_node = cn.new("CompositorNodeScale")
    set_menu(scale_node.inputs["Type"], "Relative")
    scale_node.inputs["X"].default_value = 1.9
    scale_node.inputs["Y"].default_value = 1.9
    cl.new(translate.outputs["Image"], scale_node.inputs["Image"])
    grain_mix = mix_node("OVERLAY", 0.08)
    cl.new(last, grain_mix.inputs[6])
    cl.new(scale_node.outputs["Image"], grain_mix.inputs[7])
    last = grain_mix.outputs[2]

    ellipse = cn.new("CompositorNodeEllipseMask")
    ellipse.inputs["Position"].default_value = (0.5, 0.5)
    ellipse.inputs["Size"].default_value = (0.97, 0.95)
    blur = cn.new("CompositorNodeBlur")
    blur.inputs["Size"].default_value = (220.0, 220.0)
    cl.new(ellipse.outputs["Mask"], blur.inputs["Image"])
    vignette = mix_node("MULTIPLY", 0.3)
    cl.new(last, vignette.inputs[6])
    cl.new(blur.outputs["Image"], vignette.inputs[7])
    last = vignette.outputs[2]

    group_output = cn.new("NodeGroupOutput")
    cl.new(last, group_output.inputs[0])
    print("COMPOSITOR OK")
except Exception as compositor_error:  # noqa: BLE001
    import traceback
    traceback.print_exc()
    print("COMPOSITOR FAILED:", repr(compositor_error))

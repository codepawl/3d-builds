import bpy


def enable_gpu():
    preferences = bpy.context.preferences.addons["cycles"].preferences
    for backend in ("OPTIX", "CUDA"):
        preferences.compute_device_type = backend
        preferences.get_devices()
        usable = [d for d in preferences.devices if d.type == backend]
        if usable:
            for device in preferences.devices:
                device.use = device.type == backend
            bpy.context.scene.cycles.device = "GPU"
            print("GPU", backend, [d.name for d in usable], flush=True)
            return True
    return False

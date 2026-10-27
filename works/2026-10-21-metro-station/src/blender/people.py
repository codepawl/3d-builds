"""Passenger figures with armature and Idle / Walk clips -> people.glb. Figures face +X, feet at z = 0."""
import math
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(__file__))
import lib
from lib import Mesh, material

BONES = {
    "Hips": ((0, 0, 0.9), (0, 0, 1.1), None),
    "Spine": ((0, 0, 0.9), (0, 0, 1.45), "Hips"),
    "Head": ((0, 0, 1.45), (0, 0, 1.78), "Spine"),
    "Arm_L": ((0, 0.26, 1.42), (0, 0.26, 0.9), "Spine"),
    "Arm_R": ((0, -0.26, 1.42), (0, -0.26, 0.9), "Spine"),
    "Leg_L": ((0, 0.1, 0.9), (0, 0.1, 0.02), "Hips"),
    "Leg_R": ((0, -0.1, 0.9), (0, -0.1, 0.02), "Hips"),
}
WALK_FRAMES = 24
SWING = 0.65


def bone_for_vertex(position):
    if position.z < 0.9:
        return "Leg_L" if position.y >= 0 else "Leg_R"
    if abs(position.y) > 0.2 and position.z < 1.47:
        return "Arm_L" if position.y > 0 else "Arm_R"
    if position.z > 1.47:
        return "Head"
    return "Spine"


def build_figure(name, scale, backpack):
    shirt = material("FigureShirt", "#FFFFFF", 0.7)
    trousers = material("FigureTrousers", "#3A4350", 0.8)
    skin = material("FigureSkin", "#E8B994", 0.7)
    figure = Mesh(name)
    for side in (-1, 1):
        figure.box((0.14, 0.12, 0.88), (0, side * 0.1, 0.44), trousers, bevel=0.025)
        figure.box((0.26, 0.13, 0.07), (0.05, side * 0.1, 0.035), pal_dark(), bevel=0.02)
        figure.box((0.1, 0.1, 0.5), (0, side * 0.26, 1.17), shirt, bevel=0.025)
        figure.sphere((0.05, 0.05, 0.05), (0, side * 0.26, 0.89), skin, subdivisions=1)
    figure.box((0.22, 0.38, 0.58), (0, 0, 1.18), shirt, bevel=0.04)
    figure.sphere((0.14, 0.14, 0.15), (0, 0, 1.62), skin, subdivisions=2)
    if backpack:
        figure.box((0.16, 0.28, 0.4), (-0.18, 0, 1.2), material("FigureBag", "#12A59A", 0.7), bevel=0.04)
    figure_object = figure.build()
    figure_object.scale = (scale, scale, scale)
    return figure_object


def pal_dark():
    return material("FigureShoe", "#23282F", 0.8)


def attach_armature(figure_object):
    armature_data = bpy.data.armatures.new(f"{figure_object.name}_Armature")
    armature_object = bpy.data.objects.new(f"{figure_object.name}_Rig", armature_data)
    bpy.context.scene.collection.objects.link(armature_object)
    bpy.context.view_layer.objects.active = armature_object
    bpy.ops.object.mode_set(mode="EDIT")
    for bone_name, (head, tail, parent_name) in BONES.items():
        edit_bone = armature_data.edit_bones.new(bone_name)
        edit_bone.head = head
        edit_bone.tail = tail
        if parent_name:
            edit_bone.parent = armature_data.edit_bones[parent_name]
    bpy.ops.object.mode_set(mode="OBJECT")
    for bone_name in BONES:
        figure_object.vertex_groups.new(name=bone_name)
    for vertex in figure_object.data.vertices:
        figure_object.vertex_groups[bone_for_vertex(vertex.co)].add([vertex.index], 1.0, "REPLACE")
    figure_object.parent = armature_object
    modifier = figure_object.modifiers.new("Armature", "ARMATURE")
    modifier.object = armature_object
    return armature_object


def keyframe_bone(pose_bone, frame, angle):
    pose_bone.rotation_mode = "XYZ"
    pose_bone.rotation_euler = angle
    pose_bone.keyframe_insert("rotation_euler", frame=frame)


def make_clips(armature_object):
    armature_object.animation_data_create()
    clips = {"Idle": 48, "Walk": WALK_FRAMES}
    for clip_name, length in clips.items():
        action = bpy.data.actions.new(f"{clip_name}")
        armature_object.animation_data.action = action
        for frame in range(0, length + 1, length // 8):
            phase = 2 * math.pi * frame / length
            if clip_name == "Walk":
                swing = math.sin(phase) * SWING
                keyframe_bone(armature_object.pose.bones["Leg_L"], frame + 1, (0, 0, swing))
                keyframe_bone(armature_object.pose.bones["Leg_R"], frame + 1, (0, 0, -swing))
                keyframe_bone(armature_object.pose.bones["Arm_L"], frame + 1, (0, 0, -swing * 0.8))
                keyframe_bone(armature_object.pose.bones["Arm_R"], frame + 1, (0, 0, swing * 0.8))
                keyframe_bone(armature_object.pose.bones["Spine"], frame + 1, (0, 0, math.sin(phase * 2) * 0.03))
                keyframe_bone(armature_object.pose.bones["Hips"], frame + 1, (0, 0, math.sin(phase) * 0.05))
            else:
                breath = math.sin(phase) * 0.03
                keyframe_bone(armature_object.pose.bones["Spine"], frame + 1, (0, 0, breath))
                keyframe_bone(armature_object.pose.bones["Head"], frame + 1, (0, 0, -breath))
                keyframe_bone(armature_object.pose.bones["Arm_L"], frame + 1, (0, 0, breath * 2))
                keyframe_bone(armature_object.pose.bones["Arm_R"], frame + 1, (0, 0, -breath * 2))
        armature_object.animation_data.action = None
        track = armature_object.animation_data.nla_tracks.new()
        track.name = clip_name
        track.strips.new(clip_name, 1, action)


def main():
    lib.reset_scene()
    roots = []
    for index, (name, scale, backpack) in enumerate((("Figure_Adult", 1.0, False), ("Figure_Child", 0.7, False), ("Figure_Backpack", 1.05, True))):
        figure_object = build_figure(name, scale, backpack)
        armature_object = attach_armature(figure_object)
        make_clips(armature_object)
        armature_object.location = (index * 2.0, 0, 0)
        roots.append(armature_object)
    lib.export_glb("people.glb", roots, animation_mode="NLA_TRACKS")


main()

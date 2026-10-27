"""Numbers shared by the build scripts and written to catalog.json. Every value comes from the reference
sheets in blender/refs and is marked 'verify' there (no reference images were downloaded)."""

MODULE_LENGTH = 30.5          # one wall / floor / track module; a chamber is 10 modules = 305 m
MODULES_PER_CHAMBER = 10
CHAMBER_LENGTH = 305.0
CHAMBER_WIDTH = 33.5          # clear width between inner wall faces
LIFT_PER_STEP = 8.5
STEPS = 3
WALL_HEIGHT = 25.0            # above chamber floor (z = 0 is the floor surface)
FLOOR_THICKNESS = 3.0
CENTER_WALL_WIDTH = 18.0
SIDE_WALL_TOP_WIDTH = 5.9
MULE_RAIL_OFFSET = 2.5        # track centre line from the inner wall edge
MULE_GAUGE = 1.5
GATE_LEAF_LENGTH = 19.2
GATE_HINGE_FROM_INNER_FACE = 1.6
GATE_CLOSED_ANGLE_DEG = 17.1  # leaf angle off the cross-chamber line when closed
GATE_POCKET_DEPTH = 3.3
GATE_THICKNESS = 3.0
SILL_HEIGHT = LIFT_PER_STEP
PORT_RADIUS = 0.5
CROSS_CULVERT_Y = [-12.2, -6.1, 0.0, 6.1, 12.2]
PORT_X_ROW_A = [-12.3, -8.7, -5.1, -1.5, 1.5, 5.1, 8.7, 12.3]
PORT_X_ROW_B = [-14.0, -10.5, -7.0, -3.5, 0.0, 3.5, 7.0, 10.5, 14.0]
PORT_DEPTH = 1.2

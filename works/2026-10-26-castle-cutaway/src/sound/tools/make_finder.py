import re, sys
source = open(sys.argv[1], encoding="utf-8").read()
queries = '''QUERIES = {
    "hoof_dirt": ["horse hooves walking dirt", "horse walk dirt path", "single horse hoof step"],
    "hoof_wood": ["horse hooves wooden bridge", "horse walking on wood planks", "hoof clop wood"],
    "chain": ["drawbridge chain", "heavy chain rattle", "chain winch pull", "chain dragging metal"],
    "bell": ["distant church bell", "single bell toll", "old bell ring far"],
    "smith": ["blacksmith hammer anvil", "hammer on anvil single", "anvil strike"],
    "kitchen": ["kitchen pots clatter", "chopping vegetables board", "pot lid clank"],
    "thud": ["heavy wooden thud", "wooden gate slam", "wood drop heavy"],
    "portcullis": ["metal gate grind", "heavy iron gate rising"],
}'''
patched = re.sub(r"QUERIES = \{.*?\n\}", lambda match: queries, source, count=1, flags=re.S)
open(sys.argv[2], "w", encoding="utf-8").write(patched)

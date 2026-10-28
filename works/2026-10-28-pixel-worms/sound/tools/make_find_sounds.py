"""Builds sound/tools/find_sounds.py from the product-video kit's search tool with this film's queries."""
import os

kit = os.environ["FIND_SOUNDS_KIT"]  # path of create-product-video/kit/sound/tools/find_sounds.py
here = os.path.dirname(os.path.abspath(__file__))
text = open(kit, encoding="utf8").read()
start = text.index("QUERIES = {")
end = text.index("}\n", start) + 2
queries = '''QUERIES = {
    "squelch": ["squelch", "wet squelch", "slime squish", "flesh squelch", "bite crunch", "meat chew wet", "wet slap", "gore squish"],
    "writhe": ["slime movement", "wet slimy goo", "maggots crawling", "worms squirming", "intestines wet", "gooey mud squelch loop"],
    "squeak": ["chicken squawk", "rabbit squeal", "pig squeal", "sheep bleat", "goat bleat", "hen cluck panic"],
    "ambience": ["meadow birds", "birdsong morning field", "light wind grass", "countryside ambience wind"],
    "swell": ["low rumble", "deep drone", "sub bass rumble", "low swell"],
}
'''
open(os.path.join(here, "find_sounds.py"), "w", encoding="utf8").write(text[:start] + queries + text[end:])

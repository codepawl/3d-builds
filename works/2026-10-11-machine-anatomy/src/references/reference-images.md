# Reference images (required before the model and the figure)

A figure drawn from memory drifts from the real machine: the first Falcon 9 pad was a generic square with
four towers on a ring, which is not what SLC-40 looks like. So every machine is drawn from real pictures,
and lint and the recorder enforce it.

## Collect

- Put at least 3 real photos or drawings of the machine **and its setting** in `reference/images/`:
  several angles, the patent drawing when there is one, a museum or maker's photograph, and the place it
  works in (a pad, a desk, a ship). Prefer Wikimedia Commons, the maker, NASA, museums or archives; fetch
  with `curl` (Commons: the API's `iiurlwidth=1280` thumbnail, with a User-Agent).
- Open every image with the image reader before drawing. Read off counts, placements, proportions to a
  known size, and how moving parts hinge; write what you read in `reference/notes.md`.
- `reference/images/sources.json`:
  `{ "images": [{ "file", "url", "shows", "compare" }] }`. `url` is the page the image came from,
  `shows` says what it shows (and when it was not studied closely), `compare` names the film still
  (`film.stills`) at the closest moment and angle.
- Every assembly's provenance names the images it was drawn from: `provenance.images: ["file.jpg"]`.
  A photograph is not a quote: a fact read off one is `inferred`, with the image page as source and a note.

## What lint checks

Fewer than 3 images, an image with no `sources.json` entry, an entry with no `url` or `shows`, an entry
for a missing file, an assembly with no `provenance.images`, or one naming an image that is not there.

## Compare

`node cli.mjs record` ends by writing `shots/reference-compare.png` (also `node cli.mjs compare <folder>`):
each reference image beside its `compare` still. Open it, list what differs (shape, count, placement,
proportion, direction of motion), fix what the drawing got wrong, and say in the report what is left
different on purpose (simplified, squeezed) and why.

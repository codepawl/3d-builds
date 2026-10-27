# Prompts

The original prompt to Astra was not kept as a single message. The Opus and Argon briefs (below) quote the owner's own words to Astra, translated from Vietnamese. They are the closest record. The Astra run used a Codex session, which is not in the Claude Code transcripts.

## Prompt (from the owner's words to Astra, translated)

## The brief (the owner's own words to the other model, translated)
"Adjust it in Blender, then bring it to three.js and make it like this video: https://www.youtube.com/watch?v=KPoeNZZ6H4s (procedural animation). Apply procedural animation." "A mechanical spider, the background a prototype grid, with a pixel look." "Make it mechanical like the creature in the reference: scary and massive, moving one leg segment at a time in a mechanical way, with steam. Not cute." "Record interactive movement, a side view: one without pixel, one with pixel." "Let it test walking over mechanical objects so it looks impressive." "At least have it walk a straight stretch across the obstacles, and turn around." "Hide the extra UI while recording." Reference images for mood: spider-opus/reference/spider-reference-1.jpg and -2.jpg (open with Read).
The linked video explains procedural leg animation: feet stay planted while the body moves; when a foot drifts too far from its ideal position under the moving body it steps to a new target ahead in the direction of travel, lifting in an arc; legs step in alternating groups so the body is always supported; the body's height and tilt follow the average of the feet, with a little lag and bounce; inverse kinematics places the joints. You may use the `watch-video` skill to read the video's transcript if you want more detail (yt-dlp is at ~/.local/bin/yt-dlp.exe; YouTube needs `--js-runtimes node`).


(The same text appears in the Opus and Argon briefs in the work 2026-10-11-spider-opus-vs-argon.)

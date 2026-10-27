# Prompts

The messages are from An, in order, translated from Vietnamese, with chat filler removed. Times are UTC, all on 2026-10-13. The work was done in one chat with no delegated agents, so there is no separate agent brief. The chat first loaded the `watch-video` skill on the reference video, then the `animate-code-illustration` skill. The skill's own brief for this kind of post is: draw every frame in JavaScript, show the full cycle from egg to egg, and make the score in code.

## Prompt 1 (10:07 UTC)

A reference video was attached (a downloaded copy of an X video by another creator: "Claude Opus 5 drew every frame of this animation using JavaScript") together with two links to that creator's X posts.

Try making this one. Base it on the video. If I think it is good, I will post it on X and also add it to the benchmark.

## Prompt 2 (10:25 to 11:01 UTC, three short messages)

- "They are all ugly lol. About the sea turtle, let me ask: did they really make it with JavaScript?"
- "In that video, I think some library supports drawing illustrations, because I think it looks nice."
- "Not the one on the right." (An rejected one side of a side-by-side test of two drawing methods. The plain canvas version won over the p5.brush version.)

## Prompt 3 (11:13 UTC)

So how should this skill be improved? Can you improve it while you work, together with me, in small pieces?

## Prompt 4 (11:27 UTC)

It looks odd everywhere lol. The arms and legs look hexagonal and have gaps, and the turtle shell does not look nice at all. Try redoing the fly so I can see. Doing another animal now is hard.

## Prompt 5 (11:41 UTC)

First, the body segments are not the same size. Second, the wings are not in the right place and do not have the right bubble effect (hazy, with a rainbow). The antennae are also too long and not true to life. The shading is not strong at the right spot on the fly.

Fix it and learn the lessons.

## Prompt 6 (11:51 to 12:09 UTC, feedback on the fly, seven short messages)

- "Look, their wings are very clear. You only see the rainbow. The right spot on the fly has nice shading, even the water drop has it. His style also seems to be shading with short or long strokes."
- "Every arm and leg needs clearly visible segments." (11:53)
- "I mean the joints should follow some logic too. If a joint suddenly points straight up, that is wrong for the anatomy of those animals, right?" (11:56)
- "The head is smaller than the two eyes, right?" (12:00)
- "So the lesson for next time: when you build a shape, work out the structure of each part, how the parts relate and how they work first, then you can get it right. Also look at reference images online and make it match." (12:01)
- "The shading should be improvised like sketching, not follow one pattern like the circles in the picture. Also, are the two wings in the right place like this?" (12:09)
- "OK, that is fine, go on." (12:16)

## Prompt 7 (12:22 to 12:33 UTC)

- "Hm, there is no comparison version?"
- "They zoom and they have many different changes, which is very good. For the cells or molecules that double, remember to adjust that. If the reference images are not enough, also look for the motion of how they divide in videos you can find." (12:24)
- "I mean zooming in slowly and then zooming straight in is fine too. The rest is OK, up to the part where the larva forms and hatches." (12:33)

## Prompt 8 (13:13 to 13:58 UTC)

- "I think it is OK, keep going. It is even much clearer and nicer." (13:13)
- "In the reference, the creator films the pupa from many angles, and there is a quick rewind from the moment it forms to the pupa, as the transition to when it breaks out of the cocoon. Learn the lessons and redo this part." (13:58)

## Prompt 9 (14:04 to 15:26 UTC, the hatching scene)

- "This looks more like stop motion. Make the motion similar to the reference. It is too stiff." (14:04)
- "I mean at least the part where it comes out of the cocoon needs a motion of coming out, like shaking left and right, and the cocoon should burst open from gentle to strong. You must learn and understand how the motion moves and how to code the motion for it to be OK." (14:19)
- "Is there no effect at all? For example an effect with lines radiating out in all directions, like a beat. Look at other effects too. Also the cocoon is not designed well yet. Look again and design it with the right art." (14:55)
- "When it comes out, its body should be gripped inside the cocoon. Why are its legs already free? It should follow physics. Also the black space with the vortex should be molecules and cells, not a random vortex, which looks funny. The radiating effect when it breaks the cocoon should have a gentle zoom in and out, as if it is wriggling, to make it a bit more real." (15:05)
- "Also why not spread the wings? Normally a fly spreads its wings when it comes out. And why does the larva not curl into a cocoon first and then break out as the fly? This also needs cartoon motion. It looks quite good now, but not cartoon enough." (15:26)

## Prompt 10 (15:57 to 17:00 UTC, pacing and detail fixes)

- "Why does the fly crawl out to the edge with nothing to hold on to? Also make the motion follow the beat. Try adjusting the motion that way (apply it to everything)." (15:57)
- "From 0:08 to 0:11, what happens is a bit slow compared with the zoom-in and zoom-out beat. It also happens too often and makes me dizzy." (16:03)
- "From 0:15 to 0:16 the dots suddenly turn into the fly too fast. I cannot picture it, and the transition looks ugly and unnatural." (16:07)
- "I mean why not go from the larva, then change the legs and so on, a metamorphosis shape, and let the atoms show it? Also the larva eating part does not look like eating, and I do not understand what 0:13 is about, with a pile of larvae. In the opening the text and the graph are covered. Move them to the left or somewhere so they are clearer." (16:12)
- "At 0:06 the text is covered too, so fix that. The eating looks like sucking in food, not opening the mouth and putting the mouth into the food. What do they eat, anyway, and why are there white grains? Also, in the part where it is still in the cocoon and growing, why do the stripes of its body run outside the body frame, and why is the body so small?" (16:32)
- "At 0:08, why has the food not changed? The fly in the cocoon is not very good either. It looks cheap, and the mix of X-ray and prototype is not OK at all. See if another style works. When the fly comes out and walks, its walking does not sync with its steps either." (16:48)
- "I do not like the background much, at 0:09. It does not look like anything. Is it a log?" (17:00)

## Prompt 11 (17:02 to 17:27 UTC, finishing the cut)

- "OK, that is fine. Attach the opening frame and then make the music." (17:02)
- "At 0:19 why is the eye off from the border of the red eye? What else can create the music besides the library you use now, and what are you using now? Make sure the scenes are related to each other, so one scene does not have an object that the next scene lacks. Also show me a comparison of the original video and mine." (17:18)
- "So my video is not finished? It needs the part where it becomes a real fly, then flies around, looks for a mate, lays eggs and starts another life cycle. The creator's video likes some special patterns of nature, like the honeycomb hexagon and the golden ratio. Apply that. Also apply the lessons from everything I said so far to other agents and to other videos." (17:27)

## Prompt 12 (19:21 UTC)

Give me the comparison, the fruit fly version only.

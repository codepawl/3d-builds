# Prompts

An writes in Vietnamese. These are the messages that shaped the series, in order, translated to English. Chat
filler is dropped. The work ran in Claude Code with Claude Opus 5.5. The main session started a subagent for each
machine build and each round of fixes. Each got the research task and the checks listed in the README.

## Prompt 1 (translated from Vietnamese): the starting point, 11 Oct

> https://skills.wheresryan.sh/anatomy  Try this one too, it looks great. Come up with ideas to use this skill
> for videos and posts.

## Prompt 2 (translated from Vietnamese): which skill, and the first machine

> Does Anatomy have several skills or only one?
>
> OK, then read it and install the important parts. After that, see what topic to make. Human anatomy?

After the agent listed ideas:

> Kind of boring, and I don't like the battle idea much. Opus alone is enough. What about the first sewing
> machine in the world? The caption says Opus 5.5 built an anatomy system of the first sewing machine in the
> world, a machine that raised productivity and changed the world. Use the /anatomy skill and put the skill's URL
> in the reply.
>
> Wait, a loom or a sewing machine? ... Right, the Jacquard loom, I mixed it up.
>
> Look it up online first, research it in detail, and use references, then build the anatomy. Make an artifact so
> it can be shared.

## Prompt 3 (translated from Vietnamese): the list of machines

> After that, go on to other machines or inventions that changed the world. Make a list, then we pick.

After the list:

> OK. Skip the Hollerith tabulating machine. For Watt, the steam engine is better. Replace number 2 with the Morse
> machine. Then the transistor, and Edison's phonograph.

The phonograph did not get built. The light bulb replaced it (Prompt 6).

## Prompt 4 (translated from Vietnamese): Enigma, first review

> I think it needs to be easier to understand and more accurate in detail. I remember the Enigma being more
> complicated than that.
>
> Also the sound effects must not be harsh or sound like toys. Make sure they sound like real machines.

The caption format for every post came from An's own wording:

> Opus 5.5 built the anatomy of the Enigma machine. The machine Germany used to hide its messages in World War II.
> Like that, good.

## Prompt 5 (translated from Vietnamese): the next machines

> Try the Morse machine too, I am curious. Make the other two as well, and schedule them for tomorrow.

## Prompt 6 (translated from Vietnamese): the new film shape

> I thought the transistor was the light bulb =)) but fine, that works too.
>
> For the three videos: remove the zoom frame that sits inside each model. Keep one zoom frame only. Now I think
> it should change like this. At the start, show the full model, not zoomed yet. When it zooms, the new frame grows
> out of the source frame, with dashed lines joining the four corners of the zoom frame, which then fade out slowly
> to keep it tidy. Then, after it runs a few times so people understand the principle, take the parts apart one by
> one.
>
> Now make a fourth video about the first electric light bulb. For the Morse one, add the sound of Morse tapping.
> Adjust it.

A later message in the same spirit changed the opening:

> At the start I want it working straight away, no zoom yet, for about 5 seconds, then zoom.

The film rules that came out of these messages are in `design/film-spec-v2.md`.

## Prompt 7 (translated from Vietnamese): a better skill, then Falcon 9

> I plan to improve the Anatomy skill into a new skill that is better than the old one. Also see what happens if we add a few themes, content control and fidelity, and smoother, more physically
> correct animation.
>
> For themes I would like pixel, dots, dither, and so on, different drawing styles.
>
> Also add a step that asks the user how they like it, so it can be customized properly. Adjust what is needed,
> then test a video about the Falcon 9, https://www.spacex.com/vehicles/falcon-9. If it works, it can be used for a
> showreel to open-source this and post it.

The answers to the intake questions are in `design/falcon9-intake.md`.

## Prompt 8 (translated from Vietnamese): Falcon 9, rounds of fixes

These messages came after each build of the Falcon 9 film.

> This part is covered [a screenshot]. And there is no launch pad. If there is a rocket, there should be a full
> pad. Dither looks quite good, but when it moves it looks like an analog TV =))
>
> Right. Also make the fire a bit more realistic. Learn from this and improve the skill too.
>
> Not only the captions: components that overlap each other should be checked as well.
>
> I remember the SpaceX pad and the NASA pad being different =)) Check online and make it close to the real one.
>
> So the skill should learn this: look at reference photos before modeling, and always look at examples so it does
> not drift from reality.
>
> OK, fix those 3 points. Also I remember there is a touching axis. And drop dither, use the other version. Also
> the second stage returns to the pad too fast. How can it reverse so quickly, how can it come down so fast? What
> about the rocket's nose, and the cluster of rockets on the side, do they not work?
>
> So learn from this and improve the skill so it does not happen again. If a main subject has something that can
> work and you have not touched it, that is a big gap. The same goes for illogical things, such as turning fast
> with nothing acting to turn it.
>
> Fix the zoom frame next, then lock it in and make the showreel.
>
> Drop the music =))
>
> Just post the Falcon. No repo yet, drop that.

## Prompt 9 (translated from Vietnamese): the Falcon post

> try "Opus 5.5 built the anatomy of SpaceX's Falcon 9, quite impressive result". That's all, no reply below it.

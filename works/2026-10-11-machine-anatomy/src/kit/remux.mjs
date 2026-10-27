// Renders the sound track again from the event log of the last recording and puts it on the frames
// already filmed: no browser, no new frames. Use it for any sound-only change.
//   node cli.mjs remux <folder> [--format 9:16] [--style dither]
import { join } from "node:path";
import { lowerPriority } from "./browser.mjs";
import { filmSpecOf } from "./film.mjs";
import { loadMachine } from "./page.mjs";
import { muxFilms, soundLine, variantOf } from "./record.mjs";
import { buildSoundtrack } from "./sound.mjs";

export async function remuxCommand(dir, { format = "16:9", style, theme } = {}) {
  lowerPriority();
  const { machine } = await loadMachine(dir);
  const variant = variantOf(machine, { format, style, theme });
  const spec = filmSpecOf(machine.film);
  const folder = join(dir, "shots", variant.name);
  const soundFile = join(folder, "film-sound.wav");
  const track = buildSoundtrack(join(folder, "film-events.json"), soundFile, spec.seconds, machine.sound);
  console.log(`sound track (wav) · ${track.events} events · one linear gain of ${track.gainDb.toFixed(1)} dB, no limiter · integrated ${track.integrated} LUFS · true peak ${track.truePeak} dBFS · samples at full scale ${track.clipped}`);
  const { out, web } = muxFilms(folder, variant, soundFile);
  console.log(soundLine(out, out));
  console.log(soundLine(web, web));
  return 0;
}

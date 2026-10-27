// Makes the film's sound locally (no recordings, nothing downloaded): node tools/sound.mjs [life] [vertical]
// (life: the documentary; its log lists soft hits only, no clicks, and tools/sfx.py adds the scene sound effects
// from SFX_CUES in src/film/script.js, under the music)
// - a soft low hit with a faint bell on each reveal listed in the film log;
// - a soft, deep click on every click frame of the film, the same sound the app makes (src/sound.js);
// - the score from tools/music.py: sections that follow the shot timeline (SCORE_SECTIONS in src/film/script.js), under it
//   all. There is no drone and no noise bed: the only continuous sounds are the score and the recorded wind in the
//   exterior shots (tools/sfx.py).
// The mix is measured (EBU R128) and set to about -19 LUFS integrated, then limited below -1 dBFS.
// Reads shots/film_log[_life][_vertical].json; writes shots/sound[-life][-vertical].wav.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const TARGET_LUFS = -19
const MUSIC_GAIN = 0.5
const SFX_GAIN = 0.32
// -1.9 dBFS sample ceiling keeps the true peak under -1.5 dBFS.
// 0.7 (about -3.1 dBFS sample peak) leaves room for the AAC encode, which adds up to about 1.4 dB of true peak.
const LIMIT = 0.7

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const shots = path.join(root, 'shots')
const vertical = process.argv.includes('vertical')
const life = process.argv.includes('life')
const suffix = `${life ? '-life' : ''}${vertical ? '-vertical' : ''}`
const logName = `film_log${life ? '_life' : ''}${vertical ? '_vertical' : ''}.json`
const { log, frames, fps, footfalls = [] } = JSON.parse(fs.readFileSync(path.join(shots, logName), 'utf8'))
const duration = frames / fps

// Reveals get a hit a beat after the app counts them, when the new place or name lands on screen; the opening
// click gets one as the map appears. Clicks only where the film really clicks.
const hitTimes = [
  ...log.filter((entry) => entry.label === 'open case file').map((entry) => entry.seconds + 1.1),
  ...log.filter((entry) => entry.label === 'reveal').map((entry) => entry.seconds + 0.35),
  ...log.filter((entry) => entry.label === 'hit').map((entry) => entry.seconds),
]
// The press is the frame before the logged one (the log is written after the mouse-down frame is captured).
const clickTimes = log.filter((entry) => entry.click).map((entry) => (entry.frame - 1) / fps)

function hitTerm(time) {
  const local = `(t-${time.toFixed(3)})`
  return `if(between(t,${time.toFixed(3)},${(time + 3).toFixed(3)}),0.55*sin(2*PI*44*${local})*exp(-2.6*${local})+0.22*sin(2*PI*88*${local})*exp(-4*${local})+0.035*sin(2*PI*659*${local})*exp(-5*${local}),0)`
}

// The app's click: a 92 Hz body falling from 99 Hz, a 184 Hz knock and a faint 1318 Hz tick, all short.
function clickTerm(time) {
  const local = `(t-${time.toFixed(3)})`
  return `if(between(t,${time.toFixed(3)},${(time + 0.4).toFixed(3)}),0.34*sin(2*PI*92*${local})*exp(-43*${local})+0.12*sin(2*PI*184*${local})*exp(-86*${local})+0.009*sin(2*PI*1318*${local})*exp(-138*${local}),0)`
}

const effects = [...hitTimes.map(hitTerm), ...clickTimes.map(clickTerm)].join('+') || '0'

function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  if (result.status !== 0) {
    console.error(result.stderr.slice(-2000))
    process.exit(1)
  }
  return result
}

const musicFile = path.join(shots, `music${suffix}.wav`)
const musicPython = (script, args) => run('uv', ['run', '--no-project', '--with', 'numpy', 'python', path.join(root, 'tools', script), ...args])

// The documentary's score follows its sections; the app film keeps one section-less bed (the opening's).
const sectionsFile = path.join(shots, `score${suffix}.json`)
if (life) {
  const { SCORE_SECTIONS, SHOTS } = await import('../src/film/script.js')
  fs.writeFileSync(sectionsFile, JSON.stringify({ sections: SCORE_SECTIONS, shots: SHOTS.map((shot) => ({ scene: shot.scene, start: shot.start })) }))
} else {
  fs.writeFileSync(sectionsFile, JSON.stringify({ sections: [{ name: 'opening', start: 0 }], shots: [{ scene: 'arrest', start: 0 }] }))
}
musicPython('music.py', [String(duration), sectionsFile, musicFile])

// The documentary's scene effects, synthesized from the shot list's cues; every step sits on a footfall the render logged.
const sfxFile = path.join(shots, `sfx${suffix}.wav`)
if (life) {
  const { SFX_CUES } = await import('../src/film/script.js')
  const cuesFile = path.join(shots, `sfx${suffix}.json`)
  const footfallsFile = path.join(shots, `footfalls${suffix}.json`)
  fs.writeFileSync(cuesFile, JSON.stringify(SFX_CUES))
  fs.writeFileSync(footfallsFile, JSON.stringify(footfalls))
  musicPython('sfx.py', [String(duration), cuesFile, sfxFile, footfallsFile])
} else {
  run('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', `anullsrc=r=48000:cl=stereo:d=${duration}`, sfxFile])
}

const rawMix = path.join(shots, `sound${suffix}-raw.wav`)
run('ffmpeg', [
  '-y', '-loglevel', 'error',
  '-f', 'lavfi', '-i', `aevalsrc='${effects}':s=48000:d=${duration}`,
  '-i', musicFile,
  '-i', sfxFile,
  '-filter_complex',
  `[0]lowpass=f=2400,aformat=channel_layouts=stereo[effects];[1]volume=${MUSIC_GAIN}[music];` +
  `[2]volume=${SFX_GAIN},aformat=channel_layouts=stereo[sfx];[effects][music][sfx]amix=inputs=3:normalize=0,afade=t=in:d=2.5,afade=t=out:st=${(duration - 2.2).toFixed(2)}:d=2.2[out]`,
  '-map', '[out]', '-c:a', 'pcm_f32le', rawMix,
])

function integratedLoudness(file) {
  const result = run('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-'])
  const summary = result.stderr.slice(result.stderr.lastIndexOf('Summary:'))
  return { integrated: Number(summary.match(/I:\s+(-?[\d.]+) LUFS/)[1]), peak: Number(summary.match(/Peak:\s+(-?[\d.]+) dBFS/)[1]) }
}

const before = integratedLoudness(rawMix)
const gainDb = TARGET_LUFS - before.integrated
const output = path.join(shots, `sound${suffix}.wav`)
run('ffmpeg', ['-y', '-loglevel', 'error', '-i', rawMix, '-af', `volume=${gainDb.toFixed(2)}dB,alimiter=limit=${LIMIT}:level=false`, '-c:a', 'pcm_s16le', output])
fs.rmSync(rawMix)
const after = integratedLoudness(output)
console.log(`sound${suffix}.wav ${duration.toFixed(2)} s, ${hitTimes.length} hits, ${clickTimes.length} clicks at ${clickTimes.map((time) => time.toFixed(2)).join(', ')}`)
console.log(`loudness ${after.integrated} LUFS integrated (raw ${before.integrated}, gain ${gainDb.toFixed(1)} dB), true peak ${after.peak} dBFS`)

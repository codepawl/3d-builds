import test from "node:test";
import assert from "node:assert/strict";
import { MelodyPlayer, GestureNotes, MELODY } from "./melody.js";

test("melody proceeds through every note and loops to the beginning", () => {
  const player = new MelodyPlayer();
  const notes = Array.from(
    { length: MELODY.length + 2 },
    (_, index) => player.playNext(index * 200).note,
  );
  assert.deepEqual(notes, [...MELODY, ...MELODY.slice(0, 2)]);
});
test("stationary hold resets, while continued movement preserves the melody", () => {
  const player = new MelodyPlayer();
  player.playNext(0);
  player.playNext(200);
  player.moved(2000);
  assert.equal(player.checkIdle(4000), false);
  assert.equal(player.checkIdle(5000), true);
  assert.equal(player.position, 0);
  assert.equal(player.playNext(5100).note, MELODY[0]);
});
test("downward pull plays immediately and only once per stroke", () => {
  const gestures = new GestureNotes();
  assert.equal(gestures.move({ x: 0, y: -0.3 }), true);
  assert.equal(gestures.move({ x: 0, y: -0.6 }), false);
  gestures.reset();
  assert.equal(gestures.move({ x: 0.002, y: 0.002 }), false);
  assert.equal(gestures.move({ x: 0, y: 0.3 }), false);
  assert.equal(gestures.move({ x: 0, y: 0.6 }), false);
  assert.equal(gestures.move({ x: 0, y: 0 }), true);
  assert.equal(gestures.move({ x: -0.3, y: 0 }), false);
  assert.equal(gestures.move({ x: 0, y: -0.3 }), false);
  assert.equal(gestures.move({ x: 0, y: 0.3 }), false);
  assert.equal(gestures.release(), true);
  assert.equal(gestures.release(), false);
});
test("rapid pointer events cannot consume notes faster than the cooldown", () => {
  const player = new MelodyPlayer();
  assert.ok(player.playNext(100));
  assert.equal(player.playNext(120), null);
  assert.equal(player.position, 1);
  assert.ok(player.playNext(250));
  assert.equal(player.position, 2);
});
test("selecting another song resets and loops that song", () => {
  const player = new MelodyPlayer();
  player.playNext(0);
  player.selectSong('twinkle');
  assert.equal(player.position, 0);
  assert.equal(player.history.length, 0);
  const notes = Array.from({length:player.song.notes.length + 1}, (_, i) => player.playNext(200 + i * 200).note);
  assert.deepEqual(notes, [...player.song.notes, player.song.notes[0]]);
});

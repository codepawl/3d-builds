import test from "node:test";
import assert from "node:assert/strict";
import { createMechanicalAudio } from "./footsteps.mjs";

test("foot contact variations are bounded and retained for identical offline replay", () => {
  globalThis.window = { addEventListener() {} };
  const audio = createMechanicalAudio();
  const record = () => {
    audio.beginTimeline();
    for (let index = 0; index < 24; index++)
      audio.emit("step", index % 2 ? -1 : 1);
    audio.emit("jump");
    return audio.events.map(({ seconds, ...sound }) => sound);
  };
  const first = record();
  assert.deepEqual(record(), first);
  const contacts = first.filter((sound) => sound.kind === "step");
  assert.ok(
    new Set(contacts.map((sound) => sound.weight.toFixed(2))).size > 12,
  );
  for (const sound of contacts) {
    assert.ok(sound.weight >= 0.72 && sound.weight <= 1.3);
    assert.ok(sound.pitch >= 0.9 && sound.pitch <= 1.1);
    assert.ok(sound.noiseOffset >= 0 && sound.noiseOffset < 0.7);
  }
  assert.equal(first.at(-1).kind, "jump");
});

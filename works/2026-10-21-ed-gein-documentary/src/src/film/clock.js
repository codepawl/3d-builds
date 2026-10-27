// The film's one clock, read by every scene. The director sets it once per frame from performance.now(),
// which the recorder replaces with a virtual clock, so every frame of the film is deterministic.
export const clock = {
  startedAt: null,
  filmSeconds: 0,
  shotStart: 0,
  shotSeconds: 0,
  shotLength: 1,
  shotFadeOut: 0,
}

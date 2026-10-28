// Hooks for the rules that come next (growth, spawning): the game announces what happened and does not decide what it means.
//   'worm-eat'      { chunk }          a worm finished biting a piece of meat or bone (the piece is gone; chunk.food is its worth)
//   'creature-die'  { creature }       a creature was swallowed by the swarm
//   'worm-die'      { x, z, cause }    a worm was taken ('hawk', 'fox', 'trap', 'salt')
//   'parry'         { attacker, x, z } a dodge met an attack in time
export const gameEvents = new EventTarget();

export function announce(type, detail = {}) {
  gameEvents.dispatchEvent(new CustomEvent(type, { detail }));
}

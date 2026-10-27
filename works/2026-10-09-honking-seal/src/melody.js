const TWINKLE = [
  72, 72, 79, 79, 81, 81, 79, 77, 77, 76, 76, 74, 74, 72, 79, 79, 77, 77, 76,
  76, 74, 79, 79, 77, 77, 76, 76, 74, 72, 72, 79, 79, 81, 81, 79, 77, 77, 76,
  76, 74, 74, 72,
];

export const SONGS = {
  twinkle: { title: "Twinkle, Twinkle, Little Star", artist: "", notes: TWINKLE },
};
export const MELODY = SONGS.twinkle.notes;

export class MelodyPlayer {
  constructor({ idleMilliseconds = 3000, cooldownMilliseconds = 140 } = {}) {
    this.song = SONGS.twinkle;
    this.idleMilliseconds = idleMilliseconds;
    this.cooldownMilliseconds = cooldownMilliseconds;
    this.position = 0;
    this.lastNoteAt = -Infinity;
    this.lastMovementAt = -Infinity;
    this.history = [];
  }

  selectSong(id) {
    if (!SONGS[id]) return;
    this.song = SONGS[id];
    this.history = [];
    this.reset();
  }

  reset() {
    this.position = 0;
    this.lastNoteAt = -Infinity;
    this.lastMovementAt = -Infinity;
  }

  checkIdle(now) {
    if (
      this.position > 0 &&
      now - this.lastMovementAt >= this.idleMilliseconds
    ) {
      this.reset();
      return true;
    }
    return false;
  }

  playNext(now) {
    this.checkIdle(now);
    if (now - this.lastNoteAt < this.cooldownMilliseconds) return null;
    const note = this.song.notes[this.position];
    this.position = (this.position + 1) % this.song.notes.length;
    this.lastNoteAt = now;
    this.lastMovementAt = now;
    this.history.push(note);
    if (this.history.length > 84) this.history.shift();
    return { note, position: this.position, length: this.song.notes.length };
  }

  moved(now) {
    this.lastMovementAt = now;
  }
}

export class GestureNotes {
  constructor({ threshold = 0.18 } = {}) {
    this.threshold = threshold;
    this.reset();
  }
  reset() {
    this.lastPoint = { x: 0, y: 0 };
    this.peak = 0;
    this.rise = 0;
    this.playedThisStroke = false;
  }
  move(point) {
    const change = point.y - this.lastPoint.y;
    this.lastPoint = { ...point };
    if (change > 0.006) {
      this.rise += change;
      if (this.rise >= this.threshold) {
        this.playedThisStroke = false;
        this.peak = point.y;
      }
      this.peak = Math.max(this.peak, point.y);
      return false;
    }
    if (change >= -0.006) return false;
    this.rise = 0;
    if (this.playedThisStroke || this.peak - point.y < this.threshold) return false;
    this.playedThisStroke = true;
    return true;
  }
  release() {
    const returningDown = this.lastPoint.y >= this.threshold && !this.playedThisStroke;
    this.reset();
    return returningDown;
  }
}

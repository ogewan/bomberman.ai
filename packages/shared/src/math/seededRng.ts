/**
 * SeededRng — deterministic pseudo-random number generator.
 * Uses a simple mulberry32 algorithm for reproducibility across runs.
 */

export class SeededRng {
  private state: number;

  constructor(seed: number) {
    this.state = seed | 0;
  }

  /** Returns a float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Returns true with the given probability (0..1). */
  chance(probability: number): boolean {
    return this.next() < probability;
  }
}

/**
 * Floating hearts, sparkles and confetti. Particles only appear in cells
 * that nothing else has drawn into, so they never cover the bouquet.
 */

// Ambient particle types. `weight` is the relative chance of each being spawned;
// `speed` is the vertical velocity range in pixels per second (negative = upwards).
const PARTICLE_KINDS = [
  {
    weight: 0.3,
    chars: ['<3'],
    colors: ['#ff7eb6', '#ff4f9a', '#ffd0e2', '#ff9aa8'],
    speed: [-34, -14],
    twinkles: false,
  },
  {
    weight: 0.35,
    chars: ['*', '+', '.', 'x', '`'],
    colors: ['#ffffff', '#9fd4ff', '#ffe28a'],
    speed: [-14, -4],
    twinkles: true,
  },
  {
    weight: 0.35,
    chars: ['~', '^', '"', '=', "'", 'o'],
    colors: ['#ffd24d', '#ff7eb6', '#6fb4ff', '#8ff0a0', '#ffa56b'],
    speed: [18, 42],
    twinkles: false,
  },
];

const BURST_COLORS = ['#ffffff', '#ff7eb6', '#ffd24d'];
const OFFSCREEN_MARGIN = 10;
const AMBIENT_DENSITY = 1 / 55; // particles per grid cell
const SWAY_SPEED = 8; // pixels per second

function chooseKind() {
  let roll = Math.random();
  for (const kind of PARTICLE_KINDS) {
    roll -= kind.weight;
    if (roll < 0) return kind;
  }
  return PARTICLE_KINDS[PARTICLE_KINDS.length - 1];
}

class ParticleField {
  constructor() {
    this.particles = [];
    this.width = 0;
    this.height = 0;
  }

  /** Starts over with a fresh scattering for the given grid. */
  reset(grid) {
    this.width = grid.width;
    this.height = grid.height;
    const count = Math.floor(grid.columns * grid.rows * AMBIENT_DENSITY);
    this.particles = Array.from({ length: count }, () => this.createAmbient(true));
  }

  /** `anywhere` scatters the particle over the screen; otherwise it enters from an edge. */
  createAmbient(anywhere) {
    const kind = chooseKind();
    const velocityY = randomBetween(...kind.speed);
    const edgeY = velocityY < 0 ? this.height + OFFSCREEN_MARGIN / 2 : -OFFSCREEN_MARGIN / 2;
    return {
      x: randomBetween(0, this.width),
      y: anywhere ? randomBetween(0, this.height) : edgeY,
      velocityY,
      char: pickRandom(kind.chars),
      color: pickRandom(kind.colors),
      twinkles: kind.twinkles,
      phase: randomBetween(0, TAU),
    };
  }

  /** A short-lived shower of hearts and stars, used when the screen is tapped. */
  burst(x, y, count) {
    for (let n = 0; n < count; n++) {
      this.particles.push({
        x,
        y,
        velocityX: randomBetween(-30, 30),
        velocityY: randomBetween(-90, -30),
        char: n % 3 ? '<3' : '*',
        color: BURST_COLORS[n % 3],
        twinkles: false,
        phase: 0,
        life: randomBetween(1.2, 2.6),
      });
    }
  }

  update(deltaSeconds, time) {
    const survivors = [];

    for (const particle of this.particles) {
      particle.y += particle.velocityY * deltaSeconds;
      particle.x += (particle.velocityX ?? Math.sin(time * 1.3 + particle.phase) * SWAY_SPEED) * deltaSeconds;

      if (particle.life !== undefined) {
        particle.life -= deltaSeconds;
        if (particle.life >= 0) survivors.push(particle);
      } else if (particle.y < -OFFSCREEN_MARGIN || particle.y > this.height + OFFSCREEN_MARGIN) {
        survivors.push(this.createAmbient(false));
      } else {
        survivors.push(particle);
      }
    }

    this.particles = survivors;
  }

  draw(grid, time) {
    for (const particle of this.particles) {
      if (particle.twinkles && Math.sin(time * 4 + particle.phase) < -0.2) continue;

      const column = grid.columnAt(particle.x);
      const row = grid.rowAt(particle.y);
      if (grid.isEmpty(column, row)) grid.write(column, row, particle.char, particle.color);
    }
  }
}

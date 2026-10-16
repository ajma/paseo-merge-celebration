const STEP = 1 / 120;
const MAX_PARTICLES = 240;
const COLORS = [
  ["#ff578f", "#bd386b"],
  ["#ffc857", "#c98a32"],
  ["#50dfb1", "#279978"],
  ["#6da9ff", "#4272b9"],
  ["#b391ff", "#795bb8"],
  ["#ff9357", "#bd6031"],
];

export interface PaperParticle {
  id: number;
  x: number;
  y: number;
  birthY: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  angle: number;
  spin: number;
  flip: number;
  tumble: number;
  phase: number;
  flutter: number;
  gravity: number;
  terminalSpeed: number;
  age: number;
  color: string;
  backColor: string;
}

/** Fixed-step paper motion. Births stop independently of the particles already in flight. */
export function createConfetti(initialWidth: number, initialHeight: number, random = Math.random) {
  let width = initialWidth;
  let height = initialHeight;
  let emitting = false;
  let accumulator = 0;
  let birthBudget = 0;
  let time = 0;
  let nextId = 0;
  const particles: PaperParticle[] = [];
  const between = (low: number, high: number) => low + random() * (high - low);
  function spawn() {
    const colors = COLORS[Math.floor(random() * COLORS.length)];
    const birthY = -between(24, 40);
    const paperWidth = between(5, 10);
    particles.push({
      id: nextId++,
      x: between(-20, width + 20),
      y: birthY,
      birthY,
      vx: between(-25, 25),
      vy: between(25, 70),
      width: paperWidth,
      height: between(8, 16),
      angle: between(0, Math.PI * 2),
      spin: between(1, 3.8) * (random() < 0.5 ? -1 : 1),
      flip: between(0, Math.PI * 2),
      tumble: between(2.5, 6) * (random() < 0.5 ? -1 : 1),
      phase: between(0, Math.PI * 2),
      flutter: between(2, 5),
      gravity: between(420, 620),
      terminalSpeed: between(150, 230) + paperWidth * 3,
      age: 0,
      color: colors[0],
      backColor: colors[1],
    });
  }
  function tick() {
    time += STEP;
    if (emitting) {
      // Reserve capacity for the longest fall, so tall windows never saturate into bursts.
      const transitSeconds = (height + 80) / 145 + 0.7;
      const rate = Math.min(
        Math.max(14, Math.min(45, width / 34)),
        (MAX_PARTICLES * 0.85) / transitSeconds,
      );
      birthBudget += rate * STEP;
      while (birthBudget >= 1) {
        birthBudget -= 1;
        if (particles.length < MAX_PARTICLES) spawn();
      }
    }
    for (let index = particles.length - 1; index >= 0; index--) {
      const particle = particles[index];
      particle.age += STEP;
      const flutter = Math.sin(particle.age * particle.flutter + particle.phase);
      const wind = Math.sin(time * 0.6) * 24 + flutter * 42;
      particle.vx += (wind - particle.vx) * 2.6 * STEP;
      // Quadratic air resistance settles each sheet at its own terminal speed.
      const drag = (particle.vy / particle.terminalSpeed) ** 2;
      particle.vy = Math.max(
        0,
        particle.vy + particle.gravity * (1 - 0.14 * Math.cos(particle.flip) - drag) * STEP,
      );
      particle.x += particle.vx * STEP;
      particle.y += particle.vy * STEP;
      particle.angle += (particle.spin + flutter * 0.6) * STEP;
      particle.flip += particle.tumble * STEP;
      const radius = Math.hypot(particle.width, particle.height);
      if (particle.y - radius > height || particle.x < -100 || particle.x > width + 100)
        particles.splice(index, 1);
    }
  }
  return {
    get particles(): readonly PaperParticle[] {
      return particles;
    },
    get emitting() {
      return emitting;
    },
    start() {
      particles.length = 0;
      accumulator = birthBudget = time = 0;
      emitting = true;
    },
    stop() {
      emitting = false;
      birthBudget = 0;
    },
    clear() {
      emitting = false;
      particles.length = 0;
      accumulator = birthBudget = 0;
    },
    resize(nextWidth: number, nextHeight: number) {
      width = nextWidth;
      height = nextHeight;
    },
    step(seconds: number) {
      // A delayed frame must not teleport the shower or emit a backlog all at once.
      accumulator += Math.max(0, Math.min(seconds, 0.1));
      while (accumulator + 1e-10 >= STEP) {
        tick();
        accumulator = Math.max(0, accumulator - STEP);
      }
    },
  };
}

import { test } from "node:test";
import assert from "node:assert/strict";
import { createConfetti } from "../client/confetti-physics";

function random() {
  let seed = 12345;
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}
function advance(simulation: ReturnType<typeof createConfetti>, seconds: number, fps = 60) {
  for (let frame = 0; frame < Math.round(seconds * fps); frame++) simulation.step(1 / fps);
}
test("confetti starts empty and enters from above instead of filling the screen immediately", () => {
  const simulation = createConfetti(1280, 800, random());
  simulation.start();
  assert.equal(simulation.particles.length, 0);
  advance(simulation, 0.25);
  assert.ok(simulation.particles.length > 0);
  assert.ok(simulation.particles.every((particle) => particle.y < 80));
  assert.ok(simulation.particles.every((particle) => particle.birthY < -particle.height));
});
test("gravity, air resistance and individual tumbling produce varied finite motion", () => {
  const simulation = createConfetti(1280, 800, random());
  simulation.start();
  advance(simulation, 0.25);
  const first = simulation.particles[0];
  const initial = { y: first.y, vy: first.vy, angle: first.angle, flip: first.flip };
  advance(simulation, 1.5);
  assert.ok(first.y > initial.y);
  assert.ok(first.vy > initial.vy);
  assert.ok(first.vy < first.terminalSpeed * 1.2);
  assert.notEqual(first.angle, initial.angle);
  assert.notEqual(first.flip, initial.flip);
  assert.ok(new Set(simulation.particles.map((particle) => particle.terminalSpeed)).size > 10);
  assert.ok(simulation.particles.some((particle) => particle.spin < 0));
  assert.ok(simulation.particles.some((particle) => particle.spin > 0));
  assert.ok(
    simulation.particles.every((particle) =>
      [particle.x, particle.y, particle.vx, particle.vy].every(Number.isFinite),
    ),
  );
});
test("dismissal stops births while existing particles keep falling until fully offscreen", () => {
  const simulation = createConfetti(1280, 800, random());
  simulation.start();
  advance(simulation, 2);
  simulation.stop();
  const positions = new Map(simulation.particles.map((particle) => [particle.id, particle.y]));
  assert.ok(positions.size > 0);
  advance(simulation, 0.5);
  assert.ok(simulation.particles.length > 0);
  for (const particle of simulation.particles) {
    assert.ok(positions.has(particle.id), "no new particles after dismissal");
    assert.ok(particle.y > positions.get(particle.id)!, "surviving particles continue downward");
  }
  advance(simulation, 12);
  assert.equal(simulation.particles.length, 0);
  advance(simulation, 3);
  assert.equal(simulation.particles.length, 0);
});
test("motion stays consistent at different frame rates and recovers without jumping after a stall", () => {
  const slow = createConfetti(1280, 800, random());
  const fast = createConfetti(1280, 800, random());
  slow.start();
  fast.start();
  advance(slow, 2, 30);
  advance(fast, 2, 120);
  assert.equal(slow.particles.length, fast.particles.length);
  for (let index = 0; index < slow.particles.length; index++) {
    assert.ok(Math.abs(slow.particles[index].x - fast.particles[index].x) < 0.01);
    assert.ok(Math.abs(slow.particles[index].y - fast.particles[index].y) < 0.01);
  }
  const first = slow.particles[0];
  const y = first.y;
  slow.step(10);
  assert.ok(first.y - y < 40, "a stalled frame cannot fast-forward the entire shower");
});
test("emission stays bounded, particles never wrap upward, and a fresh celebration starts empty", () => {
  const simulation = createConfetti(1280, 800, random());
  simulation.start();
  const lastY = new Map<number, number>();
  for (let frame = 0; frame < 60 * 20; frame++) {
    simulation.step(1 / 60);
    assert.ok(simulation.particles.length <= 240);
    for (const particle of simulation.particles) {
      assert.ok(particle.y >= (lastY.get(particle.id) ?? -Infinity));
      lastY.set(particle.id, particle.y);
    }
  }
  assert.ok(simulation.particles.length > 30);
  simulation.start();
  assert.equal(simulation.particles.length, 0);
  simulation.clear();
  advance(simulation, 1);
  assert.equal(simulation.particles.length, 0);
});
test("tall desktop windows keep receiving fresh confetti without saturating the particle budget", () => {
  for (const [width, height] of [
    [2560, 1440],
    [3840, 2160],
  ]) {
    const simulation = createConfetti(width, height, random());
    simulation.start();
    let previousId = -1;
    for (let quarter = 0; quarter < 25 * 4; quarter++) {
      advance(simulation, 0.25);
      const newest = Math.max(...simulation.particles.map((particle) => particle.id));
      assert.ok(newest > previousId, `${width}×${height} stopped emitting at ${quarter / 4}s`);
      assert.ok(simulation.particles.length <= 240);
      previousId = newest;
    }
  }
});
test("size scales new sheets, speed scales elapsed motion and amount scales density", () => {
  const base = createConfetti(1280, 800, random());
  const large = createConfetti(1280, 800, random(), { size: 1.5, speed: 1, amount: 1 });
  const fast = createConfetti(1280, 800, random(), { size: 1, speed: 2, amount: 1 });
  const heavy = createConfetti(1280, 800, random(), { size: 1, speed: 1, amount: 1.8 });
  for (const simulation of [base, large, fast, heavy]) simulation.start();
  advance(base, 2);
  advance(large, 2);
  advance(fast, 1);
  advance(heavy, 2);
  assert.ok(Math.abs(large.particles[0].width - base.particles[0].width * 1.5) < 1e-9);
  assert.ok(Math.abs(large.particles[0].height - base.particles[0].height * 1.5) < 1e-9);
  assert.equal(fast.particles.length, base.particles.length);
  assert.ok(Math.abs(fast.particles[0].y - base.particles[0].y) < 0.01);
  assert.ok(heavy.particles.length > base.particles.length * 1.5);
});
test("reconfiguring a running shower changes speed without restarting it", () => {
  const simulation = createConfetti(1280, 800, random());
  simulation.start();
  advance(simulation, 1);
  const first = simulation.particles[0];
  const count = simulation.particles.length;
  simulation.configure({ size: 1, speed: 0, amount: 1 });
  const y = first.y;
  advance(simulation, 1);
  assert.equal(first.y, y);
  assert.equal(simulation.particles.length, count);
});

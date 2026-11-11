import test from 'node:test';
import assert from 'node:assert/strict';
import { recognizeCircle } from '../circle.mjs';

function loop({ direction = 1, radius = 110, squash = 1, turns = 1, wobble = 0 } = {}) {
  return Array.from({ length: 101 }, (_, i) => {
    const angle = direction * i / 100 * Math.PI * 2 * turns;
    const r = radius * (1 + wobble * Math.sin(angle * 7));
    return { x: 420 + Math.cos(angle) * r, y: 300 + Math.sin(angle) * r * squash };
  });
}

test('recognizes clockwise, counterclockwise, and imperfect hand-drawn loops', () => {
  for (const options of [{}, { direction: -1 }, { squash: 0.8, wobble: 0.025 }]) {
    const center = recognizeCircle(loop(options));
    assert.ok(center);
    assert.ok(Math.abs(center.x - 420) < 8 && Math.abs(center.y - 300) < 8);
  }
});

test('recognizes a circle after an unrelated approach stroke', () => {
  const approach = Array.from({ length: 20 }, (_, i) => ({ x: 300 + i * 11, y: 300 }));
  assert.ok(recognizeCircle([...approach, ...loop()]));
});

test('rejects a line, semicircle, tiny loop, and a path traversed back and forth', () => {
  assert.equal(recognizeCircle(Array.from({ length: 100 }, (_, i) => ({ x: i * 5, y: i * 2 }))), null);
  assert.equal(recognizeCircle(loop({ turns: 0.5 })), null);
  assert.equal(recognizeCircle(loop({ radius: 24 })), null);
  const arc = loop({ turns: 0.4 });
  assert.equal(recognizeCircle([...arc, ...arc.toReversed()]), null);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { FACE_OVAL, createFaceMapping, triangleTransform } from '../face-mapping.mjs';

function face({ x = 320, y = 240, scale = 1, rotation = 0 } = {}) {
  const points = Array.from({ length: 478 }, () => ({ x: x / 640, y: y / 480 }));
  const project = (px, py) => ({ x: (x + scale * (px * Math.cos(rotation) - py * Math.sin(rotation))) / 640, y: (y + scale * (px * Math.sin(rotation) + py * Math.cos(rotation))) / 480 });
  FACE_OVAL.forEach((index, i) => { const angle = -Math.PI / 2 + i / FACE_OVAL.length * Math.PI * 2; points[index] = project(Math.cos(angle) * 80, Math.sin(angle) * 110); });
  points[33] = project(-40, -20);
  points[263] = project(40, -20);
  return points;
}

test('a moving, tilted, or larger face maps to the same prince face outline', () => {
  const baseline = createFaceMapping(face(), 640, 480, 192, 224);
  for (const pose of [{ x: 200, y: 170 }, { scale: 1.5 }, { rotation: 0.5 }]) {
    const mapped = createFaceMapping(face(pose), 640, 480, 192, 224);
    assert.equal(mapped.length, 36);
    for (let i = 0; i < mapped.length; i++) {
      assert.ok(Math.abs(mapped[i].target[1].x - baseline[i].target[1].x) < 0.001);
      assert.ok(Math.abs(mapped[i].target[1].y - baseline[i].target[1].y) < 0.001);
    }
  }
});

test('each source triangle lands exactly on its destination triangle', () => {
  const mapped = createFaceMapping(face({ rotation: -0.4, scale: 0.8 }), 640, 480, 192, 224);
  for (const triangle of mapped) {
    const [a, b, c, d, e, f] = triangleTransform(triangle.source, triangle.target);
    triangle.source.forEach((point, index) => {
      assert.ok(Math.abs(a * point.x + c * point.y + e - triangle.target[index].x) < 0.0001);
      assert.ok(Math.abs(b * point.x + d * point.y + f - triangle.target[index].y) < 0.0001);
    });
  }
});

test('missing, invalid, and collapsed faces do not produce a stale mapping', () => {
  assert.equal(createFaceMapping(undefined, 640, 480, 192, 224), null);
  assert.equal(createFaceMapping([], 640, 480, 192, 224), null);
  assert.equal(createFaceMapping(face(), 0, 480, 192, 224), null);
  assert.equal(createFaceMapping(face({ scale: 0 }), 640, 480, 192, 224), null);
});

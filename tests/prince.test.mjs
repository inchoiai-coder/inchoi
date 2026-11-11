import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { recognizeCircle } from '../circle.mjs';

const source = readFileSync(new URL('../prince.js', import.meta.url), 'utf8').replace(/^import[^\n]+\n/gm, '');

function setup(getUserMedia) {
  const elements = new Map();
  const windowEvents = {};
  for (const id of ['.scene', '#prince', '#gesture-status', '#camera-toggle', '#camera-status', '#camera-preview', '#preview-video', '#face-canvas', '#prince-close']) {
    elements.set(id, {
      hidden: ['#prince', '#camera-preview', '#face-canvas'].includes(id),
      disabled: false, style: {}, attributes: {}, events: {}, srcObject: null,
      addEventListener(name, handler) { this.events[name] = handler; },
      setAttribute(name, value) { this.attributes[name] = value; },
      getBoundingClientRect() { return id === '#prince' ? { width: 220, height: 330 } : { left: 0, top: 0, width: 1200, height: 800 }; },
      getAnimations: () => [], animate() {}, async play() {},
    });
  }
  let time = 1000;
  vm.runInNewContext(source, {
    recognizeCircle,
    createFaceTracker: async (video, canvas, onStatus) => ({ start() { canvas.hidden = false; onStatus('tracking'); }, stop() { canvas.hidden = true; } }),
    document: { querySelector: selector => elements.get(selector) },
    window: { addEventListener: (name, handler) => { windowEvents[name] = handler; } },
    navigator: { mediaDevices: { getUserMedia } },
    matchMedia: () => ({ matches: false }), performance: { now: () => time },
  });
  return { elements, windowEvents, move(x, y) {
    time += 20;
    elements.get('.scene').events.pointermove({ clientX: x, clientY: y, target: { closest: () => null } });
  } };
}

test('drawing a circle reveals the prince without requesting camera access', () => {
  let requests = 0;
  const app = setup(() => { requests++; });
  for (let i = 0; i <= 80; i++) {
    const angle = i / 80 * Math.PI * 2;
    app.move(500 + Math.cos(angle) * 130, 400 + Math.sin(angle) * 130);
  }
  assert.equal(app.elements.get('#prince').hidden, false);
  assert.equal(requests, 0);
  app.elements.get('#prince-close').events.click();
  assert.equal(app.elements.get('#prince').hidden, true);
});

test('camera button starts face tracking with the preview, with microphone disabled; turning off releases it', async () => {
  let requested;
  let stopped = 0;
  const track = { stop() { stopped++; }, addEventListener() {} };
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] };
  const { elements } = setup(async constraints => { requested = constraints; return stream; });
  const button = elements.get('#camera-toggle');
  await button.events.click();
  assert.equal(requested.audio, false);
  assert.equal(elements.get('#preview-video').srcObject, stream);
  assert.equal(elements.get('#face-canvas').hidden, false);
  assert.match(elements.get('#camera-status').textContent, /얼굴을 찾았어요/);
  assert.equal(button.attributes['aria-pressed'], 'true');
  await button.events.click();
  assert.equal(stopped, 1);
  assert.equal(elements.get('#preview-video').srcObject, null);
  assert.equal(elements.get('#face-canvas').hidden, true);
  assert.equal(button.attributes['aria-pressed'], 'false');
});

test('denial and a missing webcam show recovery instructions and keep retry enabled', async () => {
  for (const [name, message] of [['NotAllowedError', '허용'], ['NotFoundError', '연결']]) {
    const { elements } = setup(async () => { throw Object.assign(new Error(), { name }); });
    await elements.get('#camera-toggle').events.click();
    assert.match(elements.get('#camera-status').textContent, new RegExp(message));
    assert.equal(elements.get('#camera-toggle').disabled, false);
    assert.equal(elements.get('#face-canvas').hidden, true);
  }
});

test('leaving the page releases a running camera', async () => {
  let stopped = 0;
  const track = { stop() { stopped++; }, addEventListener() {} };
  const app = setup(async () => ({ getTracks: () => [track], getVideoTracks: () => [track] }));
  await app.elements.get('#camera-toggle').events.click();
  app.windowEvents.pagehide();
  assert.equal(stopped, 1);
  assert.equal(app.elements.get('#preview-video').srcObject, null);
});

test('a delayed camera permission cannot restart the stream after the page closes', async () => {
  let resolvePermission;
  let stopped = 0;
  const track = { stop() { stopped++; }, addEventListener() {} };
  const app = setup(() => new Promise(resolve => { resolvePermission = resolve; }));
  const pending = app.elements.get('#camera-toggle').events.click();
  app.windowEvents.pagehide();
  resolvePermission({ getTracks: () => [track], getVideoTracks: () => [track] });
  await pending;
  assert.equal(stopped, 1);
  assert.equal(app.elements.get('#preview-video').srcObject, null);
});

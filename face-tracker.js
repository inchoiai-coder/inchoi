import { createFaceMapping, drawMappedFace } from './face-mapping.mjs';

function assignFaces(faces, slots) {
  if (slots.length === 1 || faces.length === 0) return faces;
  const [first, second] = faces;
  const [prince, princess] = slots;
  const distance = (face, center) => center ? Math.hypot(face.center.x - center.x, face.center.y - center.y) : 0;

  if (!second) {
    const belongsToPrincess = princess.center && (!prince.center || distance(first, princess.center) < distance(first, prince.center));
    return belongsToPrincess ? [null, first] : faces;
  }

  // If both appear together, the person on the left of the mirrored preview goes first.
  if (!prince.center && !princess.center) return first.center.x >= second.center.x ? faces : [second, first];
  const keep = distance(first, prince.center) + distance(second, princess.center);
  const swap = distance(second, prince.center) + distance(first, princess.center);
  return swap < keep ? [second, first] : faces;
}

export async function createFaceTracker(video, canvases, onStatus) {
  const { FilesetResolver, FaceLandmarker } = await import('./vendor/mediapipe/vision_bundle.mjs');
  const fileset = await FilesetResolver.forVisionTasks(new URL('./vendor/mediapipe/wasm', import.meta.url).href);
  const detector = await FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: new URL('./vendor/mediapipe/face_landmarker.task', import.meta.url).href, delegate: 'CPU' },
    runningMode: 'VIDEO', numFaces: canvases.length,
    minFaceDetectionConfidence: 0.6, minFacePresenceConfidence: 0.6,
    minTrackingConfidence: 0.6,
  });
  const width = 192;
  const height = 224;
  const slots = canvases.map(canvas => {
    canvas.width = width;
    canvas.height = height;
    return { canvas, ctx: canvas.getContext('2d'), center: null, lastSeen: -Infinity };
  });
  let frame = 0;
  let active = false;
  let disposed = false;
  let lastDetection = -Infinity;
  let lastVideoTime = -1;
  let lastStatus = '';

  function hideFace(slot) {
    if (!slot.canvas.hidden) {
      slot.canvas.hidden = true;
      slot.ctx.clearRect(0, 0, width, height);
    }
    slot.center = null;
  }

  function status(value) {
    if (value !== lastStatus) { lastStatus = value; onStatus(value); }
  }
  function render(now) {
    if (!active) return;
    if (video.readyState >= 2 && video.currentTime !== lastVideoTime && now - lastDetection >= 65) {
      lastVideoTime = video.currentTime;
      lastDetection = now;
      try {
        const faces = detector.detectForVideo(video, now).faceLandmarks.flatMap(landmarks => {
          const mapping = createFaceMapping(landmarks, video.videoWidth, video.videoHeight, width, height);
          if (!mapping) return [];
          const left = landmarks[33];
          const right = landmarks[263];
          const center = {
            x: (left.x + right.x) * video.videoWidth / 2,
            y: (left.y + right.y) * video.videoHeight / 2,
          };
          return [{ center, mapping }];
        });
        const assigned = assignFaces(faces, slots);
        slots.forEach((slot, index) => {
          const face = assigned[index];
          if (face) {
            drawMappedFace(slot.ctx, video, face.mapping, width, height);
            slot.canvas.hidden = false;
            slot.center = face.center;
            slot.lastSeen = now;
          } else if (now - slot.lastSeen > 300) {
            hideFace(slot);
          }
        });
        const princeVisible = !canvases[0].hidden;
        const princessVisible = canvases[1] && !canvases[1].hidden;
        if (princessVisible) status(princeVisible ? 'trackingBoth' : 'trackingPrincess');
        else status(princeVisible ? 'tracking' : 'searching');
      } catch {
        slots.forEach(hideFace);
        status('error');
        active = false;
        return;
      }
    }
    frame = requestAnimationFrame(render);
  }
  return {
    start() { if (!active && !disposed) { active = true; frame = requestAnimationFrame(render); } },
    stop() {
      active = false;
      cancelAnimationFrame(frame);
      slots.forEach(hideFace);
      if (!disposed) { disposed = true; detector.close(); }
    },
  };
}

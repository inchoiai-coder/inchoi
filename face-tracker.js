import { createFaceMapping, drawMappedFace } from './face-mapping.mjs';

export async function createFaceTracker(video, canvas, onStatus) {
  const { FilesetResolver, FaceLandmarker } = await import('./vendor/mediapipe/vision_bundle.mjs');
  const fileset = await FilesetResolver.forVisionTasks('/vendor/mediapipe/wasm');
  const detector = await FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: '/vendor/mediapipe/face_landmarker.task', delegate: 'CPU' },
    runningMode: 'VIDEO', numFaces: 1,
    minFaceDetectionConfidence: 0.6, minFacePresenceConfidence: 0.6,
    minTrackingConfidence: 0.6,
  });
  canvas.width = 192;
  canvas.height = 224;
  const ctx = canvas.getContext('2d');
  let frame = 0;
  let active = false;
  let disposed = false;
  let lastDetection = -Infinity;
  let lastVideoTime = -1;
  let lastSeen = -Infinity;
  let lastStatus = '';

  function status(value) {
    if (value !== lastStatus) { lastStatus = value; onStatus(value); }
  }
  function render(now) {
    if (!active) return;
    if (video.readyState >= 2 && video.currentTime !== lastVideoTime && now - lastDetection >= 65) {
      lastVideoTime = video.currentTime;
      lastDetection = now;
      try {
        const landmarks = detector.detectForVideo(video, now).faceLandmarks[0];
        const mapping = createFaceMapping(landmarks, video.videoWidth, video.videoHeight, canvas.width, canvas.height);
        if (mapping) {
          drawMappedFace(ctx, video, mapping, canvas.width, canvas.height);
          canvas.hidden = false;
          lastSeen = now;
          status('tracking');
        } else if (now - lastSeen > 300) {
          canvas.hidden = true;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          status('searching');
        }
      } catch {
        canvas.hidden = true;
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
      canvas.hidden = true;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!disposed) { disposed = true; detector.close(); }
    },
  };
}

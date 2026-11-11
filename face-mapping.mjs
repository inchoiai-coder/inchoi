// MediaPipe's ordered face outline, from forehead around the jaw and back.
// https://github.com/google-ai-edge/mediapipe/blob/v0.10.21/mediapipe/tasks/web/vision/face_landmarker/face_landmarks_connections.ts
export const FACE_OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];

export function createFaceMapping(landmarks, videoWidth, videoHeight, width, height) {
  if (!landmarks || !videoWidth || !videoHeight) return null;
  const indices = [...FACE_OVAL, 33, 263];
  if (indices.some(index => !Number.isFinite(landmarks[index]?.x) || !Number.isFinite(landmarks[index]?.y))) return null;
  const pixel = index => ({ x: landmarks[index].x * videoWidth, y: landmarks[index].y * videoHeight });
  const leftEye = pixel(33);
  const rightEye = pixel(263);
  const distance = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y);
  if (distance < 8) return null;
  const ux = (rightEye.x - leftEye.x) / distance;
  const uy = (rightEye.y - leftEye.y) / distance;
  const outline = FACE_OVAL.map(pixel);
  const projected = outline.map(point => ({ x: point.x * ux + point.y * uy, y: -point.x * uy + point.y * ux }));
  const xs = projected.map(point => point.x);
  const ys = projected.map(point => point.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const rx = (maxX - minX) / 2, ry = (maxY - minY) / 2;
  if (rx < 8 || ry < 8) return null;
  const sourceCenter = { x: cx * ux - cy * uy, y: cx * uy + cy * ux };
  // Stretch each face-outline section onto the prince's oval. The source
  // triangles contain facial pixels only, so the webcam background is excluded.
  const target = projected.map(point => {
    const angle = Math.atan2((point.y - cy) / ry, (point.x - cx) / rx);
    return { x: width / 2 + Math.cos(angle) * width / 2, y: height / 2 + Math.sin(angle) * height / 2 };
  });
  return outline.map((point, index) => ({
    source: [sourceCenter, point, outline[(index + 1) % outline.length]],
    target: [{ x: width / 2, y: height / 2 }, target[index], target[(index + 1) % target.length]],
  }));
}

export function triangleTransform(source, target) {
  const [s0, s1, s2] = source;
  const [t0, t1, t2] = target;
  const x1 = s1.x - s0.x, y1 = s1.y - s0.y;
  const x2 = s2.x - s0.x, y2 = s2.y - s0.y;
  const determinant = x1 * y2 - x2 * y1;
  if (Math.abs(determinant) < 0.001) return null;
  const a = ((t1.x - t0.x) * y2 - (t2.x - t0.x) * y1) / determinant;
  const b = ((t1.y - t0.y) * y2 - (t2.y - t0.y) * y1) / determinant;
  const c = (x1 * (t2.x - t0.x) - x2 * (t1.x - t0.x)) / determinant;
  const d = (x1 * (t2.y - t0.y) - x2 * (t1.y - t0.y)) / determinant;
  return [a, b, c, d, t0.x - a * s0.x - c * s0.y, t0.y - b * s0.x - d * s0.y];
}

export function drawMappedFace(ctx, video, mapping, width, height) {
  ctx.clearRect(0, 0, width, height);
  for (const triangle of mapping) {
    const transform = triangleTransform(triangle.source, triangle.target);
    if (!transform) continue;
    ctx.save();
    ctx.beginPath();
    // Subpixel overlap prevents hairline gaps between neighboring triangles.
    const center = triangle.target.reduce((sum, point) => ({ x: sum.x + point.x / 3, y: sum.y + point.y / 3 }), { x: 0, y: 0 });
    triangle.target.forEach((point, index) => {
      const dx = point.x - center.x, dy = point.y - center.y;
      const distance = Math.hypot(dx, dy) || 1;
      const x = point.x + dx / distance * 0.4, y = point.y + dy / distance * 0.4;
      if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.clip();
    ctx.transform(...transform);
    ctx.drawImage(video, 0, 0);
    ctx.restore();
  }
}

// Accept a closed, roughly round loop in either drawing direction.
export function recognizeCircle(points) {
  for (let start = 0; start <= points.length - 20; start += 3) {
    const loop = points.slice(start);
    const xs = loop.map(point => point.x);
    const ys = loop.map(point => point.y);
    const left = Math.min(...xs);
    const top = Math.min(...ys);
    const width = Math.max(...xs) - left;
    const height = Math.max(...ys) - top;
    if (Math.min(width, height) < 85 || width / height < 0.65 || width / height > 1.55) continue;
    const center = { x: left + width / 2, y: top + height / 2 };
    const radius = (width + height) / 4;
    const first = loop[0];
    const last = loop.at(-1);
    if (Math.hypot(last.x - first.x, last.y - first.y) > radius * 0.42) continue;

    let perimeter = 0;
    let area = 0;
    let sweep = 0;
    let absoluteSweep = 0;
    let radialError = 0;
    for (let i = 0; i < loop.length; i++) {
      const point = loop[i];
      const next = loop[(i + 1) % loop.length];
      perimeter += Math.hypot(next.x - point.x, next.y - point.y);
      area += point.x * next.y - next.x * point.y;
      radialError += (Math.hypot(point.x - center.x, point.y - center.y) / radius - 1) ** 2;
      if (i === loop.length - 1) continue;
      let angle = Math.atan2(next.y - center.y, next.x - center.x) - Math.atan2(point.y - center.y, point.x - center.x);
      angle = Math.atan2(Math.sin(angle), Math.cos(angle));
      sweep += angle;
      absoluteSweep += Math.abs(angle);
    }
    const roundness = 2 * Math.PI * Math.abs(area) / perimeter ** 2;
    if (roundness < 0.81 || Math.sqrt(radialError / loop.length) > 0.22) continue;
    if (Math.abs(sweep) < 5.65 || Math.abs(sweep) > 7 || Math.abs(sweep) / absoluteSweep < 0.85) continue;
    return center;
  }
  return null;
}

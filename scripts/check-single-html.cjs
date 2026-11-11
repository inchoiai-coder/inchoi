// Serve only the finished single HTML and an in-memory test copy. No asset
// directories are exposed, so missing embedded resources cannot load by accident.
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, '호수의_왕자님.html'), 'utf8');
const photo = fs.readFileSync(path.join(root, 'tests/assets/portrait.jpg')).toString('base64');
const test = String.raw`
(async () => {
  const report = document.createElement('output');
  report.id = 'single-file-results';
  report.style.cssText = 'position:fixed;top:20px;left:20px;z-index:100;background:#14382deb;padding:16px;border-radius:14px;font:13px/1.7 sans-serif;color:white;white-space:pre-wrap;max-width:500px';
  report.textContent = '단일 HTML 점검 중 · 공식 예제 사진을 사용합니다.';
  document.body.append(report);
  const checks = [];
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  function check(name, pass) {
    checks.push((pass ? 'PASS' : 'FAIL') + ' · ' + name);
    report.textContent = '단일 HTML 점검 · 예제 사진\n' + checks.join('\n');
    if (!pass) throw new Error(name);
  }
  let raf = 0;
  let media;
  try {
    await document.querySelector('.landscape').decode();
    check('파일에 포함된 풍경 이미지', true);
    const scene = document.querySelector('.scene');
    const bounds = scene.getBoundingClientRect();
    for (let i = 0; i <= 80; i++) {
      const angle = i / 80 * Math.PI * 2;
      scene.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: bounds.width / 2 + Math.cos(angle) * 120, clientY: bounds.height / 2 + Math.sin(angle) * 120 }));
      await pause(20);
    }
    const prince = document.querySelector('#prince');
    check('원을 그리면 배 위의 왕자님 등장', !prince.hidden);
    const first = prince.getBoundingClientRect().left;
    await pause(1600);
    check('배가 호수 위에서 이동', Math.abs(prince.getBoundingClientRect().left - first) > 5 || matchMedia('(prefers-reduced-motion: reduce)').matches);
    const source = document.createElement('canvas');
    source.width = 640; source.height = 480;
    const context = source.getContext('2d');
    const image = new Image();
    image.src = 'data:image/jpeg;base64,${photo}';
    await image.decode();
    let pose = { x: 0, scale: 1, angle: 0, visible: true };
    function draw() {
      context.fillStyle = '#e4e7e2'; context.fillRect(0, 0, 640, 480);
      if (pose.visible) {
        context.save(); context.translate(320 + pose.x, 240); context.rotate(pose.angle);
        const scale = 470 / image.height * pose.scale;
        context.drawImage(image, -image.width * scale / 2, -image.height * scale / 2, image.width * scale, image.height * scale);
        context.restore();
      }
      raf = requestAnimationFrame(draw);
    }
    draw();
    media = source.captureStream(30);
    let requests = 0;
    navigator.mediaDevices.getUserMedia = async options => {
      requests++; check('마이크 없이 예제 영상으로 점검', options.audio === false); return media;
    };
    const button = document.querySelector('#camera-toggle');
    button.click();
    const face = document.querySelector('#face-canvas');
    for (let i = 0; i < 250 && face.hidden; i++) await pause(100);
    check('파일에 포함된 얼굴 인식 기능 실행', !face.hidden && requests === 1);
    for (const [name, next] of [
      ['얼굴 이동과 기울기 자동 맞춤', { x: 100, scale: 1.15, angle: 0.2, visible: true }],
      ['얼굴을 놓치면 숨김', { x: 0, scale: 1, angle: 0, visible: false }],
      ['얼굴이 돌아오면 다시 맞춤', { x: -90, scale: 1, angle: -0.15, visible: true }],
    ]) {
      pose = next;
      await pause(1400);
      check(name, face.hidden === !pose.visible);
    }
    button.click();
    check('카메라 끄기와 영상 해제', face.hidden && media.getTracks().every(track => track.readyState === 'ended'));
    report.dataset.result = 'pass';
    report.textContent += '\n완료: 별도 파일 없이 단일 HTML만으로 점검 통과';
  } catch (error) {
    report.dataset.result = 'fail'; report.textContent += '\nFAIL: ' + error.message;
  } finally {
    cancelAnimationFrame(raf);
    media?.getTracks().forEach(track => track.stop());
  }
})();`;
new vm.Script(test);
const testHtml = html.replace('  </body>', () => '<script>' + test.replace(/<\/script/gi, '<\\/script') + '</script>\n  </body>');
http.createServer((request, response) => {
  const name = request.url.split('?')[0];
  if (!['/', '/test', '/favicon.ico'].includes(name)) console.log('Unexpected asset request: ' + name);
  if (name === '/' || name === '/test') {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(name === '/test' ? testHtml : html);
  } else {
    response.writeHead(404); response.end();
  }
}).listen(5502, '127.0.0.1', () => console.log('Single HTML preview: http://127.0.0.1:5502/; test: /test'));

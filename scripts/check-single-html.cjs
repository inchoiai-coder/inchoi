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
  async function waitForFace(condition) {
    for (let i = 0; i < 40 && !condition(); i++) await pause(100);
    return condition();
  }
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
    const intro = document.querySelector('#intro');
    if (!intro.hidden) document.querySelector('#intro-skip').click();
    await Promise.all(intro.getAnimations().map(animation => animation.finished));
    check('인트로를 건너뛰면 장면을 조작할 수 있음', intro.hidden && !scene.inert);
    const bounds = scene.getBoundingClientRect();
    async function drawCircle() {
      for (let i = 0; i <= 80; i++) {
        const angle = i / 80 * Math.PI * 2;
        scene.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: bounds.width / 2 + Math.cos(angle) * 120, clientY: bounds.height / 2 + Math.sin(angle) * 120 }));
        await pause(20);
      }
    }
    const prince = document.querySelector('#prince');
    const princess = document.querySelector('#princess');
    await drawCircle();
    check('첫 원에는 배 위의 왕자님만 등장', !prince.hidden && princess.hidden);
    await drawCircle();
    check('두 번째 원에는 호숫가의 공주님도 등장', !prince.hidden && !princess.hidden);
    const first = prince.getBoundingClientRect().left;
    await pause(1600);
    check('배가 호수 위에서 이동', Math.abs(prince.getBoundingClientRect().left - first) > 5 || matchMedia('(prefers-reduced-motion: reduce)').matches);
    const source = document.createElement('canvas');
    source.width = 640; source.height = 480;
    const context = source.getContext('2d');
    const image = new Image();
    image.src = 'data:image/jpeg;base64,${photo}';
    await image.decode();
    const grayscale = document.createElement('canvas');
    grayscale.width = 400;
    grayscale.height = 430;
    const grayContext = grayscale.getContext('2d');
    grayContext.filter = 'grayscale(1)';
    grayContext.drawImage(image, 210, 0, 400, 430, 0, 0, 400, 430);
    let pose = { x: 0, scale: 1, angle: 0, visible: true };
    let secondPose;
    function draw() {
      context.fillStyle = '#e4e7e2'; context.fillRect(0, 0, 640, 480);
      for (const person of [pose, secondPose]) {
        if (!person?.visible) continue;
        context.save();
        context.translate(320 + person.x, 240);
        context.rotate(person.angle);
        if (secondPose) {
          if (person === secondPose) context.drawImage(grayscale, -112, -230, 224, 241);
          else context.drawImage(image, 210, 0, 400, 430, -112, -230, 224, 241);
        } else {
          const scale = 470 / image.height * person.scale;
          context.drawImage(image, -image.width * scale / 2, -image.height * scale / 2, image.width * scale, image.height * scale);
        }
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
    const princessFace = document.querySelector('#princess-face-canvas');
    for (let i = 0; i < 250 && face.hidden; i++) await pause(100);
    check('파일에 포함된 얼굴 인식 기능 실행', !face.hidden && requests === 1);
    check('한 얼굴은 왕자님에게만 표시', princessFace.hidden);
    for (const [name, next] of [
      ['얼굴 이동과 기울기 자동 맞춤', { x: 100, scale: 1.15, angle: 0.2, visible: true }],
      ['얼굴을 놓치면 숨김', { x: 0, scale: 1, angle: 0, visible: false }],
      ['얼굴이 돌아오면 다시 맞춤', { x: -90, scale: 1, angle: -0.15, visible: true }],
    ]) {
      pose = next;
      await pause(1400);
      check(name, await waitForFace(() => face.hidden === !pose.visible));
    }
    function colorDifference(canvas) {
      const pixels = canvas.getContext('2d').getImageData(80, 96, 32, 32).data;
      let difference = 0;
      for (let i = 0; i < pixels.length; i += 4) difference += Math.abs(pixels[i] - pixels[i + 2]);
      return difference / (pixels.length / 4);
    }
    secondPose = { x: 150, angle: 0, visible: true };
    for (let i = 0; i < 50 && princessFace.hidden; i++) await pause(100);
    check('두 번째 얼굴을 공주님에게 표시', !face.hidden && !princessFace.hidden && princessFace.getBoundingClientRect().width > 0);
    check('왕자님과 공주님이 서로 다른 영상을 표시', colorDifference(face) > 12 && colorDifference(princessFace) < 2);
    pose.visible = false;
    check('첫 사람이 나가도 공주님 얼굴 유지', await waitForFace(() => face.hidden && !princessFace.hidden && colorDifference(princessFace) < 2));
    pose.visible = true;
    check('첫 사람이 돌아오면 왕자님 얼굴 복귀', await waitForFace(() => !face.hidden && !princessFace.hidden && colorDifference(face) > 12));
    secondPose.visible = false;
    check('두 번째 사람이 나가면 공주님 원래 얼굴 복귀', await waitForFace(() => !face.hidden && princessFace.hidden));
    button.click();
    check('카메라 끄기와 영상 해제', face.hidden && princessFace.hidden && media.getTracks().every(track => track.readyState === 'ended'));
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

import { createFaceTracker } from '/face-tracker.js';

const results = document.querySelector('#results');
const source = document.querySelector('#source');
const ctx = source.getContext('2d');
const video = document.querySelector('#test-video');
let tracker;
let media;
let drawing = 0;
let status = '';
let pose = { x: 0, scale: 1, angle: 0, visible: true };
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

try {
  const page = new DOMParser().parseFromString(await (await fetch('/')).text(), 'text/html');
  const prince = page.querySelector('#prince');
  prince.hidden = false;
  document.querySelector('#test-prince').append(prince);
  const output = prince.querySelector('#face-canvas');
  const image = new Image();
  image.src = '/tests/assets/portrait.jpg';
  await image.decode();
  function draw() {
    ctx.fillStyle = '#e4e7e2';
    ctx.fillRect(0, 0, 640, 480);
    if (pose.visible) {
      ctx.save();
      ctx.translate(320 + pose.x, 240);
      ctx.rotate(pose.angle);
      const scale = 470 / image.height * pose.scale;
      ctx.drawImage(image, -image.width * scale / 2, -image.height * scale / 2, image.width * scale, image.height * scale);
      ctx.restore();
    }
    drawing = requestAnimationFrame(draw);
  }
  draw();
  media = source.captureStream(30);
  video.srcObject = media;
  await video.play();
  tracker = await createFaceTracker(video, output, value => { status = value; });
  tracker.start();
  const stages = [
    ['정면 얼굴 인식', { x: 0, scale: 1, angle: 0, visible: true }, true],
    ['왼쪽으로 이동', { x: -125, scale: 1, angle: 0, visible: true }, true],
    ['오른쪽으로 이동', { x: 125, scale: 1, angle: 0, visible: true }, true],
    ['얼굴 크기 변화', { x: 0, scale: 1.2, angle: 0, visible: true }, true],
    ['얼굴 기울기 변화', { x: 0, scale: 1, angle: 0.22, visible: true }, true],
    ['얼굴이 사라지면 숨김', { x: 0, scale: 1, angle: 0, visible: false }, false],
    ['얼굴이 돌아오면 다시 표시', { x: 0, scale: 1, angle: 0, visible: true }, true],
  ];
  const checks = [];
  for (const [name, nextPose, expected] of stages) {
    pose = nextPose;
    await pause(1200);
    const pixels = output.getContext('2d').getImageData(0, 0, output.width, output.height).data;
    let filled = 0;
    for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 128) filled++;
    const coverage = filled / (output.width * output.height);
    const passed = expected ? !output.hidden && status === 'tracking' && coverage > 0.7 : output.hidden && coverage === 0;
    checks.push(`${passed ? 'PASS' : 'FAIL'} · ${name} (${Math.round(coverage * 100)}%)`);
    results.textContent = checks.join('\n');
    if (!passed) throw new Error(name + ': ' + status);
  }
  results.dataset.result = 'pass';
  results.textContent += '\n완료: 7개 점검 통과. 예제 사진이며 실제 웹캠 연결은 별도 확인합니다.';
} catch (error) {
  results.dataset.result = 'fail';
  results.textContent += '\nFAIL: ' + error.message;
}
window.addEventListener('pagehide', () => {
  cancelAnimationFrame(drawing);
  tracker?.stop();
  media?.getTracks().forEach(track => track.stop());
});

import { recognizeCircle } from './circle.mjs';
import { createFaceTracker } from './face-tracker.js';

const scene = document.querySelector('.scene');
const prince = document.querySelector('#prince');
const gestureStatus = document.querySelector('#gesture-status');
const cameraButton = document.querySelector('#camera-toggle');
const cameraStatus = document.querySelector('#camera-status');
const preview = document.querySelector('#camera-preview');
const previewVideo = document.querySelector('#preview-video');
const faceCanvas = document.querySelector('#face-canvas');
let trail = [];
let lastPointTime = -Infinity;
let lastSummon = -Infinity;
let stream = null;
let faceTracker = null;
let cameraSession = 0;

function showPrince() {
  for (const animation of prince.getAnimations()) animation.cancel();
  prince.hidden = false;
  const size = prince.getBoundingClientRect();
  const bounds = scene.getBoundingClientRect();
  const left = Math.max(16, bounds.width * 0.23 - size.width / 2);
  const right = Math.max(left, Math.min(bounds.width - size.width - 16, bounds.width * 0.8 - size.width / 2));
  const top = Math.max(16, bounds.height * 0.7 - size.height * 0.92);
  prince.style.left = `${left}px`;
  prince.style.top = `${top}px`;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  prince.animate([{ opacity: 0 }, { opacity: 1 }], {
    duration: reduced ? 0 : 600,
    easing: 'ease-out',
  });
  if (!reduced) {
    prince.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${right - left}px)` }], {
      duration: 14000, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out',
    });
  }
  gestureStatus.textContent = stream ? '왕자님이 배를 타고 호수를 산책해요! 내 얼굴도 함께 움직여요.' : '왕자님이 배를 타고 왔다 갔다 해요! ‘내 얼굴 켜기’로 얼굴을 바꿔 보세요.';
}

scene.addEventListener('pointermove', event => {
  if (event.target.closest('.camera-controls, button')) { trail = []; return; }
  const now = performance.now();
  if (now - lastSummon < 1800) return;
  if (now - lastPointTime > 550) trail = [];
  const bounds = scene.getBoundingClientRect();
  const point = { x: event.clientX - bounds.left, y: event.clientY - bounds.top, time: now };
  const previous = trail.at(-1);
  if (previous && Math.hypot(point.x - previous.x, point.y - previous.y) < 6) return;
  lastPointTime = now;
  trail.push(point);
  trail = trail.filter(point => now - point.time < 4500).slice(-400);
  const center = recognizeCircle(trail);
  if (!center) return;
  lastSummon = now;
  trail = [];
  showPrince();
});

scene.addEventListener('pointerleave', () => { trail = []; });
window.addEventListener('blur', () => { trail = []; });
window.addEventListener('resize', () => { trail = []; if (!prince.hidden) showPrince(); });
document.querySelector('#prince-close').addEventListener('click', () => {
  prince.hidden = true;
  for (const animation of prince.getAnimations()) animation.cancel();
  gestureStatus.textContent = '큰 원을 그리면 왕자님이 다시 배를 타고 나타나요.';
});

function stopCamera(message = '카메라를 껐어요. 왕자님은 원래 얼굴로 돌아가요.') {
  cameraSession++;
  faceTracker?.stop();
  faceTracker = null;
  if (stream) for (const track of stream.getTracks()) track.stop();
  stream = null;
  previewVideo.srcObject = null;
  faceCanvas.hidden = true;
  preview.hidden = true;
  cameraButton.textContent = '내 얼굴 켜기';
  cameraButton.setAttribute('aria-pressed', 'false');
  cameraButton.disabled = false;
  cameraStatus.textContent = message;
}

cameraButton.addEventListener('click', async () => {
  if (stream) { stopCamera(); return; }
  if (!navigator.mediaDevices?.getUserMedia) {
    cameraStatus.textContent = '카메라를 사용할 수 없어요. Chrome에서 https로 시작하는 주소로 열어 주세요.';
    return;
  }
  cameraButton.disabled = true;
  const session = ++cameraSession;
  cameraStatus.textContent = 'Chrome에서 카메라 사용을 허용해 주세요.';
  try {
    const acquired = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
    if (session !== cameraSession) {
      for (const track of acquired.getTracks()) track.stop();
      return;
    }
    stream = acquired;
    previewVideo.srcObject = stream;
    await previewVideo.play();
    if (session !== cameraSession) return;
    preview.hidden = false;
    cameraButton.textContent = '내 얼굴 끄기';
    cameraButton.setAttribute('aria-pressed', 'true');
    cameraStatus.textContent = '얼굴 인식을 준비하고 있어요. 처음에는 잠시 걸릴 수 있어요.';
    for (const track of stream.getVideoTracks()) {
      track.addEventListener('ended', () => { if (stream === acquired) stopCamera('카메라 연결이 끊겼어요. 연결한 뒤 다시 켜 주세요.'); }, { once: true });
    }
    const tracker = await createFaceTracker(previewVideo, faceCanvas, status => {
      if (session !== cameraSession) return;
      const messages = {
        tracking: '얼굴을 찾았어요! 움직여도 왕자님 얼굴에 맞춰 따라가요.',
        searching: '얼굴을 찾고 있어요. 밝은 곳에서 카메라를 바라봐 주세요.',
        error: '얼굴 인식이 멈췄어요. 카메라를 껐다가 다시 켜 주세요.',
      };
      cameraStatus.textContent = messages[status];
    });
    if (session !== cameraSession) { tracker.stop(); return; }
    faceTracker = tracker;
    cameraStatus.textContent = '얼굴을 찾고 있어요. 카메라를 바라봐 주세요.';
    faceTracker.start();
  } catch (error) {
    const messages = {
      NotAllowedError: '카메라 사용이 허용되지 않았어요. Chrome의 카메라 허용 여부를 확인해 주세요.',
      NotFoundError: '웹캠을 찾지 못했어요. 웹캠 연결을 확인한 뒤 다시 눌러 주세요.',
      NotReadableError: '웹캠을 열지 못했어요. 카메라를 사용하는 다른 앱을 닫고 다시 눌러 주세요.',
    };
    if (session === cameraSession) stopCamera(messages[error.name] || '얼굴 인식을 준비하지 못했어요. 화면을 새로고침한 뒤 다시 켜 주세요.');
  } finally {
    if (session === cameraSession) cameraButton.disabled = false;
  }
});

window.addEventListener('pagehide', () => stopCamera());

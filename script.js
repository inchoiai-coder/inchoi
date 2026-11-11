const scene = document.querySelector('.scene');
const canvas = document.querySelector('#magic');
const ctx = canvas.getContext('2d');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const colors = ['#ffe8a3', '#baffdf', '#e0caff'];
let particles = [];
let fairies = [];
let pointer = null;
let lastMove = -Infinity;
let lastFairy = -Infinity;
let previousFrame = 0;
let animation = 0;
let width = 0;
let height = 0;

function playIntro() {
  const intro = document.querySelector('#intro');
  const video = document.querySelector('#intro-video');
  const skip = document.querySelector('#intro-skip');
  let waitTimer;
  let leaving = false;

  function finishIntro() {
    if (leaving) return;
    leaving = true;
    clearTimeout(waitTimer);
    video.pause();
    const fade = intro.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: 550,
      easing: 'ease-in-out',
      fill: 'forwards',
    });
    function revealScene() {
      const moveFocus = document.activeElement === skip;
      intro.hidden = true;
      scene.inert = false;
      video.removeAttribute('src');
      video.load();
      if (moveFocus) document.querySelector('#scene-title').focus({ preventScroll: true });
    }
    fade.finished.then(revealScene, revealScene);
  }

  function waitForPlayback() {
    if (leaving) return;
    clearTimeout(waitTimer);
    waitTimer = setTimeout(finishIntro, 8000);
  }

  skip.addEventListener('click', finishIntro);
  video.addEventListener('ended', finishIntro, { once: true });
  video.addEventListener('error', finishIntro, { once: true });
  video.addEventListener('waiting', waitForPlayback);
  video.addEventListener('playing', () => clearTimeout(waitTimer));
  scene.inert = true;
  intro.hidden = false;
  waitForPlayback();
  video.play().catch(finishIntro);
}

if (!reducedMotion) playIntro();

function resize() {
  const bounds = scene.getBoundingClientRect();
  width = bounds.width;
  height = bounds.height;
  const ratio = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  particles = [];
  fairies = [];
  pointer = null;
  lastMove = -Infinity;
}

function glow(x, y, radius, color, opacity) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, 'transparent');
  ctx.globalAlpha = opacity;
  ctx.fillStyle = gradient;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

function drawFairy(fairy, now, opacity) {
  const flutter = reducedMotion ? 0.65 : 0.55 + Math.sin(now * 0.025 + fairy.phase) * 0.3;
  const bob = reducedMotion ? 0 : Math.sin(now * 0.006 + fairy.phase) * 4;
  glow(fairy.x, fairy.y + bob, 42, fairy.color, opacity * 0.24);
  ctx.save();
  ctx.translate(fairy.x, fairy.y + bob);
  ctx.rotate(Math.sin(fairy.phase) * 0.22);
  ctx.scale(fairy.size, fairy.size);
  ctx.globalAlpha = opacity * 0.7;
  ctx.fillStyle = fairy.color;
  ctx.shadowColor = fairy.color;
  ctx.shadowBlur = 12;
  // Four translucent wings, then a head, a dress, arms and legs.
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(side * 9 * flutter, -4, 10 * flutter, 15, side * 0.65, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(side * 7 * flutter, 7, 7 * flutter, 10, -side * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = opacity;
  ctx.fillStyle = '#fff9e5';
  ctx.beginPath();
  ctx.arc(0, -13, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.lineTo(-5, 10);
  ctx.quadraticCurveTo(0, 13, 5, 10);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#fff9e5';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-9, 0); ctx.lineTo(0, -5); ctx.lineTo(10, -9);
  ctx.moveTo(-2, 11); ctx.lineTo(-4, 19);
  ctx.moveTo(2, 11); ctx.lineTo(5, 17);
  ctx.stroke();
  ctx.restore();
}

function render(now) {
  const dt = Math.min((now - previousFrame) / 1000, 0.05);
  previousFrame = now;
  ctx.clearRect(0, 0, width, height);
  ctx.globalCompositeOperation = 'lighter';
  const movement = Math.max(0, 1 - Math.max(0, now - lastMove - 100) / 500);
  if (pointer && movement > 0) {
    glow(pointer.x, pointer.y, 100, '#ffdc87', movement * 0.3);
    glow(pointer.x, pointer.y, 25, '#fff7d4', movement * 0.8);
  }
  particles = particles.filter(particle => now - particle.born < particle.life);
  for (const particle of particles) {
    const age = (now - particle.born) / particle.life;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vy += 10 * dt;
    const opacity = (1 - age) ** 2;
    glow(particle.x, particle.y, particle.size * 5, particle.color, opacity * 0.45);
    ctx.globalAlpha = opacity;
    ctx.fillStyle = particle.color;
    ctx.save();
    ctx.translate(particle.x, particle.y);
    ctx.rotate(particle.spin + age * 3);
    const size = particle.size * (1 - age * 0.6);
    ctx.beginPath();
    ctx.moveTo(0, -size * 2); ctx.lineTo(size * 0.5, -size * 0.5);
    ctx.lineTo(size * 2, 0); ctx.lineTo(size * 0.5, size * 0.5);
    ctx.lineTo(0, size * 2); ctx.lineTo(-size * 0.5, size * 0.5);
    ctx.lineTo(-size * 2, 0); ctx.lineTo(-size * 0.5, -size * 0.5);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  fairies = fairies.filter(fairy => now - fairy.born < fairy.life && movement > 0);
  for (const fairy of fairies) {
    const age = (now - fairy.born) / fairy.life;
    fairy.x += fairy.vx * dt;
    fairy.y -= fairy.speed * dt;
    drawFairy(fairy, now, Math.min(age * 8, 1) * (1 - age) * movement);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  animation = particles.length || fairies.length || movement > 0 ? requestAnimationFrame(render) : 0;
}

scene.addEventListener('pointermove', event => {
  const bounds = scene.getBoundingClientRect();
  const point = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  const distance = pointer ? Math.hypot(point.x - pointer.x, point.y - pointer.y) : 1;
  if (distance < 0.5) return;
  const now = performance.now();
  const count = reducedMotion ? 1 : Math.min(16, Math.max(3, Math.ceil(distance / 6)));
  for (let i = 0; i < count; i++) {
    const fraction = (i + 1) / count;
    const angle = Math.random() * Math.PI * 2;
    const speed = reducedMotion ? 12 : 20 + Math.random() * 65;
    particles.push({
      x: pointer ? pointer.x + (point.x - pointer.x) * fraction : point.x,
      y: pointer ? pointer.y + (point.y - pointer.y) * fraction : point.y,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 15,
      size: 1 + Math.random() * 2, spin: angle, born: now,
      life: 450 + Math.random() * 650, color: colors[Math.floor(Math.random() * colors.length)],
    });
  }
  if (now - lastFairy > (reducedMotion ? 250 : 90)) {
    fairies.push({
      x: point.x + (Math.random() - 0.5) * 70,
      y: point.y + (Math.random() - 0.5) * 50,
      vx: (Math.random() - 0.5) * 35, speed: reducedMotion ? 4 : 20 + Math.random() * 20,
      phase: Math.random() * Math.PI * 2, size: 0.8 + Math.random() * 0.5,
      color: colors[Math.floor(Math.random() * colors.length)], born: now, life: 1400,
    });
    lastFairy = now;
  }
  particles = particles.slice(-300);
  fairies = fairies.slice(-16);
  pointer = point;
  lastMove = now;
  if (!animation) {
    previousFrame = now;
    animation = requestAnimationFrame(render);
  }
});

function stopTrail() { pointer = null; lastMove = -Infinity; }
scene.addEventListener('pointerleave', stopTrail);
window.addEventListener('blur', stopTrail);
document.addEventListener('visibilitychange', () => { if (document.hidden) stopTrail(); });
window.addEventListener('resize', resize);
resize();

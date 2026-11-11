const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const qa = process.argv.includes('--qa');

const files = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
  ['/script.js', ['script.js', 'text/javascript; charset=utf-8']],
  ['/prince.js', ['prince.js', 'text/javascript; charset=utf-8']],
  ['/circle.mjs', ['circle.mjs', 'text/javascript; charset=utf-8']],
  ['/face-tracker.js', ['face-tracker.js', 'text/javascript; charset=utf-8']],
  ['/face-mapping.mjs', ['face-mapping.mjs', 'text/javascript; charset=utf-8']],
  ['/vendor/mediapipe/vision_bundle.mjs', ['vendor/mediapipe/vision_bundle.mjs', 'text/javascript; charset=utf-8']],
  ['/vendor/mediapipe/wasm/vision_wasm_internal.js', ['vendor/mediapipe/wasm/vision_wasm_internal.js', 'text/javascript; charset=utf-8']],
  ['/vendor/mediapipe/wasm/vision_wasm_nosimd_internal.js', ['vendor/mediapipe/wasm/vision_wasm_nosimd_internal.js', 'text/javascript; charset=utf-8']],
  ['/vendor/mediapipe/wasm/vision_wasm_internal.wasm', ['vendor/mediapipe/wasm/vision_wasm_internal.wasm', 'application/wasm']],
  ['/vendor/mediapipe/wasm/vision_wasm_nosimd_internal.wasm', ['vendor/mediapipe/wasm/vision_wasm_nosimd_internal.wasm', 'application/wasm']],
  ['/vendor/mediapipe/face_landmarker.task', ['vendor/mediapipe/face_landmarker.task', 'application/octet-stream']],
  ['/assets/finland-lake.png', ['assets/finland-lake.png', 'image/png']],
]);
if (qa) {
  files.set('/tests/face-browser.html', ['tests/face-browser.html', 'text/html; charset=utf-8']);
  files.set('/tests/face-browser.js', ['tests/face-browser.js', 'text/javascript; charset=utf-8']);
  files.set('/tests/assets/portrait.jpg', ['tests/assets/portrait.jpg', 'image/jpeg']);
}

const server = http.createServer((request, response) => {
  const file = files.get(request.url.split('?')[0]);
  if (!file || !['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(404);
    response.end('Not found');
    return;
  }

  fs.readFile(path.join(__dirname, file[0]), (error, contents) => {
    if (error) {
      response.writeHead(500);
      response.end('Could not load file');
      return;
    }
    response.writeHead(200, {
      'Content-Type': file[1], 'Cache-Control': 'no-cache',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' blob:; media-src 'self' blob:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'",
    });
    response.end(request.method === 'HEAD' ? undefined : contents);
  });
});

server.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
const port = qa ? 5501 : 5500;
server.listen(port, '127.0.0.1', () => console.log(`Local: http://127.0.0.1:${port}`));

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const stripModule = source => source.replace(/^import[^\n]*\n/gm, '').replace(/^export /gm, '');
const inlineScript = source => `<script>\n${source.replace(/<\/script/gi, '<\\/script')}\n</script>`;
function replaceOnce(source, original, replacement) {
  if (!source.includes(original) || source.indexOf(original) !== source.lastIndexOf(original)) {
    throw new Error('Expected exactly one occurrence: ' + original.slice(0, 90));
  }
  return source.replace(original, () => replacement);
}

const assets = {
  'vision-module': 'vendor/mediapipe/vision_bundle.mjs',
  'loader-simd': 'vendor/mediapipe/wasm/vision_wasm_internal.js',
  'wasm-simd': 'vendor/mediapipe/wasm/vision_wasm_internal.wasm',
  'loader-nosimd': 'vendor/mediapipe/wasm/vision_wasm_nosimd_internal.js',
  'wasm-nosimd': 'vendor/mediapipe/wasm/vision_wasm_nosimd_internal.wasm',
  'face-model': 'vendor/mediapipe/face_landmarker.task',
};
const blobs = Object.entries(assets).map(([id, file]) => `<script type="application/octet-stream" id="embedded-${id}">${fs.readFileSync(path.join(root, file)).toString('base64')}</script>`).join('\n');
const helpers = `
const embeddedUrls = new Map();
function embeddedBytes(name) {
  const text = document.getElementById('embedded-' + name).textContent.trim();
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
function embeddedUrl(name, type) {
  if (!embeddedUrls.has(name)) {
    embeddedUrls.set(name, URL.createObjectURL(new Blob([embeddedBytes(name)], { type })));
  }
  return embeddedUrls.get(name);
}
`;
let tracker = stripModule(read('face-tracker.js'));
tracker = replaceOnce(tracker, "await import('./vendor/mediapipe/vision_bundle.mjs')", "await import(embeddedUrl('vision-module', 'text/javascript'))");
tracker = replaceOnce(tracker, "const fileset = await FilesetResolver.forVisionTasks('/vendor/mediapipe/wasm');", `const simd = await FilesetResolver.isSimdSupported();
  const fileset = {
    wasmLoaderPath: embeddedUrl(simd ? 'loader-simd' : 'loader-nosimd', 'text/javascript'),
    wasmBinaryPath: embeddedUrl(simd ? 'wasm-simd' : 'wasm-nosimd', 'application/wasm'),
  };`);
tracker = replaceOnce(tracker, "modelAssetPath: '/vendor/mediapipe/face_landmarker.task'", "modelAssetBuffer: embeddedBytes('face-model')");
let prince = stripModule(read('prince.js'));
prince = prince.replace('Chrome에서 PC 내부 주소로 열어 주세요.', '이 HTML 파일을 Chrome에서 다시 열어 주세요.');
const effectsCode = `(() => {\n${read('script.js')}\n})();`;
const princeCode = `(() => {\n${helpers}\n${stripModule(read('circle.mjs'))}\n${stripModule(read('face-mapping.mjs'))}\n${tracker}\n${prince}\n})();`;
new vm.Script(effectsCode);
new vm.Script(princeCode);

let html = read('index.html');
html = replaceOnce(html, '<link rel="stylesheet" href="/style.css">', `<style>\n${read('style.css')}\n</style>`);
html = replaceOnce(html, '    <script src="/script.js" defer></script>\n', '');
html = replaceOnce(html, '    <script type="module" src="/prince.js"></script>\n', '');
const image = fs.readFileSync(path.join(root, 'assets/finland-lake.png')).toString('base64');
html = replaceOnce(html, 'src="/assets/finland-lake.png"', `src="data:image/png;base64,${image}"`);
const policy = "default-src 'none'; script-src 'unsafe-inline' 'wasm-unsafe-eval' blob:; style-src 'unsafe-inline'; img-src data: blob:; media-src blob:; connect-src blob: data:; worker-src blob:; object-src 'none'";
html = replaceOnce(html, '<meta charset="utf-8">', `<meta charset="utf-8">\n    <meta http-equiv="Content-Security-Policy" content="${policy}">`);
const notice = JSON.stringify({
  library: '@mediapipe/tasks-vision 0.10.21',
  source: JSON.parse(read('vendor/mediapipe/source.json')),
  license: read('vendor/mediapipe/LICENSE'),
}).replace(/</g, '\\u003c');
html = replaceOnce(html, '  </body>', `${blobs}\n<script type="application/json" id="third-party-notices">${notice}</script>\n${inlineScript(effectsCode)}\n${inlineScript(princeCode)}\n  </body>`);
if (/<(?:script|img)\b[^>]*\bsrc=["'](?!data:)/i.test(html) || /<link\b/i.test(html)) {
  throw new Error('An external page asset remains');
}
const output = path.join(root, '호수의_왕자님.html');
fs.writeFileSync(output, html, 'utf8');
console.log(JSON.stringify({ output, bytes: Buffer.byteLength(html), embeddedAssets: Object.keys(assets).length + 1, externalFiles: 0 }));

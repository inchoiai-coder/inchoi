"""Download pinned MediaPipe browser files and model into this project."""
import base64
import hashlib
import io
import json
from pathlib import Path
import tarfile
import urllib.request

root = Path(__file__).resolve().parent.parent
destination = root / 'vendor' / 'mediapipe'
version = '0.10.21'

def download(url):
    with urllib.request.urlopen(url, timeout=90) as response:
        return response.read()

metadata = json.loads(download(f'https://registry.npmjs.org/@mediapipe/tasks-vision/{version}'))
package = download(metadata['dist']['tarball'])
integrity = 'sha512-' + base64.b64encode(hashlib.sha512(package).digest()).decode()
if integrity != metadata['dist']['integrity']:
    raise RuntimeError('Package integrity mismatch')

destination.mkdir(parents=True, exist_ok=True)
written = []
with tarfile.open(fileobj=io.BytesIO(package), mode='r:gz') as archive:
    for member in archive.getmembers():
        name = member.name.removeprefix('package/')
        if not member.isfile():
            continue
        if name != 'vision_bundle.mjs' and name not in ('LICENSE', 'NOTICE') and not (name.startswith('wasm/') and name.endswith(('.js', '.wasm'))):
            continue
        target = (destination / name).resolve()
        if not target.is_relative_to(destination.resolve()):
            raise RuntimeError('Unsafe package path')
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(archive.extractfile(member).read())
        written.append(name)

model_url = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
model = download(model_url)
(destination / 'face_landmarker.task').write_bytes(model)
if not (destination / 'LICENSE').exists():
    (destination / 'LICENSE').write_bytes(download('https://raw.githubusercontent.com/google-ai-edge/mediapipe/v0.10.21/LICENSE'))
(destination / 'source.json').write_text(json.dumps({
    'package': '@mediapipe/tasks-vision', 'version': version,
    'packageUrl': metadata['dist']['tarball'], 'integrity': integrity,
    'modelUrl': model_url, 'modelSha256': hashlib.sha256(model).hexdigest(),
    'documentation': 'https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker?tab=Web',
    'files': written,
}, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'version': version, 'files': written, 'modelBytes': len(model)}, ensure_ascii=True))

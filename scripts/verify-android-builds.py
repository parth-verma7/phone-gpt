#!/usr/bin/env python3
"""Verify/copy matching local Dev and standalone APKs. Requires Android build tools/JDK."""
from pathlib import Path
import argparse
import hashlib
import json
import re
import shutil
import subprocess
import zipfile

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--build-tools', type=Path, required=True)
parser.add_argument('--baseline', type=Path, help='Prior signed standalone APK for update-certificate comparison')
parser.add_argument('--variant', choices=['all', 'release'], default='all', help='Verify both builds by default, or only the standalone release')
args = parser.parse_args()
version = json.loads((root / 'package.json').read_text())['version']
code = re.search(r'versionCode\s+(\d+)', (root / 'android/app/build.gradle').read_text()).group(1)

def signer(path):
    result = subprocess.check_output([str(args.build_tools / 'apksigner'), 'verify', '--print-certs', str(path)], text=True)
    return re.search(r'Signer #1 certificate SHA-256 digest: (\S+)', result).group(1)

# Check the exact local build inputs, including the voice flag/cadence, rather
# than relying solely on UI labels surviving Hermes string compilation.
source_map = json.loads((root / 'android/app/build/intermediates/sourcemaps/react/release/index.android.bundle.packager.map').read_text())
verified_sources = 0
for source, content in zip(source_map['sources'], source_map['sourcesContent']):
    relative = source.lstrip('/')
    if relative == 'App.tsx' or relative.startswith('src/'):
        local = root / relative
        assert local.exists() and content == local.read_text(), f'Stale production build input: {source}'
        verified_sources += 1
assert verified_sources >= 30, 'Expected local application sources in build map'
voice_source = (root / 'src/config/voice.ts').read_text()
assert "= 'live'" in voice_source
readiness = re.search(r'LIVE_TRANSCRIPTION_READINESS_MS\s*=\s*(\d+)', voice_source)
assert readiness and 0 < int(readiness.group(1)) <= 1000, 'Expected bounded ready-audio checks'
voice_readiness_ms = int(readiness.group(1))

web_config = (root / 'src/config/webSearch.ts').read_text()
assert '__DEV__ &&' not in web_config, 'Production search is still Dev-only'
assert 'UNKNOWN_CONTEXT_LIMIT = 32768' in (root / 'src/services/tokenLimits.ts').read_text()
assert 'UNCENSORED_MODELS_ENABLED = false' in (root / 'src/config/features.ts').read_text()

artifacts = []
for variant, suffix, package, label in [('release', 'standalone', 'com.phonegpt.app', 'PhoneGPT'), ('debug', 'development', 'com.phonegpt.app.dev', 'PhoneGPT Dev')]:
    if args.variant == 'release' and variant != 'release':
        continue
    apk = root / f'android/app/build/outputs/apk/{variant}/app-{variant}.apk'
    metadata = subprocess.check_output([str(args.build_tools / 'aapt'), 'dump', 'badging', str(apk)], text=True)
    expected_version = version + ('-dev' if variant == 'debug' else '')
    assert f"name='{package}'" in metadata and f"versionCode='{code}'" in metadata and f"versionName='{expected_version}'" in metadata
    assert f"application-label:'{label}'" in metadata
    assert ('application-debuggable' in metadata) == (variant == 'debug')
    assert "launchable-activity: name='com.phonegpt.app.MainActivity'" in metadata
    with zipfile.ZipFile(apk) as archive:
        assert archive.testzip() is None
        names = archive.namelist()
        dex = b''.join(archive.read(name) for name in names if name.endswith('.dex'))
        for marker in [b'PhoneGptRecorderModule', b'PhoneGptTransferService', b'ResumableModelTransfer', b'PhoneGptDownloadsModule', b'RNWhisper', b'VOICE_SNAPSHOT']:
            assert marker in dex, f'Missing native runtime: {marker!r}'
        for marker in ['rnllama', 'rnwhisper']:
            assert any(name.startswith('lib/arm64-v8a/') and marker in name for name in names)
        assert not any(name.startswith('assets/') and name.endswith(('.gguf', '.safetensors')) for name in names)
        for dpi, density in [(160, 'mdpi'), (240, 'hdpi'), (320, 'xhdpi'), (480, 'xxhdpi'), (640, 'xxxhdpi')]:
            resource = re.search(rf"application-icon-{dpi}:'([^']+)'", metadata).group(1)
            expected = root / f'android/app/src/main/res/mipmap-{density}/ic_launcher.webp'
            assert archive.read(resource) == expected.read_bytes(), f'Packaged logo differs: {variant}/{density}'
        if variant == 'release':
            bundle = archive.read('assets/index.android.bundle')
            assert bundle == (root / 'android/app/build/generated/assets/react/release/index.android.bundle').read_bytes(), 'Packaged bundle differs from build output'
            assert bundle[:8] == bytes.fromhex('c61fbc03c103191f')
            for marker in [f'v{version}'.encode(), b'Stop generating', b'Search your conversations', b'Paused by you', b'No internet', b'Live transcription', b'Delete conversations?', b'@phone-gpt/font-scale', b'@phone-gpt/last-loaded-model', b'Custom tokens', b'Model context limit:', b'loadLlamaModelInfo', b'Theme color', b'@phone-gpt/theme-accent', b'Violet', b'Royal blue', b'qwen-3-5-2b', b'gemma-3-1b-it', b'deepseek-r1-distill-qwen-1-5b', b'https://phone-gpt-search.tensor0712.workers.dev', b'Searching the web', b'https://formspree.io/f/mljjawvn', b'Send message', b'Edit chats', b'Delete selected', b'Back to chats', b'Main navigation', b'Reply only YES or NO']:
                assert marker in bundle, f'Missing embedded feature: {marker!r}'
            assert b'parthvarma271@gmail.com' not in bundle, 'Retired contact email still embedded'
            assert b'Open email app' not in bundle, 'Old contact handoff still embedded'
    manifest = subprocess.check_output([str(args.build_tools / 'aapt'), 'dump', 'xmltree', str(apk), 'AndroidManifest.xml'], text=True)
    assert 'PhoneGptTransferService' in manifest and 'android.permission.FOREGROUND_SERVICE_DATA_SYNC' in manifest
    subprocess.run([str(args.build_tools / 'zipalign'), '-c', '-P', '16', '4', str(apk)], check=True)
    if args.baseline:
        assert signer(apk) == signer(args.baseline), 'APK update signing certificate differs'
    output = root / f'PhoneGPT-v{version}-{suffix}.apk'
    shutil.copy2(apk, output)
    artifacts.append({'variant': suffix, 'path': str(output), 'bytes': output.stat().st_size, 'sha256': hashlib.sha256(output.read_bytes()).hexdigest()})
if len(artifacts) == 2:
    assert signer(Path(artifacts[0]['path'])) == signer(Path(artifacts[1]['path']))
print(json.dumps({'version': version, 'versionCode': int(code), 'verifiedApplicationSources': verified_sources, 'voiceMode': 'live', 'voiceScheduling': 'serial-ready-audio', 'voiceReadinessCheckMs': voice_readiness_ms, 'checks': 'current source-map inputs, packaged build output, identity, signatures, embedded features, native modules, icons, ZIP integrity/alignment', 'artifacts': artifacts}, indent=2))

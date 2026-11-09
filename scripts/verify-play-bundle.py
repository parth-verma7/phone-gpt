#!/usr/bin/env python3
"""Validate a Play AAB and generate a signed test APK without installing it."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--bundletool', type=Path, required=True)
parser.add_argument('--build-tools', type=Path, required=True)
args = parser.parse_args()
version = json.loads((ROOT / 'package.json').read_text())['version']
code = int(re.search(r'versionCode\s+(\d+)', (ROOT / 'android/app/build.gradle').read_text()).group(1))
bundle = ROOT / f'PhoneGPT-v{version}-play.aab'
props_path = Path(os.environ.get('PHONEGPT_UPLOAD_PROPERTIES', str(ROOT.parent / '.phonegpt-tools/signing/phone-gpt-upload-signing.properties')))
# Read only for subprocess credentials; never print these properties.
props = dict(line.split('=', 1) for line in props_path.read_text().splitlines() if '=' in line and not line.startswith('#'))
key_env = {**os.environ, 'PHONEGPT_VERIFY_STORE_PASSWORD': props['storePassword']}

def command(argv, **kwargs):
    return subprocess.run(argv, check=True, text=True, capture_output=True, **kwargs).stdout

bt = ['java', '-jar', str(args.bundletool)]
command(bt + ['validate', f'--bundle={bundle}'])
manifest = command(bt + ['dump', 'manifest', f'--bundle={bundle}', '--module=base'])
assert 'package="com.phonegpt.app"' in manifest
assert f'android:versionName="{version}"' in manifest and f'android:versionCode="{code}"' in manifest
assert 'android:debuggable="true"' not in manifest
assert 'android:targetSdkVersion="36"' in manifest
signature = command(['jarsigner', '-verify', str(bundle)])
assert 'jar verified.' in signature
expected_cert = subprocess.check_output(['keytool', '-exportcert', '-keystore', props['storeFile'], '-alias', props['keyAlias'], '-storepass:env', 'PHONEGPT_VERIFY_STORE_PASSWORD'], env=key_env)
expected_fingerprint = hashlib.sha256(expected_cert).hexdigest()
cert_output = command(['keytool', '-printcert', '-jarfile', str(bundle)])
actual = re.search(r'SHA256:\s*([0-9A-F:]+)', cert_output).group(1).replace(':', '').lower()
assert actual == expected_fingerprint
with zipfile.ZipFile(bundle) as archive:
    assert archive.testzip() is None
    names = archive.namelist()
    assert {p.split('/')[2] for p in names if p.startswith('base/lib/') and p.endswith('.so')} == {'arm64-v8a'}
    assert not any(p.endswith(('.gguf', '.safetensors', '.p12', '.jks', '.keystore')) for p in names)
    packaged = archive.read('base/assets/index.android.bundle')
    assert packaged == (ROOT / 'android/app/build/generated/assets/react/release/index.android.bundle').read_bytes()
    for marker in [f'v{version}'.encode(), b'@phone-gpt/system-prompt-versions-v1', b'Use original default', b'Live transcription', b'Web search limit reached', b'https://phone-gpt.pages.dev/privacy/', b'Read Privacy Policy']:
        assert marker in packaged
    for name in names:
        if not name.endswith('/'):
            assert props['storePassword'].encode() not in archive.read(name), 'Private signing password found in bundle'
source_map = json.loads((ROOT / 'android/app/build/intermediates/sourcemaps/react/release/index.android.bundle.packager.map').read_text())
sources = 0
for source, text in zip(source_map['sources'], source_map['sourcesContent']):
    relative = source.lstrip('/')
    if relative == 'App.tsx' or relative.startswith('src/'):
        assert (ROOT / relative).read_text() == text, f'Stale source: {relative}'
        sources += 1
assert sources >= 30
with tempfile.TemporaryDirectory(prefix='phonegpt-play-check-') as tmp:
    folder = Path(tmp)
    password_file = folder / 'password'
    fd = os.open(password_file, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w') as handle:
        handle.write(props['storePassword'])
    apks = folder / 'test.apks'
    command(bt + ['build-apks', f'--bundle={bundle}', f'--output={apks}', '--mode=universal', f'--ks={props["storeFile"]}', f'--ks-key-alias={props["keyAlias"]}', f'--ks-pass=file:{password_file}', f'--key-pass=file:{password_file}'])
    with zipfile.ZipFile(apks) as archive:
        apk = folder / 'universal.apk'
        apk.write_bytes(archive.read('universal.apk'))
    signer = command([str(args.build_tools / 'apksigner'), 'verify', '--print-certs', str(apk)])
    fingerprint = re.search(r'Signer #1 certificate SHA-256 digest: (\S+)', signer).group(1)
    assert fingerprint == expected_fingerprint
    command([str(args.build_tools / 'zipalign'), '-c', '-P', '16', '4', str(apk)])
print(json.dumps({'bundle': str(bundle), 'version': version, 'versionCode': code, 'bytes': bundle.stat().st_size, 'sha256': hashlib.sha256(bundle.read_bytes()).hexdigest(), 'uploadCertificateSha256': expected_fingerprint, 'verifiedApplicationSources': sources, 'architecture': 'arm64-v8a', 'checks': 'bundletool validation, release manifest, signed AAB/upload certificate, embedded source/features, no model weights/signing credentials, generated universal APK signature and 16 KB ZIP alignment', 'installedOrUploaded': False}, indent=2))

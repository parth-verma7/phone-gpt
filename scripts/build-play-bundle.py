#!/usr/bin/env python3
"""Initialize private upload signing or build an ARM64 Google Play bundle."""
import argparse
import json
import os
from pathlib import Path
import secrets
import shutil
import stat
import subprocess

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PROPERTIES = ROOT.parent / '.phonegpt-tools/signing/phone-gpt-upload-signing.properties'


def private_path(path):
    path = path.expanduser().resolve()
    if path == ROOT or ROOT in path.parents:
        raise SystemExit('Keep upload signing outside the application repository.')
    return path


def initialize(properties):
    folder = properties.parent
    folder.mkdir(mode=0o700, parents=True, exist_ok=True)
    folder.chmod(0o700)
    keystore = folder / 'phone-gpt-upload.p12'
    if properties.exists() or keystore.exists():
        raise SystemExit('Signing material already exists; it has not been changed. Reuse it for future builds.')
    password = secrets.token_urlsafe(48)
    env = {**os.environ, 'PHONEGPT_KEYTOOL_PASSWORD': password}
    subprocess.run([
        'keytool', '-genkeypair', '-noprompt', '-storetype', 'PKCS12',
        '-keystore', str(keystore), '-alias', 'phonegpt-upload',
        '-storepass:env', 'PHONEGPT_KEYTOOL_PASSWORD',
        '-keypass:env', 'PHONEGPT_KEYTOOL_PASSWORD',
        '-keyalg', 'RSA', '-keysize', '3072', '-sigalg', 'SHA256withRSA',
        '-validity', '10000', '-dname', 'CN=PhoneGPT Upload, O=PhoneGPT',
    ], env=env, check=True, capture_output=True)
    keystore.chmod(0o600)
    # Passwords are random, never command-line arguments or console output.
    content = f'storeFile={keystore}\nstorePassword={password}\nkeyAlias=phonegpt-upload\nkeyPassword={password}\n'
    fd = os.open(properties, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w') as handle:
        handle.write(content)
    print(f'Private upload key and credentials created in {folder}. Back up both securely; do not commit or share them.')


def build(properties):
    if not properties.is_file():
        raise SystemExit('No upload signing configured. Run npm run signing:android:play first.')
    if stat.S_IMODE(properties.stat().st_mode) & 0o077:
        raise SystemExit('Signing properties must be owner-only (chmod 600).')
    env = {**os.environ, 'APP_VARIANT': 'production', 'NODE_ENV': 'production', 'PHONEGPT_UPLOAD_PROPERTIES': str(properties)}
    subprocess.run([
        str(ROOT / 'android/gradlew'), '-p', str(ROOT / 'android'), ':app:bundleRelease',
        '-PphoneGptPlaySigning=true', '-PreactNativeArchitectures=arm64-v8a',
        '-PrnllamaVariants=rnllama,rnllama_v8_2', '--console=plain',
    ], cwd=ROOT, env=env, check=True)
    version = json.loads((ROOT / 'package.json').read_text())['version']
    output = ROOT / f'PhoneGPT-v{version}-play.aab'
    shutil.copy2(ROOT / 'android/app/build/outputs/bundle/release/app-release.aab', output)
    print(f'Built {output}. Validate before uploading to a Play test track.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--init-signing', action='store_true')
    args = parser.parse_args()
    properties = private_path(Path(os.environ.get('PHONEGPT_UPLOAD_PROPERTIES', str(DEFAULT_PROPERTIES))))
    if args.init_signing:
        initialize(properties)
    else:
        build(properties)

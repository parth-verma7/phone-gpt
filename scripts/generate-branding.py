#!/usr/bin/env python3
"""Package the supplied PhoneGPT icon at Android resource densities (Pillow)."""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
source = Image.open(root / 'assets-phonegpt-icon.png')
for density, launcher, splash in [('mdpi', 48, 288), ('hdpi', 72, 432), ('xhdpi', 96, 576), ('xxhdpi', 144, 864), ('xxxhdpi', 192, 1152)]:
    directory = root / 'android/app/src/main/res' / f'mipmap-{density}'
    directory.mkdir(parents=True, exist_ok=True)
    icon = source.resize((launcher, launcher), Image.Resampling.LANCZOS)
    for name in ['ic_launcher', 'ic_launcher_round']:
        icon.save(directory / f'{name}.webp', quality=92, method=6)
    directory = root / 'android/app/src/main/res' / f'drawable-{density}'
    directory.mkdir(parents=True, exist_ok=True)
    source.resize((splash, splash), Image.Resampling.LANCZOS).save(directory / 'splashscreen_logo.png', optimize=True)
print('Generated Android launcher and splash resources from assets-phonegpt-icon.png')

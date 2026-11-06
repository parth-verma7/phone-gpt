#!/usr/bin/env python3
"""Check iOS source/configuration wiring. This does NOT compile or sign iOS code."""
import json
import plistlib
import re
from pathlib import Path

root = Path(__file__).resolve().parents[1]
app = json.loads((root / 'app.json').read_text())['expo']
package = json.loads((root / 'package.json').read_text())
info = plistlib.loads((root / 'ios/PhoneGPT/Info.plist').read_bytes())
project = (root / 'ios/PhoneGPT.xcodeproj/project.pbxproj').read_text()
module = json.loads((root / 'modules/phone-gpt-ios/expo-module.config.json').read_text())
assert package['expo']['autolinking']['nativeModulesDir'] == './modules'
assert module['platforms'] == ['apple']
assert set(module['apple']['modules']) == {'PhoneGptRecorderModule', 'PhoneGptDownloadsModule'}
assert 'PhoneGptBackgroundSessionSubscriber' in module['apple']['appDelegateSubscribers']
assert info['NSMicrophoneUsageDescription']
assert info['CFBundleDisplayName'] == '$(PHONEGPT_DISPLAY_NAME)'
assert info['CFBundleShortVersionString'] == app['version']
assert info['CFBundleVersion'] == app['ios']['buildNumber']
for identity in ['com.phonegpt.app.dev', 'com.phonegpt.app', 'PhoneGPT Dev', 'exp+phone-gpt-dev']:
    assert identity in project
llama = next(plugin[1] for plugin in app['plugins'] if isinstance(plugin, list) and plugin[0] == 'llama.rn')
assert llama['enableEntitlements'] is False
assert not plistlib.loads((root / 'ios/PhoneGPT/PhoneGPT.entitlements').read_bytes())
assert '#if DEBUG' in (root / 'ios/PhoneGPT/AppDelegate.swift').read_text()
assert 'Bundle.main.url(forResource: "main", withExtension: "jsbundle")' in (root / 'ios/PhoneGPT/AppDelegate.swift').read_text()
print('PASS: generated iOS identity, permissions, local module registration and embedded-release bundle configuration')
print('NOT CHECKED: CocoaPods, Swift/Objective-C compilation, signing, native runtime or physical iPhone behavior')

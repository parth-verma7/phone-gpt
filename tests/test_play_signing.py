"""Credential lifecycle checks; no real keys, passwords or Gradle execution."""
import importlib.util
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('play_build', Path(__file__).resolve().parents[1] / 'scripts/build-play-bundle.py')
play_build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(play_build)


class PlaySigningTests(unittest.TestCase):
    def test_rejects_credentials_inside_repository(self):
        with self.assertRaises(SystemExit):
            play_build.private_path(play_build.ROOT / 'private.properties')

    def test_existing_key_is_never_overwritten(self):
        with tempfile.TemporaryDirectory() as tmp:
            key = Path(tmp) / 'phone-gpt-upload.p12'
            key.write_bytes(b'existing private key')
            with patch.object(play_build.subprocess, 'run') as run:
                with self.assertRaises(SystemExit):
                    play_build.initialize(Path(tmp) / 'upload.properties')
                run.assert_not_called()
            self.assertEqual(key.read_bytes(), b'existing private key')

    def test_initialization_restricts_files_and_keeps_password_off_command_line(self):
        with tempfile.TemporaryDirectory() as tmp:
            props = Path(tmp) / 'upload.properties'
            def keytool(args, **kwargs):
                Path(args[args.index('-keystore') + 1]).write_bytes(b'fake encrypted key')
                password = kwargs['env']['PHONEGPT_KEYTOOL_PASSWORD']
                self.assertGreater(len(password), 32)
                self.assertNotIn(password, args)
            with patch.object(play_build.subprocess, 'run', side_effect=keytool), patch('builtins.print'):
                play_build.initialize(props)
            self.assertEqual(props.stat().st_mode & 0o777, 0o600)
            self.assertEqual((Path(tmp) / 'phone-gpt-upload.p12').stat().st_mode & 0o777, 0o600)
            self.assertIn('keyAlias=phonegpt-upload', props.read_text())

    def test_missing_credentials_cannot_start_gradle(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(play_build.subprocess, 'run') as run:
            with self.assertRaises(SystemExit):
                play_build.build(Path(tmp) / 'missing.properties')
            run.assert_not_called()

    def test_world_readable_credentials_cannot_start_gradle(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(play_build.subprocess, 'run') as run:
            props = Path(tmp) / 'upload.properties'
            props.write_text('fake=test')
            props.chmod(0o644)
            with self.assertRaises(SystemExit):
                play_build.build(props)
            run.assert_not_called()


if __name__ == '__main__':
    unittest.main()

#!/usr/bin/env python3
"""Inspect an APK without extracting or modifying it. Sizes are decimal MB."""
import argparse
import json
import struct
from collections import defaultdict
from pathlib import Path
from zipfile import ZipFile


def elf_load_alignments(data):
    if data[:4] != b'\x7fELF' or data[4] not in (1, 2) or data[5] not in (1, 2):
        raise ValueError('Unsupported ELF header')
    endian = '<' if data[5] == 1 else '>'
    is64 = data[4] == 2
    offset = struct.unpack_from(endian + ('Q' if is64 else 'I'), data, 32 if is64 else 28)[0]
    entry_size, count = struct.unpack_from(endian + 'HH', data, 54 if is64 else 42)
    alignments = []
    for index in range(count):
        base = offset + index * entry_size
        if struct.unpack_from(endian + 'I', data, base)[0] == 1:
            alignments.append(struct.unpack_from(endian + ('Q' if is64 else 'I'), data, base + (48 if is64 else 28))[0])
    return alignments


def analyze(path):
    groups = defaultdict(lambda: {'raw_bytes': 0, 'apk_entry_bytes': 0})
    libraries, models = [], []
    with ZipFile(path) as archive:
        for item in archive.infolist():
            name = item.filename
            group = 'native' if name.startswith('lib/') else 'dex' if name.endswith('.dex') else 'assets' if name.startswith('assets/') else 'resources_and_metadata'
            groups[group]['raw_bytes'] += item.file_size
            groups[group]['apk_entry_bytes'] += item.compress_size
            if name.startswith('assets/') and name.lower().endswith(('.gguf', '.ggml', '.safetensors', '.bin')):
                models.append(name)
            if name.startswith('lib/') and name.endswith('.so'):
                alignments = elf_load_alignments(archive.read(item))
                libraries.append({'path': name, 'raw_bytes': item.file_size, 'apk_entry_bytes': item.compress_size,
                                  'elf_load_alignments': alignments,
                                  'elf_16kb_alignment_ok': bool(alignments) and all(value >= 16384 and value % 16384 == 0 for value in alignments)})
    return {'artifact': str(path.resolve()), 'file_bytes': path.stat().st_size, 'groups': dict(groups),
            'model_payload_candidates': models, 'libraries': sorted(libraries, key=lambda entry: entry['raw_bytes'], reverse=True),
            'note': 'APK entry sizes are not Play download size or installed storage. ELF alignment alone is not complete 16 KB compatibility validation; also check APK zip alignment and runtime behavior.'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('apk', type=Path)
    args = parser.parse_args()
    print(json.dumps(analyze(args.apk), indent=2))

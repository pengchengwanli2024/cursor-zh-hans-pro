#!/usr/bin/env python3
"""Import unambiguous UI translations from an MIT VS Code language pack.

Reads app message keys only to align an installed build. No app code, profiles,
settings, conversations, or account data are copied into the plugin.
"""
import argparse
import json
import re
from collections import defaultdict
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('app_root', type=Path)
parser.add_argument('language_pack_root', type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
keys = json.loads((args.app_root / 'out/nls.keys.json').read_text())
messages = json.loads((args.app_root / 'out/nls.messages.json').read_text())
translations = json.loads((args.language_pack_root / 'translations/main.i18n.json').read_text())['contents']
assert sum(len(ks) for _, ks in keys) == len(messages)

def normalized(module):
    return module.replace('electron-sandbox', 'electron-browser').replace('.view.contribution', '.contribution').replace('Boot.contribution', '.contribution')

aliases = defaultdict(dict)
for module, values in translations.items():
    aliases[normalized(module)].update(values)
candidates = defaultdict(set)
index = 0
for module, names in keys:
    values = translations.get(module, aliases.get(normalized(module), {}))
    for name in names:
        english, chinese = messages[index], values.get(name)
        index += 1
        if isinstance(chinese, str) and re.search('[\u4e00-\u9fff]', chinese):
            if set(re.findall(r'\{\d+\}', english)) != set(re.findall(r'\{\d+\}', chinese)):
                continue
            candidates[english].add(chinese)
fallback = {key: next(iter(values)) for key, values in candidates.items() if len(values) == 1}
curated = json.loads((root / 'dictionary.json').read_text())
combined = {**fallback, **curated}
(root / 'dictionary.json').write_text(json.dumps(combined, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'unambiguous_language_pack_terms': len(fallback), 'combined_terms': len(combined)}))

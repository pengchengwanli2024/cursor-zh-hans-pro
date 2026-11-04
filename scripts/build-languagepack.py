#!/usr/bin/env python3
"""Build one zh-cn provider from MIT base translations and curated UI phrases."""
import argparse
import copy
import json
import re
import shutil
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('app_root', type=Path)
parser.add_argument('language_pack_root', type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
dictionary = json.loads((root / 'dictionary.json').read_text())
source_package = json.loads((args.language_pack_root / 'package.json').read_text())
product = json.loads((args.app_root / 'product.json').read_text())
keys = json.loads((args.app_root / 'out/nls.keys.json').read_text())
messages = json.loads((args.app_root / 'out/nls.messages.json').read_text())
assert sum(len(k) for _, k in keys) == len(messages)
shutil.copytree(args.language_pack_root / 'translations', root / 'translations', dirs_exist_ok=True)
main_file = root / 'translations/main.i18n.json'
data = json.loads(main_file.read_text())
contents = data['contents']
original_contents = copy.deepcopy(contents)
def normalize(module):
    return module.replace('electron-sandbox', 'electron-browser').replace('.view.contribution', '.contribution').replace('Boot.contribution', '.contribution')
aliases = {normalize(module): values for module, values in original_contents.items()}
index = translated = glass_total = glass_registered = 0
for module, names in keys:
    original = original_contents.get(module, aliases.get(normalize(module), {}))
    target = contents.setdefault(module, {})
    for name in names:
        english = messages[index]
        index += 1
        chinese = original.get(name) or dictionary.get(english)
        if chinese and set(re.findall(r'\{\d+\}', english)) == set(re.findall(r'\{\d+\}', chinese)):
            target[name] = chinese
            translated += 1
            if module.startswith('vs/glass'): glass_registered += 1
        if module.startswith('vs/glass'): glass_total += 1
main_file.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n')
package_file = root / 'package.json'
package = json.loads(package_file.read_text())
package.pop('extensionDependencies', None)
package['contributes']['localizations'] = source_package['contributes']['localizations']
for entry in package['contributes']['localizations'][0]['translations']:
    assert (root / entry['path']).is_file(), entry['path']
package_file.write_text(json.dumps(package, ensure_ascii=False, indent=2) + '\n')
report = {'schema':'cursor-localization-build-v1','cursorVersion':product['version'],'baseLanguagePackVersion':source_package['version'],'currentNlsEntries':len(messages),'registeredNlsEntries':translated,'glassNlsEntries':glass_total,'registeredGlassNlsEntries':glass_registered,'dictionaryTerms':len(dictionary)}
(root / 'localization-build.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report))

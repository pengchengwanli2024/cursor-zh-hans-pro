#!/usr/bin/env python3
"""Build a dependency-free local VSIX from the reviewed extension source."""
from pathlib import Path
import json
import zipfile
import xml.etree.ElementTree as ET

root = Path(__file__).resolve().parents[1]
package = json.loads((root / 'package.json').read_text())
namespace = 'http://schemas.microsoft.com/developer/vsx-schema/2011'
ET.register_namespace('', namespace)
def child(parent, tag, attrs=None, text=None):
    element = ET.SubElement(parent, '{' + namespace + '}' + tag, attrs or {})
    element.text = text
    return element

manifest = ET.Element('{' + namespace + '}PackageManifest', {'Version': '2.0.0'})
metadata = child(manifest, 'Metadata')
child(metadata, 'Identity', {'Language': 'en-US', 'Id': package['name'], 'Version': package['version'], 'Publisher': package['publisher']})
child(metadata, 'DisplayName', text=package['displayName'])
child(metadata, 'Description', text=package['description'])
child(metadata, 'Categories', text='Other')
properties = child(metadata, 'Properties')
for key, value in {'Engine': package['engines']['vscode'], 'ExtensionKind': 'ui', 'LocalizedLanguages':'Chinese (Simplified)'}.items():
    child(properties, 'Property', {'Id': 'Microsoft.VisualStudio.Code.' + key, 'Value': value})
child(metadata, 'License', text='extension/LICENSE')
child(child(manifest, 'Installation'), 'InstallationTarget', {'Id': 'Microsoft.VisualStudio.Code'})
child(manifest, 'Dependencies')
assets = child(manifest, 'Assets')
for kind, file in [('Microsoft.VisualStudio.Code.Manifest', 'package.json'), ('Microsoft.VisualStudio.Services.Content.Details', 'README.md'), ('Microsoft.VisualStudio.Services.Content.License', 'LICENSE')]:
    child(assets, 'Asset', {'Type': kind, 'Path': 'extension/' + file, 'Addressable': 'true'})

output = root / 'releases' / (package['name'] + '-' + package['version'] + '.vsix')
output.parent.mkdir(exist_ok=True)
content_types = '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="json" ContentType="application/json"/><Default Extension="js" ContentType="application/javascript"/><Default Extension="md" ContentType="text/markdown"/><Default Extension="vsixmanifest" ContentType="text/xml"/></Types>'
with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
    archive.writestr('extension.vsixmanifest', ET.tostring(manifest, encoding='utf-8', xml_declaration=True))
    archive.writestr('[Content_Types].xml', content_types)
    for name in ['package.json', 'engine.js', 'extension.js', 'runtime.js', 'dictionary.json', 'README.md', 'LICENSE', 'THIRD-PARTY-NOTICES.md','localization-build.json']:
        archive.write(root / name, 'extension/' + name)
    for directory in ['translations','LICENSES']:
        for file in sorted((root / directory).rglob('*')):
            if file.is_file(): archive.write(file,'extension/'+str(file.relative_to(root)))
print(output.name, output.stat().st_size)

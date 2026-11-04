'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const pack=require('../package.json');
const dictionary=require('../dictionary.json');
const contents=require('../translations/main.i18n.json').contents;

test('the single zh-cn provider includes every declared base extension translation file',()=>{
  assert.equal(pack.contributes.localizations.length,1);
  assert.equal(pack.contributes.localizations[0].languageId,'zh-cn');
  assert.ok(!pack.extensionDependencies?.includes('ms-ceintl.vscode-language-pack-zh-hans'));
  for(const entry of pack.contributes.localizations[0].translations)assert.ok(fs.existsSync(path.join(__dirname,'..',entry.path)),entry.id);
});

test('native Glass translations cover representative project, permission, goal and archive actions',()=>{
  const all=Object.assign({},...Object.entries(contents).filter(([name])=>name.startsWith('vs/glass')).map(([,entries])=>entries));
  assert.equal(all['glass.goalTray.pause'],'暂停目标');
  assert.equal(all['glass.agentPanel.appSecretsPill.secretMissing'],'缺少密钥');
  assert.equal(all['glassArchiveRunningAgentsTitle'],'归档 {0} 个正在运行的智能体？');
  assert.equal(all['glass.allowedMachines.addFolder.dialogTitle'],'为此项目选择文件夹');
});

test('curated translations preserve numbered placeholders and intentional brand names',()=>{
  for(const [en,zh]of Object.entries(dictionary)) {
    const a=[...new Set(en.match(/\{\d+\}/g)||[])].sort();
    const b=[...new Set(zh.match(/\{\d+\}/g)||[])].sort();
    assert.deepEqual(b,a,en);
  }
  for(const brand of ['Cursor','IDE','SSH','WSL','GitHub','HTTP/2'])assert.equal(dictionary[brand],brand);
});

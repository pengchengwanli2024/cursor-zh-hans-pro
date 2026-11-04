'use strict';
// Inspect only app-authored UI literals. Account names, project names and messages
// never enter the report. Requires the user's explicitly enabled local CDP endpoint.
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require(process.env.CURSOR_ZH_PLAYWRIGHT || 'playwright');
const dictionary = require('../dictionary.json');

function literals(appRoot) {
  const values = new Set([...Object.keys(dictionary), ...Object.values(dictionary)]);
  for (const value of JSON.parse(fs.readFileSync(path.join(appRoot,'out/nls.messages.json'),'utf8'))) values.add(value);
  for (const name of ['workbench.glass.main.js', 'workbench.desktop.main.js','workbench.anysphere-ui-automations.js','workbench.xai-commerce-prepaid.js']) {
    const source = fs.readFileSync(path.join(appRoot, 'out/vs/workbench', name), 'utf8');
    for (const match of source.matchAll(/"(?:[^"\\]|\\.)*"/g)) {
      if (match[0].length > 1200) continue;
      try {
        const value = JSON.parse(match[0]);
        if (value.length > 1 && value.length < 600) values.add(value);
      } catch {}
    }
  }
  return [...values];
}

async function inspect(page, allowed) {
  return page.evaluate(allowedValues => {
    const allowed = new Set(allowedValues);
    const skip = 'script,style,code,pre,textarea,input,[contenteditable=true],.monaco-editor,.xterm,.ui-markdown,.markdown-body,.composer-human-message-content,.human-message-inline-body';
    const english = new Set(), attributes = new Set(), navigation = new Set(), preserved = new Set();
    const technical = new Set(['IDE','Cursor','main','GitHub','Git','SSH','WSL','HTTP/2','Ara','Pro+','Ultra','px','return','const','result']);
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const text = node.nodeValue.trim(), parent = node.parentElement;
      if (!allowed.has(text) || !parent || parent.closest(skip) || !parent.checkVisibility()) continue;
      if (parent.closest('nav') && text.length < 70) navigation.add(text);
      if (/^[A-Za-z]/.test(text) && !/[\u4e00-\u9fff]/.test(text)) (technical.has(text)?preserved:english).add(text);
    }
    for (const el of document.querySelectorAll('[title],[aria-label],[placeholder]')) {
      if (!el.checkVisibility() || el.closest(skip)) continue;
      for (const key of ['title','aria-label','placeholder']) {
        const value = (el.getAttribute(key) || '').trim();
        if (allowed.has(value) && /^[A-Za-z]/.test(value) && !/[\u4e00-\u9fff]/.test(value)) (technical.has(value)?preserved:attributes).add(value);
      }
    }
    return {navigation:[...navigation], english:[...english], attributes:[...attributes], preservedEnglish:[...preserved], revision:window.__cursorZhRevision || null};
  }, allowed);
}

async function main() {
  const appRoot=process.argv[2], endpoint=process.env.CURSOR_CDP_ENDPOINT;
  if (!appRoot || !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(endpoint || '')) throw Error('Supply APP_ROOT and loopback CURSOR_CDP_ENDPOINT.');
  const allowed=literals(appRoot);
  const browser=await chromium.connectOverCDP(endpoint);
  try {
    const page=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().includes('/workbench/workbench.html'));
    if (!page) throw Error('No Cursor workbench found.');
    if (process.argv.includes('--open-settings')) {
      const close=page.getByRole('button',{name:/^(Close Settings|关闭设置)$/});
      if (await close.count()===0) await page.getByRole('button',{name:/^(设置|Settings)$/}).click();
      await close.waitFor();
    }
    await page.waitForTimeout(250);
    const initial=await inspect(page,allowed);
    if (process.argv.includes('--all-customize')) {
      const customize=page.getByText('自定义',{exact:true});
      if(await customize.count()!==1)throw Error('Open the Agents window before auditing Customize.');
      await customize.click();await page.waitForTimeout(200);
      const results=[];
      for(const label of ['插件','MCP 外部工具服务','技能','子智能体','规则','命令','钩子']) {
        const target=page.getByRole('button',{name:label,exact:true});
        if(await target.count()!==1)throw Error('Unrecognized Customize navigation: '+label);
        await target.click();await page.waitForTimeout(220);
        const result=await inspect(page,allowed);
        results.push({page:label,english:result.english,attributes:result.attributes,preservedEnglish:result.preservedEnglish});
      }
      console.log(JSON.stringify(results,null,2));
    } else if (process.argv.includes('--all-settings')) {
      const results=[];
      const categories=new Set(['通用','外观','套餐与用量','智能体','云端智能体','模型','语音','源代码管理','浏览器与网络','代码智能','测试功能']);
      for(const label of initial.navigation.filter(x=>categories.has(x))) {
        const target=page.locator('nav').getByText(label,{exact:true}).first();
        await target.click();
        await page.waitForTimeout(220);
        const result=await inspect(page,allowed);
        results.push({page:label,english:result.english,attributes:result.attributes,preservedEnglish:result.preservedEnglish});
      }
      console.log(JSON.stringify(results,null,2));
    } else console.log(JSON.stringify(initial,null,2));
  } finally {await browser.close();}
}
module.exports={literals,inspect};
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});

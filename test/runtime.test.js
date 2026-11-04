'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.CURSOR_ZH_PLAYWRIGHT || 'playwright');
const install=require('../runtime');
const dictionary=require('../dictionary.json');

test('real Chromium translates UI and dynamic changes while preserving code, terminal, input values and conversation text',async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.CURSOR_ZH_BROWSER_CHANNEL?{channel:process.env.CURSOR_ZH_BROWSER_CHANNEL}:{})});
  try {
    const page=await browser.newPage();
    await page.setContent(`<button id="ui">New Agent</button><span id="settings">Manage Account</span><div class="monaco-editor"><span id="code">New Agent</span></div><div class="xterm"><span id="terminal">New Agent</span></div><div class="markdown-body"><p id="chat">Manage Account</p></div><div id="editable" contenteditable="true">New Agent</div><input id="input" value="New Agent" placeholder="New Agent"><span id="title" title="Manage Account"></span><div id="dynamic"></div>`);
    await page.locator('body').evaluate(body=>body.insertAdjacentHTML('beforeend','<div class="composer-human-message-content" id="cursor-human">New Agent</div><div class="ui-markdown" id="cursor-answer">Manage Account</div>'));
    await page.evaluate(`(${install.toString()})(${JSON.stringify(dictionary)},"browser-test")`);
    assert.equal(await page.locator('#ui').textContent(),'新建智能体');
    assert.equal(await page.locator('#settings').textContent(),dictionary['Manage Account']);
    for(const id of ['code','terminal','editable']) assert.equal(await page.locator('#'+id).textContent(),'New Agent');
    assert.equal(await page.locator('#chat').textContent(),'Manage Account');
    assert.equal(await page.locator('#cursor-human').textContent(),'New Agent');
    assert.equal(await page.locator('#cursor-answer').textContent(),'Manage Account');
    assert.equal(await page.locator('#input').inputValue(),'New Agent');
    assert.equal(await page.locator('#input').getAttribute('placeholder'),'新建智能体');
    assert.equal(await page.locator('#title').getAttribute('title'),dictionary['Manage Account']);
    await page.evaluate(()=>{
      document.querySelector('#dynamic').innerHTML='<button id="added">Customize</button>';
      document.querySelector('#ui').firstChild.nodeValue='Open IDE';
      document.querySelector('#title').setAttribute('title','New Agent');
    });
    await page.waitForFunction(()=>document.querySelector('#added').textContent==='自定义' && document.querySelector('#ui').textContent==='打开编辑器' && document.querySelector('#title').title==='新建智能体');
    assert.equal(await page.locator('#input').inputValue(),'New Agent');
  } finally {await browser.close();}
});

test('normalizes punctuation and whitespace, substitutes UI parameters, and preserves links and inline commands',async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.CURSOR_ZH_BROWSER_CHANNEL?{channel:process.env.CURSOR_ZH_BROWSER_CHANNEL}:{})});
  try {
    const page=await browser.newPage();
    await page.setContent('<p id="words"><span>New</span> <span>Chat</span></p><button id="count">View subscriptions (12)</button><span id="punct">Loading environments...</span><span id="spaces">New  Chat</span><p id="rich"><span>Use </span><code>/add-plugin</code><span> to install a plugin from the </span><a href="#market">Cursor Marketplace</a></p><div class="ui-markdown" id="answer">View subscriptions (12)</div><span id="brand">Cursor</span>');
    await page.locator('#rich a').evaluate(e=>{e.addEventListener('click',event=>{event.preventDefault();window.linkClicked=true;});});
    await page.evaluate(`(${install.toString()})(${JSON.stringify(dictionary)},"richtext-test")`);
    assert.equal(await page.locator('#words').textContent(),'新建对话');
    assert.equal(await page.locator('#count').textContent(),'查看订阅（12）');
    assert.equal(await page.locator('#punct').textContent(),'正在加载环境…');
    assert.equal(await page.locator('#spaces').textContent(),'新建对话');
    assert.equal(await page.locator('#rich code').textContent(),'/add-plugin');
    assert.equal(await page.locator('#rich').textContent(),'使用 /add-plugin 从 Cursor 插件市场安装插件');
    await page.locator('#rich a').click();
    assert.equal(await page.evaluate(()=>window.linkClicked),true);
    assert.equal(await page.locator('#answer').textContent(),'View subscriptions (12)');
    assert.equal(await page.locator('#brand').textContent(),'Cursor');
  } finally {await browser.close();}
});

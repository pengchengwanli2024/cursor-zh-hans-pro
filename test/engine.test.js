'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const engine = require('../engine');
const digest = text => crypto.createHash('sha256').update(text).digest('base64').replace(/=+$/, '');

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cursor-zh-test-'));
  t.after(() => fs.rmSync(dir, {recursive:true, force:true}));
  const root = path.join(dir, 'app');
  const state = path.join(dir, 'state');
  const loader = path.join(root, engine.REL);
  fs.mkdirSync(path.dirname(loader), {recursive:true});
  const productFile = path.join(root, 'product.json');
  function version(number) {
    const original = `// Cursor build ${number}\nvoid "workbench.desktop.main"; void "workbench.glass.main";\n`;
    fs.writeFileSync(loader, original);
    fs.writeFileSync(productFile, JSON.stringify({nameShort:'Cursor',version:`3.${number}.0`,commit:`commit-${number}`,checksums:{[engine.REL.slice(4)]:digest(original),'unrelated.js':'unchanged'},unrelated:{keep:true}}));
    return original;
  }
  const original = version(28);
  return {root,state,loader,productFile,version,original};
}

test('applies to the current build, preserves original bytes, keeps unrelated product metadata, and is idempotent', t => {
  const f = fixture(t);
  assert.equal(engine.apply(f.root,f.state).status,'applied');
  assert.equal(engine.inspect(f.root).current,true);
  const bytes = fs.readFileSync(f.loader);
  const mtime = fs.statSync(f.loader).mtimeMs;
  assert.equal(engine.apply(f.root,f.state).status,'unchanged');
  assert.deepEqual(fs.readFileSync(f.loader),bytes);
  assert.equal(fs.statSync(f.loader).mtimeMs,mtime);
  const product = JSON.parse(fs.readFileSync(f.productFile));
  assert.deepEqual(product.unrelated,{keep:true});
  assert.equal(product.checksums['unrelated.js'],'unchanged');
  assert.equal(engine.strip(bytes.toString()),f.original);
});

test('an official upgrade gets its own backup and never receives old application code', t => {
  const f = fixture(t);
  engine.apply(f.root,f.state);
  const upgraded = f.version(29);
  assert.equal(engine.inspect(f.root).current,false);
  engine.apply(f.root,f.state);
  const current = fs.readFileSync(f.loader,'utf8');
  assert.equal(engine.strip(current),upgraded);
  assert.ok(!current.includes('build 28'));
  assert.equal(fs.readdirSync(path.join(f.state,'versions')).length,2);
  engine.restore(f.root,f.state);
  assert.equal(fs.readFileSync(f.loader,'utf8'),upgraded);
});

test('restoring after an upgrade that removed the patch leaves the new build untouched', t => {
  const f = fixture(t);
  engine.apply(f.root,f.state);
  const upgraded=f.version(30);
  assert.equal(engine.restore(f.root,f.state).status,'unchanged');
  assert.equal(fs.readFileSync(f.loader,'utf8'),upgraded);
});

test('refuses unsupported startup layouts without modifying files', t => {
  const f = fixture(t);
  fs.writeFileSync(f.loader,'new incompatible loader');
  assert.throws(() => engine.apply(f.root,f.state),/尚未适配/);
  assert.equal(fs.readFileSync(f.loader,'utf8'),'new incompatible loader');
});

test('repairs an incomplete translation payload or an out-of-date resource checksum', t => {
  const f=fixture(t);
  engine.apply(f.root,f.state);
  fs.writeFileSync(f.loader,fs.readFileSync(f.loader,'utf8').replace('function installTranslator','function brokenTranslator'));
  assert.equal(engine.inspect(f.root).current,false);
  engine.apply(f.root,f.state);
  assert.equal(engine.inspect(f.root).current,true);
  const product=JSON.parse(fs.readFileSync(f.productFile));
  product.checksums[engine.REL.slice(4)]='old-checksum';
  fs.writeFileSync(f.productFile,JSON.stringify(product));
  assert.equal(engine.inspect(f.root).current,false);
  engine.apply(f.root,f.state);
  assert.equal(engine.inspect(f.root).current,true);
});

test('a second extension host cannot write while another host owns the lock', t => {
  const f=fixture(t);
  fs.mkdirSync(path.join(f.state,'patch.lock'),{recursive:true});
  fs.writeFileSync(path.join(f.state,'patch.lock','owner.json'),JSON.stringify({pid:process.pid}));
  assert.equal(engine.apply(f.root,f.state).status,'busy');
  assert.equal(fs.readFileSync(f.loader,'utf8'),f.original);
});

test('an interrupted marker is rejected instead of silently losing application bytes', t => {
  const f=fixture(t);
  fs.appendFileSync(f.loader,'\n;/* CURSOR_ZH_AUTO_BEGIN */\nbroken');
  const before=fs.readFileSync(f.loader);
  assert.throws(()=>engine.apply(f.root,f.state),/标记不完整/);
  assert.deepEqual(fs.readFileSync(f.loader),before);
});

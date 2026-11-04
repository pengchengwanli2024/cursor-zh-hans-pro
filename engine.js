'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const installTranslator = require('./runtime');
const dictionary = require('./dictionary.json');
const REL = 'out/vs/code/electron-sandbox/workbench/workbench.js';
const CHECKSUM_KEY = REL.slice(4);
const BEGIN = '\n;/* CURSOR_ZH_AUTO_BEGIN */\n';
const END = '\n/* CURSOR_ZH_AUTO_END */\n';
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const revision = hash(installTranslator.toString() + JSON.stringify(dictionary));

function strip(source) {
  const first = source.indexOf(BEGIN);
  if (first === -1) {
    if (source.includes(END)) throw new Error('汉化资源标记不完整，请恢复或重新安装 Cursor。');
    return source;
  }
  const last = source.indexOf(END, first);
  if (last === -1 || source.indexOf(BEGIN, first + BEGIN.length) !== -1) throw new Error('汉化资源标记不完整，请先检查备份。');
  return source.slice(0, first) + source.slice(last + END.length);
}

function readApp(appRoot) {
  const productPath = path.join(appRoot, 'product.json');
  const productBytes = fs.readFileSync(productPath);
  const product = JSON.parse(productBytes);
  if (product.nameShort !== 'Cursor' || !product.version || !product.commit) throw new Error('目标不是可识别的 Cursor 安装。');
  const target = path.join(appRoot, REL);
  const source = fs.readFileSync(target, 'utf8');
  const original = strip(source);
  if (!original.includes('workbench.desktop.main') || !original.includes('workbench.glass.main')) throw new Error('当前 Cursor 启动结构尚未适配，已停止修改；需要更新汉化插件。');
  return {appRoot, productPath, productBytes, product, target, source, original};
}

function inspect(appRoot) {
  const app = readApp(appRoot);
  const expected = patch(app.original);
  const expectedChecksum = crypto.createHash('sha256').update(expected).digest('base64').replace(/=+$/, '');
  const checksumOkay = !app.product.checksums || !Object.hasOwn(app.product.checksums, CHECKSUM_KEY) || app.product.checksums[CHECKSUM_KEY] === expectedChecksum;
  return {version:app.product.version, commit:app.product.commit, installed:app.source.includes(BEGIN), current:app.source === expected && checksumOkay, revision, terms:Object.keys(dictionary).length};
}

function patch(original) {
  return original + BEGIN + '// revision: ' + revision + '\n;(' + installTranslator.toString() + ')(' + JSON.stringify(dictionary) + ',' + JSON.stringify(revision) + ');' + END;
}

function atomic(file, bytes) {
  const temp = file + '.cursor-zh-' + process.pid + '-' + crypto.randomBytes(4).toString('hex');
  let mode = 0o600;
  try { mode = fs.statSync(file).mode & 0o777; } catch (e) { if (e.code !== 'ENOENT') throw e; }
  try { fs.writeFileSync(temp, bytes, {mode}); fs.renameSync(temp, file); }
  finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
}

function lock(stateDir, action) {
  fs.mkdirSync(stateDir, {recursive:true, mode:0o700});
  const dir = path.join(stateDir, 'patch.lock');
  try { fs.mkdirSync(dir); }
  catch (e) {
    if (e.code !== 'EEXIST') throw e;
    const ownerPath = path.join(dir, 'owner.json');
    let owner;
    try { owner = JSON.parse(fs.readFileSync(ownerPath)); } catch { return {status:'busy'}; }
    try { process.kill(owner.pid, 0); return {status:'busy'}; }
    catch (probe) { if (probe.code !== 'ESRCH') return {status:'busy'}; }
    fs.rmSync(dir, {recursive:true});
    fs.mkdirSync(dir);
  }
  try {
    fs.writeFileSync(path.join(dir, 'owner.json'), JSON.stringify({pid:process.pid}));
    return action();
  } finally { fs.rmSync(dir, {recursive:true, force:true}); }
}

function checksum(product, source) {
  if (product.checksums && Object.hasOwn(product.checksums, CHECKSUM_KEY)) product.checksums[CHECKSUM_KEY] = crypto.createHash('sha256').update(source).digest('base64').replace(/=+$/, '');
  return JSON.stringify(product, null, '\t');
}

function apply(appRoot, stateDir) {
  return lock(stateDir, () => {
    const app = readApp(appRoot);
    if (inspect(appRoot).current) return {status:'unchanged', ...inspect(appRoot)};
    const identity = hash(fs.realpathSync(appRoot) + '\n' + app.product.version + '\n' + app.product.commit + '\n' + hash(app.original));
    const backup = path.join(stateDir, 'versions', identity);
    fs.mkdirSync(backup, {recursive:true, mode:0o700});
    const originalFile = path.join(backup, 'workbench.original.js');
    if (fs.existsSync(originalFile)) {
      if (hash(fs.readFileSync(originalFile)) !== hash(app.original)) throw new Error('此版本备份校验失败，已停止修改。');
    } else fs.writeFileSync(originalFile, app.original, {flag:'wx', mode:0o600});
    const patched = patch(app.original);
    const manifest = {schema:1, version:app.product.version, commit:app.product.commit, originalSha256:hash(app.original), patchedSha256:hash(patched), revision, target:REL};
    atomic(path.join(backup, 'manifest.json'), JSON.stringify(manifest, null, 2));
    try {
      atomic(app.target, patched);
      atomic(app.productPath, checksum(app.product, patched));
      atomic(path.join(stateDir, 'current.json'), JSON.stringify(manifest, null, 2));
    } catch (error) {
      atomic(app.target, app.source);
      atomic(app.productPath, app.productBytes);
      throw error;
    }
    return {status:'applied', ...inspect(appRoot)};
  });
}

function restore(appRoot, stateDir) {
  return lock(stateDir, () => {
    const app = readApp(appRoot);
    if (app.source === app.original) return {status:'unchanged'};
    // Remove only our own appended block from CURRENT bytes. Never copy an older version over an upgrade.
    try {
      atomic(app.target, app.original);
      atomic(app.productPath, checksum(app.product, app.original));
    } catch (error) {
      atomic(app.target, app.source);
      atomic(app.productPath, app.productBytes);
      throw error;
    }
    return {status:'restored', version:app.product.version};
  });
}

module.exports = {apply, restore, inspect, strip, revision, REL};

if (require.main === module) {
  const [action, appRoot, stateDir] = process.argv.slice(2);
  try {
    if (!['apply','restore','inspect'].includes(action) || !appRoot || (action !== 'inspect' && !stateDir)) throw new Error('Usage: node engine.js apply|restore|inspect APP_ROOT [STATE_DIR]');
    console.log(JSON.stringify(action === 'inspect' ? inspect(appRoot) : module.exports[action](appRoot, stateDir)));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}

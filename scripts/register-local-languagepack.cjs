'use strict';
// Rebuild the standard data-only VS Code language-pack cache after CLI installs.
// The digest is the native cache key (extension identifier + version), not a
// signature or a trust decision. No application or extension trust policy changes.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');

function buildCache(extensionsDir) {
  const registry=JSON.parse(fs.readFileSync(path.join(extensionsDir,'extensions.json'),'utf8'));
  const result={};
  for(const entry of registry) {
    const root=fs.realpathSync(entry.relativeLocation?path.join(extensionsDir,entry.relativeLocation):entry.location.path);
    const manifest=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
    for(const locale of manifest.contributes?.localizations || []) {
      if(typeof locale.languageId!=='string'||!Array.isArray(locale.translations)||!locale.translations.length)throw Error('Invalid language-pack manifest');
      const record=result[locale.languageId] ||= {hash:'',extensions:[],translations:{},label:locale.localizedLanguageName||locale.languageName};
      record.extensions.push({extensionIdentifier:entry.identifier,version:manifest.version});
      for(const translation of locale.translations) {
        const file=fs.realpathSync(path.resolve(root,translation.path));
        if(!file.startsWith(root+path.sep)||!fs.statSync(file).isFile())throw Error('Translation path is outside its extension');
        record.translations[translation.id]=file;
      }
    }
  }
  for(const record of Object.values(result)) {
    const digest=crypto.createHash('md5');
    for(const extension of record.extensions)digest.update(extension.extensionIdentifier.uuid||extension.extensionIdentifier.id).update(extension.version);
    record.hash=digest.digest('hex');
  }
  return result;
}

function register(extensionsDir,userDataDir) {
  const cache=buildCache(extensionsDir);
  const file=path.join(userDataDir,'languagepacks.json');
  fs.mkdirSync(userDataDir,{recursive:true});
  if(fs.existsSync(file)&&!fs.existsSync(file+'.cursor-zh.backup'))fs.copyFileSync(file,file+'.cursor-zh.backup',fs.constants.COPYFILE_EXCL);
  const temporary=file+'.tmp-'+process.pid;
  try{fs.writeFileSync(temporary,JSON.stringify(cache),{mode:0o600});fs.renameSync(temporary,file);}
  finally{if(fs.existsSync(temporary))fs.unlinkSync(temporary);}
  return Object.fromEntries(Object.entries(cache).map(([locale,value])=>[locale,value.extensions.map(e=>e.extensionIdentifier.id)]));
}
module.exports={buildCache,register};
if(require.main===module){
  const [extensionsDir,userDataDir]=process.argv.slice(2);
  if(!extensionsDir||!userDataDir)throw Error('Usage: node register-local-languagepack.cjs EXTENSIONS_DIR USER_DATA_DIR');
  console.log(JSON.stringify(register(extensionsDir,userDataDir)));
}

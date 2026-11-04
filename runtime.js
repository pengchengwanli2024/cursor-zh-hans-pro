'use strict';

// Runs in the workbench renderer. No network access or application configuration writes.
function installTranslator(dictionary, revision) {
  if (window.__cursorZhRevision === revision) return;
  window.__cursorZhRevision = revision;
  const forbidden = 'script,style,code,pre,textarea,[contenteditable="true"],.monaco-editor,.xterm,.monaco-tokenized-source,.rendered-markdown,.markdown-body,.markdown-rendered,.markdown,.ui-markdown,.latin-markdown,.markdown-editor-react,.pr-comment-card__markdown,[data-message-role],.composer-human-message,.composer-human-message-content,.human-message-inline-body,.composer-assistant-message,.composer-message-content,.message-content';
  const blocked = el => !el || Boolean(el.closest(forbidden));
  const normalize = value => value.replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/\u2026/g, '...').replace(/\s+/g, ' ').trim();
  const normalized = new Map();
  for (const [key,value] of Object.entries(dictionary)) {
    const n=normalize(key);
    if (!normalized.has(n)) normalized.set(n,value);
    else if (normalized.get(n)!==value) normalized.set(n,null);
  }
  const templates=[];
  for (const [key,value] of Object.entries(dictionary)) {
    if (!/\{\d+\}/.test(key) || !/[A-Za-z]{3}/.test(key.replace(/\{\d+\}/g,''))) continue;
    const indexes=[];
    const fragments=normalize(key).split(/(\{\d+\})/g).map(part=>{
      if (/^\{\d+\}$/.test(part)) {indexes.push(Number(part.slice(1,-1)));return '([\\s\\S]*?)';}
      return part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    });
    const literal=normalize(key).replace(/\{\d+\}/g,'');
    const anchor=(literal.match(/[A-Za-z]{3,}/g)||[]).sort((a,b)=>b.length-a.length)[0];
    templates.push({pattern:new RegExp('^'+fragments.join('')+'$'),indexes,value,anchor,literalLength:literal.length});
  }
  templates.sort((a,b)=>b.literalLength-a.literalLength);
  const translate = value => {
    if (typeof value !== 'string' || value.length > 1600) return value;
    const key = value.trim();
    if(!key)return value;
    const normalizedKey=normalize(key);
    let result=Object.prototype.hasOwnProperty.call(dictionary,key) ? dictionary[key] : normalized.get(normalizedKey);
    if (!result && /[A-Za-z]/.test(key)) for(const template of templates) {
      if(template.anchor&&!normalizedKey.includes(template.anchor))continue;
      const match=template.pattern.exec(normalizedKey);
      if (!match) continue;
      const captures=new Map();
      let consistent=true;
      template.indexes.forEach((index,i)=>{
        if(captures.has(index)&&captures.get(index)!==match[i+1])consistent=false;
        captures.set(index,match[i+1]);
      });
      if(!consistent)continue;
      result=template.value.replace(/\{(\d+)\}/g,(placeholder,index)=>captures.get(Number(index))??placeholder);
      break;
    }
    return result ? value.replace(key, () => result) : value;
  };
  function aggregate(el) {
    if (blocked(el) || !el.children.length || el.children.length>120) return;
    const inline=new Set(['SPAN','B','STRONG','EM','I','BR','A','CODE']);
    if ([...el.children].some(e=>!inline.has(e.tagName))) return;
    if(el.querySelector('button,input,textarea,select,pre,svg,[contenteditable]'))return;
    // React's word-by-word UI animations split one sentence across many spans.
    // Only flatten inline, non-interactive phrasing; retain links and controls.
    if ([...el.querySelectorAll('*')].some(e=>!inline.has(e.tagName))) return;
    const before=el.textContent;
    if (!before || before.length>1600) return;
    const after=translate(before);
    if(after===before)return;
    const groups=[[]],atoms=[];
    let rejected=false;
    function collect(node) {
      if(node.nodeType===3) {
        if(blocked(node.parentElement)){rejected=true;return;}
        groups[groups.length-1].push(node);
      } else if(node.nodeType===1&&['A','CODE'].includes(node.tagName)) {
        if(!node.textContent){rejected=true;return;}
        atoms.push(node);groups.push([]);
      } else for(const child of node.childNodes)collect(child);
    }
    for(const child of el.childNodes)collect(child);
    if(rejected)return;
    const segments=[];let offset=0;
    for(const atom of atoms) {
      const token=atom.tagName==='CODE'?atom.textContent:translate(atom.textContent);
      const position=after.indexOf(token,offset);
      // Never remove or reorder a link, command, or its handler to force a match.
      if(position<0)return;
      segments.push(after.slice(offset,position));offset=position+token.length;
    }
    segments.push(after.slice(offset));
    for(let i=0;i<groups.length;i++) {
      const nodes=groups[i];
      if(nodes.length){nodes[0].nodeValue=segments[i];for(const node of nodes.slice(1))node.nodeValue='';}
      else if(segments[i]){
        const text=document.createTextNode(segments[i]);
        if(atoms[i])atoms[i].before(text);else el.appendChild(text);
      }
    }
  }
  function text(node) {
    const el = node.parentElement;
    if (blocked(el) || el.closest('input,select,option')) return;
    const next = translate(node.nodeValue);
    if (next !== node.nodeValue) node.nodeValue = next;
  }
  function attributes(el) {
    if (blocked(el)) return;
    for (const key of ['placeholder', 'title', 'aria-label']) {
      const value = el.getAttribute(key);
      const next = translate(value);
      if (next !== value) el.setAttribute(key, next);
    }
  }
  function walk(root) {
    if (!root || !root.isConnected) return;
    if (root.nodeType === 3) return text(root);
    if (root.nodeType !== 1 || blocked(root)) return;
    attributes(root);
    aggregate(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return node.nodeType === 1 && blocked(node) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      }
    });
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeType === 3) text(node);
      else {attributes(node);aggregate(node);}
    }
  }
  function boot() {
    if (!document.body) return;
    walk(document.body);
    const dirty = new Set();
    let scheduled = false;
    const observer = new MutationObserver(mutations => {
      for (const m of mutations) {
        if (m.type === 'childList') for (const n of m.addedNodes) dirty.add(n);
        else dirty.add(m.target);
      }
      if (!scheduled && dirty.size) {
        scheduled = true;
        requestAnimationFrame(() => {
          scheduled = false;
          const nodes = [...dirty];
          dirty.clear();
          for (const node of nodes) walk(node);
        });
      }
    });
    observer.observe(document.body, {subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:['placeholder','title','aria-label']});
    window.addEventListener('pagehide', () => observer.disconnect(), {once:true});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
}

module.exports = installTranslator;

// Hmong Legend V2 — tightly-scoped source patch for intermittent WebKit SND login race.
// Only changes the hello().then... login/splash callback in game/index.html.
// Default: verify applicability without writing. --write: apply exact one-time replacement.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const file = path.join(__dirname, '..', 'game', 'index.html');
const before = "hello().then(ok=>{if(!ok)return;NET.state='ready';token=store.get();if(token)connect();else if(SND.splash&&SND.splash.shown&&!SND.splash.gone)SND.splash.loginPending=true;else $('net').hidden=false});";
const after = "hello().then(ok=>{if(!ok)return;NET.state='ready';token=store.get();const showLogin=()=>{if(token)connect();else{const snd=window.SND;if(snd&&snd.splash&&snd.splash.shown&&!snd.splash.gone)snd.splash.loginPending=true;else $('net').hidden=false}};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',showLogin,{once:true});else showLogin()});";
function count(haystack, needle) { return haystack.split(needle).length - 1; }
function apply(source) {
  const n = count(source, before);
  if (n === 1 && count(source, after) === 0) return source.replace(before, after);
  if (n === 0 && count(source, after) === 1) return source;
  throw new Error('SND patch precondition mismatch; expected exactly one old or one patched login callback. old='+n+' patched='+count(source, after));
}
function main() {
  const old = fs.readFileSync(file,'utf8'), updated=apply(old);
  if (process.argv.includes('--write') && updated!==old) fs.writeFileSync(file,updated,'utf8');
  console.log('SND race patch '+(updated===old?'already present':'ready')+'; old bytes='+Buffer.byteLength(old)+' new bytes='+Buffer.byteLength(updated));
  if(!process.argv.includes('--write') && updated!==old)console.log('Run --write to patch the isolated branch only.');
}
if(require.main===module)main();
module.exports={before,after,apply};

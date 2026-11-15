'use strict';
const fs=require('fs');
const s=fs.readFileSync('game/index.html','utf8');
const hits=[...s.matchAll(/\bSND\b/g)];
console.log('SND OCCURRENCES',hits.length);
for(const m of hits){
 const p=m.index;
 console.log('SND_AT',p,'BEFORE',JSON.stringify(s.slice(Math.max(0,p-220),p)),
  'AFTER',JSON.stringify(s.slice(p,Math.min(s.length,p+260))));
}
for(const q of ['const SND','let SND','var SND','window.SND','globalThis.SND','SND=','snd.js','AudioContext','SND.play','SND.init','<script']){
 console.log('MATCH',JSON.stringify(q),s.indexOf(q));
}

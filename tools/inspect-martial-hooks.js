// Inspection-only: print small, selected pieces of actual game source.
'use strict';
const fs=require('fs'),source=fs.readFileSync('game/index.html','utf8');
const terms=['function useSkill(', 'function updCast(', 'function release(sk)', 'function artFx(', 'function attack(', "const PS=", "let PS=", "PS.cast=", "function draw(){", "for(const f of fx)", "drawFxC(f)", "function drawFx(", "CFG.skillFor=", "window.HL={"];
for(const term of terms){
 const at=source.indexOf(term);
 console.log('SOURCE_HOOK',JSON.stringify(term),'offset',at);
 if(at>=0)console.log('SOURCE_SNIP',term,'\n',source.slice(Math.max(0,at-150),at+2100).replace(/\n/g,' '),'\nEND_SNIP');
}
console.log('END INSPECTION');

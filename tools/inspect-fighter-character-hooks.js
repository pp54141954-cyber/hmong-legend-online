// Read-only inspection. Print selected original character hooks and skill frame logic.
'use strict';
const fs=require('node:fs');
const s=fs.readFileSync('game/index.html','utf8');
const terms=['const CLASS_BODY=', 'const CLASS_POSE=', 'function drawPlayer(', 'function drawClassCast(', 'function drawClass', 'function chartFx(', 'function drawChart(', 'function drawChartUD(', 'function drawChart4(', 'function release(sk)', 'function updCast(', 'function useSkill(', 'function startCast(', 'const SKILL_FXUD=', 'const SKILL_FX4=', 'const SKILL_FX=', 'window.HL={','function drawAtkPose(', 'const ASSET', 'function sprUrl(', 'function classAtk(', 'function classBody('];
for(const needle of terms){
 const i=s.indexOf(needle);
 console.log('CODE',JSON.stringify(needle),'AT',i, 'CONTENT', i<0?'NOT_FOUND':JSON.stringify(s.slice(i,i+1400)));
}
console.log('HTML lines',s.split('\n').length);
console.log('SND callback patched',s.includes("const snd=window.SND"));

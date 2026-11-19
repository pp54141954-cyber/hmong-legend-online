'use strict';
const assert=require('node:assert/strict');
global.HLFighter19CastManual=true;
class Img{
  constructor(){this.naturalWidth=1752;this.naturalHeight=1280;}
  set src(v){this._src=v;this.onload?.();}
}
global.Image=Img;
const draw=[];
const ctx={globalAlpha:1,globalCompositeOperation:'source-over',save(){},restore(){},
  drawImage(...args){draw.push(args)},imageSmoothingEnabled:true};
global.document={getElementById(id){return id==='c'?{getContext:()=>ctx}:null}};
const F=require('../game/fighter-cast19-game-hook');
let assertions=0;
function test(name,cb){cb();assertions++;console.log('PASS '+name)}
test('loading expected 1752x1280 approved grid',()=>{assert.equal(F.setSource('sprites/fighter_cast19_user.webp'),true);assert.equal(F.ready,true)});
test('exact owner order including removed points',()=>{
 assert.deepEqual(F.LENGTH,{S:5,N:4,W:6,E:4});
 assert.deepEqual(F.POINTS,{S:[17,18,19,20,21],N:[13,14,15,16],W:[6,7,8,9,10,11],E:[1,2,3,4]});
 assert.ok(!Object.values(F.POINTS).flat().some(p=>[5,12].includes(p)));
});
test('hook installed without changing original draw for unrelated sprites',()=>assert.equal(F.installGameHook(),true));
for(const [dir,len] of Object.entries(F.LENGTH)){
 test(dir+': all frames in approved order with no overflow',()=>{
  let prev=-1;
  for(let n=0;n<=200;n++){const i=F.selectFrame(dir,n/200);assert.ok(i>=0&&i<len&&i>=prev);prev=i}
  assert.equal(F.selectFrame(dir,1),len-1);
 });
}
const original={source:'original fighter attack'};
const nine=[original,0,0,240,124,280,275,240,124];
const pl={x:400,y:403,dir:'S'};
const state={look:{g:'m'},cast:{key:3,t:.55,sk:{poseT:1}}};
global.HL={player:pl,PS:state,curCls:()=> 'นักสู้',classAtk:()=>({img:original,n:5})};
for(let key=3;key<=11;key++)for(const dir of ['S','N','W','E']){
 test('skill '+key+' '+dir+' uses owner frame from Cast19',()=>{
  state.cast.key=key;pl.dir=dir;
  const before=F.draws;ctx.drawImage(...nine);
  assert.equal(F.draws,before+1);
  assert.ok(draw.at(-1)[0] instanceof Img);
  const last=F.last;
  assert.equal(last.slot,key);assert.equal(last.dir,dir);
  assert.equal(last.originalPoint,F.POINTS[dir][last.frame]);
  assert.equal(draw.at(-1)[1],last.frame*292);
  assert.equal(draw.at(-1)[2],{S:0,N:1,W:2,E:3}[dir]*320);
 });
}
test('original basic attack key b remains unmodified',()=>{
 state.cast.key='b';const p=F.draws;ctx.drawImage(...nine);
 assert.equal(F.draws,p);assert.equal(draw.at(-1)[0],original);
});
test('female Fighter stays on its original character animation',()=>{
 state.cast.key=3;state.look.g='f';const p=F.draws;ctx.drawImage(...nine);
 assert.equal(F.draws,p);assert.equal(draw.at(-1)[0],original);
 state.look.g='m';
});
test('non-fighter classes unchanged',()=>{
 global.HL.curCls=()=> 'นักดาบ';const p=F.draws;ctx.drawImage(...nine);
 assert.equal(F.draws,p);assert.equal(draw.at(-1)[0],original);
 global.HL.curCls=()=> 'นักสู้';
});
test('another player sprite is untouched',()=>{
 pl.x=990;const p=F.draws;ctx.drawImage(...nine);
 assert.equal(F.draws,p);assert.equal(draw.at(-1)[0],original);
 pl.x=400;
});
test('translucent native afterimage is retained',()=>{
 ctx.globalAlpha=.25;const p=F.draws;ctx.drawImage(...nine);
 assert.equal(F.draws,p);assert.equal(draw.at(-1)[0],original);ctx.globalAlpha=1;
});
test('unavailable Cast19 atlas fails closed',()=>{
 const saved=global.HL.PS;global.HL.PS=null;const p=F.draws;ctx.drawImage(...nine);
 assert.equal(F.draws,p);global.HL.PS=saved;
});
console.log('RESULT '+assertions+'/'+assertions+' PASS (deterministic hook/owner ordering; no live server)');

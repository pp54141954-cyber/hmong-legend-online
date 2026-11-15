'use strict';
// V2-R78 integrated equipment migration: run only with isolated in-memory game state.
const assert=require('node:assert/strict');
const {createSim}=require('../server/sim.js');
const {CFG,ZONES}=require('../shared/world.js');
const make=(cls='ผู้พิทักษ์')=>({id:1,c:{
 name:'TestGuardian',zone:'village2',x:ZONES.village2.start[0],y:ZONES.village2.start[1],dir:'S',
 lv:10,exp:0,job:1,jexp:0,cls,clsset:1,starter:1,
 st:{},sk:{},look:{g:'m',hair:0,outfit:0},bag:[],
 eq:{weapon:'shield_hmong',armor:'coat_cloth',acc:null},
 enh:{weapon:15},gold:1000000
}});
const sim=createSim({rand:()=>0.99});
const p=make();sim.addPlayer(p);
assert.equal(p.c.eq.weapon,'sword_wood','legacy shield replaced with starter sword');
assert.equal(p.c.eq.offhand,'shield_hmong','legacy guardian shield moved to offhand');
assert.equal(p.c.enh.offhand,15,'legacy +15 shield transferred without downgrade');
assert.equal(p.c.enh.weapon,0,'starter sword not enhanced');
assert.equal(sim.enhance(p,{src:'eq',slot:'offhand',rid:'old-shield'},100),'far','cannot upgrade away from smith');
const oldAtk=p.atk;
p.c.enh.offhand=0;sim.stats(p);
assert(oldAtk>p.atk,'shield +15 retains its previous ATK multiplier');
p.c.enh.offhand=15;sim.stats(p);

p.c.bag.push({id:'sword_iron',n:1,enh:9});
assert.equal(sim.inv(p,'equip',0),'ok');
assert.equal(p.c.enh.weapon,9,'upgraded sword equipped');
assert.equal(p.c.enh.offhand,15,'shield +15 unaffected by weapon swap');
assert(p.c.bag.some(s=>s.id==='sword_wood'&&!s.enh),'old starter sword returned');
assert.equal(sim.inv(p,'unequip','offhand'),'ok');
assert(p.c.bag.some(s=>s.id==='shield_hmong'&&s.enh===15),'shield +15 returned to bag');
const idx=p.c.bag.findIndex(s=>s.id==='shield_hmong');
assert.equal(sim.inv(p,'equip',idx),'ok');
assert.equal(p.c.enh.offhand,15,'shield +15 re-equipped');

const fail=make();sim.addPlayer(fail);
while(fail.c.bag.length<CFG.bag.slots)fail.c.bag.push({id:'hide',n:1});
const snapshot=JSON.stringify({cls:fail.c.cls,eq:fail.c.eq,enh:fail.c.enh,bag:fail.c.bag});
assert.equal(sim.setClass(fail,'นักธนู'),'bag-full');
assert.equal(JSON.stringify({cls:fail.c.cls,eq:fail.c.eq,enh:fail.c.enh,bag:fail.c.bag}),snapshot,'bag-full class switch is atomic');

assert.equal(sim.setClass(p,'นักธนู'),'ok');
assert.equal(p.c.eq.weapon,'bow_wood');
assert.equal(p.c.eq.offhand,null);
assert(p.c.bag.some(s=>s.id==='sword_iron'&&s.enh===9),'sword +9 retained after class switch');
assert(p.c.bag.some(s=>s.id==='shield_hmong'&&s.enh===15),'shield +15 retained after class switch');

const q=make('ผู้พิทักษ์');q.c.eq={weapon:'sword_wood',offhand:'shield_wood',armor:null,acc:null};
q.c.enh={weapon:0,offhand:10};q.c.x=CFG.npcs.find(n=>n.role==='smith'&&n.zone==='village2').tx*32;
q.c.y=CFG.npcs.find(n=>n.role==='smith'&&n.zone==='village2').ty*32;
q.c.bag=[{id:CFG.enhance.stone,n:3}];sim.addPlayer(q);
const result=sim.enhance(q,{src:'eq',slot:'offhand',rid:'offhand-fail'},100);
assert.equal(result.ok,false,'with 0.99 random the +10 upgrade fails');
assert.equal(result.to,10,'shield remains +10 when enhancement fails');
assert.equal(q.c.enh.offhand,10,'protection stone preserves the shield upgrade');
assert.equal(q.c.bag[0].n,2,'one protection stone consumed');

console.log('PASS: guardian dual slots, legacy +15 migration, +9 sword, swap, bag-full atomic, protection stone');

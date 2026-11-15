// Integration safety: R78 enhancement must survive guardian offhand migration, swaps and saved items.
'use strict';
const assert = require('node:assert/strict');
const { createSim } = require('../server/sim.js');
const { CFG, ZONES } = require('../shared/world.js');
const { open } = require('../server/db.js');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const sim=createSim({rand:()=>0});
const P=ZONES.village.start;
const mk=(cls,weapon,shield,enh={})=>({id:1,personal:[],c:{
 name:'equip-integration',zone:'village',x:P[0],y:P[1],dir:'S',
 lv:20,exp:0,job:10,jexp:0,cls,clsset:1,starter:1,
 bag:[],eq:{weapon,offhand:shield,armor:null,acc:null},enh,sk:{},st:CFG.stats.clean({}),look:{},gold:1000000
}});
assert.equal(CFG.enhance.cap,15);
assert.equal(CFG.classWeapon['ผู้พิทักษ์'],'sword');
assert.equal(CFG.items.shield_hmong.slot,'offhand');
const old=mk('ผู้พิทักษ์','shield_hmong',null,{weapon:12});
sim.addPlayer(old);
assert.equal(old.c.eq.offhand,'shield_hmong');
assert.equal(old.c.enh.offhand,12,'legacy +12 shield enchant preserved');
assert.equal(old.c.eq.weapon,'sword_wood','sword available after legacy migration');
assert.equal(old.c.enh.weapon,0);
assert.equal(sim.inv(old,'unequip','offhand'),'ok');
assert(old.c.bag.some(s=>s.id==='shield_hmong'&&s.enh===12));
let i=old.c.bag.findIndex(s=>s.id==='shield_hmong');
assert.equal(sim.inv(old,'equip',i),'ok');
assert.equal(old.c.eq.offhand,'shield_hmong');
assert.equal(old.c.enh.offhand,12);
assert.equal(sim.setClass(old,'นักธนู'),'ok');
assert.equal(old.c.eq.offhand,null);
assert(old.c.bag.some(s=>s.id==='shield_hmong'&&s.enh===12),'shield kept on class switch');
assert.equal(old.c.eq.weapon,'bow_wood');
assert.equal(sim.inv(old,'equip',old.c.bag.findIndex(s=>s.id==='shield_hmong')),'wrong-class');
const full=mk('ผู้พิทักษ์','sword_wood','shield_wood',{weapon:7,offhand:9});
full.c.bag=Array.from({length:CFG.bag.slots},()=>({id:'potion_s',n:1}));
sim.addPlayer(full);
assert.equal(sim.setClass(full,'นักธนู'),'bag-full');
assert.equal(full.c.cls,'ผู้พิทักษ์','class unchanged when no space');
assert.equal(full.c.eq.weapon,'sword_wood');
assert.equal(full.c.enh.weapon,7);
assert.equal(full.c.eq.offhand,'shield_wood');
assert.equal(full.c.enh.offhand,9);
const g=mk('ผู้พิทักษ์',null,null);
g.c.bag=[{id:'sword_hmong',n:1,enh:10},{id:'shield_wood',n:1}];
sim.addPlayer(g);
assert.equal(sim.inv(g,'equip',0),'ok');
assert.equal(g.c.enh.weapon,10);
assert.equal(sim.inv(g,'equip',0),'ok');
assert.equal(g.c.eq.offhand,'shield_wood');
assert.equal(sim.inv(g,'unequip','weapon'),'ok');
assert(g.c.bag.some(s=>s.id==='sword_hmong'&&s.enh===10),'weapon level kept on unequip');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hl-migrate-db-'));
try {
 const db=open(path.join(dir,'test.db'));const acct=db.register('Migrated','secret123',{zone:'village',x:P[0],y:P[1]});
 const c=db.character(acct.id);
 c.cls='ผู้พิทักษ์';c.clsset=1;c.starter=1;
 c.eq={weapon:old.c.eq.weapon,offhand:'shield_hmong',armor:null,acc:null};
 c.enh={weapon:0,offhand:12};
 c.bag=[{id:'sword_hmong',n:1,enh:10}];
 db.save(c);const check=db.character(acct.id);
 assert.equal(check.enh.offhand,12);
 assert(check.bag.some(s=>s.id==='sword_hmong'&&s.enh===10));
 db.close();
} finally {fs.rmSync(dir,{recursive:true,force:true})}
console.log('PASS: offhand migration / R78 enhancement persistence / full bag safety / class restrictions');

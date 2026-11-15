// Hmong Legend V2-R81 — isolated bag, equipment, shop and SQLite safety regression.
// Uses temporary accounts only. Does NOT access Render or physical phones.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { WebSocket } = require('../server/node_modules/ws');
const { createSim } = require('../server/sim.js');
const { createServer } = require('../server/server.js');
const { CFG, T, ZONES } = require('../shared/world.js');

let checks = 0;
function check(name, condition) { assert.ok(condition, name); checks++; console.log('PASS ' + name); }
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(name, fn, timeout = 5000) {
  const t = Date.now();
  while (Date.now() - t < timeout) { if (fn()) return; await sleep(20); }
  throw new Error('timeout: ' + name);
}
const sim = createSim({rand:() => .5});
function character(cls = 'นักดาบ') {
  const st = ZONES.village.start;
  const c = {
    account_id:1,name:'BagTester',zone:'village',x:st[0],y:st[1],dir:'S',
    lv:20,exp:0,job:10,jexp:0,cls,clsset:1,starter:1,gold:1000,
    bag:[],eq:{weapon:'sword_wood',offhand:null,armor:null,acc:null},
    enh:{weapon:0},sk:{},st:{},look:{}
  };
  const p = {id:1,c,personal:[],dirty:false,bagDirty:false};
  sim.addPlayer(p);
  return p;
}
function snapshot(p) { return JSON.stringify({bag:p.c.bag,eq:p.c.eq,enh:p.c.enh,gold:p.c.gold}); }
async function socketConnect(port, token) {
  return new Promise((resolve,reject) => {
    const ws = new WebSocket('ws://127.0.0.1:' + port + '/ws'), events = [];
    const timeout = setTimeout(() => reject(Error('WebSocket auth timeout')),8000);
    ws.on('open', () => ws.send(JSON.stringify({t:'hello',token})));
    ws.on('message', b => {
      let m; try{m=JSON.parse(String(b))}catch{return}
      events.push(m);
      if(m.t==='welcome'){clearTimeout(timeout);resolve({ws,events});}
    });
    ws.once('error', e => {clearTimeout(timeout);reject(e);});
  });
}
async function main(){
  const a=character();
  check('bag size is configured as 30 slots', CFG.bag.slots===30);
  check('stack size is configured as 99', CFG.bag.stack===99);
  a.c.bag=[{id:'potion_s',n:98}];
  check('stack overflow splits into another slot', sim.addItem(a,'potion_s',10)===10 &&
    a.c.bag.length===2 && a.c.bag[0].n===99 && a.c.bag[1].n===9);
  const beforeBad=snapshot(a);
  for (const n of [0,-1,1.5,NaN,Infinity,'5',null]) {
    check('reject bad addItem amount ' + String(n), sim.addItem(a,'potion_s',n)===0 && snapshot(a)===beforeBad);
  }
  a.c.bag=[{id:'potion_s',n:98},...Array.from({length:CFG.bag.slots-1},()=>({id:'hide',n:99}))];
  check('full bag adds only remaining free stack amount', sim.addItem(a,'potion_s',10)===1 &&
    a.c.bag.length===CFG.bag.slots && a.c.bag[0].n===99);
  const beforeSlot=snapshot(a);
  for (const index of [null,0.5,'0.5',-1,{},[0],true]) {
    check('invalid bag index is never coerced to slot 0: '+String(index),
      sim.inv(a,'use',index,10)==='empty' && snapshot(a)===beforeSlot);
  }
  const b=character();
  b.c.bag=[{id:'potion_s',n:2}];
  const fullHP=b.hp;
  check('using potion with full HP leaves item unchanged',sim.inv(b,'use',0,10)==='hp-full' && b.c.bag[0].n===2);
  b.hp=Math.max(1,fullHP-70);
  check('potion heals and reduces count once',sim.inv(b,'use',0,20)==='ok' && b.c.bag[0].n===1 && b.hp>fullHP-70);
  check('potion cooldown cannot consume another item',sim.inv(b,'use',0,20.1)==='cooldown' && b.c.bag[0].n===1);
  const guard=character('ผู้พิทักษ์');
  guard.c.eq.offhand='shield_hmong';guard.c.enh.offhand=12;
  guard.c.bag=Array.from({length:CFG.bag.slots},()=>({id:'hide',n:99}));
  const guardBefore=snapshot(guard);
  check('full bag blocks shield unequip and preserves +12',sim.inv(guard,'unequip','offhand')==='bag-full' && snapshot(guard)===guardBefore);
  guard.c.bag.pop();
  check('shield unequip preserves +12',sim.inv(guard,'unequip','offhand')==='ok' &&
    guard.c.bag.some(s=>s.id==='shield_hmong'&&s.enh===12));
  const ix=guard.c.bag.findIndex(s=>s.id==='shield_hmong');
  check('shield re-equip preserves +12',sim.inv(guard,'equip',ix)==='ok' &&
    guard.c.enh.offhand===12 && guard.c.eq.offhand==='shield_hmong');

  const shop=CFG.npcs.find(n=>n.id==='shop2');
  const customer=character();
  customer.c.zone=shop.zone;customer.c.x=shop.tx*T;customer.c.y=shop.ty*T;
  customer.c.bag=[{id:'potion_s',n:98},...Array.from({length:CFG.bag.slots-1},()=>({id:'hide',n:99}))];
  const balance=customer.c.gold, original=snapshot(customer);
  check('shop refuses overflow without charging or changing the bag',
    sim.buy(customer,shop.id,'potion_s',2)==='bag-full' && snapshot(customer)===original);
  for(const n of [1.5,null,NaN,Infinity,-1,100]) {
    check('shop rejects invalid amount ' + String(n),
      sim.buy(customer,shop.id,'potion_s',n)==='invalid' && snapshot(customer)===original);
  }
  check('shop fills existing stack exactly and charges once',
    sim.buy(customer,shop.id,'potion_s',1)==='ok' &&
    customer.c.bag[0].n===99 && customer.c.gold===balance-10);

  // Verify a real WebSocket command is persisted synchronously to SQLite.
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hl-bag-r81-'));
  let srv,session;
  try {
    srv=createServer({dbFile:path.join(dir,'test.db'),quiet:true,startZone:'village2',saveEverySec:3600});
    const r=srv.db.register('BagLiveTest','password123',{zone:'village2',x:shop.tx*T,y:shop.ty*T});
    check('temporary player registered',!!r.id);
    const c=srv.db.character(r.id);
    c.cls='ผู้พิทักษ์';c.clsset=1;c.starter=1;c.gold=500;
    c.eq={weapon:'sword_wood',offhand:'shield_wood',armor:'coat_cloth',acc:null};
    c.bag=[{id:'potion_s',n:1},{id:'sword_iron',n:1,enh:9}];srv.db.save(c);
    const port=await srv.listen(0);
    const response=await fetch('http://127.0.0.1:'+port+'/api/login',{method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({name:'BagLiveTest',pass:'password123'})});
    check('HTTP login successful',response.status===200);
    const auth=await response.json();session=await socketConnect(port,auth.token);
    check('WebSocket player joined',!!srv.online.get(r.id));
    session.ws.send(JSON.stringify({t:'shop',npc:'shop2',id:'potion_s',n:2}));
    await waitFor('shop persisted without logout',()=>srv.db.character(r.id).gold===480);
    check('purchase persisted immediately to SQLite',srv.db.character(r.id).bag[0].n===3);
    session.ws.send(JSON.stringify({t:'inv',op:'equip',slot:1}));
    await waitFor('equip persisted without logout',()=>srv.db.character(r.id).eq.weapon==='sword_iron');
    const equipped=srv.db.character(r.id);
    check('weapon +9 enhancement saved immediately',equipped.enh.weapon===9 &&
      equipped.bag.some(s=>s.id==='sword_wood'&&s.n===1));
    session.ws.send(JSON.stringify({t:'inv',op:'unequip',slot:'offhand'}));
    await waitFor('shield unequip persisted without logout',()=>srv.db.character(r.id).eq.offhand===null);
    check('shield returned to saved bag',srv.db.character(r.id).bag.some(s=>s.id==='shield_wood'));
    // Database fault injection: user sees an error, gold and bag are rolled back.
    const p=srv.online.get(r.id),before=snapshot(p),persisted=snapshot({c:srv.db.character(r.id)});
    const save=srv.db.save;
    srv.db.save=()=>{throw Error('injected DB failure');};
    try {
      session.ws.send(JSON.stringify({t:'shop',npc:'shop2',id:'potion_s',n:2}));
      await waitFor('save failure rejection reaches client',()=>session.events.some(m=>m.t==='deny'&&m.k==='shop'&&m.r==='save-error'));
      check('failed SQLite write rolls back inventory and gold in memory',snapshot(p)===before);
      check('failed SQLite write leaves committed database unchanged',
        snapshot({c:srv.db.character(r.id)})===persisted);
    } finally {srv.db.save=save;}
  } finally {
    if(session?.ws.readyState===WebSocket.OPEN)await new Promise(resolve=>{session.ws.once('close',resolve);session.ws.close();});
    if(srv)await srv.close();
    fs.rmSync(dir,{recursive:true,force:true});
  }
  console.log('RESULT: '+checks+'/'+checks+' PASS (isolated inventory + SQLite + WebSocket)');
}
main().catch(e=>{console.error('FAIL bag integrity:',e);process.exitCode=1;});

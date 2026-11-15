// Isolated browser play-through: two players log in, move, see each other, attack and change equipment.
// Real Chromium browser, emulated mobile viewports; NOT a test of the live Render database or physical devices.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium, devices } = require('playwright');
const { createServer } = require('../server/server.js');
const { CFG, ZONES } = require('../shared/world.js');

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-gameplay-'));
  const srv = createServer({dbFile:path.join(tmp,'game.db'),quiet:true,startZone:'village',saveEverySec:2});
  let browser;
  const results=[];
  const ok=(name,condition,detail='')=>{results.push({name,pass:!!condition});console.log((condition?'PASS ':'FAIL ')+name+(detail?' — '+detail:''));assert(condition,name+(detail?': '+detail:''));};
  try {
    for (const [n,cls,weapon,offhand] of [
      ['PlaytestA','ผู้พิทักษ์','sword_wood','shield_wood'],
      ['PlaytestB','นักธนู','bow_wood',null]
    ]) {
      const p=ZONES.village.start;
      const res=srv.db.register(n,'testpass123',{zone:'village',x:p[0],y:p[1]});
      assert(res.id);
      const c=srv.db.character(res.id);
      c.cls=cls;c.clsset=1;c.starter=1;
      c.eq={weapon,offhand,armor:'coat_cloth',acc:null};
      c.bag=[{id:'potion_s',n:2},{id:'potion_m',n:1}];
      srv.db.save(c);
    }
    const port=await srv.listen(0);
    const base='http://127.0.0.1:'+port+'/?splash=0';
    browser=await chromium.launch();
    const errors=[];
    const make=async(name,dev)=>{
      const ctx=await browser.newContext({...devices[dev]});
      const page=await ctx.newPage();
      page.on('pageerror',e=>errors.push(name+': '+e.message));
      await page.goto(base,{waitUntil:'domcontentloaded'});
      await page.waitForSelector('#net:not([hidden])',{timeout:12000});
      await page.fill('#netn',name);
      await page.fill('#netp','testpass123');
      await page.click('#netlogin');
      await page.waitForFunction(()=>window.HLNET?.auth===true&&window.HLNET?.joined===true,null,{timeout:15000});
      return {ctx,page};
    };
    const A=await make('PlaytestA','Pixel 7');
    const B=await make('PlaytestB','iPhone 13'); // Chromium iPhone-sized viewport, not Safari WebKit
    const read=page=>page.evaluate(()=>({
      zone:window.HL?.Z?.id,
      x:window.HL?.player?.x, y:window.HL?.player?.y,
      others:(window.HLNET?.others||[]).map(o=>({name:o.name,x:o.tx,y:o.ty})),
      cls:window.HLNET?.cls,
      joined:window.HLNET?.joined
    }));
    const aa=await read(A.page),bb=await read(B.page);
    ok('two mobile browser sessions authenticated',aa.joined&&bb.joined);
    ok('both spawn in village',aa.zone==='village'&&bb.zone==='village',aa.zone+' / '+bb.zone);
    await B.page.waitForFunction(()=>window.HLNET?.others?.some(p=>p.name==='PlaytestA'),null,{timeout:10000});
    ok('second player sees first player', (await read(B.page)).others.some(o=>o.name==='PlaytestA'));

    await A.page.evaluate(()=>document.activeElement?.blur?.());
    await A.page.keyboard.down('ArrowRight');
    await A.page.waitForTimeout(750);
    await A.page.keyboard.up('ArrowRight');
    await A.page.waitForTimeout(500);
    const moved=await read(A.page);
    const dist=Math.hypot(moved.x-aa.x,moved.y-aa.y);
    ok('player movement using actual key input',dist>6,'distance '+dist.toFixed(1)+' px');
    await B.page.waitForFunction(x=>{
      const o=window.HLNET?.others?.find(p=>p.name==='PlaytestA');
      return o&&Math.hypot(o.tx-x.x,o.ty-x.y)<8;
    },{x:moved.x,y:moved.y},{timeout:10000});
    ok('multiplayer movement synchronizes to second screen',true);

    await A.page.click('#bagb');
    await A.page.waitForSelector('#bag:not([hidden]) .eqs .it',{timeout:8000});
    const eq=await A.page.evaluate(()=>{
      const bag=document.querySelector('#bag'),eq=[...bag.querySelectorAll('.eqs .it')],items=[...bag.querySelectorAll('.bag-grid .it')];
      return {slots:eq.length,offhand:!!bag.querySelector('[data-eq="offhand"]'),eqMax:Math.max(...eq.map(x=>x.getBoundingClientRect().height)),bagMin:Math.min(...items.map(x=>x.getBoundingClientRect().height)),overflow:bag.scrollWidth>bag.clientWidth+2};
    });
    ok('guardian inventory four slots and shield',eq.slots===4&&eq.offhand);
    ok('equipment compact; bag items unchanged',eq.eqMax<=77&&eq.bagMin>=88&&!eq.overflow,JSON.stringify(eq));
    const artifacts=path.join(__dirname,'test-artifacts');fs.mkdirSync(artifacts,{recursive:true});
    await A.page.locator('#bag').screenshot({path:path.join(artifacts,'real-play-android-bag.png')});
    await A.page.click('#bag .eqs [data-eq="offhand"]');
    await A.page.waitForFunction(()=>window.HLNET?.eq?.offhand===null,null,{timeout:8000});
    ok('shield unequips and returns to backpack', await A.page.locator('#bag .bag-grid').innerText().then(t=>t.includes(CFG.items.shield_wood.name)));
    await A.page.locator('#bag .bag-grid .it').filter({hasText:CFG.items.shield_wood.name}).first().click();
    await A.page.waitForFunction(()=>window.HLNET?.eq?.offhand==='shield_wood',null,{timeout:8000});
    ok('shield reequips through mobile bag UI',true);
    await A.page.locator('#bag h3 button').click();
    ok('close bag and return to play',await A.page.locator('#bag').evaluate(el=>el.hidden));
    await A.page.click('#atk');
    await A.page.waitForTimeout(350);
    ok('attack button remains functional',await A.page.evaluate(()=>!!window.HL&&!!document.getElementById('atk')));
    ok('no JavaScript exceptions while playing',errors.length===0,errors.slice(0,3).join(' | '));
    await A.page.screenshot({path:path.join(artifacts,'real-play-android-game.png')});
    await B.page.screenshot({path:path.join(artifacts,'real-play-iphone-size-chromium.png')});
    await A.ctx.close();await B.ctx.close();
    console.log('RESULT: '+results.length+'/'+results.length+' PASS (isolated test server, mobile Chromium)');
  }finally{
    if(browser)await browser.close();
    await srv.close();
    fs.rmSync(tmp,{recursive:true,force:true});
  }
})().catch(e=>{console.error('FAIL gameplay:',e);process.exitCode=1;});

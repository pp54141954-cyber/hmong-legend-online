// R82: real browser UI regression against an isolated Hmong Legend test server.
// Uses Chromium Pixel 7 and WebKit iPhone 13; neither is a physical phone or Render.
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {chromium,webkit,devices}=require('playwright');
const {createServer}=require('../server/server.js');
const {ZONES,CFG}=require('../shared/world.js');
const engine=process.env.MOBILE_BROWSER==='webkit'?webkit:chromium;
const device=process.env.MOBILE_BROWSER==='webkit'?'iPhone 13':'Pixel 7';
const results=[];
function check(name,condition){assert.ok(condition,name);results.push(name);console.log('PASS '+device+' '+name);}
(async()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'hl-bag-ux-r82-'));
 let srv,browser,context,page;
 try{
  srv=createServer({dbFile:path.join(temp,'game.db'),quiet:true,startZone:'village2'});
  const pos=ZONES.village2.start;
  const r=srv.db.register('BagUxTester','password123',{zone:'village2',x:pos[0],y:pos[1]});
  assert.ok(r.id);
  const c=srv.db.character(r.id);
  c.cls='ผู้พิทักษ์';c.clsset=1;c.starter=1;c.gold=500;
  c.eq={weapon:'sword_wood',offhand:'shield_wood',armor:'coat_cloth',acc:null};
  c.bag=[{id:'potion_s',n:2},{id:'sword_iron',n:1,enh:9},{id:'hide',n:3}];
  srv.db.save(c);
  const port=await srv.listen(0);
  browser=await engine.launch();
  context=await browser.newContext({...devices[device]});
  page=await context.newPage();
  const errors=[],failed=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('requestfailed',q=>failed.push(q.url()));
  await page.goto('http://127.0.0.1:'+port+'/?splash=0',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#net:not([hidden])',{timeout:30000});
  await page.fill('#netn','BagUxTester');await page.fill('#netp','password123');
  await page.click('#netlogin');
  await page.waitForFunction(()=>window.HLNET?.joined===true&&window.HLNET?.auth===true,null,{timeout:20000});
  check('login online',await page.locator('#netst').innerText().then(s=>s.includes('ออนไลน์')));
  await page.click('#bagb');
  await page.waitForSelector('#bag:not([hidden]) #bag-online-status',{timeout:10000});
  check('online status visible INSIDE bag',await page.locator('#bag-online-status').isVisible());
  check('online status contains actual player name',await page.locator('#bag-online-status').innerText().then(s=>s.includes('BagUxTester')));
  check('existing equipment UI stays 4 slots',await page.locator('#bag .eqs .it').count()===4);
  check('initial feedback does not occupy layout',await page.locator('#bag-feedback').isHidden());
  const potion=page.locator('#bag .bag-grid .it').filter({hasText:CFG.items.potion_s.name}).first();
  await potion.click();
  await page.waitForFunction(()=>{const el=document.getElementById('bag-feedback');return !!el&&!el.hidden&&el.textContent.includes('HP เต็ม')},null,{timeout:6000});
  check('server potion denial displayed in bag',await page.locator('#bag-feedback').innerText().then(s=>s.includes('HP เต็ม')));
  check('denied potion did not disappear from SQLite',srv.db.character(r.id).bag.find(s=>s.id==='potion_s')?.n===2);
  await page.click('#bag .eqs [data-eq="offhand"]');
  await page.waitForFunction(()=>window.HLNET?.eq?.offhand===null,null,{timeout:8000});
  check('unequip shield via UI persisted',srv.db.character(r.id).eq.offhand===null);
  check('old error clears on new item action',await page.locator('#bag-feedback').isHidden());
  check('online status survives inventory rerender',await page.locator('#bag-online-status').innerText().then(s=>s.includes('ออนไลน์')));
  await page.locator('#bag .bag-grid .it').filter({hasText:CFG.items.shield_wood.name}).first().click();
  await page.waitForFunction(()=>window.HLNET?.eq?.offhand==='shield_wood',null,{timeout:8000});
  check('shield equipped back via UI',srv.db.character(r.id).eq.offhand==='shield_wood');
  const layout=await page.locator('#bag').evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth,rect:el.getBoundingClientRect().toJSON()}));
  check('no horizontal bag overflow',layout.scroll<=layout.width+2);
  check('connection line within dialog bounds',await page.evaluate(()=>{
    const s=document.querySelector('#bag-online-status').getBoundingClientRect(),b=document.querySelector('#bag').getBoundingClientRect();
    return s.left>=b.left-1&&s.right<=b.right+1&&s.top>=b.top-1&&s.bottom<=b.bottom+1;
  }));
  const dir=path.join(__dirname,'test-artifacts');fs.mkdirSync(dir,{recursive:true});
  await page.locator('#bag').screenshot({path:path.join(dir,device==='Pixel 7'?'bag-r82-android.png':'bag-r82-iphone-webkit.png')});
  check('no page JavaScript exception',errors.length===0);
  check('no failed resource requests',failed.length===0);
  console.log('RESULT '+results.length+'/'+results.length+' PASS ('+device+' browser simulation)');
 }finally{
  if(context)await context.close();
  if(browser)await browser.close();
  if(srv)await srv.close();
  fs.rmSync(temp,{recursive:true,force:true});
 }
})().catch(e=>{console.error('FAIL R82 bag UX '+device,e);process.exitCode=1});

'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {chromium,webkit,devices}=require('playwright');
const {createServer}=require('../server/server.js');
const {ZONES}=require('../shared/world.js');
const safari=process.env.MOBILE_BROWSER==='webkit',engine=safari?webkit:chromium,device=safari?'iPhone 13':'Pixel 7';
(async()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'hl-equip-r78-'));
 const server=createServer({dbFile:path.join(tmp,'game.db'),quiet:true,startZone:'village2'});
 let browser,page;
 const errors=[];
 try{
  const start=ZONES.village2.start;
  const account=server.db.register('EquipR78Test','secret123',{zone:'village2',x:start[0],y:start[1]});
  assert(account.id);
  const c=server.db.character(account.id);
  c.cls='ผู้พิทักษ์';c.clsset=1;c.starter=1;
  c.eq={weapon:'shield_hmong',armor:'coat_cloth',acc:null};c.enh={weapon:15};
  c.bag=[{id:'sword_iron',n:1,enh:9},{id:'potion_s',n:2},{id:'hide',n:3}];
  server.db.save(c);
  const port=await server.listen(0);
  browser=await engine.launch();
  page=await browser.newPage({...devices[device]});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+port+'/?splash=0');
  await page.waitForSelector('#net:not([hidden])',{timeout:15000});
  await page.fill('#netn','EquipR78Test');await page.fill('#netp','secret123');await page.click('#netlogin');
  await page.waitForFunction(()=>window.HLNET?.auth&&window.HLNET?.joined,null,{timeout:15000});
  await page.waitForFunction(()=>window.HLNET?.eq?.offhand==='shield_hmong' && window.HLNET?.enh?.offhand===15,null,{timeout:8000});
  await page.click('#bagb');
  await page.waitForSelector('#bag:not([hidden]) .eqs [data-eq="offhand"]',{timeout:8000});
  const data=await page.evaluate(()=>{
   const bag=document.getElementById('bag'),eq=[...bag.querySelectorAll('.eqs .it')],items=[...bag.querySelectorAll('.items .it')];
   return {eqCount:eq.length,heights:eq.map(x=>Math.round(x.getBoundingClientRect().height)),bagColumns:getComputedStyle(bag.querySelector('.items')).gridTemplateColumns.split(' ').length,bagItems:items.length,overflow:bag.scrollWidth>bag.clientWidth+2,enhText:bag.querySelector('[data-eq="offhand"]')?.innerText,hasSmith:!!document.getElementById('enh')};
  });
  assert.equal(data.eqCount,4,'four equipment slots');
  assert(data.heights.every(x=>x<=77),'equipment slot size '+data.heights);
  assert.equal(data.bagColumns,3,'original backpack has three columns');
  assert.equal(data.bagItems,3,'existing backpack items preserved');
  assert(data.enhText.includes('+15'),'shield +15 label preserved');
  assert(!data.overflow,'bag horizontal overflow');
  assert(data.hasSmith,'blacksmith enhancement UI preserved');
  const dir=path.join(__dirname,'test-artifacts');fs.mkdirSync(dir,{recursive:true});
  await page.locator('#bag').screenshot({path:path.join(dir,'integrated-'+(safari?'iphone':'android')+'-bag.png')});
  await page.click('#bag .eqs [data-eq="offhand"]');
  await page.waitForFunction(()=>window.HLNET?.eq?.offhand===null && window.HLNET?.bag?.some(s=>s.id==='shield_hmong'&&s.enh===15),null,{timeout:8000});
  const old=page.locator('#bag .items .it').filter({hasText:'โล่แดงม้ง'}).first();
  await old.click();
  await page.waitForFunction(()=>window.HLNET?.eq?.offhand==='shield_hmong' && window.HLNET?.enh?.offhand===15,null,{timeout:8000});
  assert.deepEqual(errors,[],'browser JS errors');
  console.log('PASS '+device+': compact 4 equipment slots, three-column bag preserved, shield +15 legacy migration, unequip/reequip, smith UI');
 }catch(e){
  if(page)console.error('UI diagnostics:',JSON.stringify(await page.evaluate(()=>({auth:window.HLNET?.auth,joined:window.HLNET?.joined,eq:window.HLNET?.eq,enh:window.HLNET?.enh,bagHidden:document.getElementById('bag')?.hidden,loginHidden:document.getElementById('net')?.hidden})).catch(()=>null)),errors.slice(0,5));
  throw e;
 }finally{if(browser)await browser.close();await server.close();fs.rmSync(tmp,{recursive:true,force:true});}
})().catch(e=>{console.error('FAIL '+device,e);process.exitCode=1});

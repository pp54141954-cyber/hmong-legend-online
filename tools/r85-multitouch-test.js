'use strict';
// R85: multi-contact joystick + 6 real skill slots + attack, backed by an isolated WebSocket server.
// Chromium: CDP native two/three-finger touch contacts.
// WebKit: Playwright real mouse hold plus touchscreen taps on an emulated iPhone.
// These emulators do NOT certify physical Android/iPhone devices or production Render.
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {chromium,webkit,devices}=require('playwright');
const {createServer}=require('../server/server.js');
const {ZONES,SKILL_TABLE}=require('../shared/world.js');

const ios=process.env.MOBILE_BROWSER==='webkit';
const browserType=ios?webkit:chromium;
const device=ios?'iPhone 13':'Pixel 7';
const nameA='R85ControlA',nameB='R85ObserverB';
const pass='testpass123';
const point=rect=>({x:rect.x+rect.width/2,y:rect.y+rect.height/2});
const check=async(page)=>page.evaluate(()=>{
  const H=window.HL;
  return {
    joy:!!H?.joy,dir:H?.inputDir?.(),skillHolds:H?.heldSkillCount,
    attack:H?.attackHeld,attackPointer:H?.attackPointerOwner,
    connected:!!(window.HLNET?.auth&&window.HLNET?.joined),
    casts:H?.PS?.cast?H.PS.cast.key:null,
    cooldowns:{...H?.PS?.cd}
  };
});
(async()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'hl-r85-multitouch-'));
 const server=createServer({dbFile:path.join(tmp,'world.db'),quiet:true,startZone:'village2'});
 let browser,control,observer;
 const errors=[];
 try{
   const start=ZONES.village2.start;
   const active=SKILL_TABLE.filter(row=>row[0]==='นักดาบ'&&row[3]==='a'&&row[2]!=='ท่าพื้นฐาน').map(row=>row[2]);
   assert(active.length>=6,'six active swordsman skills are required in test fixture');
   for(const name of [nameA,nameB]){
     const registration=server.db.register(name,pass,{zone:'village2',x:start[0],y:start[1]});
     assert(registration.id,'isolated fixture registration failed: '+name);
     const c=server.db.character(registration.id);
     c.cls='นักดาบ';c.clsset=1;c.starter=1;c.job=30;
     c.sk=Object.fromEntries(active.map(skill=>[skill,1]));
     server.db.save(c);
   }
   const port=await server.listen(0);
   const url='http://127.0.0.1:'+port+'/?splash=0';
   // Verify the same exact R85 build that a Render deployment should expose.
   const origin='http://127.0.0.1:'+port;
   const buildResponse=await fetch(origin+'/api/build-info');
   assert.equal(buildResponse.status,200,'R85 build-info endpoint unavailable');
   const build=await buildResponse.json();
   assert.equal(build.build,'R85-V3-Calm','stale controls build');
   assert(build.input?.floatingJoystick&&build.input?.sixRealSkillSlots&&build.input?.tapToMove,
     'R85 controls missing from release fingerprint');
   const stylesheet=await fetch(origin+'/r85-calm-controls.css');
   assert.equal(stylesheet.status,200,'approved R85 style not served');
   assert((stylesheet.headers.get('content-type')||'').includes('text/css'),'R85 stylesheet wrong mime type');

   browser=await browserType.launch();
   async function login(name){
     const ctx=await browser.newContext({...devices[device]});
     const page=await ctx.newPage();
     page.on('pageerror',e=>errors.push(name+': '+e.message));
     await page.goto(url,{waitUntil:'domcontentloaded'});
     await page.waitForSelector('#net:not([hidden])',{timeout:15000});
     await page.fill('#netn',name);
     await page.fill('#netp',pass);
     await page.click('#netlogin');
     await page.waitForFunction(()=>window.HLNET?.auth===true&&window.HLNET?.joined===true&&!!window.HL?.inputDir,
       null,{timeout:15000});
     return {ctx,page};
   }
   control=await login(nameA);
   observer=await login(nameB);
   const page=control.page;
   await observer.page.waitForFunction(n=>window.HLNET?.others?.some(p=>p.name===n),
      nameA,{timeout:12000});
   assert((await check(page)).connected,'controller WebSocket is disconnected');
   assert(await observer.page.evaluate(n=>!!window.HLNET?.others?.find(p=>p.name===n),nameA),
     'second session did not receive controller from WebSocket server');

   const screen=await page.locator('#c').boundingBox();
   const attack=await page.locator('#atk').boundingBox();
   const skills=await page.locator('#skills .sk').all();
   assert(screen&&attack&&skills.length===6,'HUD controls missing');
   const centers=[];
   const slotIds=[];
   for(const el of skills){
     const rect=await el.boundingBox();assert(rect,'hidden skill slot');
     centers.push(point(rect));
     slotIds.push(Number(await el.getAttribute('data-i')));
   }
   assert(slotIds.every(n=>Number.isInteger(n)&&n>0),'skill slot ids invalid');
   const joystick={x:screen.x+screen.width*.208,y:screen.y+screen.height*.659};
   assert(joystick.x<screen.x+screen.width*.5,'joystick regression point not on left');
   const posAttack=point(attack);
   await page.waitForFunction(names=>names.every(n=>window.HLNET?.sk?.[n]>0)&&window.HL?.PS?.job>=30,
     active,{timeout:12000});
   const snapshot=await page.evaluate(()=>({className:window.HLNET?.cls,job:window.HL?.PS?.job,skills:window.HLNET?.sk}));
   assert(snapshot.job>=30,'fixture failed to set Job EXP level: '+JSON.stringify(snapshot));
   assert(slotIds.every(i=>active[i-1]&&snapshot.skills[active[i-1]]>0),
     'test fixture skills are not unlocked: '+JSON.stringify({slots:slotIds,active,received:snapshot.skills}));

   if(!ios){
     // Native Android Chromium contacts. A: joystick, B: skill, C: attack.
     const cdp=await page.context().newCDPSession(page);
     // CDP sends only the contacts changed by each event (Puppeteer-style).
     // Supplying "remaining" contacts to touchEnd would release the WRONG fingers.
     // Track all live contacts so cleanup also sends explicit release events.
     const liveContacts=new Map();
     const touch=async(type,points)=>{
       await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(p=>({
         x:p.x,y:p.y,id:p.id,radiusX:7,radiusY:7,force:.7
       }))});
       for(const p of points){
         if(type==='touchStart'||type==='touchMove')liveContacts.set(p.id,p);
         if(type==='touchEnd'||type==='touchCancel')liveContacts.delete(p.id);
       }
     };
     const A={...joystick,id:101};
     const AM={x:joystick.x+44,y:joystick.y,id:101};
     const B={...centers[0],id:102},C={...posAttack,id:103};
     const noContacts=async()=>{
       for(const p of [...liveContacts.values()].reverse())await touch('touchEnd',[p]);
     };
     try{
       await touch('touchStart',[A]);
       await touch('touchMove',[AM]);
       let state=await check(page);
       assert(state.joy&&state.dir[0]>.15,'joystick did not engage on first native finger: '+JSON.stringify(state));
       await touch('touchStart',[B]);
       state=await check(page);
       assert(state.joy&&state.skillHolds===1&&state.dir[0]>.15,
         'skill finger stole joystick: '+JSON.stringify(state));
       assert(state.cooldowns[slotIds[0]]>0,
         'native skill touch did not trigger actual cooldown: '+JSON.stringify(state));
       await touch('touchStart',[C]);
       state=await check(page);
       assert(state.joy&&state.skillHolds===1&&state.attack,
         'three-finger attack/skill/joystick input conflict: '+JSON.stringify(state));
       await touch('touchEnd',[B]);
       state=await check(page);
       assert(state.joy&&state.skillHolds===0&&state.attack,
         'releasing skill cancelled the unrelated attack or joystick: '+JSON.stringify(state));
       await touch('touchEnd',[C]);
       state=await check(page);
       assert(state.joy&&!state.attack&&state.dir[0]>.15,
         'releasing attack cancelled the joystick: '+JSON.stringify(state));
       await noContacts();
       state=await check(page);
       assert(!state.joy&&!state.attack&&state.skillHolds===0,
         'final pointer release left an input stuck: '+JSON.stringify(state));
     }finally{await noContacts().catch(()=>{})}

     // Every one of the six slots accepts its own contact while a different
     // finger continues moving the joystick. No effect damage is mocked.
     for(let i=1;i<6;i++){
       const B2={...centers[i],id:150+i};
       await page.waitForFunction(()=>!window.HL?.PS?.cast,null,{timeout:10000});
       try{
         await touch('touchStart',[A]);await touch('touchMove',[AM]);
         await touch('touchStart',[B2]);
         const during=await check(page);
         assert(during.joy&&during.skillHolds===1&&during.dir[0]>.15,
           'skill slot '+(i+1)+' interrupted joystick: '+JSON.stringify(during));
         assert(during.cooldowns[slotIds[i]]>0,
           'skill '+(i+1)+' did not use real skill cooldown: '+JSON.stringify(during));
         await touch('touchEnd',[B2]);
         const after=await check(page);
         assert(after.joy&&after.skillHolds===0,'slot '+(i+1)+' released joystick incorrectly');
       }finally{await noContacts().catch(()=>{})}
       assert(!(await check(page)).joy,'joystick stuck after skill slot '+(i+1));
     }

     // Hold a single real skill finger; when its client cooldown expires it
     // should fire again without a new pointerdown. Simulate elapsed cooldown
     // on this isolated browser client, never on the server or production.
     await page.waitForFunction(()=>!window.HL?.PS?.cast,null,{timeout:10000});
     const single={...centers[0],id:190};
     try{
       await touch('touchStart',[single]);
       assert.equal((await check(page)).skillHolds,1,'held skill did not register');
       await page.evaluate(i=>{window.HL.PS.cd[i]=0;window.HL.PS.cast=null},slotIds[0]);
       await page.waitForFunction(i=>window.HL.PS.cd[i]>0,slotIds[0],{timeout:3000});
       assert.equal((await check(page)).skillHolds,1,'skill finger released before cooldown reuse');
       await noContacts();
       assert.equal((await check(page)).skillHolds,0,'skill hold stuck after touch end');
     }finally{await noContacts().catch(()=>{})}
   }else{
     // WebKit supports real Playwright mouse + touchscreen input concurrently;
     // browser-level 3-touch CDP is Chromium-only, so do not claim WebKit triple-touch.
     const captureLog=await page.evaluate(()=>{
       window.__r85Observed=[];
       for(const el of [...document.querySelectorAll('#skills .sk'),document.getElementById('atk')]){
         el.addEventListener('pointerdown',e=>window.__r85Observed.push({
           id:el.dataset.i||'attack',type:e.pointerType,
           joy:!!window.HL.joy,skillHolds:window.HL.heldSkillCount,
           attack:window.HL.attackHeld
         }));
       }
       document.getElementById('c').addEventListener('pointerdown',()=>{
         window.__r85Observed.push({id:'joystick',joy:!!window.HL.joy,
           skillHolds:window.HL.heldSkillCount,attack:window.HL.attackHeld});
       });
       return window.__r85Observed.length;
     });
     assert.equal(captureLog,0);
     await page.mouse.move(joystick.x,joystick.y);
     await page.mouse.down();
     try{
       await page.mouse.move(joystick.x+44,joystick.y,{steps:4});
       assert((await check(page)).dir[0]>.15,'WebKit pointer joystick did not move');
       for(let i=0;i<6;i++){
         await page.waitForFunction(()=>!window.HL?.PS?.cast,null,{timeout:10000});
         await page.touchscreen.tap(centers[i].x,centers[i].y);
         const state=await check(page);
         assert(state.joy&&state.dir[0]>.15&&state.skillHolds===0,
           'WebKit skill tap dropped joystick or held input: '+JSON.stringify({i,state}));
         assert(state.cooldowns[slotIds[i]]>0,
           'WebKit actual skill cooldown did not engage for slot '+(i+1));
       }
       await page.touchscreen.tap(posAttack.x,posAttack.y);
       assert((await check(page)).joy,'WebKit attack tap cancelled joystick');
       const eventLog=await page.evaluate(()=>window.__r85Observed);
       for(let i=0;i<6;i++)assert(eventLog.some(e=>e.id===String(slotIds[i])&&e.joy),
         'WebKit skill '+(i+1)+' never received input while joystick held');
       assert(eventLog.some(e=>e.id==='attack'&&e.joy),
         'WebKit attack never received second contact while joystick held');
     }finally{await page.mouse.up()}
     assert(!(await check(page)).joy,'WebKit joystick remained active after mouse up');

     // Reversed ownership: hold attack with mouse, tap joystick with a real
     // touchscreen contact. A touch end must not cancel the held mouse attack.
     await page.mouse.move(posAttack.x,posAttack.y);await page.mouse.down();
     try{
       assert((await check(page)).attack,'WebKit held attack failed');
       await page.touchscreen.tap(joystick.x,joystick.y);
       const log=await page.evaluate(()=>window.__r85Observed);
       assert(log.some(e=>e.id==='joystick'&&e.joy&&e.attack),
         'WebKit touchscreen joystick never overlapped held attack');
       assert((await check(page)).attack,'WebKit joystick touch released attack');
     }finally{await page.mouse.up()}
     assert(!(await check(page)).attack,'WebKit attack was stuck after pointerup');
   }

   assert((await check(page)).connected,'controller lost websocket during multi-touch');
   assert(await observer.page.evaluate(n=>!!window.HLNET?.others?.some(p=>p.name===n),nameA),
      'observer lost remote player while controls were active');
   assert.deepEqual(errors,[],'browser JS errors: '+errors.join(' | '));
   console.log('PASS R85 multi-touch '+(ios?'iPhone WebKit':'Android Chromium')+
     ': isolated WebSocket 2 sessions, 6 actual skill cooldowns, joystick and attack pointer independence'+
     (ios?' (mouse + touchscreen overlap)':' (native triple touch + held repeat)'));
 }catch(err){
   if(control?.page)console.error('R85 multi-touch state:',await check(control.page).catch(()=>null),errors);
   throw err;
 }finally{
   if(control)await control.ctx.close().catch(()=>{});
   if(observer)await observer.ctx.close().catch(()=>{});
   if(browser)await browser.close();
   await server.close();
   fs.rmSync(tmp,{recursive:true,force:true});
 }
})().catch(err=>{console.error('FAIL R85 multi-touch',err);process.exitCode=1});

// R85 mobile controls regression: joystick cancellation, dual-touch input, target facing and held skills.
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {chromium,webkit,devices}=require('playwright');
const {createServer}=require('../server/server.js');
const {ZONES}=require('../shared/world.js');
const ios=process.env.MOBILE_BROWSER==='webkit',engine=ios?webkit:chromium,device=ios?'iPhone 13':'Pixel 7';
(async()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'hl-control-r85-')),server=createServer({dbFile:path.join(tmp,'game.db'),quiet:true,startZone:'village2'});
 let browser,page;const errors=[];
 try{
  const start=ZONES.village2.start;
  const account=server.db.register('ControlR85','secret123',{zone:'village2',x:start[0],y:start[1]});
  assert(account.id,'failed to seed account');
  const character=server.db.character(account.id);
  character.cls='นักดาบ';character.clsset=1;character.starter=1;character.job=30;
  server.db.save(character);
  const port=await server.listen(0);
  browser=await engine.launch();
  page=await browser.newPage({...devices[device]});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+port+'/?splash=0');
  await page.waitForSelector('#net:not([hidden])',{timeout:15000});
  await page.fill('#netn','ControlR85');await page.fill('#netp','secret123');await page.click('#netlogin');
  await page.waitForFunction(()=>!!window.HLNET?.auth&&!!window.HLNET?.joined,null,{timeout:15000});
  const layout=await page.evaluate(()=>{
    const joy=document.getElementById('c').getBoundingClientRect();
    const a=document.getElementById('atk').getBoundingClientRect();
    const t=document.getElementById('tbtn').getBoundingClientRect();
    const sk=document.querySelector('#skills .sk').getBoundingClientRect();
    return {width:innerWidth,height:innerHeight,canvas:{x:joy.x,y:joy.y,w:joy.width,h:joy.height},buttons:[a,t,sk].map(r=>({x:r.x,y:r.y,w:r.width,h:r.height}))};
  });
  assert(layout.buttons.every(r=>r.width>0&&r.y>=0&&r.y+r.height<=layout.height+1),'combat buttons outside mobile viewport: '+JSON.stringify(layout));
  assert(await page.locator('#tbtn').isVisible(),'target control missing');
  // Use pointer events with real mouse drag for joystick input; ensure stop on lost capture.
  const px=Math.max(86,layout.canvas.w*.17),py=layout.canvas.h-Math.max(130,layout.canvas.h*.16);
  await page.mouse.move(px,py);await page.mouse.down();
  await page.mouse.move(px+60,py+5,{steps:4});
  let state=await page.evaluate(()=>({joy:window.HL.joy,dir:window.HL.inputDir()}));
  assert(state.joy,'joystick did not capture pointer');
  assert(state.dir[0]>.65,'joystick failed rightward analog control: '+JSON.stringify(state.dir));
  // Extra synthetic pointer on skill button must not steal the joystick pointer.
  state=await page.evaluate(()=>{
    const b=document.querySelector('#skills .sk');
    b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,pointerId:88,clientX:innerWidth*.78,clientY:innerHeight*.65}));
    const d=window.HL.inputDir(),joyId=window.HL.joy?.id;
    b.dispatchEvent(new PointerEvent('pointercancel',{bubbles:true,pointerId:88}));
    return {d,joyId};
  });
  assert(state.joyId!==null&&state.d[0]>.65,'second finger cancelled movement unexpectedly: '+JSON.stringify(state));
  await page.mouse.up();
  state=await page.evaluate(()=>({joy:window.HL.joy,dir:window.HL.inputDir()}));
  assert.equal(state.joy,null,'joystick stuck after pointerup');
  assert.equal(state.dir[0],0,'movement remains after release');
  // Lost pointer capture, browser blur and hidden-tab lifecycle must cancel input safely.
  const lost=await page.evaluate(()=>{
    const c=document.getElementById('c');
    c.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:75,clientX:80,clientY:innerHeight-120}));
    c.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerId:75,clientX:140,clientY:innerHeight-120}));
    const before=!!window.HL.joy;
    c.dispatchEvent(new PointerEvent('lostpointercapture',{bubbles:true,pointerId:75}));
    return {before,after:window.HL.joy};
  });
  assert(lost.before&&!lost.after,'joystick stuck after lostpointercapture');
  const bl=await page.evaluate(()=>{
    const c=document.getElementById('c');
    c.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:76,clientX:80,clientY:innerHeight-120}));
    window.dispatchEvent(new Event('blur'));
    return window.HL.joy;
  });
  assert.equal(bl,null,'joystick stuck after tab blur');
  // Inject a visual monster fixture briefly. This tests manual selection/auto-facing without changing server combat.
  const aim=await page.evaluate(()=>{
    const h=window.HL,p=h.player;
    h.setMons([{type:'เป้าทดสอบ',x:p.x+65,y:p.y-2,hp:99,c:{size:24,hp:99,lv:1},state:'idle',away:false}]);
    document.getElementById('tbtn').click();
    const tgt=h.lastTarget,pressed=document.getElementById('tbtn').getAttribute('aria-pressed');
    h.PS.cast=null;h.PS.cd.b=0;h.attack();
    return {target:tgt?.type,pressed,dir:h.player.dir,cast:!!h.PS.cast};
  });
  assert.equal(aim.target,'เป้าทดสอบ','manual target selection failed');
  assert.equal(aim.pressed,'true','target indicator not enabled');
  assert.equal(aim.dir,'E','attack does not face selected target');
  assert(aim.cast,'basic attack did not begin');
  // Armed held skill: after first cast, reduce cooldown to simulate ready and ensure hold triggers again.
  const hold=await page.evaluate(async()=>{
    const h=window.HL,b=document.querySelector('#skills .sk');
    const index=Number(b.dataset.i),skill=h.CFG.skillFor('นักดาบ',index);
    h.PS.job=30;window.HLNET.sk=window.HLNET.sk||{};
    const skillName=b.getAttribute('aria-label');window.HLNET.sk[skillName]=1;
    h.PS.cast=null;h.PS.cd[index]=0;
    b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,pointerId:103}));
    const first=!!h.PS.cast;
    h.PS.cast=null;h.PS.cd[index]=0;
    await new Promise(resolve=>setTimeout(resolve,540));
    const repeated=!!h.PS.cast||h.PS.cd[index]>0;
    b.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:103}));
    return {index,shape:skill?.shape,first,repeated};
  });
  assert(hold.first,'skill not cast at pointerdown: '+JSON.stringify(hold));
  assert(hold.repeated,'skill did not repeat while held after simulated cooldown: '+JSON.stringify(hold));
  await page.waitForTimeout(150);
  assert.deepEqual(errors,[],'browser JS errors: '+errors.join('; '));
  const dir=path.join(__dirname,'test-artifacts');fs.mkdirSync(dir,{recursive:true});
  await page.screenshot({path:path.join(dir,ios?'controls-r85-iphone-webkit.png':'controls-r85-android-chromium.png')});
  console.log('PASS '+device+' '+(ios?'WebKit':'Chromium')+': analog drag/release, multi-touch, blur recovery, target-facing, held-skill repeats');
 }catch(e){
  if(page){
   console.error('R85 diagnostics:',JSON.stringify({errors,state:await page.evaluate(()=>({online:window.HLNET?.state,auth:window.HLNET?.auth,joy:window.HL?.joy,dir:window.HL?.inputDir?.()})).catch(()=>null)}));
   const dir=path.join(__dirname,'test-artifacts');fs.mkdirSync(dir,{recursive:true});
   await page.screenshot({path:path.join(dir,ios?'controls-r85-iphone-failure.png':'controls-r85-android-failure.png')}).catch(()=>{});
  }
  throw e;
 }finally{if(browser)await browser.close();await server.close();fs.rmSync(tmp,{recursive:true,force:true})}
})().catch(e=>{console.error('FAIL R85 mobile controls:',e);process.exitCode=1});

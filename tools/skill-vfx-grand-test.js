// Staging-only browser regression for opt-in grand skill effects.
// Tests real game HTML, projection, game-generated fx, baseline parity,
// and JS exceptions. It does not test or deploy to Render.
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {chromium,webkit,devices}=require('playwright');
const {createServer}=require('../server/server');
const fx=require('../game/skill-vfx-grand');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let n=0;
const ok=(title,val)=>{assert.ok(val,title);n++;console.log('PASS '+title);};
(async()=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'hl-grand-vfx-'));
  const server=createServer({dbFile:path.join(tmp,'test.db'),quiet:true,startZone:'field'});
  let browser;
  try{
    const field=server.sim.zones.field;
    assert.ok(field);
    const x=field.G.D.start[0],y=field.G.D.start[1];
    const user='GrandVfxPilot';
    const reg=server.db.register(user,'testpass123',{zone:'field',x,y});
    assert.ok(reg.id);
    const char=server.db.character(reg.id);
    char.cls='ผู้พิทักษ์';char.clsset=1;char.starter=1;
    server.db.save(char);
    const port=await server.listen(0),root='http://127.0.0.1:'+port;
    const raw=fs.readFileSync(path.join(__dirname,'..','game','index.html'),'utf8');
    const defaultHtml=await (await fetch(root+'/')).text();
    ok('normal game HTML remains byte-for-byte unchanged',defaultHtml===raw);
    const previewHtml=await (await fetch(root+'/?grandvfx=1')).text();
    ok('opt-in game HTML loads VFX engine and bridge',
      previewHtml.includes('Hmong Legend V2.0 — Grand Skill VFX') &&
      previewHtml.includes('HLGrandStage') &&
      previewHtml.length>raw.length);
    const logic=fx.create({quality:'low'});
    ok('effect API rejects invalid world coordinates',!logic.emit({kind:'sword',x:NaN,y:40}));
    ok('effect API accepts original guardian wing effect',logic.emit({kind:'shield',x:100,y:100,tier:3}));
    ok('mobile effect pool is capped',(()=>{for(let i=0;i<60;i++)logic.emit({kind:'ice',x:10+i,y:20});return logic.count<=logic.max})());
    const browserName=process.env.VFX_BROWSER==='webkit'?'webkit':'chromium';
    browser=await (browserName==='webkit'?webkit:chromium).launch();
    const device=browserName==='webkit'?'iPhone 13':'Pixel 7';
    const context=await browser.newContext({...devices[device]});
    const page=await context.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(root+'/?splash=0&grandvfx=1',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>Boolean(window.HLGrandStage?.enabled&&window.HL?.player),null,{timeout:15000});
    ok('game and independent visual overlay initialize',await page.evaluate(()=>
      !!window.HLGrandStage?.layer && window.HLGrandStage.layer.id==='hl-grand-vfx-layer'));
    await page.waitForFunction(()=>Array.isArray(window.HLGrandStage?.worldMatrix),null,{timeout:10000});
    ok('new layer receives game world-camera transform',await page.evaluate(()=>
      window.HLGrandStage.worldMatrix.every(Number.isFinite)));
    await page.waitForSelector('#net:not([hidden])',{timeout:10000});
    await page.fill('#netn',user);await page.fill('#netp','testpass123');await page.click('#netlogin');
    await page.waitForFunction(()=>window.HLNET?.joined===true,null,{timeout:15000});
    ok('existing real login works with visual plugin',await page.evaluate(()=>window.HLNET?.joined===true));
    await page.evaluate(()=>{
      const H=window.HL,fx=window.HLGrandStage;
      fx.emit({kind:'shield',x:H.player.x,y:H.player.y-14,dir:'S',tier:3});
    });
    await page.waitForTimeout(180);
    const visible=await page.evaluate(()=>{
      const a=window.HLGrandStage.layer;
      const ctx=a.getContext('2d'),pixel=ctx.getImageData(0,0,a.width,a.height).data;
      let count=0;for(let i=3;i<pixel.length;i+=4)if(pixel[i]>10)count++;
      return {count,w:a.width,h:a.height};
    });
    ok('grand guardian effect draws visible pixels on top of real map',visible.count>120);
    const out=path.join(__dirname,'test-artifacts');fs.mkdirSync(out,{recursive:true});
    await page.screenshot({path:path.join(out,'grand-vfx-'+browserName+'-guardian.png')});
    await page.evaluate(()=>{
      const H=window.HL;
      H.fxList.push({k:'cboom',x:H.player.x+38,y:H.player.y-14,t:.7,r:80,col:'#ac8bff'});
    });
    await page.waitForFunction(()=>window.HLGrandStage.count>=1,null,{timeout:3000});
    ok('bridge recognizes game-native effect events',await page.evaluate(()=>window.HLGrandStage.count>0));
    await page.waitForTimeout(900);
    ok('VFX instances expire without unbounded accumulation',
      await page.evaluate(()=>window.HLGrandStage.count===0));
    ok('no browser JavaScript exceptions',errors.length===0);
    await context.close();
    console.log('RESULT: '+n+'/'+n+' PASS ('+browserName+' mobile emulation, isolated server)');
  }finally{
    if(browser)await browser.close();
    await server.close();
    fs.rmSync(tmp,{recursive:true,force:true});
  }
})().catch(e=>{console.error('FAIL VFX:',e);process.exitCode=1;});

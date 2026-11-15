// Visual regression on the isolated test server, never on Render or real accounts.
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {chromium,webkit,devices}=require('playwright');
const {createServer}=require('../server/server.js');
const {SKILL_TABLE,ZONES}=require('../shared/world.js');
async function run(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hl-vfx-'));
 const srv=createServer({dbFile:path.join(dir,'game.db'),quiet:true,startZone:'village2'});
 const results=[];
 const check=(name,condition)=>{assert.ok(condition,name);results.push(name);console.log('PASS '+name)};
 const cases=[
  {name:'FxSword',cls:'นักดาบ',engine:chromium,device:'Pixel 7',output:'skill-vfx-android.png'},
  {name:'FxMage',cls:'ผู้ใช้มนตรา',engine:webkit,device:'iPhone 13',output:'skill-vfx-iphone.png'}
 ];
 try{
  for(const item of cases){
   const spawn=ZONES.village2.start;
   const r=srv.db.register(item.name,'testpass123',{zone:'village2',x:spawn[0],y:spawn[1]});
   assert.ok(r.id);const c=srv.db.character(r.id);
   c.cls=item.cls;c.clsset=1;c.starter=1;c.job=30;c.sk={};
   for(const row of SKILL_TABLE)if(row[0]===item.cls&&row[3]==='a')c.sk[row[2]]=1;
   c.eq={weapon:item.cls==='นักดาบ'?'sword_wood':'book_wood',offhand:null,armor:'coat_cloth',acc:null};
   srv.db.save(c);
  }
  const port=await srv.listen(0);
  for(const item of cases){
   const browser=await item.engine.launch();
   try{
    const context=await browser.newContext({...devices[item.device]});
    const page=await context.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:'+port+'/?splash=0',{waitUntil:'domcontentloaded'});
    await page.waitForSelector('#net:not([hidden])',{timeout:30000}).catch(async e=>{console.error('LOGIN DEBUG '+item.device+' '+JSON.stringify(await page.evaluate(()=>({ready:document.readyState,netHidden:document.getElementById('net')?.hidden,hasHL:!!window.HL,hasNET:!!window.HLNET})).catch(()=>({})))+' JS errors='+errors.join(' / '));throw e});
    await page.fill('#netn',item.name);await page.fill('#netp','testpass123');await page.click('#netlogin');
    await page.waitForFunction(()=>window.HLNET?.auth&&window.HLNET?.joined&&window.HL?.useSkill,null,{timeout:18000});
    await page.waitForFunction(()=>window.HLNET?.sk?.[window.HL?.skName(3)]>=1,null,{timeout:10000});
    check(item.device+' enters online game',await page.evaluate(()=>HLNET.joined&&HL.curCls()=== (HLNET.cls)));
    for(const slot of [3,9]){
     const activation=await page.evaluate(n=>({result:HL.useSkill(n),currentClass:HL.curCls(),shapes:HL.fxList.map(f=>f.k)}),slot);
     check(item.device+' activates skill '+slot,activation.result==='ok');
     check(item.device+' keeps approved sprite chart '+slot,activation.shapes.some(k=>/^cchart/.test(k)));
     check(item.device+' has charge halo '+slot,activation.shapes.includes('cgrand'));
     // Emulated mobile canvases can render at <5fps in CI. Step the isolated client clock
     // deterministically instead of tying cast-phase assertions to wall-clock/frame rate.
     const timing=await page.evaluate(()=>{for(let n=0;n<12;n++)HL.update(0.05);return {
       current:HL.tNow,phases:HL.fxList.filter(f=>f.k==='cgrand').map(f=>({phase:f.phase,q:f.q,r:f.r})),
       cast:HL.PS.cast&&{done:HL.PS.cast.done,t:HL.PS.cast.t}
     }});
     console.log('VFX PHASE '+item.device+' skill '+slot+' '+JSON.stringify(timing)+' errors='+errors.join(' / '));
     const render=await page.evaluate(()=>({newEffects:HL.fxList.filter(f=>f.k==='cgrand').map(f=>({phase:f.phase,r:f.r,q:f.q})),
      original:HL.fxList.some(f=>/^cchart/.test(f.k))}));
     check(item.device+' cinematic release phase '+slot,render.newEffects.some(f=>f.phase==='release'&&f.r>=98));
     check(item.device+' cinematic layer not hidden '+slot,render.newEffects.some(f=>f.phase==='release'&&f.q!==true));
     if(slot===9){
      // Freeze the in-flight VFX at the intended ACTION frame *in the isolated test fixture*.
      // Slow CI software renderers otherwise advance the effect to the blank recovery frame
      // before page.screenshot() can capture it. This does not change game code or timing.
      const frozen=await page.evaluate(()=>{
       const active=HL.fxList.filter(f=>f.k==='cgrand'||/^cchart/.test(f.k));
       for(const f of active){f.T=15;f.t=f.k==='cgrand'?9:10;f.q=false}
       return {effects:active.length,stages:active.map(f=>f.k)};
      });
      check(item.device+' has cinematic effects frozen for visual inspection',frozen.effects>=2);
      console.log('VFX SCREENSHOT FRAME '+item.device+' '+JSON.stringify(frozen));
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>resolve())));
      const dir=path.join(__dirname,'test-artifacts');fs.mkdirSync(dir,{recursive:true});
      await page.screenshot({path:path.join(dir,item.output),animations:'disabled'});
     }
     await page.evaluate(()=>{for(let n=0;n<22;n++)HL.update(0.05)}); // finish local cast without relying on software canvas FPS
    }
    check(item.device+' has no JavaScript exceptions',errors.length===0);
    await context.close();
   }finally{await browser.close()}
  }
  console.log('RESULT: '+results.length+'/'+results.length+' PASS (isolated Chromium/WebKit, visual effect smoke)');
 }finally{await srv.close();fs.rmSync(dir,{recursive:true,force:true})}
}
run().catch(e=>{console.error('FAIL skill FX:',e);process.exitCode=1});

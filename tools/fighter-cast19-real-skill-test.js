/* Isolated end-to-end: actual Hmong Legend server+login+WebSocket+game.useSkill
 * plus Cast19 hook. CI uses a clearly SYNTHETIC 1752x1280 test sprite;
 * it verifies integration, NOT the uploaded user's art's visual fidelity.
 * The real approved asset is separately contained in the delivery ZIP.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {chromium,webkit,devices}=require('playwright');
const {createServer}=require('../server/server');
const {CFG,SKILL_TABLE}=require('../shared/world');
const check=(name,p)=>{assert.ok(p,name);console.log('PASS '+name)};
(async()=>{
 const engine=process.env.CAST19_BROWSER==='webkit'?webkit:chromium;
 const label=process.env.CAST19_BROWSER==='webkit'?'webkit':'chromium';
 const fixture=path.resolve(__dirname,'../game/sprites/fighter_cast19_user.webp');
 check('synthetic fixture exists; this is NOT original art',fs.existsSync(fixture));
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'hl-fighter19-integrate-'));
 const server=createServer({dbFile:path.join(root,'game.sqlite'),quiet:true,startZone:'village2'});
 let browser,context;
 try{
  const user='Fighter19Pilot';
  const home=CFG.player.home==='village2'?'village2':'village2';
  const start=server.sim.zones[home].G.D.start;
  const reg=server.db.register(user,'testpass123',{zone:home,x:start[0],y:start[1]});
  assert.ok(reg.id);
  const ch=server.db.character(reg.id);ch.cls='นักสู้';ch.clsset=1;ch.starter=1;ch.job=30;ch.lv=30;
  const names=SKILL_TABLE.filter(r=>r[0]==='นักสู้'&&r[3]==='a'&&r[2]!=='ท่าพื้นฐาน');
  check('existing game confirms 9 unlocked active skills',names.length===11);
  ch.sk=Object.fromEntries(names.slice(2).map(r=>[r[2],1]));
  ch.eq={weapon:'fists_iron',offhand:null,armor:'coat_cloth',acc:null};
  server.db.save(ch);
  const port=await server.listen(0);
  browser=await engine.launch(process.env.CAST19_EXECUTABLE?{executablePath:process.env.CAST19_EXECUTABLE}:{});
  context=await browser.newContext({...devices[label==='webkit'?'iPhone 13':'Pixel 7']});
  const page=await context.newPage();const errors=[];
  page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE_ERROR',e.message)});
  const url='http://127.0.0.1:'+port+'/?splash=0&fightercast19=1';
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.HLFighter19Cast?.installed&&window.HL?.useSkill,
    null,{timeout:25000});
  await page.waitForSelector('#net:not([hidden])',{timeout:25000});
  await page.fill('#netn',user);await page.fill('#netp','testpass123');await page.click('#netlogin');
  await page.waitForFunction(()=>window.HLNET?.joined&&window.HL.curCls()==='นักสู้',
    null,{timeout:18000}).catch(async e=>{
      console.error('LOGIN_DIAGNOSTICS',JSON.stringify(await page.evaluate(()=>({
        netVisible:!document.querySelector('#net')?.hidden,
        joined:window.HLNET?.joined,netState:window.HLNET?.state,
        cls:window.HL?.curCls?.(),bodyText:document.body.innerText.slice(-700)
      }))));
      throw e;
    });
  await page.waitForFunction(()=>window.HLFighter19Cast.ready,null,{timeout:16000});
  check('single fightercast19 flag activates both original nine-skill VFX and Cast19',await page.evaluate(()=>
    window.HLGrandStage?.realFighterEnabled===true&&window.HLFighter19Cast?.installed===true));
  check('actual game account joined and synthetic Cast19 sheet decoded',true);
  check('owner-provided ordinal maps remain exact',await page.evaluate(()=>{
    const f=window.HLFighter19Cast;
    return JSON.stringify(f.POINTS)==='{"S":[17,18,19,20,21],"N":[13,14,15,16],"W":[6,7,8,9,10,11],"E":[1,2,3,4]}';
  }));
  check("game's original approved Fighter character is available",await page.evaluate(()=>{
    const H=window.HL;return H.classAtk('นักสู้',H.PS.look)?.img.naturalWidth>0;
  }));
  await page.waitForFunction(()=>window.HLGrandStage?.fighterApprovedAtlasReady&&
    window.HLGrandStage?.fighterDirectionalAtlasReady,null,{timeout:16000});
  check('approved Fighter VFX atlas available for both horizontal and vertical skills',true);
    const artDir=path.join(__dirname,'test-artifacts');fs.mkdirSync(artDir,{recursive:true});
  for(let slot=3;slot<=11;slot++){
    await page.waitForFunction(()=>!window.HL.PS.cast,null,{timeout:12000});
    const dir=['E','W','S','N'][(slot-3)%4];
    await page.evaluate(d=>{window.HL.player.dir=d},dir);
    const before=await page.evaluate(()=>({
      cast:window.HLFighter19Cast.draws,effect:window.HLGrandStage.fighterAtlasFrames
    }));
    const result=await page.evaluate(n=>window.HL.useSkill(n),slot);
    check('actual useSkill('+slot+') accepted skill '+names[slot-1][2],result==='ok');
    await page.waitForFunction(arg=>window.HLFighter19Cast.draws>arg.before.cast&&
      window.HLFighter19Cast.last?.slot===arg.slot,
      {before,slot},{timeout:11000});
    await page.waitForFunction(arg=>{
      const H=window.HLGrandStage;
      return H?.fighterAtlasFrames>arg.before.effect&&H?.fighterLastFrame?.slot===arg.slot&&
       H?.martialEvents?.some(e=>e.slot===arg.slot);
    },{before,slot},{timeout:12000});
    const resultData=await page.evaluate(()=>({
      last:window.HLFighter19Cast.last,
      lastVFX:window.HLGrandStage.fighterLastFrame,
      vfxAtlasDraws:window.HLGrandStage.fighterAtlasFrames,
      released:window.HLGrandStage.martialEvents.some(e=>e.slot===window.HLFighter19Cast.last?.slot),
      draws:window.HLFighter19Cast.draws,
      clientClass:window.HL.curCls(),
      fighterEffect:window.HLGrandStage?.realFighterEnabled
    }));
    check('real cast sprite hook drew skill '+slot+' from approved ordinal list',
      resultData.last?.slot===slot&&resultData.draws>before.cast&&
      windowSafe(resultData.last.originalPoint)&&resultData.fighterEffect);
    check('skill '+slot+' releases its approved Fighter VFX alongside Cast19',
      resultData.lastVFX?.slot===slot&&resultData.vfxAtlasDraws>before.effect&&
      resultData.released&&resultData.lastVFX?.dir===dir&&
      resultData.lastVFX?.source===(dir==='E'||dir==='W'?'approved-side':'approved-updown'));
    if([3,7,11].includes(slot)){
      await page.screenshot({path:path.join(artDir,'cast19-'+label+'-test-fixture-slot'+slot+'.png')});
    }
  }
  check('no JavaScript page exceptions during real nine skill calls',errors.length===0);
  await context.close();context=null;
  console.log('RESULT: NINE REAL GAME SKILLS PASS with synthetic test fixture ('+label+'); real owner art still needs binary upload');
 }finally{
  if(context)await context.close();
  if(browser)await browser.close();
  await server.close();
  fs.rmSync(root,{recursive:true,force:true});
 }
 function windowSafe(n){return Number.isInteger(n)&&n>0&&![5,12].includes(n)}
})().catch(e=>{console.error('FAIL Cast19 actual game integration',e);process.exitCode=1});

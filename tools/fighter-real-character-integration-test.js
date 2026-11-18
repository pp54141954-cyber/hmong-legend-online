// Verify the NINE real นักสู้ active skill effects against existing CSV and game casts.
// Isolated server and simulated mobile browsers only; never touch Render or players.
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {chromium,webkit,devices}=require('playwright');
const {createServer}=require('../server/server');
const {SKILL_TABLE,CFG}=require('../shared/world');
const M=require('../game/martial-vfx');
const F=require('../game/fighter-vfx-real');
const check=(name,condition)=>{assert.ok(condition,name);console.log('PASS '+name);};
(async()=>{
 const rows=SKILL_TABLE.filter(r=>r[0]==='นักสู้'&&r[3]==='a'&&r[2]!=='ท่าพื้นฐาน');
 check('exactly 9 non-default martial active skills plus two original starter skills',rows.length===11&&M.SKILLS.length===9&&F.SKILLS.length===9);
 for(const def of M.SKILLS){
  const table=rows[def.slot-1],mechanic=CFG.classSkills['นักสู้'][def.slot-3];
  check('approved fighter visual name matches '+def.slot,F.SKILLS[def.slot-3]?.name===def.name);
  check('approved '+def.slot+' '+def.name,table?.[2]===def.name&&table[1]===def.path);
  check('unchanged combat mechanics for '+def.name,mechanic.shape===def.shape&&
    (!def.art||mechanic.art===def.art)&&(!def.fxk||mechanic.fxk===def.fxk));
 }
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'hl-martial-nine-'));
 const srv=createServer({dbFile:path.join(tmp,'db.sqlite'),quiet:true,startZone:'village2'});
 let browser;
 try{
  const user='MartialNinePilot';
  const p=CFG.player.home==='village2'?CFG.player.home:'village2';
  const point=srv.sim.zones[p].G.D.start;
  const reg=srv.db.register(user,'testpass123',{zone:p,x:point[0],y:point[1]});
  assert.ok(reg.id);
  const c=srv.db.character(reg.id);
  c.cls='นักสู้';c.clsset=1;c.starter=1;c.job=30;c.lv=30;
  c.sk=Object.fromEntries(M.SKILLS.map(s=>[s.name,1]));
  c.eq={weapon:'fists_iron',offhand:null,armor:'coat_cloth',acc:null};
  c.bag=[{id:'potion_s',n:2}];
  srv.db.save(c);
  const port=await srv.listen(0);
  const browserType=process.env.VFX_BROWSER==='webkit'?'webkit':'chromium';
  browser=await(browserType==='webkit'?webkit:chromium).launch();
  const context=await browser.newContext({...devices[browserType==='webkit'?'iPhone 13':'Pixel 7']});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE_ERROR',e.message)});
  await page.goto('http://127.0.0.1:'+port+'/?splash=0&fightervfx=1',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.HLGrandStage?.enabled&&window.HL?.useSkill,null,{timeout:20000});
  await page.waitForSelector('#net:not([hidden])',{timeout:22000});
  await page.fill('#netn',user);await page.fill('#netp','testpass123');await page.click('#netlogin');
  await page.waitForFunction(()=>window.HLNET?.joined&&window.HL.curCls()==='นักสู้',null,{timeout:18000});
  await page.waitForFunction(()=>window.HL.PS.job>=30&&window.HLNET?.sk?.['สัญชาตญาณดุร้าย']>0,null,{timeout:10000});
  check('real isolated account has martial class and unlocked skills',true);
  check('visuals use approved existing male or female fighter sprite',await page.evaluate(()=>{
    const H=window.HL;
    return !!H.classBody('นักสู้',H.PS.look)&&!!H.classBody('นักสู้',H.PS.look).naturalWidth;
  }));
  check('staging real character effect bridge is active',await page.evaluate(()=>
    window.HLGrandStage.realFighterEnabled&&window.HLFighterRealVFX.SKILLS.length===9));
  check('all nine skill profile signatures agree with runtime',await page.evaluate(()=>{
    const H=window.HL,M=window.HLMartialVFX;
    return M.SKILLS.every(s=>M.profileFor(H,s.slot)?.name===s.name);
  }));
  const out=path.join(__dirname,'test-artifacts');fs.mkdirSync(out,{recursive:true});
  for(const spec of M.SKILLS){
    await page.waitForFunction(()=>!window.HL.PS.cast,null,{timeout:11000});
    const d=['E','W','S','N'][(spec.slot-3)%4];
    await page.evaluate(direction=>{window.HL.player.dir=direction;},d);
    const returned=await page.evaluate(slot=>window.HL.useSkill(slot),spec.slot);
    check('real useSkill('+spec.slot+') accepts '+spec.name,returned==='ok');
    await page.waitForFunction(v=>window.HLGrandStage.martialEvents.some(e=>e.slot===v.slot&&e.name===v.name),
      {slot:spec.slot,name:spec.name},{timeout:12000});
    const recent=await page.evaluate(slot=>{
      const H=window.HLGrandStage,matched=H.martialEvents.filter(e=>e.slot===slot);
      return {event:matched.at(-1),visible:H.martialCount>0,errors:!!window.HL?.player};
    },spec.slot);
    check('skill '+spec.slot+' renders its OWN correct type on real fighter',recent.event?.kind===spec.kind&&recent.visible);
    await page.waitForFunction(()=>window.HLGrandStage.fighterApprovedAtlasReady&&
      window.HLGrandStage.fighterDirectionalAtlasReady,null,{timeout:12000});
    check('up/down effect atlas has blue defense and pink tiger tint',
      await page.evaluate(()=>window.HLGrandStage.fighterDirectionalRecolorReady));
    await page.waitForFunction(slot=>window.HLGrandStage.fighterLastFrame?.slot===slot,
      spec.slot,{timeout:9000});
    check('skill '+spec.slot+' uses approved 9x5 Fighter atlas (not generic circles)',
      await page.evaluate(slot=>{
        const stage=window.HLGrandStage;
        return stage.fighterAtlasFrames>0&&stage.fighterLastFrame.slot===slot;
      },spec.slot));
    check('existing chart art for '+spec.slot+' is suppressed only in Fighter preview',
      await page.evaluate(()=>window.HL.fxList.some(f=>f.cls==='นักสู้'&&
       /^cchart/.test(f.k||'')&&f.q===true)));
    if(spec.slot>=9){
      await page.waitForFunction(()=>window.HLGrandStage.fighterTigerReady,null,{timeout:12000});
      check('spectral tiger uses existing game tiger sprite for skill '+spec.slot,
        await page.evaluate(()=>window.HLGrandStage.fighterTigerReady));
    }
    // Screenshots are captured during the active effect, not after expiry.
    await page.screenshot({path:path.join(out,'real-fighter-'+browserType+'-'+String(spec.slot).padStart(2,'0')+'.png')});
    // Never force cooldowns; nine different authentic skill slots are used once each.
  }
  // Extra art-only test matrix: 9 approved skills x 4 directions x five
  // storyboard phases. Does not send any extra combat or cooldown commands.
  const matrix=await page.evaluate(async()=>{
    const H=window.HL,F=window.HLFighterRealVFX;
    const fx=F.create({quality:'low',mobile:true});
    fx.prepareAtlas(H.sprUrl('skfx_fighter.webp'),H.sprUrl('skfxud_fighter.webp'));
    await new Promise((resolve,reject)=>{
      const start=Date.now();
      const poll=()=>{
        if(fx.approvedSideReady&&fx.approvedDownUpReady&&fx.directionalColorReady)return resolve();
        if(Date.now()-start>12000)return reject(new Error('approved Fighter atlas image load timeout'));
        setTimeout(poll,50);
      };
      poll();
    });
    const canvas=document.createElement('canvas');canvas.width=520;canvas.height=520;
    const ctx=canvas.getContext('2d',{alpha:true});
    const failures=[];let checked=0,stages=0;
    for(const dir of ['S','N','W','E'])for(const s of F.SKILLS){
      const cast={t:.02,done:false},expected=dir==='N'||dir==='S'?'approved-updown':'approved-side';
      fx.start({slot:s.slot,cast,x:220,y:270,dir,poseT:.6});
      for(const [t,done,expectedFrame,repeat] of [
        [.03,false,0,1],[.18,false,1,1],[.42,false,2,1],
        [.43,true,3,1],[.43,true,4,8]
      ]){
        cast.t=t;cast.done=done;
        for(let i=0;i<repeat;i++)fx.draw(ctx,.07);
        const frame=fx.lastFrame;
        if(frame?.slot!==s.slot||frame?.dir!==dir||frame?.source!==expected||frame?.frame!==expectedFrame)
          failures.push(s.slot+':'+dir+':expected'+expectedFrame+':actual'+JSON.stringify(frame));
        stages++;
      }
      checked++;fx.clear();
    }
    return {checked,stages,failures,cache:fx.directionalTintCacheCount,
      cacheLimit:fx.directionalTintCacheLimit,tintedFrames:fx.tintedFrameCount,
      pixelsPerTintedCell:fx.directionalTintFramePixels};
  });
  check('36 Fighter skill-direction combinations render approved storyboard frames',
    matrix.checked===36&&matrix.stages===180&&matrix.failures.length===0);
  if(matrix.failures.length)console.error('FRAME_MATRIX_ERRORS',matrix.failures.slice(0,15));
  check('mobile recolor cache stays bounded to small 300x300 cells',
    matrix.cache<=6&&matrix.cacheLimit===6&&matrix.pixelsPerTintedCell===90000&&matrix.tintedFrames>0);
  check('real game preview uses bounded directional recolor cache',
    await page.evaluate(()=>window.HLGrandStage.fighterTintCacheCount<=
      window.HLGrandStage.fighterTintCacheLimit));
    check('no JavaScript exceptions while using nine active skills',errors.length===0);
  await context.close();
  console.log('RESULT: all 9 martial effects on existing approved fighter body triggered by real releases ('+browserType+', isolated)');
 }finally{
  if(browser)await browser.close();
  await srv.close();
  fs.rmSync(tmp,{recursive:true,force:true});
 }
})().catch(e=>{console.error('FAIL real fighter VFX',e);process.exitCode=1});

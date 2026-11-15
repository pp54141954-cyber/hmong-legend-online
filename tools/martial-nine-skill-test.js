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
const check=(name,condition)=>{assert.ok(condition,name);console.log('PASS '+name);};
(async()=>{
 const rows=SKILL_TABLE.filter(r=>r[0]==='นักสู้'&&r[3]==='a'&&r[2]!=='ท่าพื้นฐาน');
 check('exactly 9 non-default martial active skills plus two original starter skills',rows.length===11&&M.SKILLS.length===9);
 for(const def of M.SKILLS){
  const table=rows[def.slot-1],mechanic=CFG.classSkills['นักสู้'][def.slot-3];
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
  await page.goto('http://127.0.0.1:'+port+'/?splash=0&grandvfx=1',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.HLGrandStage?.enabled&&window.HL?.useSkill,null,{timeout:20000});
  await page.waitForSelector('#net:not([hidden])',{timeout:22000});
  await page.fill('#netn',user);await page.fill('#netp','testpass123');await page.click('#netlogin');
  await page.waitForFunction(()=>window.HLNET?.joined&&window.HL.curCls()==='นักสู้',null,{timeout:18000});
  await page.waitForFunction(()=>window.HL.PS.job>=30&&window.HLNET?.sk?.['สัญชาตญาณดุร้าย']>0,null,{timeout:10000});
  check('real isolated account has martial class and unlocked skills',true);
  check('all nine skill profile signatures agree with runtime',await page.evaluate(()=>{
    const H=window.HL,M=window.HLMartialVFX;
    return M.SKILLS.every(s=>M.profileFor(H,s.slot)?.name===s.name);
  }));
  const out=path.join(__dirname,'test-artifacts');fs.mkdirSync(out,{recursive:true});
  for(const spec of M.SKILLS){
    await page.waitForFunction(()=>!window.HL.PS.cast,null,{timeout:11000});
    const returned=await page.evaluate(slot=>window.HL.useSkill(slot),spec.slot);
    check('real useSkill('+spec.slot+') accepts '+spec.name,returned==='ok');
    await page.waitForFunction(v=>window.HLGrandStage.martialEvents.some(e=>e.slot===v.slot&&e.name===v.name),
      {slot:spec.slot,name:spec.name},{timeout:12000});
    const recent=await page.evaluate(slot=>{
      const H=window.HLGrandStage,matched=H.martialEvents.filter(e=>e.slot===slot);
      return {event:matched.at(-1),visible:H.martialCount>0,errors:!!window.HL?.player};
    },spec.slot);
    check('skill '+spec.slot+' renders its OWN correct type',recent.event?.kind===spec.kind&&recent.visible);
    // Screenshots are captured during the active effect, not after expiry.
    await page.screenshot({path:path.join(out,'martial-'+browserType+'-'+String(spec.slot).padStart(2,'0')+'.png')});
    // Never force cooldowns; nine different authentic skill slots are used once each.
  }
  check('no JavaScript exceptions while using nine active skills',errors.length===0);
  await context.close();
  console.log('RESULT: all 9 martial skills emitted by real in-game release events ('+browserType+', isolated)');
 }finally{
  if(browser)await browser.close();
  await srv.close();
  fs.rmSync(tmp,{recursive:true,force:true});
 }
})().catch(e=>{console.error('FAIL nine martial VFX',e);process.exitCode=1});

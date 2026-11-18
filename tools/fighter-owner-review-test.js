// Offline owner review: approved male+female Fighter sprites and real 9-skill atlas.
// Browser emulation only; the user's physical handset still needs manual review.
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {chromium,webkit,devices}=require('playwright');
const ok=(name,value)=>{assert.ok(value,name);console.log('PASS '+name);};
(async()=>{
 const engine=process.env.REVIEW_BROWSER==='webkit'?webkit:chromium;
 const engineName=process.env.REVIEW_BROWSER==='webkit'?'webkit':'chromium';
 const file=path.resolve(__dirname,'../dist/Hmong_Legend_Fighter_9_Skills_Approved_Character_Review.html');
 const html=fs.readFileSync(file,'utf8');
 ok('review file is fully self-contained',!/<script\b[^>]*src\s*=/i.test(html)
  &&html.includes('data:image/webp;base64,'));
 const browser=await engine.launch();
 try{
  const context=await browser.newContext({...devices[engineName==='webkit'?'iPhone 13':'Pixel 7']});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE_ERROR',e.message)});
  await page.goto('file://'+file,{waitUntil:'load'});
  await page.waitForFunction(()=>window.HLFighterOwnerReview?.ready&&window.HLFighterOwnerReview?.spriteReady,null,{timeout:20000});
  ok('actual game male and female fighter sprites load offline',
     await page.evaluate(()=>Object.entries(window.HLFighterReviewAssets).length===7));
  const specs=await page.evaluate(()=>window.HLFighterRealVFX.SKILLS);
  ok('nine approved Fighter skill names come from original module',specs.length===9);
  let combos=0,wrong=[];
  for(const gender of ['m','f']){
    await page.locator('[data-gender="'+gender+'"]').click();
    for(const dir of ['S','N','W','E']){
      await page.locator('[data-dir="'+dir+'"]').click();
      for(const s of specs){
        await page.evaluate(slot=>window.HLFighterOwnerReview.play(slot),s.slot);
        await page.waitForFunction(v=>window.HLFighterOwnerReview.lastFrame?.slot===v.slot
           &&window.HLFighterOwnerReview.lastFrame?.dir===v.dir,
          {slot:s.slot,dir},{timeout:3500});
        const info=await page.evaluate(()=>({
          dir:window.HLFighterOwnerReview.dir,gender:window.HLFighterOwnerReview.gender,
          frame:window.HLFighterOwnerReview.lastFrame,cache:window.HLFighterOwnerReview.cacheCount
        }));
        if(info.dir!==dir||info.gender!==gender||info.frame.source!==
          (dir==='N'||dir==='S'?'approved-updown':'approved-side')||info.cache>6)
          wrong.push({slot:s.slot,dir,gender,info});
        combos++;
      }
    }
    const dst=path.resolve(__dirname,'test-artifacts');
    fs.mkdirSync(dst,{recursive:true});
    await page.screenshot({path:path.join(dst,'owner-review-'+engineName+'-'+gender+'.png')});
  }
  if(wrong.length)console.error('COMBO_ERRORS',JSON.stringify(wrong.slice(0,6)));
  ok('72 male/female skill-direction combinations render approved art',combos===72&&wrong.length===0);
  await page.locator('#quality').selectOption('high');
  await page.waitForFunction(()=>window.HLFighterOwnerReview.ready,null,{timeout:20000});
  ok('high-quality effects can be selected',await page.evaluate(()=>window.HLFighterOwnerReview.ready));
  await page.locator('#quality').selectOption('low');
  await page.waitForFunction(()=>window.HLFighterOwnerReview.ready,null,{timeout:20000});
  ok('low-quality effects can be selected',await page.evaluate(()=>window.HLFighterOwnerReview.ready));
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  ok('phone viewport does not overflow horizontally',overflow<=2);
  ok('no browser JavaScript exceptions',errors.length===0);
  await context.close();
  console.log('RESULT: standalone approved Fighter visual reviewer PASS 72 combinations ('+engineName+' mobile emulation)');
 }finally{await browser.close()}
})().catch(e=>{console.error('FAIL FIGHTER OWNER REVIEW',e);process.exitCode=1});

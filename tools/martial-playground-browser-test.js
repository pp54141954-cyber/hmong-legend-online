// Automated cross-browser proof for the offline martial 9-skill visual tester.
// Uses existing source-of-truth CFG and the exact HLMartialVFX renderer.
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {chromium,webkit,devices}=require('playwright');
const {CFG,SKILL_TABLE}=require('../shared/world');
const M=require('../game/martial-vfx');
let passed=0;
function ok(name,v){assert.ok(v,name);passed++;console.log('PASS '+name);}
async function run(){
 const browserName=process.env.PLAYGROUND_BROWSER==='webkit'?'webkit':'chromium';
 const browser=await (browserName==='webkit'?webkit:chromium).launch();
 try{
  const context=await browser.newContext({...devices[browserName==='webkit'?'iPhone 13':'Pixel 7']});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',err=>errors.push(err.message));
  const file=path.resolve(__dirname,'../dist/Hmong_Legend_Martial_9_Skills_Test.html');
  ok('single-file standalone offline HTML exists',fs.existsSync(file));
  await page.goto('file://'+file,{waitUntil:'load'});
  await page.waitForFunction(()=>!!window.HLMartialPlayground&&!!window.HLMartialVFX,{timeout:15000});
  ok('original martial VFX runtime loaded offline',await page.evaluate(()=>
   HLMartialVFX.SKILLS.length===9&&HLMartialPlayground.skills.length===9));
  const source=SKILL_TABLE.filter(row=>row[0]==='นักสู้'&&row[3]==='a'&&row[2]!=='ท่าพื้นฐาน');
  ok('official skill table has starter two and 9 martial skills',source.length===11);
  const slots=await page.evaluate(()=>HLMartialPlayground.skills.map(s=>({
   slot:s.slot,name:s.name,path:s.path,shape:s.shape,art:s.art,fxk:s.fxk
  })));
  for(const entry of slots){
   const index=entry.slot-3,s=CFG.classSkills['นักสู้'][index],row=source[entry.slot-1];
   ok('name and mechanics match official game for slot '+entry.slot,
     row[2]===entry.name&&row[1]===entry.path&&s.shape===entry.shape&&
     (!entry.art||s.art===entry.art)&&(!entry.fxk||s.fxk===entry.fxk));
  }
  const uiCd=await page.evaluate(()=>HLMartialPlayground.metrics.map(x=>x.cd));
  ok('original cooldown times preserved as visual metadata',uiCd.every((v,i)=>v===CFG.classSkills['นักสู้'][i].cd));
  ok('mobile skill tabs display 3 skills',await page.locator('.skills .skill').count()===3);
  for(let i=0;i<slots.length;i++){
   const slot=slots[i].slot,group=Math.floor(i/3);
   await page.locator('.path[data-group="'+group+'"]').click();
   const target=page.locator('.skill[data-slot="'+slot+'"]');
   await target.click();
   ok('tap skill '+slot+' selects approved '+slots[i].name,
     await page.evaluate(v=>HLMartialPlayground.selected===v,slot));
   ok('tap skill '+slot+' triggers original VFX instance',
     await page.evaluate(()=>HLMartialPlayground.count>0));
   await page.waitForTimeout(80);
   const out=path.resolve(__dirname,'../dist/screenshots');
   fs.mkdirSync(out,{recursive:true});
   await page.screenshot({path:path.join(out,browserName+'-skill-'+String(slot).padStart(2,'0')+'.png')});
  }
  await page.locator('.dir[data-dir="N"]').click();
  await page.locator('#replay').click();
  ok('direction switch and replay work without server',await page.evaluate(()=>HLMartialPlayground.count>0));
  await page.locator('#quality').selectOption('low');
  ok('mobile low-quality mode available',await page.evaluate(()=>HLMartialPlayground.quality==='low'));
  await page.locator('#quality').selectOption('high');
  ok('high-quality mode available',await page.evaluate(()=>HLMartialPlayground.quality==='high'));
  await page.locator('#arena').click({position:{x:100,y:90}});
  ok('touch canvas target placement does not throw errors',errors.length===0);
  await page.locator('#move').click();
  ok('reset and replay work',await page.evaluate(()=>HLMartialPlayground.count>0));
  const widths=await page.evaluate(()=>{
   const rect=document.querySelector('.wrapper').getBoundingClientRect();
   return {viewport:window.innerWidth,bodyWidth:document.documentElement.scrollWidth,wrapper:rect.width};
  });
  ok('mobile tester has no horizontal overflow',widths.bodyWidth<=widths.viewport+2);
  ok('no uncaught JavaScript exceptions',errors.length===0);
  await context.close();
  console.log('RESULT '+passed+'/'+passed+' PASS ('+browserName+' phone emulation; visual only)');
 }finally{await browser.close();}
}
run().catch(e=>{console.error('FAIL PLAYGROUND',e);process.exitCode=1;});

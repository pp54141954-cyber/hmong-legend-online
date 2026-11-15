// R83: client-only visual/audio settings. Run with Playwright Chromium or WebKit.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { chromium, webkit, devices } = require('playwright');
const { createServer } = require('../server/server.js');
const safari = process.env.MOBILE_BROWSER === 'webkit';
const device = safari ? 'iPhone 13' : 'Pixel 7';
const engine = safari ? webkit : chromium;
(async()=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'hl-view-r83-'));
  const server=createServer({dbFile:path.join(tmp,'world.db'),quiet:true,startZone:'village2'});
  let browser,page;
  const errors=[];
  try{
    const port=await server.listen(0);
    browser=await engine.launch();
    page=await browser.newPage({...devices[device]});
    page.on('pageerror',err=>errors.push(err.message));
    const url='http://127.0.0.1:'+port+'/?splash=0';
    await page.goto(url);
    await page.waitForFunction(()=>!!window.HL&&!!window.SND&&!!window.HL_VIEW_CFG,null,{timeout:15000});
    await page.click('#gear');
    await page.click('#viewprefs-btn');
    await page.waitForSelector('#viewprefs:not([hidden])');
    const toggles=page.locator('#viewprefs [role="switch"]');
    assert.equal(await toggles.count(),4,'visual/audio switches count');
    for(const key of ['grandFx','numbers','shake','sound'])
      assert.equal(await page.locator('#viewprefs [data-pref="'+key+'"]').getAttribute('aria-checked'),'true','default '+key);
    await page.click('#viewprefs [data-pref="grandFx"]');
    await page.click('#viewprefs [data-pref="numbers"]');
    await page.click('#viewprefs [data-pref="shake"]');
    await page.click('#viewprefs [data-pref="sound"]');
    let state=await page.evaluate(()=>({
      cfg:{...window.HL_VIEW_CFG},sound:window.SND.st.mute,
      saved:JSON.parse(localStorage.getItem('hl_view_v1')),
      soundSaved:JSON.parse(localStorage.getItem('hl_snd')).mute
    }));
    for(const k of ['grandFx','numbers','shake']){
      assert.equal(state.cfg[k],false,'failed to disable '+k);
      assert.equal(state.saved[k],false,'failed to persist '+k);
    }
    assert.equal(state.sound,true,'audio should be muted');
    assert.equal(state.soundSaved,true,'audio mute not persisted');
    await page.locator('#viewprefs').screenshot({path:path.join(tmp,'preferences.png')});
    await page.reload();
    await page.waitForFunction(()=>!!window.HL&&!!window.SND&&!!window.HL_VIEW_CFG,null,{timeout:15000});
    state=await page.evaluate(()=>({...window.HL_VIEW_CFG,soundMuted:window.SND.st.mute}));
    assert.deepEqual(state,{grandFx:false,numbers:false,shake:false,soundMuted:true},'preferences lost on reload');
    await page.click('#gear');await page.click('#viewprefs-btn');
    const checks=await page.locator('#viewprefs [role="switch"]').evaluateAll(nodes=>nodes.map(el=>[el.dataset.pref,el.getAttribute('aria-checked')]));
    assert(checks.every(([k,v])=>v==='false'),'UI toggle values not synchronized: '+JSON.stringify(checks));
    await page.click('#viewprefs .view-reset');
    const after=await page.evaluate(()=>({...window.HL_VIEW_CFG,soundMuted:window.SND.st.mute}));
    assert.deepEqual(after,{grandFx:true,numbers:true,shake:true,soundMuted:true},'display reset altered audio or did not reset visuals');
    await page.click('#viewprefs [data-pref="sound"]');
    await page.click('#viewprefs .x');
    assert(await page.locator('#viewprefs').isHidden(),'close button not working');
    assert.deepEqual(errors,[],'browser JavaScript exceptions: '+errors.join('; '));
    const dir=path.join(__dirname,'test-artifacts');fs.mkdirSync(dir,{recursive:true});
    fs.copyFileSync(path.join(tmp,'preferences.png'),path.join(dir,safari?'settings-r83-iphone-webkit.png':'settings-r83-android-chromium.png'));
    console.log('PASS '+device+' ('+(safari?'WebKit':'Chromium')+'): switches persist/reload, reset preserves audio, no JS errors');
  }catch(e){
    if(page){
      console.error('R83 diagnostics:',JSON.stringify({errors,info:await page.evaluate(()=>({state:window.HLNET?.state,view:window.HL_VIEW_CFG,settings:document.getElementById('viewprefs')?.hidden})).catch(()=>null)}));
      const dir=path.join(__dirname,'test-artifacts');fs.mkdirSync(dir,{recursive:true});
      await page.screenshot({path:path.join(dir,safari?'settings-r83-iphone-fail.png':'settings-r83-android-fail.png')}).catch(()=>{});
    }
    throw e;
  }finally{if(browser)await browser.close();await server.close();fs.rmSync(tmp,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exitCode=1});

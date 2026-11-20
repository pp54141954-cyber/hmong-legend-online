'use strict';
// R85 release gate: exercise the REAL splash -> login -> WebSocket path.
// Never connects to Render. Uses disposable SQLite accounts and local server.
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {chromium,webkit,devices}=require('playwright');
const {createServer}=require('../server/server.js');
const {ZONES}=require('../shared/world.js');
const ios=process.env.MOBILE_BROWSER==='webkit';
(async()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'hl-r85-splash-'));
  const server=createServer({dbFile:path.join(temp,'world.db'),quiet:true,startZone:'village2'});
  let browser,context,page;
  const errors=[];
  try{
    const name='R85SplashTest',password='secret123';
    const start=ZONES.village2.start;
    const registration=server.db.register(name,password,{zone:'village2',x:start[0],y:start[1]});
    assert(registration.id,'fixture registration failed');
    const c=server.db.character(registration.id);
    c.cls='นักดาบ';c.clsset=1;c.starter=1;server.db.save(c);
    const port=await server.listen(0);
    browser=await (ios?webkit:chromium).launch();
    context=await browser.newContext({...devices[ios?'iPhone 13':'Pixel 7']});
    page=await context.newPage();
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:'+port+'/?splash=1',{waitUntil:'domcontentloaded'});
    await page.waitForSelector('#splash:not([hidden])',{timeout:12000});
    await page.waitForSelector('#splgo:not([hidden])',{timeout:35000});
    assert.equal(await page.locator('#net').isVisible(),false,'login visible behind active splash');
    assert(await page.evaluate(()=>window.SND?.splash?.done===true),'splash did not complete asset loading');
    // The animated entry button must keep its actual hitbox stationary: otherwise
    // Playwright's tap/click waits forever and players can miss the moving target.
    const hitbox=await page.evaluate(async()=>{
      const button=document.getElementById('splgo');
      const rect=()=>{const r=button.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}};
      const before=rect();
      await new Promise(resolve=>setTimeout(resolve,360));
      const after=rect();
      return {before,after};
    });
    for(const k of ['x','y','width','height']){
      assert(Math.abs(hitbox.before[k]-hitbox.after[k])<.5,
        'splash entry button hitbox moved while animating: '+JSON.stringify(hitbox));
    }
    await page.locator('#splgo').click({timeout:10000});
    await page.waitForSelector('#net:not([hidden])',{timeout:15000});
    assert.deepEqual(errors,[],'splash startup errors: '+errors.join(' | '));
    await page.locator('#netn').fill(name);
    await page.locator('#netp').fill(password);
    await page.locator('#netlogin').click();
    await page.waitForFunction(()=>window.HLNET?.auth===true&&window.HLNET?.joined===true,
      null,{timeout:15000});
    assert.deepEqual(errors,[],'login errors: '+errors.join(' | '));
    assert(await page.evaluate(()=>!!window.HL?.inputDir),'game input unavailable after splash/login');
    console.log('PASS R85 splash->login '+(ios?'iPhone WebKit':'Android Chromium')+
      ': real splash completed, login visible after splash, WebSocket joined, no page errors');
  }catch(e){
    if(page)console.error('R85 splash diagnostics:',JSON.stringify({
      errors,state:await page.evaluate(()=>({
        splash:window.SND?.splash,loginHidden:document.getElementById('net')?.hidden,
        loggedIn:window.HLNET?.auth,joined:window.HLNET?.joined
      })).catch(()=>null)
    }));
    throw e;
  }finally{
    if(context)await context.close().catch(()=>{});
    if(browser)await browser.close().catch(()=>{});
    await server.close();
    fs.rmSync(temp,{recursive:true,force:true});
  }
})().catch(e=>{console.error('FAIL R85 splash-login:',e);process.exitCode=1});

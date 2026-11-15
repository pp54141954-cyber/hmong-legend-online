'use strict';
// R85 mobile control regression. Uses real Playwright pointer input; HL exposes readonly input state.
const assert = require('node:assert/strict');
const fs=require('node:fs'), os=require('node:os'), path=require('node:path');
const {chromium,webkit,devices}=require('playwright');
const {createServer}=require('../server/server.js');
const {ZONES}=require('../shared/world.js');
const ios=process.env.MOBILE_BROWSER==='webkit';
(async()=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'hl-r85-'));
  const server=createServer({dbFile:path.join(tmp,'world.db'),quiet:true,startZone:'village2'});
  let browser,page;const errors=[];
  const read=async()=>page.evaluate(()=>({active:!!window.HL.joy,id:window.HL.joy?.id,dir:window.HL.inputDir(),attack:window.HL.attackHeld}));
  try{
    const start=ZONES.village2.start;
    const reg=server.db.register('JoyTester','secret123',{zone:'village2',x:start[0],y:start[1]});
    assert(reg.id,'fixture registration failed');
    const character=server.db.character(reg.id);
    character.cls='นักดาบ';character.clsset=1;character.starter=1;server.db.save(character);
    const port=await server.listen(0);
    browser=await (ios?webkit:chromium).launch();
    page=await browser.newPage({...devices[ios?'iPhone 13':'Pixel 7']});
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:'+port+'/?splash=0');
    await page.waitForSelector('#net:not([hidden])',{timeout:15000});
    await page.fill('#netn','JoyTester');await page.fill('#netp','secret123');await page.click('#netlogin');
    await page.waitForFunction(()=>window.HLNET?.auth&&window.HLNET?.joined&&typeof window.HL?.inputDir==='function',null,{timeout:15000});
    const bounds=await page.locator('#c').boundingBox();
    assert(bounds&&bounds.width>100&&bounds.height>100,'canvas missing');
    const x=bounds.x+bounds.width*.17,y=bounds.y+bounds.height*.60;

    // Playwright mouse emits real browser pointer events, including valid pointer capture.
    await page.mouse.move(x,y);await page.mouse.down();
    let state=await read();
    assert.equal(state.active,true,'pointerdown did not acquire joystick: '+JSON.stringify(state));
    const id=state.id;
    // A second finger must not move or release the pointer owned by the joystick.
    const beforeOtherPointer=await read();
    await page.evaluate(({id,x,y})=>{
      const c=document.getElementById('c');
      c.dispatchEvent(new PointerEvent('pointermove',{pointerId:id+500,pointerType:'touch',clientX:x-90,clientY:y,bubbles:true}));
      c.dispatchEvent(new PointerEvent('pointerup',{pointerId:id+500,pointerType:'touch',bubbles:true}));
    },{id,x,y});
    state=await read();
    assert.equal(state.id,id,'unrelated finger stole joystick ownership');
    assert.equal(state.active,true,'unrelated pointerup stopped joystick');
    assert.deepEqual(state.dir,beforeOtherPointer.dir,'unrelated finger moved joystick');

    await page.mouse.move(x+80,y,{steps:5});
    state=await read();
    assert(state.dir[0]>.4,'drag did not produce right movement: '+JSON.stringify(state));

    // Cancel the already captured pointer, then release physical mouse button.
    await page.evaluate(id=>document.querySelector('#c').dispatchEvent(new PointerEvent('pointercancel',{pointerId:id,bubbles:true})),id);
    state=await read();
    assert.equal(state.active,false,'pointercancel left joystick held');
    assert.equal(state.dir[0],0,'pointercancel left horizontal movement');
    await page.mouse.up();

    await page.mouse.move(x,y);await page.mouse.down();
    assert.equal((await read()).active,true,'second pointerdown did not acquire joystick');
    await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
    state=await read();
    assert.equal(state.active,false,'window blur left joystick held');
    assert.equal(state.dir[0],0,'window blur left movement active');
    await page.mouse.up();

    await page.keyboard.down('w');
    assert((await read()).dir[1]<0,'keyboard movement not recognized');
    await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
    assert.equal((await read()).dir[1],0,'blur did not release keyboard movement');
    await page.keyboard.up('w');

    // Attack has its own pointer owner. Neither a different finger nor a keyboard
    // keyup should cancel the active touch hold.
    const attack=await page.locator('#atk').boundingBox();
    assert(attack,'attack button missing');
    await page.evaluate(()=>document.getElementById('atk').addEventListener('pointerdown',e=>{window.__r85AtkPointer=e.pointerId},{once:true}));
    await page.mouse.move(attack.x+attack.width/2,attack.y+attack.height/2);await page.mouse.down();
    assert.equal((await read()).attack,true,'held attack did not engage');
    const attackId=await page.evaluate(()=>window.__r85AtkPointer);
    assert(Number.isInteger(attackId),'attack pointer owner not recorded');
    await page.evaluate(id=>document.getElementById('atk').dispatchEvent(
      new PointerEvent('pointerup',{pointerId:id+500,pointerType:'touch',bubbles:true})
    ),attackId);
    assert.equal((await read()).attack,true,'unrelated pointerup released attack');
    await page.keyboard.down('j');
    await page.mouse.up();
    assert.equal((await read()).attack,true,'releasing touch cancelled keyboard hold');
    await page.keyboard.up('j');
    assert.equal((await read()).attack,false,'keyboard attack remained held after keyup');

    // Pointer cancellation and focus loss must also stop attacks.
    await page.mouse.down();
    assert.equal((await read()).attack,true,'attack did not restart');
    await page.evaluate(id=>document.getElementById('atk').dispatchEvent(
      new PointerEvent('pointercancel',{pointerId:id,bubbles:true})
    ),attackId);
    assert.equal((await read()).attack,false,'pointercancel left attack held');
    await page.mouse.up();

    await page.mouse.down();
    assert.equal((await read()).attack,true,'held attack did not engage after cancel');
    await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
    assert.equal((await read()).attack,false,'blur left held attack active');
    await page.mouse.up();

    await page.mouse.move(x,y);await page.mouse.down();
    state=await read();
    assert.equal(state.active,true,'third joystick pointerdown failed');
    await page.evaluate(id=>document.querySelector('#c').dispatchEvent(new PointerEvent('lostpointercapture',{pointerId:id,bubbles:true})),state.id);
    assert.equal((await read()).active,false,'lostpointercapture left joystick held');
    await page.mouse.up();

    // Simulate the app being hidden while moving; release all held inputs.
    await page.mouse.move(x,y);await page.mouse.down();
    assert.equal((await read()).active,true,'joystick failed before app-hide test');
    await page.evaluate(()=>{
      Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});
      document.dispatchEvent(new Event('visibilitychange'));
      delete document.hidden;
    });
    state=await read();
    assert.equal(state.active,false,'hidden app left joystick held');
    assert.deepEqual(state.dir,[0,0],'hidden app left movement active');
    await page.mouse.up();


    // R85 tap-to-move: use an actual valid path tile, not a fake unlocked map.
    await page.waitForFunction(()=>!window.HL.PS.cast,null,{timeout:10000});
    const chooseGoal=async()=>page.evaluate(()=>{
      const H=window.HL,p=H.player,step=H.T;
      const candidates=[];
      for(const r of [3,4,5,6,2,7,8])for(const [dx,dy] of [[1,0],[0,1],[-1,0],[0,-1],[1,1],[-1,1]])
        candidates.push({x:p.x+dx*r*step,y:p.y+dy*r*step});
      for(const c of candidates){
        if(c.x<16||c.y<16||c.x>H.COLS*step-16||c.y>H.ROWS*step-16||H.boxBlocked(c.x,c.y))continue;
        if(H.tapNavigate(c.x,c.y))return c;
      }
      return null;
    });
    const dest=await chooseGoal();
    assert(dest,'No reachable test destination found within the same zone');
    assert(await page.evaluate(()=>!!window.HL.tapDestination),'destination not installed');
    const from=await page.evaluate(()=>({x:window.HL.player.x,y:window.HL.player.y}));
    await page.waitForTimeout(350);
    const after=await page.evaluate(()=>({x:window.HL.player.x,y:window.HL.player.y}));
    assert(Math.hypot(after.x-from.x,after.y-from.y)>.3,'tap navigation did not move player');

    // Manual joystick input has precedence over a marked route.
    if(!await page.evaluate(()=>!!window.HL.tapDestination))await chooseGoal();
    await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+78,y,{steps:5});
    assert.equal(await page.evaluate(()=>window.HL.tapDestination),null,'manual joystick did not cancel tap route');
    await page.mouse.up();

    // A blocked map tile must never be accepted as a destination.
    const blocked=await page.evaluate(()=>{
      const H=window.HL;
      for(let y=2;y<H.ROWS-2;y++)for(let x=2;x<H.COLS-2;x++)if(H.tileBlocked(x,y)){
        const wx=(x+.5)*H.T,wy=(y+.5)*H.T;
        if(H.tapNavigate(wx,wy))return 'accepted blocked tile '+x+','+y;
        return null;
      }
      return 'no blocked test tile found';
    });
    assert.equal(blocked,null,'blocked destination check failed: '+blocked);
    assert.equal(await page.evaluate(()=>window.HL.tapDestination),null,'blocked map tap left route active');

    await chooseGoal();
    assert(await page.evaluate(()=>!!window.HL.tapDestination),'tap destination missing before blur');
    await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
    assert.equal(await page.evaluate(()=>window.HL.tapDestination),null,'blur did not cancel tap navigation');

    assert.deepEqual(errors,[],'browser JavaScript errors: '+errors.join('; '));
    console.log('PASS R85 '+(ios?'iPhone WebKit':'Android Chromium')+': multi-pointer ownership, tap path, manual override, blocked destinations, app hide and keyboard hold');
  }catch(e){
    if(page)console.error('R85 diagnostics:',JSON.stringify({errors, state:await page.evaluate(()=>({auth:window.HLNET?.auth,joined:window.HLNET?.joined,joy:!!window.HL?.joy,net:document.getElementById('net')?.hidden})).catch(()=>null)}));
    throw e;
  }finally{
    if(browser)await browser.close();
    await server.close();fs.rmSync(tmp,{recursive:true,force:true});
  }
})().catch(e=>{console.error('FAIL R85 mobile controls:',e);process.exitCode=1});

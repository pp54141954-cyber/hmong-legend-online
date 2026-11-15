'use strict';
// R85: test joystick and held attack cancellation without relying on production network.
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {chromium,webkit,devices}=require('playwright');
const {createServer}=require('../server/server.js');
const ios=process.env.MOBILE_BROWSER==='webkit';
(async()=>{
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'hl-r85-'));
const srv=createServer({dbFile:path.join(temp,'game.db'),quiet:true,startZone:'village2'});
let browser;
try{
const port=await srv.listen(0);
browser=await (ios?webkit:chromium).launch();
const page=await browser.newPage({...devices[ios?'iPhone 13':'Pixel 7']});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:'+port+'/?splash=0');
await page.waitForFunction(()=>!!window.HL&&!!document.querySelector('#c'),null,{timeout:20000});
const canvas=page.locator('#c');const r=await canvas.boundingBox();assert(r&&r.width>100&&r.height>100);
const x=r.x+r.width*.17,y=r.y+r.height*.65;
await page.evaluate(({x,y})=>{
 const c=document.querySelector('#c');
 c.dispatchEvent(new PointerEvent('pointerdown',{pointerId:42,pointerType:'touch',clientX:x,clientY:y,bubbles:true,cancelable:true}));
}, {x,y});
let state=await page.evaluate(()=>({dir:inputDir(),active:!!joy,id:joy?.id}));
assert.equal(state.active,true,'joystick did not acquire pointer');
await page.evaluate(({x,y})=>{document.querySelector('#c').dispatchEvent(new PointerEvent('pointermove',{pointerId:42,pointerType:'touch',clientX:x+80,clientY:y,bubbles:true}))},{x,y});
state=await page.evaluate(()=>({dir:inputDir(),active:!!joy}));
assert(state.dir[0]>.4,'joystick did not produce rightward movement: '+JSON.stringify(state));
await page.evaluate(()=>document.querySelector('#c').dispatchEvent(new PointerEvent('pointercancel',{pointerId:42,pointerType:'touch',bubbles:true})));
state=await page.evaluate(()=>({dir:inputDir(),active:!!joy}));
assert.equal(state.active,false,'pointercancel left joystick stuck');
assert.equal(state.dir[0],0,'movement persisted after pointercancel');
await page.evaluate(({x,y})=>{document.querySelector('#c').dispatchEvent(new PointerEvent('pointerdown',{pointerId:43,pointerType:'touch',clientX:x,clientY:y,bubbles:true}))},{x,y});
await page.evaluate(()=>{window.dispatchEvent(new Event('blur'))});
state=await page.evaluate(()=>({dir:inputDir(),active:!!joy}));
assert.equal(state.active,false,'blur left joystick stuck');
assert.equal(state.dir[0],0,'blur left movement active');
await page.evaluate(()=>{keys.w=1;atkHeld=true;window.dispatchEvent(new Event('blur'))});
state=await page.evaluate(()=>({dir:inputDir(),attack:atkHeld,keyboard:keys.w}));
assert.equal(state.dir[1],0,'blur left keyboard movement active');
assert.equal(state.attack,false,'blur left attack held');
await page.evaluate(({x,y})=>{document.querySelector('#c').dispatchEvent(new PointerEvent('pointerdown',{pointerId:44,pointerType:'touch',clientX:x,clientY:y,bubbles:true}))},{x,y});
await page.evaluate(()=>document.querySelector('#c').dispatchEvent(new PointerEvent('lostpointercapture',{pointerId:44,bubbles:true})));
assert.equal(await page.evaluate(()=>!!joy),false,'lostpointercapture left joystick stuck');
assert.deepEqual(errors,[],'browser JS errors: '+errors.join('; '));
console.log('PASS R85 '+(ios?'iPhone WebKit':'Android Chromium')+' joystick drag, cancel, lost capture, blur, keyboard and attack release');
}finally{if(browser)await browser.close();await srv.close();fs.rmSync(temp,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exitCode=1});

// Regression for WebKit online-login race when inline audio script has not yet initialized.
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {before,after,apply}=require('./fix-snd-webkit-login');
const input=fs.readFileSync(path.join(__dirname,'..','game','index.html'),'utf8');
assert.ok(input.includes(after),'game source must contain patched callback');
assert.ok(!input.includes(before),'the old unsafe callback must be gone');
assert.equal(apply(input),input,'patch must be idempotent');
const execute=new Function('hello','NET','store','connect','window','document','$',after);
async function caseRun(name,{readyState='loading',sound=null,token=null}={},validate){
 const handlers={};
 const net={hidden:true};
 const doc={readyState,addEventListener:(type,fn,o)=>{handlers[type]=fn;assert.equal(o.once,true)}};
 const win={};if(sound!==null)win.SND=sound;
 const NET={state:''};const store={get:()=>token};
 let connected=0;
 execute(()=>Promise.resolve(true),NET,store,()=>connected++,win,doc,id=>{assert.equal(id,'net');return net;});
 await new Promise(resolve=>setImmediate(resolve));
 if(readyState==='loading'){assert.ok(handlers.DOMContentLoaded,'deferred callback required before audio initialization');handlers.DOMContentLoaded()}
 validate({net,NET,sound,connected});
 console.log('PASS '+name);
}
(async()=>{
 await caseRun('No SND: login becomes visible rather than ReferenceError',{sound:null},x=>assert.equal(x.net.hidden,false));
 await caseRun('Audio script ready + active splash: login is deferred',{sound:{splash:{shown:true,gone:false,loginPending:false}}},x=>{
  assert.equal(x.net.hidden,true);assert.equal(x.sound.splash.loginPending,true);
 });
 await caseRun('Completed splash: login appears',{sound:{splash:{shown:true,gone:true}}},x=>assert.equal(x.net.hidden,false));
 await caseRun('Sound not loaded yet + preexisting auth token: reconnect still runs',{token:'stored-token'},x=>{
  assert.equal(x.connected,1);assert.equal(x.net.hidden,true);
 });
 await caseRun('DOMContentLoaded already fired: login appears immediately',{readyState:'complete',sound:null},x=>assert.equal(x.net.hidden,false));
 console.log('RESULT 5/5 deterministic SND login race tests passed.');
})().catch(err=>{console.error('FAIL SND race regression',err);process.exitCode=1});

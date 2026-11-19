'use strict';
// Read-only release verifier. No login, no database writes, no deployment.
// Usage: node tools/r85-release-check.js https://your-staging-host.example
const assert=require('node:assert/strict');
const origin=process.argv[2]||'http://127.0.0.1:8080';
async function get(rel){
  const url=new URL(rel,origin);
  const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(15000)});
  const text=await response.text();
  return{response,text,url:url.toString()};
}
(async()=>{
  const root=new URL(origin);
  assert(['http:','https:'].includes(root.protocol),'Expected http(s) host');
  const fingerprint=await get('/api/build-info');
  assert.equal(fingerprint.response.status,200,'Missing R85 build fingerprint at '+fingerprint.url);
  const info=JSON.parse(fingerprint.text);
  assert.equal(info.build,'R85-V3-Calm','Different game version is deployed');
  const inputs=info.input||{};
  for(const key of ['floatingJoystick','sixRealSkillSlots','multiTouch','tapToMove','destinationRingOnly']){
    assert.equal(inputs[key],true,'Missing approved R85 feature '+key);
  }
  console.log('PASS R85 build fingerprint');
  const html=await get('/');
  assert.equal(html.response.status,200,'Game page not served');
  for(const marker of ['r85-calm-controls.css','id="r85target"','id="r85bugPanel"','id="r85dash"','id="skills"','id="atk"']){
    assert(html.text.includes(marker),'Game page missing R85 control '+marker);
  }
  console.log('PASS R85 game page controls');
  const css=await get('/r85-calm-controls.css');
  assert.equal(css.response.status,200,'R85 stylesheet not served');
  assert((css.response.headers.get('content-type')||'').includes('text/css'),'R85 stylesheet MIME mismatch');
  assert(css.text.includes('#r85target')&&css.text.includes('#skills'),'R85 stylesheet missing HUD selectors');
  console.log('PASS R85 Calm HUD stylesheet');
  console.log('R85 release content detected; still requires Android/iPhone touch and two-player gameplay verification.');
})().catch(e=>{console.error('FAIL / NOT YET DEPLOYED R85:',e.message);process.exitCode=1;});

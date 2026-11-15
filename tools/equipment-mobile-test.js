// Mobile inventory UI regression test. Run: node tools/equipment-mobile-test.js
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { chromium, devices } = require('playwright');
const { createServer } = require('../server/server.js');
(async () => {
 const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-equip-ui-'));
 const server = createServer({dbFile:path.join(tmp,'game.db'),quiet:true,startZone:'village'});
 let browser;
 try {
  const port = await server.listen(0);
  browser = await chromium.launch();
  const page = await browser.newPage({...devices['Pixel 7']});
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+port+'/');
  await page.waitForSelector('#net:not([hidden])');
  await page.fill('#netn','EquipUiTester');await page.fill('#netp','secret123');await page.click('#netreg');
  await page.waitForSelector('#cstart #nmin');await page.fill('#cstart #nmin','EquipUi');await page.click('#cstart #nmgo');
  await page.click('#cstart button[aria-label="อาชีพ ผู้พิทักษ์"]');
  await page.click('#cstart [data-g="m"]');await page.click('#csgo');
  await page.waitForSelector('#atgo');await page.click('#atgo');
  await page.waitForFunction(()=>{const e=document.getElementById('cstart');return e.hidden||getComputedStyle(e).display==='none'});
  await page.click('#bagb');
  await page.waitForSelector('#bag:not([hidden]) .eqs .it');
  const sizes=await page.evaluate(()=>{
   const bag=document.getElementById('bag'),eq=[...bag.querySelectorAll('.eqs .it')],items=[...bag.querySelectorAll('.bag-grid .it')];
   return {eqCount:eq.length,eqHeights:eq.map(e=>e.getBoundingClientRect().height),itemHeights:items.map(e=>e.getBoundingClientRect().height),offhand:!!bag.querySelector('[data-eq="offhand"]'),tabs:bag.querySelectorAll('.bag-tabs button').length,overflow:bag.scrollWidth>bag.clientWidth+2};
  });
  assert.equal(sizes.eqCount,4);assert(sizes.offhand);assert.equal(sizes.tabs,4);
  assert(sizes.eqHeights.every(h=>h<=77),'equipment cells too tall');
  assert(sizes.itemHeights.every(h=>h>=88),'backpack item cells shrank');
  assert(!sizes.overflow,'inventory has horizontal overflow');
  assert.deepEqual(errors,[],'browser JavaScript errors');
  console.log('PASS mobile inventory: compact equipment, original bag item sizing, tabs, no overflow');
 }finally{if(browser)await browser.close();await server.close();fs.rmSync(tmp,{recursive:true,force:true})}
})().catch(e=>{console.error('FAIL mobile inventory:',e);process.exitCode=1});

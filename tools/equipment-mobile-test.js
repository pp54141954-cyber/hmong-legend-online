// Mobile inventory regression: authenticated guardian fixture, not first-time class onboarding.
// Run: NODE_PATH=<playwright module directory> node tools/equipment-mobile-test.js
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { chromium, webkit, devices } = require('playwright');
const safariMode = process.env.MOBILE_BROWSER === 'webkit';
const engine = safariMode ? webkit : chromium;
const deviceName = safariMode ? 'iPhone 13' : 'Pixel 7';
const { createServer } = require('../server/server.js');
const { ZONES, CFG } = require('../shared/world.js');

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-equip-ui-'));
  const server = createServer({ dbFile: path.join(tmp, 'game.db'), quiet: true, startZone: 'village2' });
  let browser, page;
  try {
    const point = ZONES.village2.start;
    const registration = server.db.register('EquipUiTester', 'secret123', { zone: 'village2', x: point[0], y: point[1] });
    assert(registration.id, 'failed to seed account');
    const character = server.db.character(registration.id);
    character.cls = 'ผู้พิทักษ์';
    character.clsset = 1;
    character.starter = 1;
    character.eq = { weapon: 'sword_wood', offhand: 'shield_wood', armor: 'coat_cloth', acc: null };
    character.bag = [{ id: 'potion_s', n: 2 }, { id: 'sword_iron', n: 1 }, { id: 'hide', n: 3 }];
    server.db.save(character);

    const port = await server.listen(0);
    browser = await engine.launch();
    page = await browser.newPage({ ...devices[deviceName] });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://127.0.0.1:' + port + '/?splash=0');
    await page.waitForSelector('#net:not([hidden])', { timeout: 10000 });
    await page.fill('#netn', 'EquipUiTester');
    await page.fill('#netp', 'secret123');
    await page.click('#netlogin');
    await page.waitForFunction(() => window.HLNET && window.HLNET.auth && window.HLNET.joined, null, { timeout: 15000 });
    await page.click('#bagb');
    await page.waitForSelector('#bag:not([hidden]) .eqs .it', { timeout: 10000 });
    const sizes = await page.evaluate(() => {
      const bag = document.getElementById('bag');
      const eq = [...bag.querySelectorAll('.eqs .it')];
      const items = [...bag.querySelectorAll('.bag-grid .it')];
      return {
        eqCount: eq.length,
        eqHeights: eq.map(e => e.getBoundingClientRect().height),
        itemHeights: items.map(e => e.getBoundingClientRect().height),
        offhand: !!bag.querySelector('[data-eq="offhand"]'),
        tabs: bag.querySelectorAll('.bag-tabs button').length,
        overflow: bag.scrollWidth > bag.clientWidth + 2
      };
    });
    assert.equal(sizes.eqCount, 4, 'equipment slots count');
    assert(sizes.offhand, 'offhand slot missing');
    assert.equal(sizes.tabs, 4, 'inventory category tabs missing');
    assert(sizes.eqHeights.every(h => h <= 77), 'equipment slots too tall: ' + sizes.eqHeights);
    assert(sizes.itemHeights.length >= 3, 'fixture items missing');
    assert(sizes.itemHeights.every(h => h >= 88), 'backpack cells changed size: ' + sizes.itemHeights);
    assert(!sizes.overflow, 'inventory horizontal overflow');
    const picture = path.join(tmp, safariMode ? 'bag-iphone-webkit.png' : 'bag-android-chromium.png');
    await page.locator('#bag').screenshot({ path: picture });
    const screenshotFolder = path.join(__dirname, 'test-artifacts');
    fs.mkdirSync(screenshotFolder, { recursive: true });
    fs.copyFileSync(picture, path.join(screenshotFolder, path.basename(picture)));

    // Verify the original server-authoritative unequip flow reaches the UI.
    await page.click('#bag .eqs [data-eq="offhand"]');
    await page.waitForFunction(() => window.HLNET.eq && window.HLNET.eq.offhand === null, null, { timeout: 8000 });
    assert(await page.locator('#bag .bag-grid').innerText().then(t => t.includes(CFG.items.shield_wood.name)), 'shield not returned to bag');
    assert.deepEqual(errors, [], 'browser JS exceptions');
    console.log('PASS ' + deviceName + ' (' + (safariMode ? 'WebKit' : 'Chromium') + '): compact equipment / backpack sizing / shield unequip / no overflow');
  } catch (e) {
    if (page) {
      const state = await page.evaluate(() => ({
        started: window.HLNET?.joined, auth: window.HLNET?.auth,
        cstartHidden: document.getElementById('cstart')?.hidden,
        cstartText: document.getElementById('cstart')?.innerText?.slice(0, 180),
        bagHidden: document.getElementById('bag')?.hidden,
        netStatus: document.getElementById('netst')?.textContent?.slice(0, 180)
      })).catch(() => null);
      console.error('UI diagnostics:', JSON.stringify(state));
    }
    throw e;
  } finally {
    if (browser) await browser.close();
    await server.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
})().catch(e => { console.error('FAIL mobile inventory:', e); process.exitCode = 1; });
